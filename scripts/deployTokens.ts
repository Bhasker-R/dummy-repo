import hre from 'hardhat'
import deployTokens from './pipelines/deployTokens'

async function main() {
  await deployTokens()
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
