import { ethers, network } from 'hardhat'
import { tokens } from '../helpers/config'
import { LZ_CHAIN_ID } from './constants'

async function main() {
	const targetNetworkName = 'mantle'

  const oft = await ethers.getContractAt('CPOOLOFT20', (tokens as any)[network.name].cpoolOft)

  const remoteOftAddress = (tokens as any)[targetNetworkName].cpoolOft

  const targetChainId = LZ_CHAIN_ID[targetNetworkName]
  console.log(
    `Setting trusted remote for chain ${targetNetworkName} (LayerZero id = ${targetChainId})`,
  )

  const remote = ethers.utils.solidityPack(['address', 'address'], [remoteOftAddress, oft.address])

  const tx = await oft.setTrustedRemote(targetChainId, remote)

  console.log('TX ID:', tx.hash)

  await tx.wait()
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
