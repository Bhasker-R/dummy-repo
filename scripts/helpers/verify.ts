import { upgrades, run } from 'hardhat'
import { getDeployment } from './deployer'

export async function verify(name: string) {
  console.log(`Verifying contract ${name}`)

  const info = getDeployment(name)

  if (info.type == 'beacon') {
    const impl = await upgrades.beacon.getImplementationAddress(info.address)
    await run('verify:verify', { address: impl })
  } else if (info.type == 'proxy') {
    const impl = await upgrades.erc1967.getImplementationAddress(info.address)
    await run('verify:verify', { address: impl })
  } else {
    await run('verify:verify', {
      address: info.address,
      constructorArguments: info.args,
    })
  }
}
