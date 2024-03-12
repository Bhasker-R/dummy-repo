import { ethers, upgrades } from 'hardhat'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { CPOOL, MembershipStaking } from '../typechain'
import { mineBlock, startMining, stopMining } from './shared/utils'
import { ContractTransaction } from 'ethers'
import { ERRORS } from './shared/errors'

const { parseUnits } = ethers.utils

describe('Test Membership Staking', function () {
  let owner: SignerWithAddress, other: SignerWithAddress, fakeFactory: SignerWithAddress
  let cpool: CPOOL, staking: MembershipStaking

  beforeEach(async function () {
    ;[owner, other, fakeFactory] = await ethers.getSigners()
    const chainIdSrc = 1
    let LZEndpointMock = await ethers.getContractFactory('LZEndpointMock')
    let lzEndpointSrcMock = await LZEndpointMock.deploy(chainIdSrc)

    const CPOOLFactory = await ethers.getContractFactory('CPOOL')
    cpool = await CPOOLFactory.deploy(owner.address)

    const StakingFactory = await ethers.getContractFactory('MembershipStaking')
    staking = (await upgrades.deployProxy(StakingFactory, [
      cpool.address,
      fakeFactory.address,
      parseUnits('5'),
    ])) as MembershipStaking
  })

  describe('Configuration', function () {
    it('Only owner can set manager minimal stake', async function () {
      await expect(staking.connect(other).setManagerMinimalStake(100)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      )
    })

    it('Owner can set manager minimal stake', async function () {
      await staking.setManagerMinimalStake(100)
      expect(await staking.managerMinimalStake()).to.equal(100)
    })
  })

  describe('Staking', function () {
    it('Staking and unstaking works', async function () {
      expect((await staking.getCurrentStake(owner.address)).toNumber()).equals(0)

      await cpool.approve(staking.address, 1000000)
      await staking.stake(1000000)
      expect((await staking.getCurrentStake(owner.address)).toNumber()).equals(1000000)

      await staking.unstake(300000)
      expect((await staking.getCurrentStake(owner.address)).toNumber()).equals(700000)
    })

    it("Unstaking below zero won't work", async function () {
      await expect(staking.unstake(1000)).to.be.revertedWith(ERRORS.STAKING.NOT_ENOUGH_STAKE)
    })

    it("Can't stake with unsufficient funds", async function () {
      await cpool.connect(other).approve(staking.address, 1000000)

      await expect(staking.connect(other).stake(10000)).to.be.revertedWith(
        'Cpool::_transferTokens: transfer amount exceeds balance',
      )
    })

    it("Several stakes in one block don't right multiple checkpoints", async function () {
      await cpool.approve(staking.address, 3000)

      await stopMining()
      await staking.stake(1000)
      await staking.stake(2000)
      await startMining()

      expect(await staking.numCheckpoints(owner.address)).to.equal(1)
      const currentBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber())
      const checkpoint = await staking.checkpoints(owner.address, 0)
      expect(checkpoint.fromBlock).to.equal(currentBlock.number)
      expect(checkpoint.stake).to.equal(3000)
    })
  })

  describe('Get prior votes', function () {
    let tx1: ContractTransaction,
      tx2: ContractTransaction,
      tx3: ContractTransaction,
      tx4: ContractTransaction,
      tx5: ContractTransaction,
      tx6: ContractTransaction

    this.beforeEach(async function () {
      await cpool.approve(staking.address, 10000)
      tx1 = await staking.stake(1000)
      tx2 = await staking.stake(1000)
      tx3 = await staking.stake(1000)
      tx4 = await staking.stake(1000)
      tx5 = await staking.stake(1000)
      tx6 = await staking.stake(1000)
      await mineBlock(10)
    })

    it("Can't get votes for future block", async function () {
      await expect(staking.getPriorVotes(owner.address, tx6.blockNumber! + 100)).to.be.revertedWith(
        ERRORS.STAKING.NOT_YET_DETERMINED,
      )
    })

    it('Case when last checkpoint is valid calculates correct', async function () {
      expect(await staking.getPriorVotes(owner.address, tx6.blockNumber! + 5)).to.equal(6000)
    })

    it('Case when zero checkopoint is valid calculates correct', async function () {
      expect(await staking.getPriorVotes(owner.address, tx1.blockNumber! - 5)).to.equal(0)
    })

    it('Searching checkpoint works correct', async function () {
      expect(await staking.getPriorVotes(owner.address, tx1.blockNumber!)).to.equal(1000)
      expect(await staking.getPriorVotes(owner.address, tx2.blockNumber!)).to.equal(2000)
      expect(await staking.getPriorVotes(owner.address, tx3.blockNumber!)).to.equal(3000)
      expect(await staking.getPriorVotes(owner.address, tx4.blockNumber!)).to.equal(4000)
      expect(await staking.getPriorVotes(owner.address, tx5.blockNumber!)).to.equal(5000)
      expect(await staking.getPriorVotes(owner.address, tx6.blockNumber!)).to.equal(6000)
    })
  })

  describe('Locking', function () {
    beforeEach(async function () {
      await cpool.approve(staking.address, await staking.managerMinimalStake())
      await staking.stake(await staking.managerMinimalStake())
    })

    it('Only factory can lock stake', async function () {
      await expect(staking.lockStake(owner.address)).to.be.revertedWith(ERRORS.STAKING.ONLY_FACTORY)
    })

    it('Only factory can unlock stake', async function () {
      await expect(
        staking.unlockAndWithdrawStake(
          owner.address,
          owner.address,
          await staking.locked(owner.address),
        ),
      ).to.be.revertedWith(ERRORS.STAKING.ONLY_FACTORY)
    })

    it("Locking overflowing stake won't work", async function () {
      await staking.setManagerMinimalStake(parseUnits('10'))
      await expect(staking.connect(fakeFactory).lockStake(owner.address)).to.be.revertedWith(
        'Cpool::transferFrom: transfer amount exceeds spender allowance',
      )
    })

    it('Correct locking should work', async function () {
      expect(await staking.locked(owner.address)).to.equal(0)
      await staking.connect(fakeFactory).lockStake(owner.address)
      expect(await staking.locked(owner.address)).to.equal(await staking.managerMinimalStake())
    })

    it('Locking overflowing stake but with enough allowance also works (auto-staking)', async function () {
      await staking.setManagerMinimalStake(parseUnits('10'))
      await cpool.approve(staking.address, parseUnits('5'))
      await staking.connect(fakeFactory).lockStake(owner.address)
    })

    it('Correct unlocking should work', async function () {
      expect(await staking.locked(owner.address)).to.equal(0)
      await staking.connect(fakeFactory).lockStake(owner.address)
      expect(await staking.locked(owner.address)).to.equal(await staking.managerMinimalStake())
      await staking
        .connect(fakeFactory)
        .unlockAndWithdrawStake(owner.address, owner.address, await staking.locked(owner.address))
      expect(await staking.locked(owner.address)).to.equal(0)
    })
  })
})
