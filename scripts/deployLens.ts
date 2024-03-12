import { Deployer, ActionType, DeployType, c } from './helpers/deployer'

async function main() {
  const deployer = new Deployer('CUR')

  deployer.addAction({
    name: 'Deploy Lens',
    type: ActionType.Deploy,
    deployType: DeployType.Default,
    contract: 'ClearpoolLens',
    args: [c('PoolFactory')],
  })

  await deployer.execute()
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
