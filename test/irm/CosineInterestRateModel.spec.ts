import { ethers } from 'hardhat'
import { expect } from 'chai'
import { asAnnual, decimal, perSecond } from '../shared/utils'
import { CosineInterestRateModel } from '../../typechain'
import { plot } from 'asciichart'

const { parseUnits, formatUnits } = ethers.utils

describe('Test CosineInterestRateModel', function () {
  let model: CosineInterestRateModel

  const zeroRate = decimal('0.1')
  const fullRate = decimal('0.2')
  const kink = decimal('0.8')
  const kinkRate = decimal('0.05')

  this.beforeEach(async function () {
    const InterestRateModelFactory = await ethers.getContractFactory('CosineInterestRateModel')
    model = await InterestRateModelFactory.deploy(zeroRate, fullRate, kink, kinkRate)
  })

  it('Type getter is correct', async function () {
    expect(await model.TYPE()).to.equal('Cosine')
  })

  it('Zero rate is correct', async function () {
    expect(await model.getBorrowRate(parseUnits('100'), 0, 0)).to.equal(perSecond(zeroRate))
  })

  it('Full rate is correct', async function () {
    expect(await model.getBorrowRate(0, parseUnits('100'), 0)).to.equal(perSecond(fullRate))
  })

  it('Kink rate is correct', async function () {
    expect(await model.getBorrowRate(parseUnits('20'), parseUnits('80'), 0)).to.equal(
      perSecond(kinkRate),
    )
  })

  it('Rates at different utilization', async function () {
    const rates = new Array(21)
    for (let i = 0; i <= 100; i += 5) {
      const borrows = parseUnits(i.toString())
      const rate = asAnnual(await model.getBorrowRate(parseUnits('100').sub(borrows), borrows, 0))
      rates[i / 5] = rate.div(parseUnits('0.01')).toNumber()
      //console.log(`${i}% utilization: ${formatUnits(rate)}`);
    }
    console.log(plot(rates))
  })

  it('Configuring works', async function () {
    await expect(model.configure(decimal('0.2'), decimal('0.3'), decimal('0.8'), decimal('0.1')))
      .to.emit(model, 'Configured')
      .withArgs(decimal('0.2'), decimal('0.3'), decimal('0.8'), decimal('0.1'))

    expect(await model.zeroRate()).to.equal(perSecond(decimal('0.2')))
    expect(await model.fullRate()).to.equal(perSecond(decimal('0.3')))
    expect(await model.kink()).to.equal(decimal('0.8'))
    expect(await model.kinkRate()).to.equal(perSecond(decimal('0.1')))
  })
})
