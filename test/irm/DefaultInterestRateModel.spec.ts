import { ethers } from 'hardhat'
import { expect } from 'chai'
import { decimal, perSecond } from '../shared/utils'
import { DefaultInterestRateModel } from '../../typechain'

describe('Test DefaultInterestRateModel', function () {
  let model: DefaultInterestRateModel

  const baseRate = perSecond(decimal('0.01'))
  const multiplier = perSecond(decimal('0.04'))
  const jumpMultiplier = perSecond(decimal('0.08'))
  const kink = decimal('0.8')
  const one = decimal('1')

  this.beforeEach(async function () {
    const InterestRateModelFactory = await ethers.getContractFactory('DefaultInterestRateModel')
    model = await InterestRateModelFactory.deploy(baseRate, multiplier, jumpMultiplier, kink)
  })

  it('Type getter is correct', async function () {
    expect(await model.TYPE()).to.equal('Default')
  })

  it('Zero borrows calculation is correct', async function () {
    expect(await model.getBorrowRate(100000, 0, 0)).to.equal(0)
  })

  it('Calculation when utilization lower than kink is correct', async function () {
    const util = await model.utilizationRate(100000, 90000, 10000)
    expect(await model.getBorrowRate(100000, 90000, 10000)).to.equal(
      baseRate.add(multiplier.mul(util).div(one)).add(1), // Because of rounding
    )
  })

  it('Calculation when utilization is higher than kink is correct', async function () {
    const util = await model.utilizationRate(100000, 810000, 10000)
    expect(await model.getBorrowRate(100000, 810000, 10000)).to.equal(
      baseRate
        .add(multiplier.mul(kink).div(one))
        .add(jumpMultiplier.mul(util.sub(kink)).div(one))
        .add(1), // Because of rounding
    )
  })
})
