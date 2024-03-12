import { ethers } from 'hardhat'
import { expect } from 'chai'

import { TypedDataField } from '@ethersproject/abstract-signer'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { splitSignature } from '@ethersproject/bytes'
import { BigNumber, BigNumberish, Contract, ContractReceipt, ContractTransaction } from 'ethers'

export async function isValidTx(tx: ContractTransaction) {
  try {
    const receipt = await tx.wait()
  } catch (error) {
    return false
  }
  return true
}

export async function signMessage(
  signer: SignerWithAddress,
  domain: object,
  types: Record<string, TypedDataField[]>,
  message: Record<string, any>,
) {
  return splitSignature(await signer._signTypedData(domain, types, message))
}

const getKeyValue = (key: any) => (obj: any) => obj[key]

export function expectEvent(
  receipt: ContractReceipt,
  contractAddress: string,
  eventName: string,
  args: object,
) {
  const event = receipt.events!.find((e) => e.address == contractAddress && e.event == eventName)
  expect(event).not.to.be.undefined
  expect(event).not.to.be.null
  if (args) {
    expect(event!.args).not.to.be.null
    for (const arg in args) {
      expect(getKeyValue(arg)(event!.args)).to.equal(getKeyValue(arg)(args))
    }
  }
  return event ? event?.args : null
}

export function expectObject(real: object, expected: object) {
  for (const key in expected) {
    expect(getKeyValue(key)(real)).to.equal(getKeyValue(key)(expected))
  }
}

export function decimal(value: string) {
  return ethers.utils.parseEther(value)
}

export async function mineBlock(count = 1) {
  for (var i = 0; i < count; i++) {
    await ethers.provider.send('evm_mine', [])
  }
}

export async function stopMining() {
  await ethers.provider.send('evm_setAutomine', [false])
  await ethers.provider.send('evm_setIntervalMining', [1e9])
}

export async function startMining(mineNow = true) {
  await ethers.provider.send('evm_setAutomine', [true])
  await ethers.provider.send('evm_setIntervalMining', [0])
  if (mineNow) {
    await ethers.provider.send('evm_mine', [])
  }
}

export async function increaseTime(seconds: number, mineNow: boolean = true) {
  await ethers.provider.send('evm_increaseTime', [seconds])
  if (mineNow) {
    await mineBlock()
  }
}

export async function both(contract: Contract, method: string, args: Array<any> = []) {
  const reply = await contract.callStatic[method](...args)
  const receipt = await contract[method](...args)
  return { reply, receipt }
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export const SECONDS_PER_YEAR = 31536000

export function perSecond(rate: BigNumberish): BigNumber {
  return ethers.BigNumber.from(rate).div(SECONDS_PER_YEAR)
}

export function asAnnual(rate: BigNumberish): BigNumber {
  return ethers.BigNumber.from(rate).mul(SECONDS_PER_YEAR)
}

export function getWeightedAverage(nums: BigNumber[], weights: BigNumber[]): BigNumber {
  const [sum, weightSum] = weights.reduce(
    (acc, w, i) => {
      acc[0] = acc[0].add(nums[i].mul(w))
      acc[1] = acc[1].add(w)
      return acc
    },
    [ethers.BigNumber.from('0'), ethers.BigNumber.from('0')],
  )
  return sum.div(weightSum)
}

export function calcCpoolApr(
  totalSupply: number,
  exchangeRate: number,
  cpoolPrice: number,
  rewardPerSecond: number,
) {
  if (!totalSupply) {
    return 0 // prevent division by 0
  }

  const poolSupply = totalSupply * exchangeRate // poolSize cannot be used because it does not include already accrued interest
  const rewardPerYear = rewardPerSecond * SECONDS_PER_YEAR // ~ in USD
  const usdRewardPerYear = rewardPerYear * cpoolPrice

  return (usdRewardPerYear * 100) / poolSupply
}
