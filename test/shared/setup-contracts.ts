import { upgrades, ethers } from 'hardhat'
import { MembershipStaking, PoolFactory, Auction } from '../../typechain'
import { decimal } from './utils'

const { parseUnits } = ethers.utils

export default async function setupContracts({
  poolContract = 'PoolMaster',
  baseRatePerSecond = '0.00000000063419584',
  multiplierPerSecond = '0.000000009512937595',
  jumpMultiplierPerSecond = '0.000000025367833587',
  kink = '0.8',
  reserveFactor = '0.05',
  insuranceFactor = '0.05',
}) {
  const chainIdSrc = 1
  let LZEndpointMock = await ethers.getContractFactory('LZEndpointMock')
  let lzEndpointSrcMock = await LZEndpointMock.deploy(chainIdSrc)

  const [owner, , treasury] = await ethers.getSigners()

  const CPOOLFactory = await ethers.getContractFactory('CPOOL')
  const cpool = await CPOOLFactory.deploy(owner.address)

  const StakingFactory = await ethers.getContractFactory('MembershipStaking')
  const staking = (await upgrades.deployProxy(StakingFactory, [], {
    initializer: false,
  })) as MembershipStaking

  const PoolMasterFactory = await ethers.getContractFactory(poolContract)
  const poolBeacon = await upgrades.deployBeacon(PoolMasterFactory)

  const PoolFactoryFactory = await ethers.getContractFactory('PoolFactory')
  const factory = (await upgrades.deployProxy(PoolFactoryFactory, [], {
    initializer: false,
  })) as PoolFactory

  const AuctionFactory = await ethers.getContractFactory('Auction')
  const auction = (await upgrades.deployProxy(AuctionFactory, [
    factory.address,
    60 * 60 * 24,
    decimal('1'),
    {
      percent: parseUnits('1', 16), // 1%
      maxAmount: decimal('100000'), // 100K
    },
  ])) as Auction

  const InterestRateModelFactory = await ethers.getContractFactory('DefaultInterestRateModel')
  const interestRateModel = await InterestRateModelFactory.deploy(
    decimal(baseRatePerSecond),
    decimal(multiplierPerSecond),
    decimal(jumpMultiplierPerSecond),
    decimal(kink),
  )

  const ClearpoolLensFactory = await ethers.getContractFactory('ClearpoolLens')
  const lens = await ClearpoolLensFactory.deploy(factory.address)

  const TokenFactory = await ethers.getContractFactory('FaucetToken')
  const usdc = await TokenFactory.deploy('USDC', 'USDC', 6)
  const dai = await TokenFactory.deploy('DAI', 'DAI', 18)
  const otherToken = await TokenFactory.deploy('TKN', 'TKN', 18)

  await staking.initialize(cpool.address, factory.address, parseUnits('1'))
  await factory.initialize(
    cpool.address,
    staking.address,
    poolBeacon.address,
    interestRateModel.address,
    auction.address,
  )
  await factory.setTreasury(treasury.address)
  await factory.setReserveFactor(decimal(reserveFactor))
  await factory.setMaxInactivePeriod(60 * 60 * 24 * 14)
  await factory.setInsuranceFactor(decimal(insuranceFactor))
  await factory.setProvisionalDefaultUtilization(decimal('0.99'))
  await factory.setWarningUtilization(decimal('0.95'))
  await factory.setProvisionalRepaymentUtilization(decimal('0.85'))
  await factory.setWarningGracePeriod(60 * 60 * 24 * 3)
  await factory.setPeriodToStartAuction(3 * 24 * 60 * 60)

  await cpool.delegate(owner.address)
  await cpool.approve(staking.address, parseUnits('1000'))
  await staking.stake(parseUnits('1000'))

  await usdc.mint(owner.address, parseUnits('100000'))
  await factory.setCurrency(usdc.address, true)
  await dai.mint(owner.address, parseUnits('100000'))
  await factory.setCurrency(dai.address, true)
  await otherToken.mint(owner.address, parseUnits('100000'))

  return {
    cpool,
    staking,
    poolBeacon,
    factory,
    auction,
    interestRateModel,
    usdc,
    dai,
    otherToken,
    lens,
  }
}
