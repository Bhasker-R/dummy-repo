import { ethers } from 'hardhat'
import { expect } from 'chai'
import { increaseTime } from '../shared/utils'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { FaucetToken, Faucet } from '../../typechain'

const { parseUnits } = ethers.utils

describe('Test Faucet', function () {
  let owner: SignerWithAddress, other: SignerWithAddress
  let token: FaucetToken, faucet: Faucet

  beforeEach(async function () {
    ;[owner, other] = await ethers.getSigners()

    const FaucetTokenFactory = await ethers.getContractFactory('FaucetToken')
    const FaucetFactory = await ethers.getContractFactory('Faucet')

    token = await FaucetTokenFactory.deploy('Token', 'TKN', 18)
    faucet = await FaucetFactory.deploy(token.address, parseUnits('1'), 24 * 60 * 60)

    await token.mint(faucet.address, parseUnits('100000'))
  })

  it('Can claim from faucet with correct intervals', async function () {
    await faucet.connect(other).claim()
    expect(await token.balanceOf(other.address)).to.equal(parseUnits('1'))
    expect(await faucet.canClaim(other.address)).to.be.false

    await increaseTime(24 * 60 * 60)
    expect(await faucet.canClaim(other.address)).to.be.true

    await faucet.connect(other).claim()
    expect(await token.balanceOf(other.address)).to.equal(parseUnits('2'))
  })

  it('Owner and only owner can update amount per claim', async function () {
    await expect(faucet.connect(other).setAmountPerClaim(parseUnits('10'))).to.be.revertedWith(
      'Ownable: caller is not the owner',
    )

    await faucet.setAmountPerClaim(parseUnits('10'))
    expect(await faucet.amountPerClaim()).to.equal(parseUnits('10'))
  })

  it('Owner and only owner can update claim interval', async function () {
    await expect(faucet.connect(other).setClaimInterval(1000)).to.be.revertedWith(
      'Ownable: caller is not the owner',
    )

    await faucet.setClaimInterval(1000)
    expect(await faucet.claimInterval()).to.equal(1000)
  })
})
