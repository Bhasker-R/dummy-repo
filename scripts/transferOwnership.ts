import { Deployer } from './helpers/deployer'
import { network } from 'hardhat';
import { governor as governorList } from './helpers/config';

async function main() {
    // Deploy CPOOL OFT

    const deployer = new Deployer('TRANSFER_OWNERSHIP')
    const governor = governorList[network.name];

    if (!governor) {
        throw new Error("missing owner addresss");
    }
    //TODO: transfer ownership for AdminProxy

    deployer.addCall('PoolFactory', 'transferOwnership', [governor]);
    deployer.addCall('Auction', 'transferOwnership', [governor]);
    deployer.addCall('PoolBeacon', 'transferOwnership', [governor]);
    deployer.addCall('Staking', 'transferOwnership', [governor]);
    deployer.addCall('CPOOL', 'transferOwnership', [governor]);
    // deployer.addCall('WincentIRM', 'transferOwnership', [governor])

    await deployer.execute()
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
