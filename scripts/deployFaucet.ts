import hre from 'hardhat'
import { sleep } from '../test/shared/utils'

const { ethers } = hre
const parseUnits = ethers.utils.parseUnits

async function main() {
  const deployer = (await ethers.getSigners())[0]

  const tokens = [
    { name: 'CPOOL', address: process.env.CPOOL! },
    { name: 'USDC', address: process.env.USDC! },
  ]

  const amountPerClaim = parseUnits('1')
  const claimInterval = 24 * 60 * 60
  const faucetBalance = parseUnits('10000')

  const FaucetFactory = await ethers.getContractFactory('Faucet')

  const contracts: Record<string, any> = {}

  for (let token of tokens) {
    const faucet = await FaucetFactory.deploy(token.address, amountPerClaim, claimInterval)
    await faucet.deployed()

    const tokenContract = await ethers.getContractAt('FaucetToken', token.address)
    const deployerBalance = await tokenContract.balanceOf(deployer.address)
    if (deployerBalance.lt(faucetBalance)) {
      const tx = await tokenContract.mint(deployer.address, faucetBalance)
      await tx.wait()
    }
    await tokenContract.transfer(faucet.address, faucetBalance)

    console.log(`Faucet for ${token.name} deployed to: ${faucet.address}`)
    contracts[token.name] = faucet
  }

  if (hre.network.name !== 'hardhat' && hre.network.name !== 'localhost') {
    console.log('Sleeping before verification...')
    await sleep(15000)

    for (let i = 0; i < tokens.length; i++) {
      const { name, address } = tokens[i]

      await hre.run('verify:verify', {
        address: contracts[name].address,
        constructorArguments: [address, amountPerClaim, claimInterval],
      })
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
