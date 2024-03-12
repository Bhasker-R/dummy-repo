import { ContractFactory } from 'ethers'
import { ethers } from 'hardhat'
import { getDeployment } from './deployments'

class DelayedContract {
  name: string

  constructor(name: string) {
    this.name = name
  }
}

export function c(name: string): DelayedContract {
  return new DelayedContract(name)
}

class DelayedCall {
  contract: string
  functionName: string
  args: Array<any>
  process?: Function

  constructor(contract: string, functionName: string, args: Array<any>, process?: Function) {
    this.contract = contract
    this.functionName = functionName
    this.args = args
    this.process = process
  }
}

export function cc(contract: string, functionName: string, args: Array<any>, process?: Function) {
  return new DelayedCall(contract, functionName, args, process)
}

export function getName(contract: string | { name: string; source: string }): string {
  if (typeof contract === 'string' || contract instanceof String) {
    return contract as string
  } else {
    return contract.name
  }
}

export async function getFactory(
  contract: string | { name: string; source: string },
): Promise<ContractFactory> {
  let name: string
  if (typeof contract === 'string' || contract instanceof String) {
    name = contract as string
  } else {
    name = contract.source
  }
  return await ethers.getContractFactory(name)
}

export async function processArgs(args: Array<any>): Promise<Array<any>> {
  return await Promise.all(
    args.map(async (a) => {
      if (a instanceof DelayedContract) {
        const contractName = a.name
        return getDeployment(contractName).address
      } else if (a instanceof DelayedCall) {
        const info = getDeployment(getName(a.contract))
        const contract = new ethers.Contract(info.address, info.abi, ethers.provider)
        const result = await contract.functions[a.functionName!](...a.args)
        if (a.process) {
          return a.process(result)
        } else {
          return result
        }
      } else {
        return a
      }
    }),
  )
}
