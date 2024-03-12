import { ethers, network, upgrades } from 'hardhat'
import { getDeployment } from './helpers/deployer'

async function main() {
  console.log('Deploying new PoolFactory implementation...')

  const ContractFactory = await ethers.getContractFactory('PoolFactory')
  const newFactoryImpl = await ContractFactory.deploy()
  await newFactoryImpl.deployed()

  console.log('New pool factory implementation deployed to:', newFactoryImpl.address)

  const poolFactoryDeployment = getDeployment('PoolFactory')
  const adminAddress = await upgrades.erc1967.getAdminAddress(poolFactoryDeployment.address)

  console.log('Proxy admin is: ', adminAddress)
  if (!["mainnet", "polygon", "zkevm", "arbitrum", "optimism"].includes(network.name)) {
    const admin = await ethers.getContractAt('ProxyAdmin', adminAddress)

    console.log('Upgrading PoolFactory proxy...')
    const tx = await admin.upgrade(poolFactoryDeployment.address, newFactoryImpl.address)
    await tx.wait()

    console.log('Upgraded')
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
