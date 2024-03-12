import { ethers, network } from 'hardhat'
import { expect } from 'chai'
import { decimal, increaseTime, mineBlock, signMessage } from '../shared/utils'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { PoolFactory, PoolMaster, FaucetToken } from '../../typechain'
import setupContracts from '../shared/setup-contracts'
import { ERRORS } from '../shared/errors'
import { PoolState } from '../shared/states'
import { BigNumberish, Event } from 'ethers'
import { Block } from '@ethersproject/abstract-provider'
import { runs as allRuns } from '../shared/runs'

const { parseUnits } = ethers.utils
const { MaxUint256 } = ethers.constants

const chainId = network.config.chainId!
const ONE = parseUnits('1', 18)

const DomainERC20 = async (token: FaucetToken) => ({
  name: await token.name(),
  version: '1',
  chainId,
  verifyingContract: token.address,
})

const TypesERC20 = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
}

type ERC20Permit = {
  owner: string
  spender: string
  value: BigNumberish
  deadline: BigNumberish
  nonce: BigNumberish
}

export async function signPermitERC20(
  signer: SignerWithAddress,
  token: FaucetToken,
  permit: ERC20Permit,
) {
  return await signMessage(signer, await DomainERC20(token), TypesERC20, permit)
}

const badSig = {
  v: 0,
  r: ethers.utils.formatBytes32String('bad'),
  s: ethers.utils.formatBytes32String('bad'),
}

