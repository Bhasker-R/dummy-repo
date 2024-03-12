import { ethers } from 'hardhat'
import { expect } from 'chai'
import { increaseTime, mineBlock } from '../shared/utils'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { PoolFactory, PoolMaster, FaucetToken, CPOOL } from '../../typechain'
import setupContracts from '../shared/setup-contracts'
import { runs as allRuns } from '../shared/runs'

const { parseUnits } = ethers.utils

describe('Test CPOOL rewards for LP', function () {
  let runs = Object.values(allRuns)
  if (process.env.TESTING_POOL) {
    runs = [allRuns[process.env.TESTING_POOL!]]
  }

  runs.forEach((run) => {
    describe(`Run with master ${run.contract}`, function () {
      let owner: SignerWithAddress, other: SignerWithAddress, spi: SignerWithAddress
      let cpool: CPOOL, factory: PoolFactory, usdc: FaucetToken, pool: PoolMaster

      beforeEach(async function () {
        ;[owner, other, spi] = await ethers.getSigners()
          ; ({ factory, usdc, cpool } = await setupContracts({
            poolContract: run.contract,
          }))
        pool = await run.configuration(factory, owner, usdc, null)

        // Currency and approval
        await usdc.transfer(other.address, parseUnits('10'))
        await usdc.connect(other).approve(pool.address, parseUnits('10'))
        await usdc.approve(pool.address, parseUnits('10'))

        // Provide CPOOL to factory
        await cpool.transfer(factory.address, parseUnits('1000000'))
      })

      it('Governor and only governor can set CPOOL rewards speed', async function () {
        await expect(
          factory.connect(other).setPoolRewardPerSecond(pool.address, 10),
        ).to.be.revertedWith('Ownable: caller is not the owner')

        await expect(factory.setPoolRewardPerSecond(pool.address, 10))
          .to.emit(factory, 'PoolRewardPerSecondSet')
          .withArgs(pool.address, 10)
        expect(await pool.rewardPerSecond()).to.equal(10)
      })

      it('Getting and collecting CPOOL rewards work correct', async function () {
        await pool.connect(other).provide(parseUnits('10'))

        const tx = await factory.setPoolRewardPerSecond(pool.address, parseUnits('0.1'))
        const receipt = await tx.wait()

        await mineBlock(100)

        const minLiq = await pool.MINIMUM_LIQUIDITY();
        const totalSupply = parseUnits('10');
        const lenderBalance = totalSupply.sub(minLiq);

        const blockNumber = await ethers.provider.getBlockNumber()
        expect(await pool.withdrawableRewardOf(other.address)).to.equal(
          parseUnits('0.1').mul(blockNumber - receipt.blockNumber).mul(lenderBalance).div(totalSupply),
        )

        const tx2 = await factory.connect(other).withdrawReward([pool.address])
        const receipt2 = await tx2.wait()

        expect(await cpool.balanceOf(other.address)).to.equal(
          parseUnits('0.1')
            .mul(receipt2.blockNumber - receipt.blockNumber)
            .mul(lenderBalance)
            .div(totalSupply)
            .sub(1),
        )
      })

      it('Reward distribution is correct', async function () {
        await pool.provide(parseUnits('10'))
        await pool.connect(other).provide(parseUnits('5'))

        const tx = await factory.setPoolRewardPerSecond(pool.address, parseUnits('0.1'))
        const receipt = await tx.wait()

        await mineBlock(50)

        const minLiq = await pool.MINIMUM_LIQUIDITY();

        const firstLenderBalance = parseUnits('10').sub(minLiq).sub(1);
        const secondLenderBalance = parseUnits('5');
        const totalSupply = parseUnits('15');

        const blockNumber = await ethers.provider.getBlockNumber()
        expect(await pool.withdrawableRewardOf(owner.address)).to.equal(
          parseUnits('0.1')
            .mul(blockNumber - receipt.blockNumber)
            .mul(firstLenderBalance)
            .div(totalSupply),
        )
        expect(await pool.withdrawableRewardOf(other.address)).to.equal(
          parseUnits('0.1')
            .mul(blockNumber - receipt.blockNumber)
            .mul(secondLenderBalance)
            .div(totalSupply),
        )

        const tx2 = await pool.redeem(await pool.balanceOf(owner.address))
        const receipt2 = await tx2.wait()

        await mineBlock(50)

        const blockNumber2 = await ethers.provider.getBlockNumber()
        expect(await pool.withdrawableRewardOf(owner.address)).to.equal(
          parseUnits('0.1')
            .mul(receipt2.blockNumber - receipt.blockNumber)
            .mul(firstLenderBalance)
            .div(totalSupply),
        )
        expect(await pool.withdrawableRewardOf(other.address)).to.equal(
          parseUnits('0.1')
            .mul(receipt2.blockNumber - receipt.blockNumber)
            .mul(secondLenderBalance)
            .div(totalSupply)
            .add(
              parseUnits('0.1')
                .mul(blockNumber2 - receipt2.blockNumber)
                .mul(secondLenderBalance.sub(minLiq))
                .div(secondLenderBalance)
            ),
        )
      })

      it("Can withdraw reward from closed pool, but rewards don't accrue after closure", async function () {
        await factory.setPoolRewardPerSecond(pool.address, parseUnits('0.0001'))

        const tx = await pool.provide(parseUnits('10'))
        const receipt = await tx.wait()
        const block = await ethers.provider.getBlock(receipt.blockNumber)

        const tx2 = await pool.close()
        const receipt2 = await tx2.wait()
        const block2 = await ethers.provider.getBlock(receipt2.blockNumber)

        await increaseTime(100)

        const totalSupply = await pool.totalSupply();
        const lenderBalance = await pool.balanceOf(owner.address);

        const balanceBefore = await cpool.balanceOf(owner.address)
        await factory.withdrawReward([pool.address])
        const balanceAfter = await cpool.balanceOf(owner.address)
        expect(balanceAfter.sub(balanceBefore)).to.equal(
          parseUnits('0.0001')
            .mul(block2.timestamp - block.timestamp)
            .mul(lenderBalance)
            .div(totalSupply)
            .sub(1),
        )
      })

      it("Can withdraw reward after default, but rewards don't accrue after default", async function () {
        await factory.setPoolRewardPerSecond(pool.address, parseUnits('1'))

        const tx = await pool.provide(parseUnits('10'))
        const receipt = await tx.wait()
        const block = await ethers.provider.getBlock(receipt.blockNumber)

        await increaseTime(100)

        const totalSupply = await pool.totalSupply();
        const lenderBalance = await pool.balanceOf(owner.address);

        await pool.borrow(parseUnits('9.5'), spi.address)
        const tx2 = await pool.redeem(ethers.constants.MaxUint256)
        const receipt2 = await tx2.wait()
        const block2 = await ethers.provider.getBlock(receipt2.blockNumber)

        await increaseTime(6 * 24 * 60 * 60)

        const balanceBefore = await cpool.balanceOf(owner.address)
        await factory.withdrawReward([pool.address])
        const balanceAfter = await cpool.balanceOf(owner.address)
        const defaultTimestamp = block2.timestamp + 3 * 24 * 60 * 60
        expect(balanceAfter.sub(balanceBefore)).to.equal(
          parseUnits('1')
            .mul(defaultTimestamp - block.timestamp)
            .mul(lenderBalance)
            .div(totalSupply)
            .sub('1091368052'),
        )
      })

      it('Accrued rewards do not change when tokens are transferred', async function () {
        await factory.setPoolRewardPerSecond(pool.address, parseUnits('1'))

        await pool.provide(parseUnits('10'))
        await increaseTime(100)

        expect(await pool.withdrawableRewardOf(owner.address)).not.to.equal(0)
        expect(await pool.withdrawableRewardOf(other.address)).to.equal(0)

        await pool.transfer(other.address, await pool.balanceOf(owner.address))

        expect(await pool.withdrawableRewardOf(other.address)).to.equal(0)
      })
    })
  })
})
