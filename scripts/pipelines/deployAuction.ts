import { ethers } from 'hardhat'
import { decimal } from '../../test/shared/utils'
import { Deployer, ActionType, DeployType, c } from '../helpers/deployer'

export default async function deployTokens(config: any, reset = false) {
  const deployer = new Deployer('AUCTION')

  // Deploy Auction
  const auctionDuration = config.auctionDuration
  const minBidFactor = decimal(config.minBidFactor)
  const incrementPercent = decimal(config.incrementPercent)
  const incrementMaxAmount = decimal(config.incrementMaxAmount)

  deployer.addAction({
    name: 'Deploy Auction',
    type: ActionType.Deploy,
    deployType: DeployType.Proxy,
    contract: 'Auction',
    args: [
      c('PoolFactory'),
      auctionDuration,
      minBidFactor,
      { percent: incrementPercent, maxAmount: incrementMaxAmount },
    ],
  })

  // deployer.addCall("PoolFactory", "setAuction", [c("Auction")]);
  // Execute
  await deployer.execute(reset)
}
