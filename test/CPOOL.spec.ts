import { ethers, upgrades, network } from 'hardhat'
import { expect } from 'chai'
import { expectObject, mineBlock, signMessage, startMining, stopMining } from './shared/utils'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { CPOOL, LZEndpointMock } from '../typechain'

const { parseUnits } = ethers.utils
const { MaxUint256, AddressZero } = ethers.constants
const MaxUint96 = ethers.BigNumber.from('79228162514264337593543950335')

describe('CPOOL Test', function () {
  let cpoolSrc: CPOOL
  let cpoolDst: CPOOL
  let deployer: SignerWithAddress, adr1: SignerWithAddress, adr2: SignerWithAddress
  let chainId: number
  let lzEndpointSrcMock: LZEndpointMock, lzEndpointDstMock: LZEndpointMock

  const name = 'Clearpool'
  const symbol = 'CPOOL'
  const totalSupply = ethers.utils.parseUnits('1000000000', 18)
  const chainIdSrc = 1
  const chainIdDst = 2

  beforeEach(async function () {
    ;[deployer, adr1, adr2] = await ethers.getSigners()
    const CPOOLFactory = await ethers.getContractFactory('CPOOL')

    cpoolSrc = await CPOOLFactory.deploy(deployer.address)

    chainId = network.config.chainId!
  })

  describe('Deployment', function () {
    it('Should set the right name and symbol', async function () {
      expect(await cpoolSrc.name()).to.equal(name)
      expect(await cpoolSrc.symbol()).to.equal(symbol)
    })

    it('Should distribute the right amounts to the right addresses as init', async function () {
      expect(await cpoolSrc.balanceOf(deployer.address)).to.equal(totalSupply)
    })
  })

  describe('Token', function () {
    it('Correct allowance', async () => {
      expect(await cpoolSrc.allowance(deployer.address, adr1.address)).to.equal(0)

      await cpoolSrc.approve(adr1.address, 100)
      expect(await cpoolSrc.allowance(deployer.address, adr1.address)).to.equal(100)

      await cpoolSrc.approve(adr1.address, MaxUint256)
      expect(await cpoolSrc.allowance(deployer.address, adr1.address)).to.equal(MaxUint96)
    })

    it('Approving max and almost max', async () => {
      await expect(cpoolSrc.approve(adr1.address, MaxUint96.add(1))).to.be.revertedWith(
        'Cpool::approve: amount exceeds 96 bits',
      )
    })

    it('Nested delegation', async () => {
      await cpoolSrc.transfer(adr1.address, 1)
      await cpoolSrc.transfer(adr2.address, 2)

      let currentVotes0 = await cpoolSrc.getCurrentVotes(adr1.address)
      let currentVotes1 = await cpoolSrc.getCurrentVotes(adr2.address)
      expect(currentVotes0).to.be.eq(0)
      expect(currentVotes1).to.be.eq(0)

      await cpoolSrc.connect(adr1).delegate(adr2.address)
      currentVotes1 = await cpoolSrc.getCurrentVotes(adr2.address)
      expect(currentVotes1).to.be.eq(1)

      await cpoolSrc.connect(adr2).delegate(adr2.address)
      currentVotes1 = await cpoolSrc.getCurrentVotes(adr2.address)
      expect(currentVotes1).to.be.eq(3)

      await cpoolSrc.connect(adr2).delegate(adr1.address)
      currentVotes1 = await cpoolSrc.getCurrentVotes(adr2.address)
      expect(currentVotes1).to.be.eq(1)
    })
  })

  describe('Delegation by signature', () => {
    const Domain = (cpool: CPOOL) => ({
      name,
      chainId,
      verifyingContract: cpool.address,
    })
    const Types = {
      Delegation: [
        { name: 'delegatee', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'expiry', type: 'uint256' },
      ],
    }

    it('reverts if the signatory is invalid', async () => {
      const badBytes = '0x6c00000000000000000000000000000000000000000000000000000000000000'
      const delegatee = deployer,
        nonce = 0,
        expiry = 0
      await expect(
        cpoolSrc.delegateBySig(delegatee.address, nonce, expiry, 0, badBytes, badBytes),
      ).to.be.revertedWith('Cpool::delegateBySig: invalid signature')
    })

    it('reverts if the nonce is bad ', async () => {
      const delegatee = deployer,
        nonce = 1,
        expiry = 0
      const { v, r, s } = await signMessage(adr1, Domain(cpoolSrc), Types, {
        delegatee: delegatee.address,
        nonce: nonce,
        expiry: expiry,
      })

      await expect(
        cpoolSrc.delegateBySig(delegatee.address, nonce, expiry, v, r, s),
      ).to.be.revertedWith('Cpool::delegateBySig: invalid nonce')
    })

    it('reverts if the signature has expired', async () => {
      const delegatee = deployer,
        nonce = 0,
        expiry = 0
      const { v, r, s } = await signMessage(adr1, Domain(cpoolSrc), Types, {
        delegatee: delegatee.address,
        nonce: nonce,
        expiry: expiry,
      })

      await expect(
        cpoolSrc.delegateBySig(delegatee.address, nonce, expiry, v, r, s),
      ).to.be.revertedWith('Cpool::delegateBySig: signature expired')
    })

    it('delegates on behalf of the signatory', async () => {
      const delegatee = deployer,
        nonce = 0,
        expiry = 10e9
      const { v, r, s } = await signMessage(adr1, Domain(cpoolSrc), Types, {
        delegatee: delegatee.address,
        nonce: nonce,
        expiry: expiry,
      })

      expect(await cpoolSrc.delegates(adr1.address)).to.equal(AddressZero)

      const tx = await cpoolSrc.delegateBySig(delegatee.address, nonce, expiry, v, r, s)
      const receipt = await tx.wait()
      expect(receipt.gasUsed.toNumber()).lessThan(100000)
      expect(await cpoolSrc.delegates(adr1.address)).to.equal(deployer.address)
    })
  })

  describe('numCheckpoints', () => {
    it('returns the number of checkpoints for a delegate', async () => {
      let tx = await cpoolSrc.transfer(adr2.address, 100)
      await tx.wait()
      expect(await cpoolSrc.numCheckpoints(adr1.address)).to.equal(0)

      const t1 = await cpoolSrc.connect(adr2).delegate(adr1.address)
      const r1 = await t1.wait()
      expect(await cpoolSrc.numCheckpoints(adr1.address)).to.equal(1)

      const t2 = await cpoolSrc.transfer(adr2.address, 10)
      const r2 = await t2.wait()
      expect(await cpoolSrc.numCheckpoints(adr1.address)).to.equal(2)

      const t3 = await cpoolSrc.transfer(adr2.address, 10)
      const r3 = await t3.wait()
      expect(await cpoolSrc.numCheckpoints(adr1.address)).to.equal(3)

      const t4 = await cpoolSrc.connect(adr2).transfer(deployer.address, 20)
      const r4 = await t4.wait()
      expect(await cpoolSrc.numCheckpoints(adr1.address)).to.equal(4)

      expectObject(await cpoolSrc.checkpoints(adr1.address, 0), {
        fromBlock: r1.blockNumber,
        votes: 100,
      })
      expectObject(await cpoolSrc.checkpoints(adr1.address, 1), {
        fromBlock: r2.blockNumber,
        votes: 110,
      })
      expectObject(await cpoolSrc.checkpoints(adr1.address, 2), {
        fromBlock: r3.blockNumber,
        votes: 120,
      })
      expectObject(await cpoolSrc.checkpoints(adr1.address, 3), {
        fromBlock: r4.blockNumber,
        votes: 100,
      })
    })

    it('does not add more than one checkpoint in a block', async () => {
      await cpoolSrc.transfer(adr2.address, 100)
      expect(await cpoolSrc.numCheckpoints(adr1.address)).to.equal(0)

      await stopMining()

      const t1 = await cpoolSrc.connect(adr2).delegate(adr1.address)
      const t2 = await cpoolSrc.transfer(adr2.address, 10)
      const t3 = await cpoolSrc.transfer(adr2.address, 10)

      await startMining()

      const r1 = await t1.wait()
      await t2.wait()
      await t3.wait()

      expect(await cpoolSrc.numCheckpoints(adr1.address)).equal(1)

      expectObject(await cpoolSrc.checkpoints(adr1.address, 0), {
        fromBlock: r1.blockNumber,
        votes: 120,
      })
      expectObject(await cpoolSrc.checkpoints(adr1.address, 1), {
        fromBlock: 0,
        votes: 0,
      })
      expectObject(await cpoolSrc.checkpoints(adr1.address, 2), {
        fromBlock: 0,
        votes: 0,
      })

      const t4 = await cpoolSrc.transfer(adr2.address, 20)
      const r4 = await t4.wait()
      expect(await cpoolSrc.numCheckpoints(adr1.address)).to.equal(2)
      expectObject(await cpoolSrc.checkpoints(adr1.address, 1), {
        fromBlock: r4.blockNumber,
        votes: 140,
      })
    })
  })

  describe('getPriorVotes', () => {
    it('reverts if block number >= current block', async () => {
      await expect(cpoolSrc.getPriorVotes(adr1.address, 5e10)).to.be.revertedWith(
        'Cpool::getPriorVotes: not yet determined',
      )
    })

    it('returns 0 if there are no checkpoints', async () => {
      expect(await cpoolSrc.getPriorVotes(adr1.address, 0)).to.equal(0)
    })

    it('returns the latest block if >= last checkpoint block', async () => {
      const t1 = await (await cpoolSrc.connect(deployer).delegate(adr1.address)).wait()
      await mineBlock(2)

      expect(await cpoolSrc.getPriorVotes(adr1.address, t1.blockNumber)).to.equal(
        parseUnits('1000000000'),
      )
      expect(await cpoolSrc.getPriorVotes(adr1.address, t1.blockNumber + 1)).to.equal(
        parseUnits('1000000000'),
      )
    })

    it('returns zero if < first checkpoint block', async () => {
      const t1 = await (await cpoolSrc.connect(deployer).delegate(adr1.address)).wait()
      await mineBlock(2)

      expect(await cpoolSrc.getPriorVotes(adr1.address, t1.blockNumber - 1)).to.equal(0)
      expect(await cpoolSrc.getPriorVotes(adr1.address, t1.blockNumber + 1)).to.equal(
        parseUnits('1000000000'),
      )
    })

    it('generally returns the voting balance at the appropriate checkpoint', async () => {
      const t1 = await cpoolSrc.connect(adr2).delegate(adr1.address)
      const r1 = await t1.wait()
      await mineBlock(2)

      const t2 = await cpoolSrc.transfer(adr2.address, 10)
      const r2 = await t2.wait()
      await mineBlock(2)

      const t3 = await cpoolSrc.transfer(adr2.address, 10)
      const r3 = await t3.wait()
      await mineBlock(2)

      const t4 = await cpoolSrc.transfer(adr2.address, 10)
      const r4 = await t4.wait()
      await mineBlock(2)

      const t5 = await cpoolSrc.transfer(adr2.address, 10)
      const r5 = await t5.wait()
      await mineBlock(2)

      expect(await cpoolSrc.getPriorVotes(adr1.address, r1.blockNumber - 1)).to.equal(0)
      expect(await cpoolSrc.getPriorVotes(adr1.address, r1.blockNumber)).to.equal(0)
      expect(await cpoolSrc.getPriorVotes(adr1.address, r1.blockNumber + 1)).to.equal(0)

      expect(await cpoolSrc.getPriorVotes(adr1.address, r2.blockNumber)).to.equal(10)
      expect(await cpoolSrc.getPriorVotes(adr1.address, r3.blockNumber)).to.equal(20)
      expect(await cpoolSrc.getPriorVotes(adr1.address, r4.blockNumber)).to.equal(30)

      expect(await cpoolSrc.getPriorVotes(adr1.address, r5.blockNumber - 1)).to.equal(30)
      expect(await cpoolSrc.getPriorVotes(adr1.address, r5.blockNumber)).to.equal(40)
      expect(await cpoolSrc.getPriorVotes(adr1.address, r5.blockNumber + 1)).to.equal(40)
    })
  })
})
