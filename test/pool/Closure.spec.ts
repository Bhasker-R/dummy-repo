import { ethers } from 'hardhat'
import { expect } from 'chai'
import { mul, div } from '@prb/math'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import {
  PoolFactory,
  PoolMaster,
  FaucetToken,
  MembershipStaking,
  DefaultInterestRateModel,
  CPOOL,
} from '../../typechain'
import setupContracts from '../shared/setup-contracts'
import { ERRORS } from '../shared/errors'
import { PoolState } from '../shared/states'
import { runs as allRuns } from '../shared/runs'
import { decimal, increaseTime } from '../shared/utils'

const { parseUnits } = ethers.utils
const { MaxUint256 } = ethers.constants

const ONE = parseUnits('1', 18)

describe('Test interaction with Pool: Closure', function () {
  let runs = Object.values(allRuns)
  if (process.env.TESTING_POOL) {
    runs = [allRuns[process.env.TESTING_POOL!]]
  }

  runs.forEach((run) => {
    describe(`Run with master ${run.contract}`, function () {
      let owner: SignerWithAddress, other: SignerWithAddress, spi: SignerWithAddress
      let staking: MembershipStaking,
        factory: PoolFactory,
        usdc: FaucetToken,
        cpool: CPOOL,
        pool: PoolMaster,
        interestRateModel: DefaultInterestRateModel

      beforeEach(async function () {
        ;[owner, other, spi] = await ethers.getSigners()
          ; ({ staking, factory, usdc, cpool, interestRateModel } = await setupContracts({
            poolContract: run.contract,
          }))
        pool = await run.configuration(factory, owner, usdc, other)
      })

      it('Only owner can close basically', async function () {
        await expect(pool.connect(other).close()).to.be.revertedWith(
          ERRORS.POOL_MASTER.SENDER_CANT_CLOSE,
        )
      })

      it('Correct closure works', async function () {
        expect(await staking.locked(owner.address)).not.to.equal(0)

        const minStake = await staking.managerMinimalStake()

        const cpoolBalanceBefore = await cpool.balanceOf(owner.address)
        await expect(pool.connect(owner).close()).to.emit(staking, 'StakeUnlocked').to.emit(pool, 'Closed')
        const cpoolBalanceAfter = await cpool.balanceOf(owner.address)

        expect(await pool.state()).to.equal(PoolState.Closed)
        expect(await staking.locked(owner.address)).to.equal(0)
        expect(cpoolBalanceAfter.sub(cpoolBalanceBefore)).to.equal(minStake)
      })

      it("Closed pool doesn't leave closed state", async function () {
        await pool.borrow(parseUnits('5'), spi.address)

        await increaseTime(24 * 60 * 60)

        await usdc.approve(pool.address, parseUnits('10'))
        await pool.repay(MaxUint256)
        await pool.connect(owner).close()
        await pool.connect(other).redeem(parseUnits('5'))

        expect(await pool.state()).to.equal(PoolState.Closed)
      })

      it("Closed (separately) pool doesn't leave closed state", async function () {
        await pool.borrow(parseUnits('5'), spi.address)

        await increaseTime(24 * 60 * 60)

        await usdc.approve(pool.address, parseUnits('10'))
        await pool.repay(MaxUint256)
        await pool.connect(owner).close()
        await pool.connect(other).redeem(parseUnits('5'))

        expect(await pool.state()).to.equal(PoolState.Closed)
      })

      it('Can redeem from closed (separately) pool', async function () {
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

      it('When closed by governance due to inactivity, insurance get returned to the governor', async function () {
        const tx = await pool.borrow(parseUnits('1'), spi.address)
        const receipt = await tx.wait()
        const block = await ethers.provider.getBlock(receipt.blockNumber)
        await increaseTime(100000)

        await usdc.approve(pool.address, parseUnits('10'))
        const tx2 = await pool.repay(MaxUint256)
        const receipt2 = await tx2.wait()
        const block2 = await ethers.provider.getBlock(receipt2.blockNumber)

        const balanceTreasuryBefore = await usdc.balanceOf(await factory.treasury())

        await increaseTime(30 * 24 * 60 * 60)
        await factory.transferOwnership(other.address)
        await pool.connect(other).close()

        const balanceTreasuryAfter = await usdc.balanceOf(await factory.treasury())

        const baseRate = await interestRateModel.baseRate()
        const multiplier = await interestRateModel.multiplier()
        const util = div(parseUnits('1'), parseUnits('10'))
        const rate = baseRate.add(mul(multiplier, util))
        const interest = parseUnits('1')
          .mul(rate)
          .mul(block2.timestamp - block.timestamp)
          .div(decimal('1'))
        const insurance = interest.mul(await pool.insuranceFactor()).div(decimal('1'))
        expect(balanceTreasuryAfter.sub(balanceTreasuryBefore)).to.equal(insurance.mul(2))
      })
    })
  })
})
