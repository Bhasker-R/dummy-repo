import { ethers, upgrades } from 'hardhat'
import { getDeployment } from './helpers/deployer'

async function main() {
  console.log('Deploying new Auction implementation...')

  const auctionFactory = await ethers.getContractFactory('Auction')
  const newAuctionImpl = await auctionFactory.deploy()
  await newAuctionImpl.deployed()

  console.log('New Auction implementation deployed to:', newAuctionImpl.address)

  const auctionDeployment = await getDeployment('Auction')
  const adminAddress = await upgrades.erc1967.getAdminAddress(auctionDeployment.address)
  const admin = await ethers.getContractAt('ProxyAdmin', adminAddress)

  console.log('Upgrading Auction proxy...')

  const tx = await admin.upgrade(auctionDeployment.address, newAuctionImpl.address)
  await tx.wait()

  console.log('Upgraded')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
