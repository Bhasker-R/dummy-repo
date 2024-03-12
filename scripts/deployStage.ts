import { network } from 'hardhat'
import { stageConfig, testnetBorrowers } from './helpers/config'
import { deploymentExists, getDeployment } from './helpers/deployer/deployments'
import deployProtocol from './pipelines/deployProtocol'
import deployTokens from './pipelines/deployTokens'

async function main() {
  if (!deploymentExists('CPOOL')) {
    if (network.name == 'localhost' || network.name == 'hardhat') {
      await deployTokens()
    } else {
      throw Error('No token deploymens!')
    }
  }
  await deployProtocol(stageConfig, testnetBorrowers)

  // Output installation
  const contracts = [
    'CPOOL',
    'USDC',
    'USDT',
    'WETH',
    'WBTC',
    'PoolFactory',
    'PoolBeacon',
    'Staking',
    'Auction',
    'CosineInterestRateModel',
    'ClearpoolLens',
  ]
  for (let contract of contracts) {
    const deployment = getDeployment(contract)
    console.log(`${contract}: ${deployment.address}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
