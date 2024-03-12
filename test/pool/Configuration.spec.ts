import { ethers } from 'hardhat'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { PoolFactory, PoolMaster, FaucetToken } from '../../typechain'
import setupContracts from '../shared/setup-contracts'
import { ERRORS } from '../shared/errors'
import { runs as allRuns } from '../shared/runs'

describe('Test interaction with Pool: Basic interaction', function () {
  let runs = Object.values(allRuns)
  if (process.env.TESTING_POOL) {
    runs = [allRuns[process.env.TESTING_POOL!]]
  }

  runs.forEach((run) => {
    describe(`Run with master ${run.contract}`, function () {
      let owner: SignerWithAddress, other: SignerWithAddress, spi: SignerWithAddress
      let factory: PoolFactory, usdc: FaucetToken, pool: PoolMaster

      beforeEach(async function () {
        ;[owner, other, spi] = await ethers.getSigners()
          ; ({ factory, usdc } = await setupContracts({
            poolContract: run.contract,
          }))
        pool = await run.configuration(factory, owner, usdc, other)
      })

      it('Owner and only owner can set interest rate model', async function () {
        await expect(
          pool.connect(other).setInterestRateModel(other.address),
        ).to.be.revertedWithCustomError(pool, ERRORS.GLOBAL.ONLY_GOVERNOR)

        await pool.setInterestRateModel(other.address)
        expect(await pool.interestRateModel()).to.equal(other.address)
      })

      it('Owner and only owner can set reserve factor', async function () {
        await expect(pool.connect(other).setReserveFactor(1)).to.be.revertedWithCustomError(
          pool,
          ERRORS.GLOBAL.ONLY_GOVERNOR,
        )

        await pool.setReserveFactor(1)
        expect(await pool.reserveFactor()).to.equal(1)
      })

      it('Owner and only owner can set insurance factor', async function () {
        await expect(pool.connect(other).setInsuranceFactor(1)).to.be.revertedWithCustomError(
          pool,
          ERRORS.GLOBAL.ONLY_GOVERNOR,
        )

        await pool.setInsuranceFactor(1)
        expect(await pool.insuranceFactor()).to.equal(1)
      })

      it('Owner and only owner can set warning utilization', async function () {
        await expect(pool.connect(other).setWarningUtilization(1)).to.be.revertedWithCustomError(
          pool,
          ERRORS.GLOBAL.ONLY_GOVERNOR,
        )

        await pool.setWarningUtilization(1)
        expect(await pool.warningUtilization()).to.equal(1)
      })

      it('Owner and only owner can set provisional repayment utilization', async function () {
        await expect(
          pool.connect(other).setProvisionalRepaymentUtilization(1),
        ).to.be.revertedWithCustomError(pool, ERRORS.GLOBAL.ONLY_GOVERNOR)

        await pool.setProvisionalRepaymentUtilization(1)
        expect(await pool.provisionalRepaymentUtilization()).to.equal(1)
      })

      it('Owner and only owner can set provisional default utilization', async function () {
        await expect(
          pool.connect(other).setProvisionalDefaultUtilization(1),
        ).to.be.revertedWithCustomError(pool, ERRORS.GLOBAL.ONLY_GOVERNOR)

        await pool.setProvisionalDefaultUtilization(1)
        expect(await pool.provisionalDefaultUtilization()).to.equal(1)
      })

      it('Owner and only owner can set warning grace period', async function () {
        await expect(pool.connect(other).setWarningGracePeriod(1)).to.be.revertedWithCustomError(
          pool,
          ERRORS.GLOBAL.ONLY_GOVERNOR,
        )

        await pool.setWarningGracePeriod(1)
        expect(await pool.warningGracePeriod()).to.equal(1)
      })

      it('Owner and only owner can set max inactive period', async function () {
        await expect(pool.connect(other).setMaxInactivePeriod(1)).to.be.revertedWithCustomError(
          pool,
          ERRORS.GLOBAL.ONLY_GOVERNOR,
        )

        await pool.setMaxInactivePeriod(1)
        expect(await pool.maxInactivePeriod()).to.equal(1)
      })

      it('Owner and only owner can set period to start auction', async function () {
        await expect(pool.connect(other).setPeriodToStartAuction(1)).to.be.revertedWithCustomError(
          pool,
          ERRORS.GLOBAL.ONLY_GOVERNOR,
        )

        await pool.setPeriodToStartAuction(1)
        expect(await pool.periodToStartAuction()).to.equal(1)
      })

      it('Owner and only owner can set symbol', async function () {
        await expect(pool.connect(other).setSymbol('NSMB')).to.be.revertedWithCustomError(
          pool,
          ERRORS.GLOBAL.ONLY_GOVERNOR,
        )

        await pool.setSymbol('NSMB')
        expect(await pool.symbol()).to.equal('NSMB')
      })

      it('Owner or manager can set maximum capacity', async function () {
        await expect(pool.connect(other).setMaxCapacity(1)).to.be.revertedWith(
          ERRORS.POOL_MASTER.ONLY_GOVERNOR_OR_MANAGER,
        )

        await pool.setMaxCapacity(1)
        expect(await pool.maximumCapacity()).to.equal(1)
      })
    })
  })
})
