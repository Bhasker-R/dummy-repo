import { ethers } from 'hardhat'
import { decimal } from '../../test/shared/utils'
import { BorrowerInfo } from '../helpers/config'
import { Deployer, ActionType, DeployType, c, cc } from '../helpers/deployer'
import pinataSDK from '@pinata/sdk'

const pinata = new pinataSDK(process.env.PINATA_API_KEY!, process.env.PINATA_API_SECRET!)

async function upload(borrower: BorrowerInfo): Promise<{ IpfsHash: string; ipfsHashHex: string }> {
  const { IpfsHash } = await pinata.pinJSONToIPFS(borrower.info)

  const ipfsHashHex = ethers.utils.hexlify(ethers.utils.base58.decode(IpfsHash).slice(2))
  console.log(`borrower info has been loaded: ${IpfsHash} ${ipfsHashHex}`)
  return {
    IpfsHash,
    ipfsHashHex
  }
}

export default async function deployProtocol(config: any, borrowers: any, reset = false) {
  const [signer] = await ethers.getSigners()
  const deployer = new Deployer('PROTOCOL_STAGE')
  // Deploy contracts actions

  deployer.addAction({
    name: 'Deploy PoolFactory',
    type: ActionType.Deploy,
    deployType: DeployType.Proxy,
    contract: 'PoolFactory',
    skipInitialize: true,
    args: []
  })

  deployer.addAction({
    name: 'Deploy MembershipStaking',
    type: ActionType.Deploy,
    deployType: DeployType.Proxy,
    contract: {
      name: 'Staking',
      source: 'MembershipStaking'
    },
    skipInitialize: true,
    args: []
  })

  deployer.addAction({
    name: 'Deploy PoolBeacon',
    type: ActionType.Deploy,
    deployType: DeployType.Beacon,
    contract: {
      name: 'PoolBeacon',
      source: 'PoolMaster'
    },
    args: []
  })

  const zeroRate = decimal(config.zeroRate)
  const fullRate = decimal(config.fullRate)
  const kink = decimal(config.kink)
  const kinkRate = decimal(config.kinkRate)

  const incrementPercent = decimal(config.incrementPercent)
  const incrementMaxAmount = decimal(config.incrementMaxAmount)

  deployer.addAction({
    name: 'Deploy CosineInterestRateModel',
    type: ActionType.Deploy,
    deployType: DeployType.Default,
    contract: 'CosineInterestRateModel',
    args: [zeroRate, fullRate, kink, kinkRate]
  })

  const auctionDuration = config.auctionDuration
  const minBidFactor = decimal(config.minBidFactor)
  deployer.addAction({
    name: 'Deploy Auction',
    type: ActionType.Deploy,
    deployType: DeployType.Proxy,
    contract: 'Auction',
    args: [
      c('PoolFactory'),
      auctionDuration,
      minBidFactor,
      { percent: incrementPercent, maxAmount: incrementMaxAmount }
    ]
  })

  deployer.addAction({
    name: 'Initialize PoolFactory',
    type: ActionType.Call,
    contract: 'PoolFactory',
    functionName: 'initialize',
    args: [c('CPOOL'), c('Staking'), c('PoolBeacon'), c('CosineInterestRateModel'), c('Auction')]
  })

  deployer.addAction({
    name: 'Initialize MemershipStaking',
    type: ActionType.Call,
    contract: 'Staking',
    functionName: 'initialize',
    args: [c('CPOOL'), c('PoolFactory'), ethers.utils.parseUnits(config.managerMinimalStake)]
  })

  deployer.addAction({
    name: 'Deploy Lens',
    type: ActionType.Deploy,
    deployType: DeployType.Default,
    contract: 'ClearpoolLens',
    args: [c('PoolFactory')]
  })

  // Configure contracts

  // Configure Factory

  deployer.addCall('PoolFactory', 'setTreasury', [
    config.treasury ? config.treasury : signer.address
  ])
  deployer.addCall('PoolFactory', 'setReserveFactor', [decimal(config.reserveFactor)])
  deployer.addCall('PoolFactory', 'setInsuranceFactor', [decimal(config.insuranceFactor)])
  deployer.addCall('PoolFactory', 'setWarningGracePeriod', [config.warningGracePeriod])
  deployer.addCall('PoolFactory', 'setMaxInactivePeriod', [config.inactivePeriod])
  deployer.addCall('PoolFactory', 'setProvisionalDefaultUtilization', [
    decimal(config.provisionalDefaultUtilization)
  ])

  deployer.addCall('PoolFactory', 'setWarningUtilization', [decimal(config.warningUtilization)])
  deployer.addCall('poolFactory', 'setProvisionalRepaymentUtilization', [
    decimal(config.provisionalRepaymentUtilization)
  ])

  deployer.addCall('PoolFactory', 'setPeriodToStartAuction', [config.auctionDuration])

  deployer.addCall('PoolFactory', 'setCurrency', [c('USDC'), true])
  deployer.addCall('PoolFactory', 'setCurrency', [c('USDT'), true])
  deployer.addCall('PoolFactory', 'setCurrency', [c('WETH'), true])
  deployer.addCall('PoolFactory', 'setCurrency', [c('WBTC'), true])

  // Configure Auction

  deployer.addCall('Auction', 'setWhitelistedBidder', [signer.address, true])
  // Setup borrowers

  deployer.addCall(
    'CPOOL',
    'approve',
    [c('Staking'), ethers.constants.MaxUint256],
    'Approve CPOOL for pool deposits'
  )

  for (let borrower of borrowers) {
    const ipfsHashHex = borrower.ipfsHashHex
      ? borrower.ipfsHashHex
      : (await upload(borrower)).ipfsHashHex

    deployer.addCall(
      'PoolFactory',
      'createPoolInitial',
      [borrower.manager, c(borrower.currency ?? 'USDC'), ipfsHashHex, borrower.info.ticker, false],
      `Create pool ${borrower.info.name}`
    )

    const perSecond = ethers.utils.parseEther('0.0001')
    deployer.addCall(
      'PoolFactory',
      'setPoolRewardPerSecond',
      [cc('PoolFactory', 'managerInfo', [borrower.manager], (i: any) => i.pool), perSecond],
      `Set reward for pool ${borrower.info.name}`
    )
  }

  // Execute

  await deployer.execute(reset)
}
