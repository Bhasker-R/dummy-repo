import { FormatTypes, Fragment } from 'ethers/lib/utils'
import { JsonFragment } from '@ethersproject/abi'
import { network, ethers } from 'hardhat'
import path from 'path'
import fs from 'fs'
import { Contract } from 'ethers'

export function saveDeployment(name: string, deploymentData: object): void {
  const dirPath = path.resolve(`deployments/${network.name}`)
  fs.mkdirSync(dirPath, { recursive: true })

  const filePath = `${dirPath}/${name}.json`
  fs.writeFileSync(filePath, JSON.stringify(deploymentData, null, '\t'), 'utf8')
}

export async function importDeployment(
  name: string,
  source: string,
  address: string,
  type: string = 'default',
): Promise<void> {
  const factory = await ethers.getContractFactory(source)
  let contract: Contract = new Contract(ethers.constants.AddressZero, factory.interface)
  const info = {
    address: address,
    type: type,
    abi: contract.interface.format(FormatTypes.json),
  }
  saveDeployment(name, info)
}

export function getDeployment(
  name: string,
  networkName?: string,
): {
  address: string
  abi: ReadonlyArray<Fragment | JsonFragment | string>
  type: string
  args: Array<any>
} {
  if (!networkName) {
    networkName = network.name
  }

  try {
    const filePath = path.resolve(`deployments/${networkName}/${name}.json`)
    return JSON.parse(fs.readFileSync(filePath, { encoding: 'utf8' }))
  } catch {
    throw Error(`Contract with name ${name} does not exist in current network`)
  }
}

export function deploymentExists(name: string): boolean {
  const filePath = path.resolve(`deployments/${network.name}/${name}.json`)
  return fs.existsSync(filePath)
}
