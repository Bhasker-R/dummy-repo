import { ethers, upgrades } from 'hardhat'
import { getDeployment } from './helpers/deployer'


async function main() {
    console.log('Deploying new PoolBeacon implementation...')

    const PoolBeacon = await ethers.getContractFactory('PoolMaster')
    const currentDeployment = getDeployment('PoolBeacon');

    await upgrades.validateUpgrade(currentDeployment.address, PoolBeacon);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
