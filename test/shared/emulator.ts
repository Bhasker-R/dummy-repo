import { ethers } from 'hardhat'
import { BigNumber, BigNumberish } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { parseEther } from 'ethers/lib/utils'
import setupContracts from './setup-contracts'
import { PoolMaster, PoolFactory, FaucetToken } from '../../typechain'

export enum ActionType {
  Provide = 'Provide',
  Redeem = 'Redeem',
  Borrow = 'Borrow',
  Repay = 'Repay',
  Faucet = 'Faucet',
  Mine = 'Mine',
  IncreaseTime = 'IncreaseTime',
}
export interface Action {
  type: ActionType
  actor?: SignerWithAddress
  value: string
  result?: Data
}
export interface Data {
  block?: BigNumberish
  timestamp?: BigNumberish
  state?: number
  poolSize?: BigNumberish
  supplyRate?: BigNumberish
  borrowRate?: BigNumberish
  availableForLP?: BigNumberish
  availableForBR?: BigNumberish
  cash?: BigNumberish
  reserves?: BigNumberish
  insurance?: BigNumberish
  borrows?: BigNumberish
  utilisationRate?: BigNumberish
  users?: UserState[]
}

export interface UserState {
  address: string
  cpTokens?: BigNumberish
}

export interface Params {
  baseRatePerSecond: string
  multiplierPerSecond: string
  jumpMultiplierPerSecond: string
  kink: string
  reserveFactor: string
  insuranceFactor: string
}

export class Emulator {
  pool!: PoolMaster
  usdc!: FaucetToken
  factory!: PoolFactory

  constructor() { }

  async setup(params: Params) {
    const contracts = await setupContracts({
      baseRatePerSecond: params.baseRatePerSecond,
      multiplierPerSecond: params.multiplierPerSecond,
      jumpMultiplierPerSecond: params.jumpMultiplierPerSecond,
      kink: params.kink,
      reserveFactor: params.reserveFactor,
      insuranceFactor: params.insuranceFactor,
    })
    this.factory = contracts.factory
    this.usdc = contracts.usdc
  }

  async createPool(manager: SignerWithAddress): Promise<string> {
    await this.factory.createPoolInitial(
      manager.address,
      this.usdc.address,
      '0x5bc3f60f6e3a974a8c563323d93981a71289a260dd8bd4ac084c4469aa9cc73d',
      'MNG',
      false
    )
    const info = await this.factory.managerInfo(manager.address)
    this.pool = await ethers.getContractAt('PoolMaster', info.pool)
    return this.pool.address
  }

  async getData() {
    const cash = await this.usdc.balanceOf(this.pool.address)
    const reserves = await this.pool.reserves()
    const insurance = await this.pool.insurance()
    const poolSize = await this.pool.poolSize()
    const availableForLP = await this.pool.availableToWithdraw()
    const availableForBR = await this.pool.availableToBorrow()
    const supplyRate = await this.pool.getSupplyRate()
    const borrowRate = await this.pool.getBorrowRate()
    const utilisationRate = await this.pool.getUtilizationRate()
    const block = await ethers.provider.getBlockNumber()
    const timestamp = (await ethers.provider.getBlock(block)).timestamp
    const borrows = await this.pool.borrows()
    const state = await this.pool.state()
    const data: Data = {
      block,
      timestamp,
      state,
      poolSize,
      supplyRate,
      borrowRate,
      availableForLP,
      availableForBR,
      cash,
      reserves,
      insurance,
      borrows,
      utilisationRate,
    }
    return data
  }

  async getLog(): Promise<Data> {
    let data: any = await this.getData()
    Object.keys(data).forEach((key: string) => {
      data[key] = data[key].toString()
    })
    return data
  }

  async getUserData(address: string): Promise<UserState> {
    const cpTokens = await this.pool.balanceOf(address)
    return {
      address,
      cpTokens,
    }
  }

  async checkUser(userResult: any) {
    const data: any = await this.getUserData(userResult.address)
    Object.keys(userResult).forEach((key: string) => {
      let res = userResult[key]
      if (key !== 'address') {
        res = parseEther(userResult[key])
      }
      expect(res).to.equal(data[key], `Wrong parameter: ${key}`)
    })
  }

  async check(result: any) {
    const data: any = await this.getData()
    Object.keys(result).forEach((key: string) => {
      if (key === 'users') {
        result[key].forEach(async (user: any) => {
          await this.checkUser(user)
        })
      } else {
        const res = parseEther(result[key])
        expect(res).to.equal(data[key], `Wrong parameter: ${key}`)
      }
    })
  }

  async run(actions: Action[]): Promise<any[]> {
    let logs: any[] = []
    for (const action of actions) {
      let value
      if (action.value === 'max') {
        value = ethers.constants.MaxUint256
      } else {
        value = parseEther(action.value)
      }
      switch (action.type) {
        case ActionType.Provide:
          await this.usdc.connect(action.actor!).approve(this.pool.address, value)
          await this.pool.connect(action.actor!).provide(value)
          break
        case ActionType.Redeem:
          await this.pool.connect(action.actor!).redeem(value)

          break

        case ActionType.Borrow:
          await this.pool.connect(action.actor!).borrow(value, action.actor?.address!)
          break

        case ActionType.Repay:
          await this.usdc.connect(action.actor!).approve(this.pool.address, value)
          await this.pool.connect(action.actor!).repay(value)
          break

        case ActionType.Mine:
          for (let i = 0; i < parseInt(action.value); i++) {
            await ethers.provider.send('evm_increaseTime', [14])
            await ethers.provider.send('evm_mine', [])
          }
          break

        case ActionType.IncreaseTime:
          await ethers.provider.send('evm_increaseTime', [parseInt(action.value)])
          break
        case ActionType.Faucet:
          await this.usdc.connect(action.actor!).faucet(value)
      }
      if (action.result) {
        await this.check(action.result)
      }
      if (action.type !== ActionType.Faucet) {
        const log: any = await this.getLog()
        log['action'] = action.type
        logs.push(log)
      }
    }
    return logs
  }
}
