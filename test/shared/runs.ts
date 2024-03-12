import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { FaucetToken, PoolFactory, PoolMaster } from '../../typechain'

const { parseUnits, formatBytes32String } = ethers.utils

async function createPool(
  factory: PoolFactory,
  manager: SignerWithAddress,
  currency: FaucetToken,
  symbol: string = 'MNG',
  requireKYC: boolean = false
) {
  // Create a Pool
  await factory.createPoolInitial(
    manager.address,
    currency.address,
    formatBytes32String('info'),
    symbol,
    requireKYC
  )
  const info = await factory.managerInfo(manager.address)
  return await ethers.getContractAt('PoolMaster', info.pool)
}

async function provideInitialLiquidity(
  pool: PoolMaster,
  currency: FaucetToken,
  provider: SignerWithAddress,
) {
  // Provide some liquidity
  await currency.transfer(provider.address, parseUnits('10'))
  await currency.connect(provider).approve(pool.address, parseUnits('10'))
  await pool.connect(provider).provide(parseUnits('10'))
}

async function setupAavePool(pool: PoolMaster) {
  const aavePool = await ethers.getContractAt('AavePoolMaster', pool.address)

  const LendingPoolMockFactory = await ethers.getContractFactory('LendingPoolMock')
  const lendingPool = await LendingPoolMockFactory.deploy()
  await lendingPool.createAToken(await pool.currency())

  await aavePool.upgradeTo(lendingPool.address)
}

type Run = {
  contract: string
  configuration: Function
}

type RunsMapping = {
  [index: string]: Run
}

export const runs: RunsMapping = {
  BasicPool: {
    contract: 'PoolMaster',
    configuration: async (
      factory: PoolFactory,
      manager: SignerWithAddress,
      currency: FaucetToken,
      provider: SignerWithAddress | null,
      symbol: string = 'MNG',
      requireKYC: boolean = false
    ) => {
      const pool = await createPool(factory, manager, currency, symbol, requireKYC)
      if (provider) {
        await provideInitialLiquidity(pool, currency, provider!)
      }

      return pool
    },
  },
  AavePool: {
    contract: 'AavePoolMaster',
    configuration: async (
      factory: PoolFactory,
      manager: SignerWithAddress,
      currency: FaucetToken,
      provider: SignerWithAddress | null,
      symbol: string = 'MNG',
      requireKYC: boolean = false
    ) => {
      const pool = await createPool(factory, manager, currency, symbol, requireKYC)
      await setupAavePool(pool)
      if (provider) {
        await provideInitialLiquidity(pool, currency, provider!)
      }
      return pool
    },
  },
}
