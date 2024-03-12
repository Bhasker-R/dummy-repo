import { network } from 'hardhat'
import deployCosineIRM from './pipelines/deployCosineIRM'
import { stageConfig, mainnetConfig } from './helpers/config'

async function main() {
    await deployCosineIRM(mainnetConfig, true)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
