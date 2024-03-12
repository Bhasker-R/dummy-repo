import { ethers } from 'hardhat'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { PoolFactory, FaucetToken, LendingPoolMock, AavePoolMaster } from '../../typechain'
import setupContracts from '../shared/setup-contracts'
import { runs as allRuns } from '../shared/runs'

const { parseUnits } = ethers.utils

const shouldSkip = process.env.TESTING_POOL && process.env.TESTING_POOL !== 'AavePool'

;(shouldSkip ? describe.skip : describe)('Test Aave boosted pool', function () {
  let run = allRuns['AavePool']

  let owner: SignerWithAddress, other: SignerWithAddress, spi: SignerWithAddress
  let factory: PoolFactory,
    usdc: FaucetToken,
    pool: AavePoolMaster,
    aaveLendingPool: LendingPoolMock

  beforeEach(async function () {
    ;[owner, other, spi] = await ethers.getSigners()
    ;({ factory, usdc } = await setupContracts({
      poolContract: run.contract,
    }))
    const basicPool = await run.configuration(factory, owner, usdc, other)
    pool = await ethers.getContractAt('AavePoolMaster', basicPool.address)
    aaveLendingPool = await ethers.getContractAt('LendingPoolMock', await pool.lendingPool())
  })

  it('Accruing aave rewards to treasury works', async function () {
    await aaveLendingPool.scale(usdc.address, parseUnits('1.1'))
    await usdc.mint(aaveLendingPool.address, parseUnits('10'))

    await pool.collectAaveInterest()

    expect(await usdc.balanceOf(await factory.treasury())).to.equal(parseUnits('1'))
  })
})
