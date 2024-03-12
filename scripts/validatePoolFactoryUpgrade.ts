import { ethers, upgrades } from 'hardhat'
import { getDeployment } from './helpers/deployer'

async function main() {
  console.log('Deploying new PoolFactory implementation...')

  const PoolFactory = await ethers.getContractFactory('PoolFactory')
  const currentDeployment = getDeployment('PoolFactory')

  await upgrades.validateUpgrade(currentDeployment.address, PoolFactory, {
    unsafeAllowRenames: true,
  })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
