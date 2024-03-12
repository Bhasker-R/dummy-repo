import { ethers } from 'hardhat'
import { expect } from 'chai'
import { mul, div } from '@prb/math'
import { decimal, mineBlock, increaseTime, stopMining, startMining } from '../shared/utils'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { PoolFactory, PoolMaster, FaucetToken, DefaultInterestRateModel } from '../../typechain'
import setupContracts from '../shared/setup-contracts'
import { ERRORS } from '../shared/errors'
import { PoolState } from '../shared/states'
import { runs as allRuns } from '../shared/runs'

const { parseUnits } = ethers.utils
const { MaxUint256 } = ethers.constants

describe('Test interaction with Pool: Borrowing', function () {
  let runs = Object.values(allRuns)
  if (process.env.TESTING_POOL) {
    runs = [allRuns[process.env.TESTING_POOL!]]
  }

  runs.forEach((run) => {
    describe(`Run with master ${run.contract}`, function () {
      let owner: SignerWithAddress, other: SignerWithAddress, spi: SignerWithAddress
      let factory: PoolFactory,
        usdc: FaucetToken,
        pool: PoolMaster,
        interestRateModel: DefaultInterestRateModel

      beforeEach(async function () {
        ;[owner, other, spi] = await ethers.getSigners()
          ; ({ factory, usdc, interestRateModel } = await setupContracts({
            poolContract: run.contract,
          }))
        pool = await run.configuration(factory, owner, usdc, other)
      })

      it("Can't borrow zero", async function () {
        await expect(pool.borrow(0, spi.address)).to.be.revertedWithCustomError(
          pool,
          ERRORS.GLOBAL.AMOUNT_IS_ZERO,
        )
      })

      it("Can't borrow beyond warning utilization", async function () {
        await expect(
          pool.borrow(parseUnits('9.5').add(1), spi.address),
        ).to.be.revertedWithCustomError(pool, ERRORS.POOL_MASTER.NOT_ENOUGH_LIQUIDITY)
      })

      it('Can borrow up to warning and state will change after this', async function () {
        await pool.borrow(parseUnits('9.5'), spi.address)

        expect(await pool.state()).to.equal(PoolState.Warning)
      })

      it('Can borrow available', async function () {
        await pool.borrow(MaxUint256, spi.address)
        expect(await usdc.balanceOf(spi.address)).to.equal(parseUnits('9.5'))
      })

      it('Can borrow available after redemption', async function () {
        await pool.borrow(parseUnits('9.5'), spi.address)

        await usdc.mint(other.address, parseUnits('10'))
        await usdc.connect(other).approve(pool.address, parseUnits('10'))
        await pool.connect(other).provide(parseUnits('2'))
        await pool.connect(other).redeemCurrency(parseUnits('1.5'))

        await pool.borrow(MaxUint256, spi.address)
      })

      it('LP can withdraw up to provisional default and state will change after this', async function () {
        await pool.borrow(parseUnits('9.5'), spi.address)
        await pool.connect(other).redeem(ethers.constants.MaxUint256)

        expect(await pool.state()).to.equal(PoolState.ProvisionalDefault)
      })

      it("LP can't withdraw beyond provisional default", async function () {
        await pool.borrow(parseUnits('9.5'), spi.address)
        await expect(pool.connect(other).redeemCurrency(parseUnits('0.49'))).to.be.revertedWith(
          ERRORS.POOL_MASTER.NOT_ENOUGH_CURRENCY,
        )
      })

      it('Timer stops if utilisation is less than provisional repayment utilisation', async function () {
        await pool.borrow(parseUnits('9.5'), spi.address)
        await pool.connect(other).redeem(MaxUint256)
        expect(await pool.state()).to.equal(PoolState.ProvisionalDefault)
        expect(await pool.enteredProvisionalDefault()).not.equal(0)

        await usdc.approve(pool.address, MaxUint256)
        await pool.repay(parseUnits('1.5')) // below provisional repayment utilization 85%
        expect(await pool.enteredProvisionalDefault()).equal(0)
      })

      it('Pool becomes default after warningGracePeriod', async function () {
        await pool.borrow(parseUnits('9.5'), spi.address)
        expect(await pool.state()).to.equal(PoolState.Warning)
        await pool.connect(other).redeem(ethers.constants.MaxUint256)
        expect(await pool.state()).to.equal(PoolState.ProvisionalDefault)

        await usdc.approve(pool.address, MaxUint256)
        await pool.repay(parseUnits('0.1'))

        const warningGracePeriod = await pool.warningGracePeriod()
        await increaseTime(warningGracePeriod.add(1).toNumber())
        await mineBlock()

        expect(await pool.state()).to.equal(PoolState.Default)
      })

      it('Pool leaves zero utilization at borrowing', async function () {
        await pool.borrow(parseUnits('1'), spi.address)
        expect(await pool.enteredZeroUtilization()).to.equal(0)
      })

      it('No zero division', async function () {
        await pool.borrow(1, spi.address)
        await mineBlock(10)
        expect(await pool.borrows()).to.equal(1)
      })

      it('Last accrual is valid', async function () {
        await pool.borrow(parseUnits('1'), spi.address)
        await mineBlock(10)

        const block = await ethers.provider.getBlock(await ethers.provider.getBlockNumber())
        expect(await pool.lastAccrual()).to.equal(block.timestamp)
      })

      it('Interest rate works correct', async function () {
        const tx = await pool.borrow(parseUnits('1'), spi.address)
        const receipt = await tx.wait()
        const block = await ethers.provider.getBlock(receipt.blockNumber)

        await increaseTime(1000)

        const balanceBefore = await usdc.balanceOf(owner.address)

        await usdc.approve(pool.address, MaxUint256)
        const tx2 = await pool.repay(MaxUint256)
        const receipt2 = await tx2.wait()
        const block2 = await ethers.provider.getBlock(receipt2.blockNumber)

        const balanceAfter = await usdc.balanceOf(owner.address)

        const baseRate = await interestRateModel.baseRate()
        const multiplier = await interestRateModel.multiplier()
        const util = div(parseUnits('1'), parseUnits('10'))
        const rate = baseRate.add(mul(multiplier, util))
        const interest = parseUnits('1')
          .mul(rate)
          .mul(block2.timestamp - block.timestamp)
          .div(decimal('1'))
        expect(balanceBefore.sub(balanceAfter)).to.equal(parseUnits('1').add(interest))
      })

      it('Current exchange rate is correct', async function () {
        const tx = await pool.borrow(parseUnits('1'), spi.address)
        const receipt = await tx.wait()
        const block = await ethers.provider.getBlock(receipt.blockNumber)

        await increaseTime(1000)

        const block2 = await ethers.provider.getBlock(await ethers.provider.getBlockNumber())
        const baseRate = await interestRateModel.baseRate()
        const multiplier = await interestRateModel.multiplier()
        const util = div(parseUnits('1'), parseUnits('10'))
        const rate = baseRate.add(mul(multiplier, util))
        const interest = parseUnits('1')
          .mul(rate)
          .div(decimal('1'))
          .mul(block2.timestamp - block.timestamp)
        const borrows = parseUnits('1').add(interest)
        const reserveFactor = await pool.reserveFactor()
        const insuranceFactor = await pool.insuranceFactor()
        const locked = interest.mul(reserveFactor.add(insuranceFactor)).div(decimal('1'))

        const balance = parseUnits('9')
        expect(await pool.getCurrentExchangeRate()).to.equal(
          balance
            .sub(locked)
            .add(borrows)
            .mul(decimal('1'))
            .div(await pool.totalSupply()),
        )
      })

      it('No double accrual in one block', async function () {
        const tx = await pool.borrow(parseUnits('1'), spi.address)
        const receipt = await tx.wait()
        const block = await ethers.provider.getBlock(receipt.blockNumber)

        await usdc.approve(pool.address, parseUnits('10'))

        await stopMining()
        const tx2 = await pool.provide(parseUnits('1'))
        await pool.provide(parseUnits('1'))
        await startMining()
        const receipt2 = await tx2.wait()
        const block2 = await ethers.provider.getBlock(receipt2.blockNumber)

        const baseRate = await interestRateModel.baseRate()
        const multiplier = await interestRateModel.multiplier()
        const util = div(parseUnits('1'), parseUnits('10'))
        const rate = baseRate.add(mul(multiplier, util))
        const interest = parseUnits('1')
          .mul(rate)
          .mul(block2.timestamp - block.timestamp)
          .div(decimal('1'))
        expect(await pool.borrows()).to.equal(parseUnits('1').add(interest))
      })

      it('Borrows getter works correct', async function () {
        const tx = await pool.borrow(parseUnits('1'), spi.address)
        const receipt = await tx.wait()
        const initialBlock = await ethers.provider.getBlock(receipt.blockNumber)

        await increaseTime(1000)

        const currentBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber())
        const baseRate = await interestRateModel.baseRate()
        const multiplier = await interestRateModel.multiplier()
        const util = div(parseUnits('1'), parseUnits('10'))
        const rate = baseRate.add(mul(multiplier, util))
        const interest = parseUnits('1')
          .mul(rate)
          .mul(currentBlock.timestamp - initialBlock.timestamp)
          .div(decimal('1'))
        expect(await pool.borrows()).to.equal(parseUnits('1').add(interest))
      })

      it('Only manager can borrow', async function () {
        await expect(
          pool.connect(other).borrow(parseUnits('1'), spi.address),
        ).to.be.revertedWithCustomError(pool, ERRORS.POOL_MASTER.ONLY_MANAGER)
      })

      it("Can't borrow more than available", async function () {
        await expect(
          pool.borrow(ethers.utils.parseUnits('1000'), spi.address),
        ).to.be.revertedWithCustomError(pool, ERRORS.POOL_MASTER.NOT_ENOUGH_LIQUIDITY)
      })

      it('Borrowing with correct arguments should work', async function () {
        await expect(pool.borrow(parseUnits('1'), spi.address))
          .to.emit(pool, 'Borrowed')
          .withArgs(parseUnits('1'), spi.address)

        expect(await pool.borrows()).to.equal(parseUnits('1'))
        expect(await usdc.balanceOf(spi.address)).to.equal(parseUnits('1'))
      })

      it('Borrows accrual works correct', async function () {
        const tx = await pool.borrow(parseUnits('1'), spi.address)
        const receipt = await tx.wait()
        const block = await ethers.provider.getBlock(receipt.blockNumber)

        await increaseTime(150)

        const baseRate = await interestRateModel.baseRate()
        const multiplier = await interestRateModel.multiplier()
        const util = div(parseUnits('1'), parseUnits('10'))
        const rate = baseRate.add(mul(multiplier, util))

        const tx2 = await pool.repay(0)
        const receipt2 = await tx2.wait()
        const block2 = await ethers.provider.getBlock(receipt2.blockNumber)

        const interest = parseUnits('1')
          .mul(rate)
          .div(decimal('1'))
          .mul(block2.timestamp - block.timestamp)
        expect(await pool.borrows()).to.equal(parseUnits('1').add(interest))
      })

      it('Only manager can repay', async function () {
        await pool.borrow(parseUnits('1'), spi.address)
        await usdc.mint(other.address, parseUnits('10'))
        await expect(
          pool.connect(other).repay(parseUnits('1')),
        ).to.be.revertedWithCustomError(pool, ERRORS.POOL_MASTER.ONLY_MANAGER)
      })

      it("Can't repay without approval", async function () {
        await pool.borrow(parseUnits('1'), owner.address)
        await expect(pool.repay(parseUnits('1'))).to.be.revertedWith(
          'ERC20: insufficient allowance',
        )
      })

      it("Can't repay more than borrowed", async function () {
        await pool.borrow(parseUnits('1'), owner.address)
        await usdc.approve(pool.address, parseUnits('10'))
        await expect(pool.repay(parseUnits('10'))).to.be.revertedWithCustomError(
          pool,
          ERRORS.POOL_MASTER.MORE_THAN_BORROWED,
        )
      })

      it('Repaying works correct', async function () {
        const tx = await pool.borrow(parseUnits('1'), owner.address)
        const receipt = await tx.wait()
        const block = await ethers.provider.getBlock(receipt.blockNumber)

        await usdc.approve(pool.address, parseUnits('0.5'))
        const tx2 = await pool.repay(parseUnits('0.5'))
        const receipt2 = await tx2.wait()
        const block2 = await ethers.provider.getBlock(receipt2.blockNumber)

        const baseRate = await interestRateModel.baseRate()
        const multiplier = await interestRateModel.multiplier()
        const util = div(parseUnits('1'), parseUnits('10'))
        const rate = baseRate.add(mul(multiplier, util))
        const interest = parseUnits('1')
          .mul(rate)
          .div(decimal('1'))
          .mul(block2.timestamp - block.timestamp)
        const reserves = interest.mul(decimal('0.05')).div(decimal('1'))
        const insurance = interest.mul(decimal('0.05')).div(decimal('1'))
        const borrows = parseUnits('1').add(interest).sub(parseUnits('0.5'))
        const balance = await pool.cash()

        expect(await pool.reserves()).to.equal(reserves)
        expect(await pool.insurance()).to.equal(insurance)
        expect(await pool.borrows()).to.equal(borrows)

        // LPs can withdraw up to 99% utilization
        const poolSizeForProv = borrows.mul(decimal('1')).div(decimal('0.99'))
        const currentPoolSize = balance
          .sub(reserves)
          .sub(insurance)
          .add(parseUnits('0.5').add(interest))
        expect(await pool.availableToWithdraw()).to.equal(currentPoolSize.sub(poolSizeForProv))

        // As all interest has been repaid, manager can now borrow available funds up to 99% utilization
        const borrowsForProv = currentPoolSize.mul(decimal('0.95')).div(decimal('1'))
        expect(await pool.availableToBorrow()).to.equal(borrowsForProv.sub(borrows))
      })

      it('Governor and only governor can transfer reserves at any time', async function () {
        const tx = await pool.borrow(parseUnits('1'), spi.address)
        const receipt = await tx.wait()
        const block = await ethers.provider.getBlock(receipt.blockNumber)
        await increaseTime(1000)

        await expect(pool.connect(other).transferReserves()).to.be.revertedWithCustomError(
          pool,
          ERRORS.GLOBAL.ONLY_GOVERNOR,
        )

        const balanceBefore = await usdc.balanceOf(await factory.treasury())

        const tx2 = await pool.transferReserves()
        const receipt2 = await tx2.wait()
        const block2 = await ethers.provider.getBlock(receipt2.blockNumber)

        const baseRate = await interestRateModel.baseRate()
        const multiplier = await interestRateModel.multiplier()
        const util = div(parseUnits('1'), parseUnits('10'))
        const rate = baseRate.add(mul(multiplier, util))
        const reserveFactor = await pool.reserveFactor()
        const reserves = parseUnits('1')
          .mul(rate)
          .mul(block2.timestamp - block.timestamp)
          .div(decimal('1'))
          .mul(reserveFactor)
          .div(decimal('1'))

        const balanceAfter = await usdc.balanceOf(await factory.treasury())
        expect(balanceAfter.sub(balanceBefore)).to.equal(reserves)
      })
    })
  })
})
