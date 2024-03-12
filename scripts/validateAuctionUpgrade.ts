import { ethers, upgrades } from 'hardhat'
import { getDeployment } from './helpers/deployer'

async function main() {
  console.log('Deploying new Auction implementation...')

  const auctionFactory = await ethers.getContractFactory('Auction')

  const auctionDeployment = getDeployment('Auction')

  await upgrades.validateUpgrade(auctionDeployment.address, auctionFactory)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