describe('Test interaction with Pool: Basic interaction', function () {
  let runs = Object.values(allRuns)
  if (process.env.TESTING_POOL) {
    runs = [allRuns[process.env.TESTING_POOL!]]
  }

  runs.forEach((run) => {
    describe(`Run with master ${run.contract}`, function () {
      let owner: SignerWithAddress, other: SignerWithAddress, spi: SignerWithAddress
      let factory: PoolFactory, usdc: FaucetToken, pool: PoolMaster
      let block: Block

      beforeEach(async function () {
        ;[owner, other, spi] = await ethers.getSigners()
          ; ({ factory, usdc } = await setupContracts({
            poolContract: run.contract,
          }))
        pool = await run.configuration(factory, owner, usdc, other)

        block = await ethers.provider.getBlock(await ethers.provider.getBlockNumber())
      })

      it('Pool is initially in zero utilization', async function () {
        expect(await pool.enteredZeroUtilization()).not.to.equal(0)
        expect(await pool.getUtilizationRate()).to.equal(0)
      })

      it('Providing and redeeming liquidity', async function () {
        await usdc.approve(pool.address, parseUnits('10'))
        await pool.provide(parseUnits('10'))

        expect(await pool.balanceOf(owner.address)).to.equal(parseUnits('10'))

        await mineBlock(210)

        await expect(() => pool.redeem(parseUnits('10'))).to.changeTokenBalance(
          usdc,
          owner,
          parseUnits('10'),
        )

        await expect(pool.redeem(1)).to.be.revertedWith('ERC20: burn amount exceeds balance')
      })

      it('Can provide liquidity for someone else', async function () {
        await usdc.approve(pool.address, parseUnits('10'))
        await pool.provideFor(parseUnits('10'), other.address)

        const minLiq = await pool.MINIMUM_LIQUIDITY();

        expect(await pool.balanceOf(owner.address)).to.equal(0)
        expect(await pool.balanceOf(other.address)).to.equal(parseUnits('20').sub(minLiq))
      })

      it('Can redeem currency', async function () {
        await usdc.approve(pool.address, parseUnits('10'))
        await pool.provide(parseUnits('10'))

        await expect(() => pool.redeemCurrency(parseUnits('5'))).to.changeTokenBalance(
          usdc,
          owner,
          parseUnits('5'),
        )
      })

      it("Can't redeem beyond provisional default", async function () {
        await pool.borrow(parseUnits('0.99'), spi.address)

        await expect(pool.connect(other).redeem(parseUnits('9').add(1))).to.be.revertedWith(
          ERRORS.POOL_MASTER.NOT_ENOUGH_CURRENCY,
        )
      })

      it('Pool is active when in provisional default', async function () {
        await pool.borrow(parseUnits('9.5'), spi.address)
        await pool.connect(other).redeem(MaxUint256)

        expect(await pool.state()).to.equal(PoolState.ProvisionalDefault)

        await usdc.mint(other.address, parseUnits('10'))
        await usdc.connect(other).approve(pool.address, parseUnits('10'))
        await pool.connect(other).provide(parseUnits('10'))

        expect(await pool.state()).to.equal(PoolState.Active)
      })

      it('Initial exchange rate is always one', async function () {
        await pool.connect(other).redeem(await pool.balanceOf(other.address))

        expect(await pool.getCurrentExchangeRate()).to.equal(decimal('1'))
      })

      it('Can redeem from closed (when repaying) pool', async function () {
        await pool.borrow(parseUnits('1'), spi.address)
        await usdc.approve(pool.address, parseUnits('10'))
        await pool.repay(MaxUint256)
        await pool.connect(owner).close()

        const tokensAmount = await pool.balanceOf(other.address)
        const exchangeRate = await pool.getCurrentExchangeRate();
        const balanceBefore = await usdc.balanceOf(other.address)
        await pool.connect(other).redeem(MaxUint256)
        const balanceAfter = await usdc.balanceOf(other.address)

        const redeemedAmount = tokensAmount.mul(exchangeRate).div(ONE);
        expect(balanceAfter.sub(balanceBefore)).to.equal(redeemedAmount)
      })

      it("Can't provide more than maximum capacity", async function () {
        expect(await pool.cash()).to.eq(parseUnits('10'))

        await pool.setMaxCapacity(parseUnits('15'))

        await usdc.approve(pool.address, parseUnits('10').add(1))

        await expect(pool.provide(parseUnits('5').add(1))).to.be.revertedWith(
          ERRORS.POOL_MASTER.CANT_PROVIDE_MORE_THAN_CAPACITY,
        )

        await pool.provide(parseUnits('5'))

        await pool.setMaxCapacity(parseUnits('20'))

        await expect(pool.provide(parseUnits('5').add(1))).to.be.revertedWith(
          ERRORS.POOL_MASTER.CANT_PROVIDE_MORE_THAN_CAPACITY,
        )

        await pool.provide(parseUnits('5'))
      })

      it('Capacity == 0 is infinite', async function () {
        await pool.setMaxCapacity(parseUnits('10'))

        await expect(pool.setMaxCapacity(0)).to.emit(pool, 'MaximumCapacityChanged').withArgs(0)

        const amount = parseUnits('1000000000000000000000')

        await usdc.approve(pool.address, amount)
        await usdc.mint(owner.address, amount)
        await pool.provide(amount)
      })

      it('Can redeem available (via MaxUint)', async function () {
        const tx = await pool.borrow(parseUnits('4'), owner.address)
        const receipt = await tx.wait()
        const block = await ethers.provider.getBlock(receipt.blockNumber)

        const rate = await pool.getBorrowRate()

        const balanceBefore = await usdc.balanceOf(other.address)

        const tx2 = await pool.connect(other).redeem(MaxUint256)
        const receipt2 = await tx2.wait()
        const block2 = await ethers.provider.getBlock(receipt2.blockNumber)

        const balanceAfter = await usdc.balanceOf(other.address)

        const interest = parseUnits('4')
          .mul(rate)
          .div(decimal('1'))
          .mul(block2.timestamp - block.timestamp)
        const reserveFactor = await pool.reserveFactor()
        const insuranceFactor = await pool.insuranceFactor()
        const locked = interest.mul(reserveFactor.add(insuranceFactor)).div(decimal('1'))

        const totalBorrows = parseUnits('4').add(interest)
        const poolSizeForProvDefault = totalBorrows.mul(decimal('1')).div(decimal('0.99'))
        const currentPoolSize = parseUnits('10').sub(locked)
        const available = currentPoolSize.sub(poolSizeForProvDefault).add(1)

        expect(balanceAfter.sub(balanceBefore)).to.equal(available)
      })

      it("Can't provide liquidity with invalid signature", async function () {
        await expect(
          pool.provideWithPermit(
            parseUnits('1'),
            block.timestamp + 1000,
            badSig.v,
            badSig.r,
            badSig.s,
          ),
        ).to.be.revertedWith('ECDSA: invalid signature')
      })

      it("Can't provide liquidity after permit deadline exceeded", async function () {
        const sig = await signPermitERC20(owner, usdc, {
          owner: owner.address,
          spender: pool.address,
          value: parseUnits('1'),
          deadline: block.timestamp + 10,
          nonce: 0,
        })
        await increaseTime(100)
        await expect(
          pool.provideWithPermit(parseUnits('1'), block.timestamp + 10, sig.v, sig.r, sig.s),
        ).to.be.revertedWith('ERC20Permit: expired deadline')
      })

      it('Can provide liquidity with correct permit', async function () {
        const sig = await signPermitERC20(owner, usdc, {
          owner: owner.address,
          spender: pool.address,
          value: parseUnits('1'),
          deadline: block.timestamp + 10,
          nonce: 0,
        })
        await expect(
          pool.provideWithPermit(parseUnits('1'), block.timestamp + 10, sig.v, sig.r, sig.s),
        )
          .to.emit(pool, 'Provided')
          .withArgs(owner.address, parseUnits('1'), parseUnits('1'))
      })

      it('Can provide liquidity for someone else with correct permit', async function () {
        const sig = await signPermitERC20(owner, usdc, {
          owner: owner.address,
          spender: pool.address,
          value: parseUnits('1'),
          deadline: block.timestamp + 10,
          nonce: 0,
        })
        await expect(
          pool.provideForWithPermit(
            parseUnits('1'),
            other.address,
            block.timestamp + 10,
            sig.v,
            sig.r,
            sig.s,
          ),
        )
          .to.emit(pool, 'Provided')
          .withArgs(other.address, parseUnits('1'), parseUnits('1'))

        expect(await pool.balanceOf(owner.address)).to.equal(0)
        const minLiq = await pool.MINIMUM_LIQUIDITY()
        expect(await pool.balanceOf(other.address)).to.equal(parseUnits('11').sub(minLiq))
      })
    })
  })
})
