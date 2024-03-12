import { ethers } from 'hardhat'
import { Deployer, ActionType, DeployType } from '../helpers/deployer'

export default async function deployTokens(reset = false) {
  const signer = (await ethers.getSigners())[0]

  const deployer = new Deployer('TOKENS')

  // Deploy CPOOL

  deployer.addAction({
    name: 'Deploy CPOOL',
    type: ActionType.Deploy,
    deployType: DeployType.Default,
    contract: 'CPOOL',
    skipInitialize: true,
    args: [signer.address],
  })

  deployer.addAction({
    name: 'Delegate CPOOL',
    type: ActionType.Call,
    contract: 'CPOOL',
    functionName: 'delegate',
    args: [signer.address],
  })

  // Deploy Tokens

  const tokens = [
    { name: 'USDC', decimals: 6 },
    { name: 'USDT', decimals: 6 },
    { name: 'WETH', decimals: 18 },
    { name: 'WBTC', decimals: 8 },
  ]

  for (const token of tokens) {
    deployer.addAction({
      name: `Deploy ${token.name}`,
      type: ActionType.Deploy,
      deployType: DeployType.Default,
      contract: {
        name: token.name,
        source: 'FaucetToken',
      },
      args: [token.name, token.name, token.decimals],
    })

    deployer.addAction({
      name: `Faucet ${token.name}`,
      type: ActionType.Call,
      contract: token.name,
      functionName: 'faucet',
      args: [ethers.utils.parseUnits('1000000000000', token.decimals)],
    })
  }

  // Execute

  await deployer.execute(reset)
}
