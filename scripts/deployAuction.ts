import { network } from 'hardhat'
import deployAuction from './pipelines/deployAuction'
import { stageConfig, mainnetConfig } from './helpers/config'

async function main() {
  if (['mainnet', 'polygon'].includes(network.name)) {
    await deployAuction(mainnetConfig, true)
  } else {
    await deployAuction(stageConfig, true)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
