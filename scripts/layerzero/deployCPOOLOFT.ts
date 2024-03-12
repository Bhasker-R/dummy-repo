import { network } from 'hardhat'
import { Deployer, ActionType, DeployType } from '../helpers/deployer'
import { LZ_ENDPOINT } from './constants'

async function main() {
  // Deploy CPOOL OFT 
  const deployer = new Deployer('CPOOLOFT')

  deployer.addAction({
    name: 'Deploy CPOOL OFT',
    type: ActionType.Deploy,
    deployType: DeployType.Default,
    contract: { name: 'CPOOLOFT', source: 'CPOOLOFT20' },
    skipInitialize: true,
    args: [LZ_ENDPOINT[network.name]],
  })

  await deployer.execute()
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
