import { ethers } from 'hardhat'
import { expect } from 'chai'
import { mul, div, exp } from '@prb/math'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import {
  PoolFactory,
  PoolMaster,
  FaucetToken,
  DefaultInterestRateModel,
  ClearpoolLens,
} from '../../typechain'
import setupContracts from '../shared/setup-contracts'
import { ERRORS } from '../shared/errors'
import { PoolState } from '../shared/states'
import { runs as allRuns } from '../shared/runs'
import {
  decimal,
  increaseTime,
  SECONDS_PER_YEAR,
  getWeightedAverage,
  calcCpoolApr,
} from '../shared/utils'
import { BigNumber } from 'ethers'
import { parseEther } from 'ethers/lib/utils'

const { parseUnits, formatUnits } = ethers.utils
const { MaxUint256 } = ethers.constants

interface IMarketData {
  tokenAddress: string
  value: BigNumber
}

describe('Test interaction with pools: Lens', function () {
  let runs = Object.values(allRuns)
  if (process.env.TESTING_POOL) {
    runs = [allRuns[process.env.TESTING_POOL!]]
  }

  runs.forEach((run) => {
    ;(run.contract === 'AavePoolMaster' ? describe.skip : describe)(
      `Run with master ${run.contract}`,
      function () {
        let owner: SignerWithAddress,
          other: SignerWithAddress,
          spi: SignerWithAddress,
          alice: SignerWithAddress,
          bob: SignerWithAddress,
          carol: SignerWithAddress
        let factory: PoolFactory,
          usdc: FaucetToken,
          dai: FaucetToken,
          otherToken: FaucetToken,
          pool1: PoolMaster,
          pool2: PoolMaster,
          pool3: PoolMaster,
          pool4: PoolMaster,
          pool5: PoolMaster,
          lens: ClearpoolLens

        beforeEach(async function () {
          ;[owner, other, spi, alice, bob, carol] = await ethers.getSigners()
          ;({ factory, usdc, lens, dai, otherToken } = await setupContracts({
            poolContract: run.contract,
          }))
          pool1 = await run.configuration(factory, owner, usdc, other, 'MNG1')
          pool2 = await run.configuration(factory, other, usdc, other, 'MNG2')
          pool3 = await run.configuration(factory, alice, dai, other, 'MNG3')
          pool4 = await run.configuration(factory, bob, dai, other, 'MNG4')

          await factory.setCurrency(otherToken.address, true)

          pool5 = await run.configuration(factory, carol, otherToken, other, 'MNG5')
        })

        it('Pool list is correct', async function () {
          const pools = await factory.getPools()
          expect(pools.length).to.equal(5)
          expect(pools[0]).to.equal(pool1.address)
          expect(pools[1]).to.equal(pool2.address)
          expect(pools[2]).to.equal(pool3.address)
          expect(pools[3]).to.equal(pool4.address)
          expect(pools[4]).to.equal(pool5.address)
        })

        describe('Index rates', async function () {
          it('Initially borrow & supply rate indexes are correct', async function () {
            const markets = [usdc.address, dai.address, otherToken.address]
            const SupplyRates: IMarketData[] = await lens.getSupplyRatesIndexesByMarkets(markets)
            const BorrowRates: IMarketData[] = await lens.getBorrowRatesIndexesByMarkets(markets)
            expect(SupplyRates).to.deep.eq(BorrowRates)
          })

          it('Subsequent borrow & supply rate indexes are correct', async function () {
            await pool1.borrow(parseUnits('4'), owner.address)
            await pool2.connect(other).borrow(parseUnits('2'), other.address)

            await pool3.connect(alice).borrow(parseUnits('4'), alice.address)
            await pool4.connect(bob).borrow(parseUnits('4'), bob.address)
            await pool5.connect(carol).borrow(parseUnits('1'), carol.address)

            const [apr1, apr2, apr3, apr4, apr5] = await Promise.all([
              pool1.getBorrowRate(),
              pool2.getBorrowRate(),
              pool3.getBorrowRate(),
              pool4.getBorrowRate(),
              pool5.getBorrowRate(),
            ])

            const indexApr = await lens.getBorrowRatesIndexesByMarkets([
              usdc.address,
              dai.address,
              otherToken.address,
            ])
            const usdIndexApr = await lens.getBorrowRatesIndexesByMarkets([usdc.address])

            const usdApr = apr1.add(apr2).div(2)
            const daiApr = apr3.add(apr4).div(2)
            const otherApr = apr5

            const usdBorrowIndex = async () => {
              let totalPoolSize = BigNumber.from(0)
              let rate = BigNumber.from(0)

              let pool1Size = await pool1.poolSize()

              totalPoolSize = totalPoolSize.add(pool1Size)
              rate = (await pool1.getBorrowRate()).mul(pool1Size)

              let pool2Size = await pool2.poolSize()

              totalPoolSize = totalPoolSize.add(pool2Size)
              rate = rate.add((await pool2.getBorrowRate()).mul(pool2Size))

              rate = rate.div(totalPoolSize)
              return rate
            }

            expect(indexApr[0].value).to.equal(usdIndexApr[0].value)
            expect(indexApr[0].value).to.equal(await usdBorrowIndex())
            expect(indexApr[0].value).to.equal(usdApr.sub(1))
            expect(indexApr[1].value).to.equal(daiApr)
            expect(indexApr[2].value).to.equal(otherApr)
          })

          it('CPOOL APR is correct', async function () {
            // set reward
            const rps = parseUnits('0.36')
            const tx = await factory.setPoolRewardPerSecond(pool1.address, rps)
            await tx.wait()

            // get reference rate
            const cpoolPrice = 0.038
            const parsedCpoolPrice = parseUnits(String(cpoolPrice))

            const [rawTotalSupply, rawExchangeRate, rawRewardPerSecond, poolDecimals] =
              await Promise.all([
                pool1.totalSupply(),
                pool1.getCurrentExchangeRate(),
                pool1.rewardPerSecond(),
                pool1.decimals(),
              ])

            const totalSupply = parseFloat(formatUnits(rawTotalSupply))
            const exchangeRate = parseFloat(formatUnits(rawExchangeRate))
            const rewardPerSecond = parseFloat(formatUnits(rawRewardPerSecond))

            const referenceAPR = calcCpoolApr(
              totalSupply,
              exchangeRate,
              cpoolPrice,
              rewardPerSecond,
            )

            const lensAPR = await lens.getPoolCpoolApr(pool1.address, parsedCpoolPrice)

            expect(formatUnits(lensAPR.mul(100), poolDecimals)).to.equal(String(referenceAPR))
          })

          it('APR index is correct', async function () {
            const cpoolPrice = parseEther('1')

            const tx = await factory.setPoolRewardPerSecond(pool1.address, parseUnits('10'))
            const tx2 = await factory.setPoolRewardPerSecond(pool2.address, parseUnits('10'))

            await tx.wait()
            await tx2.wait()

            const [supplyRate1, supplyRate2, poolSize1, poolSize2, cpoolApr1, cpoolApr2] =
              await Promise.all([
                pool1.getSupplyRate(),
                pool2.getSupplyRate(),
                pool1.poolSize(),
                pool2.poolSize(),
                lens.getPoolCpoolApr(pool1.address, cpoolPrice),
                lens.getPoolCpoolApr(pool2.address, cpoolPrice),
              ])

            const expectedWeightedCurrencyApr = getWeightedAverage(
              [supplyRate1, supplyRate2],
              [poolSize1, poolSize2],
            )
            const expectedWeightedCpoolApr = getWeightedAverage(
              [cpoolApr1, cpoolApr2],
              [poolSize1, poolSize2],
            )

            const aprIndeces = await lens.getAprIndexByMarket([usdc.address], cpoolPrice)

            const currencyApr = aprIndeces.currencyAprs[0].value
            const cpoolApr = aprIndeces.cpoolAprs[0].value

            expect(currencyApr).to.equal(expectedWeightedCurrencyApr)
            expect(cpoolApr).to.equal(expectedWeightedCpoolApr)
          })
        })

        describe('Total parameters', async function () {
          this.beforeEach(async function () {
            await pool1.borrow(parseUnits('2'), owner.address)
            await pool2.connect(other).borrow(parseUnits('4'), other.address)
          })

          it('Total liquidity is correct', async function () {
            const totalLiquidity = await lens.getTotalLiquidityByMarkets([
              usdc.address,
              dai.address,
              otherToken.address,
            ])

            const interest1 = await pool1.interest()
            const interest2 = await pool2.interest()

            expect(totalLiquidity[0].value).to.equal(
              parseUnits('20').add(interest1.mul(9).div(10)).add(interest2.mul(9).div(10)).add(2),
            )

            const interest3 = await pool3.interest()
            const interest4 = await pool4.interest()

            expect(totalLiquidity[1].value).to.equal(
              parseUnits('20').add(interest3.mul(9).div(10)).add(interest4.mul(9).div(10)),
            )

            const interest5 = await pool5.interest()

            expect(totalLiquidity[2].value).to.equal(parseUnits('10').add(interest5.mul(9).div(10)))
          })

          it('Total interest is valid', async function () {
            const [interest1, interest2, interest3, interest4, interest5] = await Promise.all([
              pool1.interest(),
              pool2.interest(),
              pool3.interest(),
              pool4.interest(),
              pool5.interest(),
            ])

            const totalInterest = await lens.getTotalInterestsByMarkets([
              usdc.address,
              dai.address,
              otherToken.address,
            ])
            expect(totalInterest[0].value).to.equal(interest1.add(interest2))

            expect(totalInterest[1].value).to.equal(interest3.add(interest4))

            expect(totalInterest[2].value).to.equal(interest5)
          })

          it('Total borrows are valid', async function () {
            await pool1.borrow(parseUnits('4'), owner.address)
            await pool2.connect(other).borrow(parseUnits('2'), other.address)

            await pool3.connect(alice).borrow(parseUnits('4'), alice.address)
            await pool4.connect(bob).borrow(parseUnits('4'), bob.address)
            await pool5.connect(carol).borrow(parseUnits('1'), carol.address)

            const [borrows1, borrows2, borrows3, borrows4, borrows5] = await Promise.all([
              pool1.borrows(),
              pool2.borrows(),
              pool3.borrows(),
              pool4.borrows(),
              pool5.borrows(),
            ])

            const totalBorrows = await lens.getTotalBorrowsByMarkets([
              usdc.address,
              dai.address,
              otherToken.address,
            ])

            expect(totalBorrows[0].value).to.equal(borrows1.add(borrows2))

            expect(totalBorrows[1].value).to.equal(borrows3.add(borrows4))

            expect(totalBorrows[2].value).to.equal(borrows5)
          })

          it('Total principal is valid', async function () {
            const [principal1, principal2, principal3, principal4, principal5] = await Promise.all([
              pool1.principal(),
              pool2.principal(),
              pool3.principal(),
              pool4.principal(),
              pool5.principal(),
            ])

            const totalPrincipal = await lens.getTotalPrincipalsByMarkets([
              usdc.address,
              dai.address,
              otherToken.address,
            ])

            expect(totalPrincipal[0].value).to.equal(principal1.add(principal2))

            expect(totalPrincipal[1].value).to.equal(principal3.add(principal4))

            expect(totalPrincipal[2].value).to.equal(principal5)
          })

          it('Total reserves are valid', async function () {
            const [reserves1, reserves2, reserves3, reserves4, reserves5] = await Promise.all([
              pool1.reserves(),
              pool2.reserves(),
              pool3.reserves(),
              pool4.reserves(),
              pool5.reserves(),
            ])

            const totalReserves = await lens.getTotalReservesByMarkets([
              usdc.address,
              dai.address,
              otherToken.address,
            ])

            expect(totalReserves[0].value).to.equal(reserves1.add(reserves2))

            expect(totalReserves[1].value).to.equal(reserves3.add(reserves4))

            expect(totalReserves[2].value).to.equal(reserves5)
          })
        })
      },
    )
  })
})
