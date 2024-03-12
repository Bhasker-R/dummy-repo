import { ethers, network } from 'hardhat'
import { expect } from 'chai'
import { decimal, increaseTime, isValidTx } from './shared/utils'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import type {
  PoolFactory,
  PoolMaster,
  CPOOL,
  FaucetToken,
  MembershipStaking,
  Auction,
} from '../typechain'
import setupContracts from './shared/setup-contracts'
import { ERRORS } from './shared/errors'
import { PoolState } from './shared/states'
import { runs as allRuns } from './shared/runs'

const { formatBytes32String } = ethers.utils
const { MaxUint256, AddressZero } = ethers.constants

const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD'
const MAX_UINT_96 = '0xffffffffffffffffffffffff'
const ONE = ethers.utils.parseUnits('1', 18)

describe('Test debt auction', function () {
  let runs = Object.values(allRuns)
  if (process.env.TESTING_POOL) {
    runs = [allRuns[process.env.TESTING_POOL!]]
  }

  runs.forEach((run) => {
    describe(`Run with master ${run.contract}`, function () {
      let owner: SignerWithAddress,
        other: SignerWithAddress,
        alice: SignerWithAddress,
        newPoolManager: SignerWithAddress
      let cpool: CPOOL,
        staking: MembershipStaking,
        auction: Auction,
        factory: PoolFactory,
        usdc: FaucetToken,
        pool: PoolMaster

      let parseUnits: any

      beforeEach(async function () {
        ;[owner, other, alice, newPoolManager] = await ethers.getSigners()
          ; ({ factory, usdc, cpool, staking, auction } = await setupContracts({
            poolContract: run.contract,
          }))
        pool = await run.configuration(factory, owner, usdc, null)

        // Initial configuration
        const decimals = await pool.decimals()
        parseUnits = (a: any) => ethers.utils.parseUnits(a, decimals)

        // transfer pool
        await factory.transferPool(owner.address, newPoolManager.address)

        await usdc.mint(other.address, parseUnits('1000'))
        await usdc.transfer(other.address, parseUnits('10'))
        await usdc.connect(other).approve(pool.address, parseUnits('10'))
        await pool.connect(other).provide(parseUnits('10'))
        await pool.connect(newPoolManager).borrow(parseUnits('9.5'), owner.address)

        await pool.connect(other).redeem(ethers.constants.MaxUint256) // 0.404040276964533718
        await increaseTime(3 * 24 * 60 * 60)

        await usdc.approve(auction.address, parseUnits('100'))
        await usdc.connect(other).approve(auction.address, parseUnits('200'))

        // set manager as whitelisted, shouldn't allow it to bid
        await auction.setWhitelistedBidder(newPoolManager.address, true)
        await auction.setWhitelistedBidder(owner.address, true)
        await auction.setWhitelistedBidder(other.address, true)
        await auction.setWhitelistedBidder(alice.address, true)
      })

      it('Owner and only owner can set whitelisted bidders', async function () {
        await expect(
          auction.connect(other).setWhitelistedBidder(other.address, true),
        ).to.be.revertedWith('Ownable: caller is not the owner')

        await auction.setWhitelistedBidder(other.address, true)
        expect(await auction.isWhitelistedBidder(other.address)).to.be.true
      })

      it("In non-default pool auction can't be started", async function () {
        await cpool.transfer(other.address, parseUnits('1000'))
        await cpool.connect(other).approve(staking.address, parseUnits('1000'))
        await factory.createPoolInitial(
          other.address,
          usdc.address,
          formatBytes32String('info'),
          'MNGO',
          false
        )

        const info = await factory.managerInfo(other.address)
        await usdc.approve(auction.address, parseUnits('100'))
        await expect(auction.bid(info.pool, parseUnits('100'))).to.be.revertedWith(
          ERRORS.AUCTION.NOT_IN_DEFAULT,
        )
      })

      it("Can't bid for non-existent pool", async function () {
        await expect(auction.bid(other.address, parseUnits('100'))).to.be.reverted
      })

      it("Can't bid without approval", async function () {
        await usdc.approve(auction.address, 0)
        await expect(auction.bid(pool.address, parseUnits('100'))).to.be.revertedWith(
          'ERC20: insufficient allowance',
        )
      })

      it('Only whitelisted bidder can start auction', async function () {
        await auction.setWhitelistedBidder(other.address, false)
        await expect(
          auction.connect(other).bid(pool.address, parseUnits('100')),
        ).to.be.revertedWith(ERRORS.AUCTION.NOT_WHITELISTED_BIDDER)
      })

      it('Only whitelisted bidder can make further bids', async function () {
        await auction.setWhitelistedBidder(other.address, false)
        await auction.bid(pool.address, parseUnits('100'))
        await expect(
          auction.connect(other).bid(pool.address, parseUnits('200')),
        ).to.be.revertedWith(ERRORS.AUCTION.NOT_WHITELISTED_BIDDER)
      })

      it('Only non-manager bidder can make further bids', async function () {
        await expect(
          auction.connect(newPoolManager).bid(pool.address, parseUnits('200')),
        ).to.be.revertedWith(ERRORS.AUCTION.POOL_MANAGER_NOT_ALLOWED)
      })

      it("Can't bid less than min bid", async function () {
        const insurance = await pool.insurance()
        await expect(auction.bid(pool.address, insurance.sub(1))).to.be.revertedWith(
          ERRORS.AUCTION.LESS_MIN_BID,
        )
      })

      it('Bidding works', async function () {
        const tx = await auction.bid(pool.address, parseUnits('100'))
        const receipt = await tx.wait()
        const block = await ethers.provider.getBlock(receipt.blockNumber)

        await expect(tx).to.emit(auction, 'AuctionStarted').withArgs(pool.address, owner.address)
        await expect(tx)
          .to.emit(auction, 'Bid')
          .withArgs(pool.address, owner.address, parseUnits('100'))

        const info = await auction.auctionInfo(pool.address)
        expect(info.end).to.equal(block.timestamp + (await auction.auctionDuration()).toNumber())
        expect(info.lastBidder).to.equal(owner.address)
        expect(info.lastBid).to.equal(parseUnits('100'))

        // Should set incrementalAmount % * poolSize
        const poolSize = await pool.poolSize()
        const poolDecimals = await pool.decimals()
        let { percent, maxAmount } = await auction.bidIncrementInfo()

        maxAmount = maxAmount.div(10 ** (18 - poolDecimals))
        if (info.incrementalAmount.eq(maxAmount)) {
          expect(info.incrementalAmount).to.equal(maxAmount)
        } else {
          expect(info.incrementalAmount).to.equal(poolSize.mul(percent).div(decimal('1')))
        }

        expect(await staking.locked(owner.address)).to.equal(0)
        expect(await cpool.balanceOf(BURN_ADDRESS)).to.equal(await staking.managerMinimalStake())
      })

      it('Can bid only with higher amount than previous bid', async function () {
        await auction.bid(pool.address, parseUnits('100'))

        await expect(
          auction.connect(other).bid(pool.address, parseUnits('100')),
        ).to.be.revertedWith(ERRORS.AUCTION.NEXT_BID_GREATER)
      })

      it('Can bid only with higher amount than previous bid + incrementalAmount', async function () {
        const previousBid = parseUnits('100')
        await auction.bid(pool.address, previousBid)

        const { incrementalAmount } = await auction.auctionInfo(pool.address)
        await expect(
          auction.connect(other).bid(pool.address, previousBid.add(incrementalAmount).sub('1')),
        ).to.be.revertedWith(ERRORS.AUCTION.LOW_BID_AMOUNT)
      })

      it("Can't bid after yourself", async function () {
        await auction.bid(pool.address, parseUnits('100'))

        await network.provider.send('hardhat_mine', ['0xA'])

        await expect(auction.bid(pool.address, parseUnits('101'))).to.be.revertedWith(
          ERRORS.AUCTION.CANT_BID_AFTER_YOURSELF,
        )
      })

      // This test brokes solidity-coverage
      it('Should prohibit two bid transactions at the same block', async function () {
        await usdc.mint(alice.address, parseUnits('1000'))
        await usdc.connect(alice).approve(auction.address, parseUnits('1000'))

        await network.provider.send('evm_setAutomine', [false])

        const tx1 = await auction.bid(pool.address, parseUnits('102'), {
          gasPrice: parseUnits('10', 'gwei'),
        })

        const tx2 = await auction.connect(alice).bid(pool.address, parseUnits('101'), {
          gasPrice: parseUnits('11', 'gwei'),
        })
        await network.provider.send('evm_setAutomine', [true])

        // await network.provider.send("evm_mine");
        await network.provider.send('hardhat_mine', ['0x9'])

        expect(await isValidTx(tx1)).to.false
        expect(await isValidTx(tx2)).to.true

        const auctionInfo = await auction.auctionInfo(pool.address)

        expect(auctionInfo.lastBidder).to.eq(alice.address)
      })

      it("Can't bid after auction end", async function () {
        await auction.bid(pool.address, parseUnits('100'))

        const auctionDuration = await auction.auctionDuration()
        await increaseTime(auctionDuration.toNumber())

        await expect(
          auction.connect(other).bid(pool.address, parseUnits('101')),
        ).to.be.revertedWith(ERRORS.AUCTION.AUCTION_FINISHED)
      })

      it("Can't increase bid of last bidder with less than increment amount", async function () {
        await auction.bid(pool.address, parseUnits('100'))

        // https://hardhat.org/hardhat-network/docs/reference#hardhat-mine
        await network.provider.send('hardhat_mine', ['0x9'])

        await usdc.approve(auction.address, parseUnits('200'))

        const info = await auction.auctionInfo(pool.address)
        await expect(
          auction.increaseBid(pool.address, info.incrementalAmount.sub('1')),
        ).to.be.revertedWith(ERRORS.AUCTION.LOW_BID_AMOUNT)
      })

      it('Can increase bid of last bidder', async function () {
        const previousBid = parseUnits('100')

        await auction.bid(pool.address, previousBid)

        // https://hardhat.org/hardhat-network/docs/reference#hardhat-mine
        await network.provider.send('hardhat_mine', ['0x9'])

        await usdc.approve(auction.address, parseUnits('200'))

        let info = await auction.auctionInfo(pool.address)
        const incrementalAmount = info.incrementalAmount

        const newBid = previousBid.add(incrementalAmount)
        await expect(() => auction.increaseBid(pool.address, newBid)).to.changeTokenBalances(
          usdc,
          [owner, auction],
          [parseUnits('0').sub(newBid), newBid],
        )

        info = await auction.auctionInfo(pool.address)
        expect(info.lastBidder).to.equal(owner.address)
        expect(info.lastBid).to.equal(newBid.add(previousBid))
      })

      it('Second bidder returns bid to the first bidder ', async function () {
        // alice bid
        await usdc.mint(alice.address, parseUnits('100'))
        await usdc.connect(alice).approve(auction.address, parseUnits('100'))

        await auction.connect(alice).bid(pool.address, parseUnits('100'))

        // other bid (automatically return bid to alice)
        await usdc.connect(other).approve(auction.address, parseUnits('300'))

        await expect(
          auction.connect(other).bid(pool.address, parseUnits('300')),
        ).to.changeTokenBalances(
          usdc,
          [alice, other, auction],
          [parseUnits('100'), parseUnits('-300'), parseUnits('200')],
        )
      })

      it("Can't increase bid before auction starts", async function () {
        await expect(auction.increaseBid(pool.address, parseUnits('200'))).to.be.revertedWith(
          ERRORS.AUCTION.AUCTION_FINISHED,
        )
      })

      it("Can't increase bid without bid", async function () {
        await usdc.mint(alice.address, parseUnits('500'))
        await usdc.connect(alice).approve(auction.address, parseUnits('1000'))

        await auction.connect(alice).bid(pool.address, parseUnits('100'))

        await usdc.connect(owner).approve(auction.address, parseUnits('200'))

        await auction.connect(owner).bid(pool.address, parseUnits('200'))

        await usdc.connect(other).approve(auction.address, parseUnits('300'))

        await auction.connect(other).bid(pool.address, parseUnits('300'))

        await network.provider.send('hardhat_mine', ['0x9'])

        await expect(
          auction.connect(alice).increaseBid(pool.address, parseUnits('500')),
        ).to.be.revertedWith(ERRORS.AUCTION.NO_BID_MADE)
      })

      it("Can't resolve auction before auction end", async function () {
        await auction.bid(pool.address, parseUnits('100'))

        await expect(auction.resolveAuction(pool.address, true)).to.be.revertedWith(
          ERRORS.AUCTION.AUCTION_NOT_FINISHED,
        )
      })

      it("Can't resolve auction if there was no auction", async function () {
        await expect(auction.resolveAuction(pool.address, true)).to.be.revertedWith(
          ERRORS.AUCTION.NO_AUCTION_EXISTS,
        )
      })

      it('Only owner can resolve auction', async function () {
        await auction.bid(pool.address, parseUnits('100'))
        await increaseTime(24 * 60 * 60)

        await expect(auction.connect(other).resolveAuction(pool.address, true)).to.be.revertedWith(
          'Ownable: caller is not the owner',
        )
      })

      it('Only owner can set bid incremental percent', async function () {
        await auction.bid(pool.address, parseUnits('100'))
        await increaseTime(24 * 60 * 60)

        await expect(
          auction.connect(other).setBidIncrementalPercent(parseUnits('2', 16)),
        ).to.be.revertedWith('Ownable: caller is not the owner')
      })

      it('Only owner can set bid incremental maxAmount', async function () {
        await auction.bid(pool.address, parseUnits('100'))
        await increaseTime(24 * 60 * 60)

        await expect(
          auction.connect(other).setBidIncrementalMaxAmount(parseUnits('200')),
        ).to.be.revertedWith('Ownable: caller is not the owner')
      })

      it('Only owner can set bid incremental percent higher than 1%', async function () {
        await auction.bid(pool.address, parseUnits('100'))
        await increaseTime(24 * 60 * 60)

        await expect(auction.setBidIncrementalPercent(parseUnits('0', 16))).to.be.revertedWith(
          ERRORS.AUCTION.INVALID_VALUE,
        )
      })

      it('Resolving auction with acceptance works correct', async function () {
        const reserves = await pool.reserves()
        const insurance = await pool.insurance()
        const cash = await pool.cash()
        const freeFunds = cash.sub(reserves).sub(insurance)

        await auction.bid(pool.address, parseUnits('100'))
        await auction.connect(other).bid(pool.address, parseUnits('150'))
        await increaseTime(24 * 60 * 60)

        await auction.resolveAuction(pool.address, true)

        expect(await pool.availableToWithdraw()).to.equal(parseUnits('150').add(freeFunds))

        const info = await auction.auctionInfo(pool.address)
        expect(info.tokenId).to.equal(1)

        expect(await auction.ownerOf(1)).to.equal(other.address)

        const tokenInfo = await auction.tokenInfo(1)
        expect(tokenInfo.pool).to.equal(pool.address)
      })

      it("Can't resolve auction twice", async function () {
        await auction.bid(pool.address, parseUnits('100'))
        await increaseTime(24 * 60 * 60)

        await auction.resolveAuction(pool.address, true)

        await expect(auction.resolveAuction(pool.address, true)).to.be.revertedWith(
          ERRORS.AUCTION.ALREADY_CLAIMED,
        )
      })

      it('Redeeming from auctionized pool works correct', async function () {
        await auction.bid(pool.address, parseUnits('100'))
        await increaseTime(24 * 60 * 60)
        await auction.resolveAuction(pool.address, true)

        const balanceBefore = await usdc.balanceOf(other.address)
        const tokensBalance = await pool.balanceOf(other.address)
        const exchangeRate = await pool.getCurrentExchangeRate();

        await pool.connect(other).redeem(tokensBalance)
        const balanceAfter = await usdc.balanceOf(other.address)

        const redeemedAmount = exchangeRate.mul(tokensBalance).div(ONE)
        expect(balanceAfter.sub(balanceBefore)).to.equal(redeemedAmount)
      })

      it('Auctionized pool will endup in Closed state', async function () {
        await auction.bid(pool.address, parseUnits('100'))
        await increaseTime(24 * 60 * 60)
        await auction.resolveAuction(pool.address, true)

        await pool.connect(other).redeem(parseUnits('5'))

        expect(await pool.state()).to.equal(PoolState.Closed)
      })

      it('Owner can reject winning bid', async function () {
        await usdc.connect(other).approve(auction.address, parseUnits('200'))

        await auction.bid(pool.address, parseUnits('100'))
        // automatically return bid to owner
        await auction.connect(other).bid(pool.address, parseUnits('200'))

        await increaseTime(24 * 60 * 60)
        await network.provider.send('hardhat_mine', ['0xA'])

        await expect(() => auction.resolveAuction(pool.address, false)).to.changeTokenBalances(
          usdc,
          [auction, other, owner],
          [parseUnits('-200'), parseUnits('200'), parseUnits('0')],
        )

        expect((await auction.auctionInfo(pool.address)).tokenId).to.equal(MAX_UINT_96)
        expect(await auction.ownerOfDebt(pool.address)).to.equal(AddressZero)
        expect(await pool.cash()).to.equal(await usdc.balanceOf(pool.address))
      })

      it('After rejection users can redeem remaining cash (including insurance)', async function () {
        await auction.bid(pool.address, parseUnits('100'))
        await increaseTime(24 * 60 * 60)
        await auction.resolveAuction(pool.address, false)

        const cash = await pool.cash()
        expect(await pool.availableToWithdraw()).to.equal(cash)

        const balance = await pool.balanceOf(other.address)
        const exchangeRate = await pool.getCurrentExchangeRate()

        const tokensForRedeem = balance.mul(exchangeRate).div(ONE)

        await pool.connect(other).redeem(balance)
        expect(await pool.cash()).to.equal(cash.sub(tokensForRedeem)) // 1 wei remaing because of rounding
      })

      it("If auction hasn't been started after period to allowWithdrawalAfterNoAuction", async function () {
        const reserves = await pool.reserves()
        const cash = await pool.cash()

        await expect(pool.allowWithdrawalAfterNoAuction()).to.be.revertedWithCustomError(
          pool,
          'CDC',
        )

        await increaseTime(3 * 24 * 60 * 60)
        await pool.allowWithdrawalAfterNoAuction()

        expect(await pool.insurance()).to.equal(0)

        const tokensBalance = await pool.balanceOf(other.address);
        const exchangeRate = await pool.getCurrentExchangeRate();
        const minLiq = await pool.MINIMUM_LIQUIDITY();

        await pool.connect(other).redeem(MaxUint256)
        const real = tokensBalance.mul(exchangeRate).div(ONE);
        const expected = cash.sub(reserves)
        expect(real.sub(expected).abs()).to.be.lte(minLiq) // Difference of several wei due to rounding in arithmetics
      })

      it("Operating after debt claim doesn't break accrual", async function () {
        await auction.bid(pool.address, parseUnits('100'))
        await increaseTime(24 * 60 * 60)
        await auction.resolveAuction(pool.address, true)

        await pool.connect(other).redeem(MaxUint256)
        expect(await pool.state()).to.equal(PoolState.Closed)
      })

      it('Pool will close after auction ends with negative resolution', async function () {
        await auction.bid(pool.address, parseUnits('100'))
        await increaseTime(24 * 60 * 60)
        await expect(() => auction.resolveAuction(pool.address, false)).to.changeTokenBalances(
          usdc,
          [auction, owner],
          [parseUnits('-100'), parseUnits('100')],
        )

        expect(await pool.state()).to.equal(PoolState.Closed)

        const reserves = await pool.reserves()
        const cash = await pool.cash()

        expect(await pool.state()).to.equal(PoolState.Closed)
        expect(await pool.insurance()).to.equal(0)
        expect(await pool.availableToWithdraw()).to.equal(cash.sub(reserves))

        const tokensBalance = await pool.balanceOf(other.address);
        const exchangeRate = await pool.getCurrentExchangeRate();
        const minLiq = await pool.MINIMUM_LIQUIDITY();

        await pool.connect(other).redeem(MaxUint256)
        const real = tokensBalance.mul(exchangeRate).div(ONE);
        const expected = cash.sub(reserves)
        expect(real.sub(expected).abs()).to.be.lte(minLiq) // Difference of several wei due to rounding in arithmetics
      })
      it('Resolve auction without governor decision after timeout', async function () {
        await usdc.connect(other).approve(auction.address, parseUnits('100'))

        await usdc.connect(owner).approve(auction.address, parseUnits('110'))

        await expect(() =>
          auction.connect(other).bid(pool.address, parseUnits('100')),
        ).to.changeTokenBalances(
          usdc,
          [auction, other, owner],
          [parseUnits('100'), parseUnits('-100'), parseUnits('0')],
        )

        await expect(() => auction.bid(pool.address, parseUnits('110'))).to.changeTokenBalances(
          usdc,
          [auction, other, owner],
          [parseUnits('10'), parseUnits('100'), parseUnits('-110')],
        )

        await increaseTime(24 * 60 * 60 * 11 + 1)
        await network.provider.send('hardhat_mine', ['0xA'])

        await expect(() =>
          auction.resolveAuctionWithoutGoverment(pool.address),
        ).to.changeTokenBalances(
          usdc,
          [auction, owner, other],
          [parseUnits('-110'), parseUnits('110'), parseUnits('0')],
        )
      })
      it("Can't resolve auction before timeout", async function () {
        await auction.bid(pool.address, parseUnits('100'))

        await increaseTime(24 * 60 * 60 * 3 - 1)
        await network.provider.send('hardhat_mine', ['0xA'])

        await expect(auction.resolveAuctionWithoutGoverment(pool.address)).to.be.revertedWith(
          ERRORS.AUCTION.TIMEOUT_NOT_PASSED,
        )
      })
      it('Manual resolution closes pool', async function () {
        await auction.bid(pool.address, parseUnits('100'))

        await increaseTime(24 * 60 * 60 * 11 + 1)
        await network.provider.send('hardhat_mine', ['0xA'])

        await auction.resolveAuctionWithoutGoverment(pool.address)

        await pool.connect(other).redeem(parseUnits('5'))

        expect(await pool.state()).to.equal(PoolState.Closed)
      })
      it('Should check changing of auction duration', async function () {
        expect(await auction.auctionDuration()).to.equal(24 * 60 * 60)

        await auction.setAuctionDuration(100)
        expect(await auction.auctionDuration()).to.equal(100)

        await auction.bid(pool.address, parseUnits('100'))
        await network.provider.send('hardhat_mine', ['0xA'])

        // bid extended end with 1 day
        await increaseTime(24 * 60 * 60 + 100)

        await expect(auction.resolveAuction(pool.address, false)).to.be.not.reverted
      })
    })
  })
})
