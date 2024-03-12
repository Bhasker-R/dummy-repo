import { ethers } from 'hardhat'
import { expect } from 'chai'
import { decimal, mineBlock } from '../shared/utils'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { PoolFactory, PoolMaster, FaucetToken, DefaultInterestRateModel } from '../../typechain'
import setupContracts from '../shared/setup-contracts'
import { BigNumber } from 'ethers'
import { runs as allRuns } from '../shared/runs'

const { parseUnits, formatUnits } = ethers.utils
const { MaxUint256 } = ethers.constants

describe('Test pool interaction flow', function () {
  let runs = Object.values(allRuns)
  if (process.env.TESTING_POOL) {
    runs = [allRuns[process.env.TESTING_POOL!]]
  }

  runs.forEach((run) => {
    describe(`Run with master ${run.contract}`, function () {
      let owner: SignerWithAddress, lp1: SignerWithAddress, lp2: SignerWithAddress
      let factory: PoolFactory,
        usdc: FaucetToken,
        pool: PoolMaster,
        interestRateModel: DefaultInterestRateModel

      let realCash: BigNumber,
        realPoolSize: BigNumber,
        realInterest: BigNumber,
        realBorrows: BigNumber,
        realPrincipal: BigNumber,
        realReserves: BigNumber,
        realInsurance: BigNumber,
        realLp1Balance: BigNumber,
        realLp2Balance: BigNumber
      let principal: BigNumber, oldReserves: BigNumber, oldInsurance: BigNumber,
        minLiq: BigNumber

      let states: any[] = []

      async function getState() {
        realCash = await pool.cash()
        realPoolSize = await pool.poolSize()
        realInterest = await pool.interest()
        realBorrows = await pool.borrows()
        realPrincipal = await pool.principal()
        realReserves = await pool.reserves()
        realInsurance = await pool.insurance()
        realLp1Balance = await pool.balanceOf(lp1.address)
        realLp2Balance = await pool.balanceOf(lp2.address)
        minLiq = await pool.MINIMUM_LIQUIDITY();
      }

      function logState(title: string = '') {
        states.push({
          title: title,
          cash: formatUnits(realCash),
          poolSize: formatUnits(realPoolSize),
          principal: formatUnits(realPrincipal),
          interest: formatUnits(realInterest),
          borrows: formatUnits(realBorrows),
          reserves: formatUnits(realReserves),
          insurance: formatUnits(realInsurance),
          lp1Balance: formatUnits(realLp1Balance),
          lp2Balance: formatUnits(realLp2Balance),
        })
      }

      this.beforeAll(async function () {
        ;[owner, lp1, lp2] = await ethers.getSigners()
          ; ({ factory, usdc, interestRateModel } = await setupContracts({
            poolContract: run.contract,
          }))
        pool = await run.configuration(factory, owner, usdc, null)

        // Transfer and approve
        await usdc.transfer(lp1.address, parseUnits('100'))
        await usdc.connect(lp1).approve(pool.address, parseUnits('100'))
        await usdc.transfer(lp2.address, parseUnits('100'))
        await usdc.connect(lp2).approve(pool.address, parseUnits('100'))
        await usdc.approve(pool.address, parseUnits('100'))

        await ethers.provider.send('evm_setIntervalMining', [0])
      })

      this.afterAll(async function () {
        console.table(states)
      })

      it('Stage 0 - Initial', async function () {
        await getState()
        expect(realCash).to.equal(0)
        expect(realPoolSize).to.equal(0)
        expect(realInterest).to.equal(0)
        expect(realBorrows).to.equal(0)
        expect(realPrincipal).to.equal(0)
        expect(realReserves).to.equal(0)
        expect(realInsurance).to.equal(0)
        expect(realLp1Balance).to.equal(0)
        expect(realLp2Balance).to.equal(0)
        logState('Initial')
      })

      it('Stage 1 - LP1 provides liquidity', async function () {
        await pool.connect(lp1).provide(parseUnits('10'))

        await getState()
        expect(realCash).to.equal(parseUnits('10'))
        expect(realPoolSize).to.equal(parseUnits('10'))
        expect(realInterest).to.equal(0)
        expect(realBorrows).to.equal(0)
        expect(realPrincipal).to.equal(0)
        expect(realReserves).to.equal(0)
        expect(realInsurance).to.equal(0)
        expect(realLp1Balance).to.equal(parseUnits('10').sub(minLiq))
        expect(realLp2Balance).to.equal(0)
        logState('LP1 provides liquidity')
      })

      it('Stage 2 - Empty block', async function () {
        await mineBlock()

        await getState()
        expect(realCash).to.equal(parseUnits('10'))
        expect(realPoolSize).to.equal(parseUnits('10'))
        expect(realInterest).to.equal(0)
        expect(realBorrows).to.equal(0)
        expect(realPrincipal).to.equal(0)
        expect(realReserves).to.equal(0)
        expect(realInsurance).to.equal(0)
        expect(realLp1Balance).to.equal(parseUnits('10').sub(minLiq))
        expect(realLp2Balance).to.equal(0)
        logState('Empty block')
      })

      it('Stage 3 - LP2 provides liquidity', async function () {
        await pool.connect(lp2).provide(parseUnits('5'))

        await getState()
        expect(realCash).to.equal(parseUnits('15'))
        expect(realPoolSize).to.equal(parseUnits('15'))
        expect(realInterest).to.equal(0)
        expect(realBorrows).to.equal(0)
        expect(realPrincipal).to.equal(0)
        expect(realReserves).to.equal(0)
        expect(realInsurance).to.equal(0)
        expect(realLp1Balance).to.equal(parseUnits('10').sub(minLiq))
        expect(realLp2Balance).to.equal(parseUnits('5'))
        logState('LP2 provides liquidity')
      })

      it('Stage 4 - Manager borrows', async function () {
        await pool.borrow(parseUnits('5'), owner.address)

        await getState()
        expect(realCash).to.equal(parseUnits('10'))
        expect(realPoolSize).to.equal(parseUnits('15'))
        expect(realInterest).to.equal(0)
        expect(realBorrows).to.equal(parseUnits('5'))
        expect(realPrincipal).to.equal(parseUnits('5'))
        expect(realReserves).to.equal(0)
        expect(realInsurance).to.equal(0)
        expect(realLp1Balance).to.equal(parseUnits('10').sub(minLiq))
        expect(realLp2Balance).to.equal(parseUnits('5'))
        logState('Manager borrows')
      })

      it('Stage 5 - Empty block, interest accrues', async function () {
        await mineBlock()

        const baseRate = await interestRateModel.baseRate()
        const multiplier = await interestRateModel.multiplier()
        const rate = baseRate.add(multiplier.mul(parseUnits('5')).div(parseUnits('15')))
        const interest = parseUnits('5').mul(rate).div(decimal('1'))
        const reserves = interest.mul(5).div(100)
        const insurance = interest.mul(5).div(100)

        await getState()
        expect(realCash).to.equal(parseUnits('10'))
        expect(realPoolSize).to.equal(parseUnits('15').sub(reserves).sub(insurance))
        expect(realInterest).to.equal(interest)
        expect(realBorrows).to.equal(parseUnits('5').add(interest))
        expect(realPrincipal).to.equal(parseUnits('5'))
        expect(realReserves).to.equal(reserves)
        expect(realInsurance).to.equal(insurance)
        expect(realLp1Balance).to.equal(parseUnits('10').sub(minLiq))
        expect(realLp2Balance).to.equal(parseUnits('5'))
        logState('Empty block, interest accrues')
      })

      it('Stage 6 - Empty block, interest accrues', async function () {
        await mineBlock()

        const baseRate = await interestRateModel.baseRate()
        const multiplier = await interestRateModel.multiplier()
        const rate = baseRate.add(multiplier.mul(parseUnits('5')).div(parseUnits('15')))
        const interest = parseUnits('5').mul(rate).div(decimal('1')).mul(2)
        const reserves = interest.mul(5).div(100)
        const insurance = interest.mul(5).div(100)

        await getState()
        expect(realCash).to.equal(parseUnits('10'))
        expect(realPoolSize).to.equal(parseUnits('15').sub(reserves).sub(insurance))
        expect(realInterest).to.equal(interest)
        expect(realBorrows).to.equal(parseUnits('5').add(interest))
        expect(realPrincipal).to.equal(parseUnits('5'))
        expect(realReserves).to.equal(reserves)
        expect(realInsurance).to.equal(insurance)
        expect(realLp1Balance).to.equal(parseUnits('10').sub(minLiq))
        expect(realLp2Balance).to.equal(parseUnits('5'))
        logState('Empty block, interest accrues')
      })

      it('Stage 7 - Empty block, interest accrues', async function () {
        await mineBlock()

        const baseRate = await interestRateModel.baseRate()
        const multiplier = await interestRateModel.multiplier()
        const rate = baseRate.add(multiplier.mul(parseUnits('5')).div(parseUnits('15')))
        const interest = parseUnits('5').mul(rate).div(decimal('1')).mul(3)
        const reserves = interest.mul(5).div(100)
        const insurance = interest.mul(5).div(100)

        await getState()
        expect(realCash).to.equal(parseUnits('10'))
        expect(realPoolSize).to.equal(parseUnits('15').sub(reserves).sub(insurance))
        expect(realInterest).to.equal(interest)
        expect(realBorrows).to.equal(parseUnits('5').add(interest))
        expect(realPrincipal).to.equal(parseUnits('5'))
        expect(realReserves).to.equal(reserves)
        expect(realInsurance).to.equal(insurance)
        expect(realLp1Balance).to.equal(parseUnits('10').sub(minLiq))
        expect(realLp2Balance).to.equal(parseUnits('5'))
        logState('Empty block, interest accrues')
      })

      it('Stage 8 - Borrower repays', async function () {
        await pool.repay(parseUnits('5'))

        const baseRate = await interestRateModel.baseRate()
        const multiplier = await interestRateModel.multiplier()
        const rate = baseRate.add(multiplier.mul(parseUnits('5')).div(parseUnits('15')))
        const interest = parseUnits('5').mul(rate).div(decimal('1')).mul(4)
        const reserves = interest.mul(5).div(100)
        const insurance = interest.mul(5).div(100)

        await getState()
        expect(realCash).to.equal(parseUnits('15'))
        expect(realPoolSize).to.equal(parseUnits('15').sub(reserves).sub(insurance).add(interest))
        expect(realInterest).to.equal(0)
        expect(realBorrows).to.equal(interest)
        expect(realPrincipal).to.equal(interest)
        expect(realReserves).to.equal(reserves)
        expect(realInsurance).to.equal(insurance)
        expect(realLp1Balance).to.equal(parseUnits('10').sub(minLiq))
        expect(realLp2Balance).to.equal(parseUnits('5'))
        logState('Borrower repays')
      })

      it('Stage 9 - Empty block, interest accrues', async function () {
        await mineBlock()

        principal = realPrincipal
        oldReserves = realReserves
        oldInsurance = realInsurance

        const baseRate = await interestRateModel.baseRate()
        const multiplier = await interestRateModel.multiplier()
        const rate = baseRate.add(multiplier.mul(principal).div(parseUnits('15')))
        const interest = principal.mul(rate).div(decimal('1'))
        const reserves = oldReserves.add(interest.mul(5).div(100))
        const insurance = oldInsurance.add(interest.mul(5).div(100))

        await getState()
        expect(realCash).to.equal(parseUnits('15'))
        expect(realPoolSize).to.equal(parseUnits('15').sub(reserves).sub(insurance).add(principal))
        expect(realInterest).to.equal(interest)
        expect(realBorrows).to.equal(principal.add(interest))
        expect(realPrincipal).to.equal(principal)
        expect(realReserves).to.equal(reserves)
        expect(realInsurance).to.equal(insurance)
        expect(realLp1Balance).to.equal(parseUnits('10').sub(minLiq))
        expect(realLp2Balance).to.equal(parseUnits('5'))
        logState('Empty block, interest accrues')
      })

      it('Stage 10 - LP2 redeems', async function () {
        const balanceBefore = await usdc.balanceOf(lp2.address)
        await pool.connect(lp2).redeem(MaxUint256)
        const balanceAfter = await usdc.balanceOf(lp2.address)

        const baseRate = await interestRateModel.baseRate()
        const multiplier = await interestRateModel.multiplier()
        const rate = baseRate.add(multiplier.mul(principal).div(parseUnits('15')))
        const interest = principal.mul(rate).div(decimal('1')).mul(2)
        const reserves = realReserves.add(interest.mul(5).div(100)).sub(2)
        const insurance = realReserves.add(interest.mul(5).div(100)).sub(2)

        const available = parseUnits('15').sub(reserves).sub(insurance).add(principal).add(interest)
        const supply = parseUnits('15')
        const exchangeRate = available.mul(decimal('1')).div(supply)
        const equivalent = parseUnits('5').mul(exchangeRate).div(decimal('1'))

        expect(balanceAfter.sub(balanceBefore)).to.equal(equivalent)

        await getState()
        expect(realCash).to.equal(parseUnits('15').sub(equivalent))
        expect(realPoolSize).to.equal(
          parseUnits('15').sub(equivalent).sub(reserves).sub(insurance).add(principal),
        )
        expect(realInterest).to.equal(interest)
        expect(realBorrows).to.equal(principal.add(interest))
        expect(realPrincipal).to.equal(principal)
        expect(realReserves).to.equal(reserves)
        expect(realInsurance).to.equal(insurance)
        expect(realLp1Balance).to.equal(parseUnits('10').sub(minLiq))
        expect(realLp2Balance).to.equal(0)
        logState('LP2 redeems')
      })
    })
  })
})
