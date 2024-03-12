import { ethers } from 'hardhat'
import { expect } from 'chai'
import { increaseTime } from '../shared/utils'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { PoolFactory, PoolMaster, FaucetToken } from '../../typechain'
import setupContracts from '../shared/setup-contracts'
import { ERRORS } from '../shared/errors'
import { PoolState } from '../shared/states'
import { runs as allRuns } from '../shared/runs'

const { parseUnits } = ethers.utils
const { MaxUint256 } = ethers.constants

describe('Test interaction with Pool: Default', function () {
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
        ;({ factory, usdc } = await setupContracts({
          poolContract: run.contract,
        }))
        pool = await run.configuration(factory, owner, usdc, other)
      })

      it('When utilization is beyond 99% pool goes to warning state', async function () {
        await pool.borrow(parseUnits('9.5'), owner.address)
        const tx = await pool.connect(other).redeem(MaxUint256)
        const receipt = await tx.wait()
        const block = await ethers.provider.getBlock(receipt.blockNumber)

        expect(await pool.enteredProvisionalDefault()).to.equal(block.timestamp)
        expect(await pool.state()).to.equal(PoolState.ProvisionalDefault)
      })

      it('After 3 days in warning state pool goes to default', async function () {
        await pool.borrow(parseUnits('9.5'), owner.address)
        await pool.connect(other).redeem(MaxUint256)
        await increaseTime(3 * 24 * 60 * 60)

        expect(await pool.state()).to.equal(PoolState.Default)
      })

      it('When pool is in default no repaying is available', async function () {
        await pool.borrow(parseUnits('9.5'), owner.address)
        await pool.connect(other).redeem(MaxUint256)
        await increaseTime(3 * 24 * 60 * 60)

        await usdc.approve(pool.address, MaxUint256)
        await expect(pool.repay(MaxUint256)).to.be.revertedWith(
          ERRORS.POOL_MASTER.POOL_ISNT_ACTIVE,
        )
      })

      it('Borrows can go to warning utilization on virtual accrual, pool will eventually default', async function () {
        await pool.borrow(parseUnits('9.49999999'), owner.address)
        await increaseTime(100 * 24 * 60 * 60)

        expect(await pool.state()).to.equal(PoolState.Default)
      })

      it('Governor and only governor can force default of the pool', async function () {
        await expect(pool.connect(other).forceDefault()).to.be.revertedWithCustomError(
          pool,
          ERRORS.GLOBAL.ONLY_GOVERNOR,
        )

        await pool.forceDefault()
        expect(await pool.state()).to.equal(PoolState.Default)
      })
    })
  })
})
