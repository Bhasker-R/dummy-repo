import { ethers } from 'hardhat'
import { decimal } from '../../test/shared/utils'
import { Deployer, ActionType, DeployType, c } from '../helpers/deployer'

export default async function deployCosineIRM(config: any, reset = false) {
  const deployer = new Deployer('AUCTION')

  // Deploy IRM
  const zeroRate = decimal(config.zeroRate)
  const fullRate = decimal(config.fullRate)
  const kink = decimal(config.kink)
  const kinkRate = decimal(config.kinkRate)

  deployer.addAction({
    name: 'Deploy CosineInterestRateModel',
    type: ActionType.Deploy,
    deployType: DeployType.Default,
    contract: 'CosineInterestRateModel',
    args: [zeroRate, fullRate, kink, kinkRate],
  })

  await deployer.execute(reset)
}
