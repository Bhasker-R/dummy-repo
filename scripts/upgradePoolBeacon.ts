import { ethers, network } from 'hardhat'
import { getDeployment } from './helpers/deployer'

async function main() {
  console.log('Deploying new PoolMaster...')

  const poolMasterFactory = await ethers.getContractFactory('PoolMaster')
  const newPoolMaster = await poolMasterFactory.deploy()
  await newPoolMaster.deployed()

  console.log('New pool master implementation deployed to:', newPoolMaster.address)
  const beaconDeployment = getDeployment('PoolBeacon')

  console.log('PoolBeacon', beaconDeployment.address);
  if (!["mainnet", "polygon", "zkevm", "arbitrum", "optimism"].includes(network.name)) {
    const poolBeacon = await ethers.getContractAt('UpgradeableBeacon', beaconDeployment.address)

    console.log('Upgrading beacon...')

    const tx = await poolBeacon.upgradeTo(newPoolMaster.address)
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
