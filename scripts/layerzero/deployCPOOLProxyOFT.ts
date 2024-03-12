import { network } from 'hardhat'
import { Deployer, ActionType, DeployType, deploymentExists, c } from '../helpers/deployer'
import deployTokens from '../pipelines/deployTokens'
import importTokens from '../pipelines/importTokens'
import { LZ_ENDPOINT } from './constants'

async function main() {
  // Deploy or import CPOOL

  if (!deploymentExists('CPOOL')) {
    if (network.name == 'localhost' || network.name == 'hardhat') {
      await deployTokens()
    } else {
      await importTokens()
    }
  }

  // Deploy CPOOL Proxy OFT

  const deployer = new Deployer('CPOOLOFT')

  deployer.addAction({
    name: 'Deploy CPOOL Proxy OFT',
    type: ActionType.Deploy,
    deployType: DeployType.Default,
    contract: { name: 'CPOOLOFT', source: 'CPOOLProxyOFT20' },
    skipInitialize: true,
    args: [c('CPOOL'), LZ_ENDPOINT[network.name]],
  })

  await deployer.execute()
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
