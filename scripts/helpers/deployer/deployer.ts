import { ethers, upgrades, network } from 'hardhat'
import { Contract } from 'ethers'
import { FormatTypes } from 'ethers/lib/utils'
import chalk from 'chalk'
import { getFactory, processArgs, getName } from './delayed'
import { saveDeployment, getDeployment } from './deployments'
import updateEnvFile from '../updateEnvFile'

export enum ActionType {
  Deploy,
  Call,
}

export enum DeployType {
  Default,
  Proxy,
  Beacon,
}

export type Action = {
  name: string
  type: ActionType
  deployType?: DeployType
  contract: string | { name: string; source: string }
  skipInitialize?: boolean | undefined
  functionName?: string
  args: Array<any>
}

const MAX_RETRIES = 3

export class Deployer {
  id: string
  actions: Action[]

  constructor(id: string) {
    this.id = id
    this.actions = []
  }

  key(): string {
    return `DEPLOYER_${this.id.toUpperCase()}_${network.name.toUpperCase()}`
  }

  addAction(action: Action): void {
    this.actions.push(action)
  }

  addActions(actions: Action[]): void {
    this.actions.push(...actions)
  }

  addCall(to: string, functionName: string, args: Array<any>, name?: string): void {
    this.actions.push({
      name: name ? name : functionName,
      functionName: functionName,
      type: ActionType.Call,
      contract: to,
      args: args,
    })
  }

  async execute(reset = false): Promise<void> {
    console.log(chalk.bold(`███ Executing deployer with ID ${this.id} ███`))

    let lastExecuted = -1
    if (!reset) {
      try {
        lastExecuted = Number.parseInt(process.env[this.key()] || '-1')
      } catch {}
    }
    // If deployer was fully executed, start from the beginning
    if (lastExecuted == this.actions.length - 1) {
      lastExecuted = -1
    }

    console.log(`Starting with step ${lastExecuted + 1}\n`)

    for (let i = lastExecuted + 1; i < this.actions.length; i++) {
      console.log(chalk.bold(`Executing step ${i}: ${this.actions[i].name}`))

      let retryCount = 0
      while (retryCount < MAX_RETRIES) {
        try {
          await this._executeAction(i)
          break
        } catch (e) {
          if ((e as any).errorDescriptor && (e as any).errorDescriptor.number == 109) {
            retryCount++
            continue
          } else {
            throw e
          }
        }
      }
    }
  }

  protected async _executeAction(i: number): Promise<void> {
    const a = this.actions[i]

    if (a.type == ActionType.Deploy) {
      await this._deploy(a)
    } else if (a.type == ActionType.Call) {
      await this._call(a)
    } else {
      throw Error('Invalid action type')
    }

    // Save execution result
    updateEnvFile({ [this.key()]: i.toString() })
    console.log('')
  }

  protected async _deploy(a: Action): Promise<void> {
    const factory = await getFactory(a.contract)
    const args = await processArgs(a.args)

    let contract: Contract = new Contract(ethers.constants.AddressZero, factory.interface)
    if (a.deployType == DeployType.Default) {
      contract = await factory.deploy(...args)
    } else if (a.deployType == DeployType.Proxy) {
      contract = await upgrades.deployProxy(factory, args, {
        initializer: a.skipInitialize ? false : undefined,
      })
    } else if (a.deployType == DeployType.Beacon) {
      contract = await upgrades.deployBeacon(factory)
    } else {
      throw Error('Unknown deploy type')
    }

    console.log(`Transaction accepted (ID: ${contract.deployTransaction.hash}), waiting...`)
    const receipt = await contract.deployTransaction.wait()

    console.log(`Contract deployed to: ${contract.address}`)

    let proxyType = ''
    switch (a.deployType) {
      case DeployType.Proxy:
        proxyType = 'proxy'
        break
      case DeployType.Beacon:
        proxyType = 'beacon'
        break
      default:
        proxyType = 'default'
        break
    }
    const info = {
      address: contract.address,
      type: proxyType,
      abi: contract.interface.format(FormatTypes.json),
      transactionHash: contract.deployTransaction.hash,
      receipt: receipt,
      args: args,
    }
    saveDeployment(getName(a.contract), info)
  }

  protected async _call(a: Action): Promise<void> {
    const info = getDeployment(getName(a.contract))

    console.log(`Calling function ${a.functionName} on contract ${a.contract}`)

    const signer = (await ethers.getSigners())[0]
    const contract = new ethers.Contract(info.address, info.abi, signer)
    const args = await processArgs(a.args)

    const tx = await contract.functions[a.functionName!](...args)

    console.log(`Transaction accepted (ID: ${tx.hash}), waiting...`)
    await tx.wait()
  }
}
