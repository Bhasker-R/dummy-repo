import { BigNumber } from 'ethers'
import { decimal } from './utils'
export default class InterestRateModel {
  baseRate: BigNumber
  multiplier: BigNumber
  jumpMultiplier: BigNumber
  kink: BigNumber
  mantissa: BigNumber = decimal('1')
  constructor(
    baseRate: BigNumber,
    multiplier: BigNumber,
    jumpMultiplier: BigNumber,
    kink: BigNumber,
  ) {
    this.baseRate = baseRate
    this.multiplier = multiplier
    this.jumpMultiplier = jumpMultiplier
    this.kink = kink
  }

  utilizationRate(balance: BigNumber, borrows: BigNumber, reserves: BigNumber): BigNumber {
    return borrows.mul(this.mantissa).div(balance.add(borrows).sub(reserves))
  }

  getBorrowRate(balance: BigNumber, borrows: BigNumber, reserves: BigNumber): BigNumber {
    if (borrows.isZero()) {
      return BigNumber.from('0')
    }
    let rate
    const util = this.utilizationRate(balance, borrows, reserves)
    if (util.lte(this.kink)) {
      rate = this.baseRate.add(this.multiplier.mul(util).div(this.mantissa))
    } else {
      rate = this.baseRate
        .add(this.multiplier.mul(this.kink).div(this.mantissa))
        .add(this.jumpMultiplier.mul(util.sub(this.kink)).div(this.mantissa))
    }
    console.log(
      'ts   :',
      borrows.toString(),
      balance.toString(),
      reserves.toString(),
      rate.toString(),
    )
    return rate
  }

  getSupplyRate(
    balance: BigNumber,
    borrows: BigNumber,
    reserves: BigNumber,
    reserveFactor?: BigNumber,
  ) {
    const util = this.utilizationRate(balance, borrows, reserves)
    const borrowRate = this.getBorrowRate(balance, borrows, reserves)
    if (reserveFactor) {
      return util
        .mul(borrowRate)
        .div(this.mantissa)
        .mul(BigNumber.from(this.mantissa).sub(reserveFactor))
    } else {
      return util.mul(borrowRate).div(this.mantissa)
    }
  }
}
