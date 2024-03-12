import { ethers } from 'hardhat'
import { expect } from 'chai'
import { decimal } from './shared/utils'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { PoolFactory, FaucetToken, MembershipStaking } from '../typechain'
import setupContracts from './shared/setup-contracts'
import { ERRORS } from './shared/errors'

const { parseUnits, formatBytes32String } = ethers.utils
const { AddressZero } = ethers.constants

describe('Test PoolFactory', function () {
  let owner: SignerWithAddress, other: SignerWithAddress, third: SignerWithAddress
  let staking: MembershipStaking, factory: PoolFactory, usdc: FaucetToken, otherToken: FaucetToken

  beforeEach(async function () {
    ;[owner, other, third] = await ethers.getSigners()
      ; ({ staking, factory, usdc, otherToken } = await setupContracts({}))
  })

  describe('Configuration', function () {
    it('Only owner can set currency', async function () {
      await expect(factory.connect(other).setCurrency(otherToken.address, true)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      )
    })

    it('Should set currency', async function () {
      await factory.setCurrency(otherToken.address, true)
      expect(await factory.currencyAllowed(otherToken.address)).to.be.true
      expect(await factory.getPoolSymbol(otherToken.address, owner.address)).to.equal('cp-TKN')
    })

    it('Owner and only owner can set new pool beacon, it should be correct', async function () {
      await expect(factory.connect(other).setPoolBeacon(other.address)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      )

      await expect(factory.setPoolBeacon(ethers.constants.AddressZero)).to.be.revertedWith(
        ERRORS.GLOBAL.ADDRESS_IS_ZERO,
      )

      await factory.setPoolBeacon(other.address)
      expect(await factory.poolBeacon()).to.equal(other.address)
    })

    it('Owner and only owner can set new interest rate model, it should be correct', async function () {
      await expect(factory.connect(other).setInterestRateModel(other.address)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      )

      await expect(factory.setInterestRateModel(ethers.constants.AddressZero)).to.be.revertedWith(
        ERRORS.GLOBAL.ADDRESS_IS_ZERO,
      )

      await factory.setInterestRateModel(other.address)
      expect(await factory.interestRateModel()).to.equal(other.address)
    })

    it('Owner and only owner can set new treasury, it should be correct', async function () {
      await expect(factory.connect(other).setTreasury(other.address)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      )

      await expect(factory.setTreasury(ethers.constants.AddressZero)).to.be.revertedWith(
        ERRORS.GLOBAL.ADDRESS_IS_ZERO,
      )

      await factory.setTreasury(other.address)
      expect(await factory.treasury()).to.equal(other.address)
    })

    it('Owner and only owner can set reserve factor, it should be correct', async function () {
      await expect(factory.connect(other).setReserveFactor(decimal('0.5'))).to.be.revertedWith(
        'Ownable: caller is not the owner',
      )

      await expect(factory.setReserveFactor(decimal('2'))).to.be.revertedWith(
        ERRORS.POOL_FACTORY.GREATER_THAN_ONE,
      )

      await factory.setReserveFactor(decimal('0.5'))
      expect(await factory.reserveFactor()).to.equal(decimal('0.5'))
    })

    it('Owner and only owner can set warning utilization, it should be correct', async function () {
      await expect(factory.connect(other).setWarningUtilization(decimal('0.5'))).to.be.revertedWith(
        'Ownable: caller is not the owner',
      )

      await expect(factory.setWarningUtilization(decimal('2'))).to.be.revertedWith(
        ERRORS.POOL_FACTORY.GREATER_THAN_ONE,
      )

      await factory.setWarningUtilization(decimal('0.5'))
      expect(await factory.warningUtilization()).to.equal(decimal('0.5'))
    })

    it('Owner and only owner can set warning grace period', async function () {
      await expect(factory.connect(other).setWarningGracePeriod(1000)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      )

      await factory.setWarningGracePeriod(1000)
      expect(await factory.warningGracePeriod()).to.equal(1000)
    })

    it('Owner and only owner can set max inactive period', async function () {
      await expect(factory.connect(other).setMaxInactivePeriod(1000)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      )

      await factory.setMaxInactivePeriod(1000)
      expect(await factory.maxInactivePeriod()).to.equal(1000)
    })

    it('Owner and only owner can set period to start auction', async function () {
      await expect(factory.connect(other).setPeriodToStartAuction(1000)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      )

      await factory.setPeriodToStartAuction(1000)
      expect(await factory.periodToStartAuction()).to.equal(1000)
    })

    it('Owner and only owner can sweep', async function () {
      await usdc.transfer(factory.address, parseUnits('1'))

      await expect(
        factory.connect(other).sweep(usdc.address, other.address, parseUnits('1')),
      ).to.be.revertedWith('Ownable: caller is not the owner')

      await factory.sweep(usdc.address, owner.address, parseUnits('1'))
      expect(await usdc.balanceOf(factory.address)).to.equal(0)
    })

    it("Owner can't sweep CPOOL", async function () {
      let cpool = await factory.cpool()

      await expect(factory.sweep(cpool, owner.address, parseUnits('1'))).to.be.revertedWith(
        ERRORS.POOL_FACTORY.SWEEP_NOT_ALLOWED,
      )
    })

    it("Can't close pool directly", async function () {
      const FakePoolFactory = await ethers.getContractFactory('FakePool')
      const fakePool = await FakePoolFactory.deploy(factory.address)

      await expect(fakePool.close()).to.be.revertedWith(ERRORS.POOL_FACTORY.SENDER_NOT_POOL)
    })
  })

  describe('Pool Creation', async function () {
    it('Only owner can create pool initial', async function () {
      await expect(
        factory
          .connect(other)
          .createPoolInitial(other.address, usdc.address, formatBytes32String('ingo'), 'MNG', false),
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('Creating pool initial works', async function () {
      await factory.createPoolInitial(
        other.address,
        usdc.address,
        formatBytes32String('info'),
        'MNG',
        false
      )

      const info = await factory.managerInfo(other.address)
      expect(info.pool).not.to.equal(AddressZero)
      expect(info.ipfsHash).to.equal(formatBytes32String('info'))
      expect(info.managerSymbol).to.equal('MNG')
      expect(info.staker).to.equal(owner.address)
      expect(info.stakedAmount).to.equal(await staking.managerMinimalStake())

      expect(await staking.locked(owner.address)).to.equal(info.stakedAmount)
    })

    it('Pool address adds to marketPools with createPoolInitial()', async function () {
      await expect(factory.marketPools(usdc.address, 0)).to.be.reverted

      await factory.createPoolInitial(
        other.address,
        usdc.address,
        formatBytes32String('info'),
        'MNG',
        false
      )

      const info = await factory.managerInfo(other.address)

      expect(await factory.marketPools(usdc.address, 0)).to.eq(info.pool)
    })

    it('Pool address adds to marketPools with createPool()', async function () {
      await expect(factory.marketPools(usdc.address, 0)).to.be.reverted

      await factory.createPoolInitial(
        other.address,
        usdc.address,
        formatBytes32String('info'),
        'MNG',
        false
      )

      await factory.createPoolInitial(
        third.address,
        usdc.address,
        formatBytes32String('info'),
        'MNG2',
        false
      )

      const pool1 = await factory.pools(0)
      const pool2 = await factory.pools(1)

      expect(await factory.marketPools(usdc.address, 0)).to.eq(pool1)
      expect(await factory.marketPools(usdc.address, 1)).to.eq(pool2)
    })

    it("Pool address removes from marketpools with it's closing", async function () {
      await factory.createPoolInitial(
        owner.address,
        usdc.address,
        formatBytes32String('info'),
        'MNG',
        false
      )

      const poolAddr = await factory.pools(0)
      const pool = await ethers.getContractAt('PoolMaster', poolAddr)

      expect(await factory.marketPools(usdc.address, 0)).to.eq(poolAddr)

      await pool.connect(owner).close()

      await expect(factory.marketPools(usdc.address, 0)).to.be.reverted
    })

    it("Can't twice create pool initial", async function () {
      await factory.createPoolInitial(
        owner.address,
        usdc.address,
        formatBytes32String('info'),
        'MNG',
        false
      )

      await expect(
        factory.createPoolInitial(owner.address, usdc.address, formatBytes32String('info'), 'MNG', false),
      ).to.be.revertedWith(ERRORS.POOL_FACTORY.ALREADY_HAS_INFO)
    })

    it('Only owner can create pool non-initial', async function () {
      await expect(
        factory.connect(other).createPool(other.address, usdc.address, false),
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it("Can't create pool non-initial without previous initialization", async function () {
      await expect(factory.createPool(other.address, usdc.address, false)).to.be.revertedWith(
        ERRORS.POOL_FACTORY.MANAGER_HAVE_INFO,
      )
    })

    it('Creating pool non-initial works', async function () {
      await factory.createPoolInitial(
        owner.address,
        usdc.address,
        formatBytes32String('info'),
        'MNG',
        false
      )
      const info = await factory.managerInfo(owner.address)

      const pool = await ethers.getContractAt('PoolMaster', info.pool)
      await pool.close()

      await factory.createPool(owner.address, usdc.address, false)
    })
  })

  describe('Pool Transfer', async function () {
    this.beforeEach(async function () {
      await factory.createPoolInitial(
        other.address,
        usdc.address,
        formatBytes32String('info'),
        'MNG',
        false
      )
    })

    it('Only owner can transfer pool', async function () {
      await expect(
        factory.connect(other).transferPool(other.address, third.address),
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it("Can't transfer pool to manager with existing pool", async function () {
      await factory.createPoolInitial(
        third.address,
        usdc.address,
        formatBytes32String('info2'),
        'MNG2',
        false
      )

      await expect(factory.transferPool(other.address, third.address)).to.be.revertedWith(
        ERRORS.POOL_FACTORY.ALREADY_HAS_POOL,
      )
    })

    it('Transferring pool should work', async function () {
      let info = await factory.managerInfo(other.address)
      const pool = await ethers.getContractAt('PoolMaster', info.pool)
      await usdc.approve(pool.address, parseUnits('10'))
      await pool.provide(parseUnits('10'))

      await factory.transferPool(other.address, third.address)

      await pool.connect(third).borrow(parseUnits('5'), third.address)
      expect(await pool.manager()).to.equal(third.address)

      info = await factory.managerInfo(other.address)
      expect(info.pool).to.equal(AddressZero)
      info = await factory.managerInfo(third.address)
      expect(info.pool).to.equal(pool.address)
    })
  })
})
