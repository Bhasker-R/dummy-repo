const { expect } = require('chai')
const { ethers } = require('hardhat')

describe('CPOOLProxyOFT20: ', function () {
  const chainId_A = 1
  const chainId_B = 2
  const chainId_C = 3
  const totalSupply = ethers.utils.parseUnits('1000000000', 18)

  let owner, alice, lzEndpointMockA, lzEndpointMockB, lzEndpointMockC
  let CPOOLOFT20_B,
    CPOOLOFT20_C,
    LZEndpointMock,
    CPOOLOFT20,
    CPOOL,
    CPOOLSrc,
    CPOOLProxyOFT20_A,
    CPOOLProxyOFT20

  before(async function () {
    owner = (await ethers.getSigners())[0]
    alice = (await ethers.getSigners())[1]
    LZEndpointMock = await ethers.getContractFactory('LZEndpointMock')
    CPOOLOFT20 = await ethers.getContractFactory('CPOOLOFT20')
    CPOOLProxyOFT20 = await ethers.getContractFactory('CPOOLProxyOFT20')
    CPOOL = await ethers.getContractFactory('CPOOL')
  })

  beforeEach(async function () {
    lzEndpointMockA = await LZEndpointMock.deploy(chainId_A)
    lzEndpointMockB = await LZEndpointMock.deploy(chainId_B)
    lzEndpointMockC = await LZEndpointMock.deploy(chainId_C)

    // make an ERC20 to mock a previous deploy
    CPOOLSrc = await CPOOL.deploy(owner.address)
    // generate a proxy to allow it to go OFT
    CPOOLProxyOFT20_A = await CPOOLProxyOFT20.deploy(CPOOLSrc.address, lzEndpointMockA.address)

    // create OFT on dstChains
    CPOOLOFT20_B = await CPOOLOFT20.deploy(lzEndpointMockB.address)
    CPOOLOFT20_C = await CPOOLOFT20.deploy(lzEndpointMockC.address)

    // wire the lz endpoints to guide msgs back and forth
    lzEndpointMockA.setDestLzEndpoint(CPOOLOFT20_B.address, lzEndpointMockB.address)
    lzEndpointMockA.setDestLzEndpoint(CPOOLOFT20_C.address, lzEndpointMockC.address)
    lzEndpointMockB.setDestLzEndpoint(CPOOLProxyOFT20_A.address, lzEndpointMockA.address)
    lzEndpointMockB.setDestLzEndpoint(CPOOLOFT20_C.address, lzEndpointMockC.address)
    lzEndpointMockC.setDestLzEndpoint(CPOOLProxyOFT20_A.address, lzEndpointMockA.address)
    lzEndpointMockC.setDestLzEndpoint(CPOOLOFT20_B.address, lzEndpointMockB.address)

    // set each contracts source address so it can send to each other
    await CPOOLProxyOFT20_A.setTrustedRemote(chainId_B, CPOOLOFT20_B.address)
    await CPOOLProxyOFT20_A.setTrustedRemote(chainId_C, CPOOLOFT20_C.address)
    await CPOOLOFT20_B.setTrustedRemote(chainId_A, CPOOLProxyOFT20_A.address)
    await CPOOLOFT20_B.setTrustedRemote(chainId_C, CPOOLOFT20_C.address)
    await CPOOLOFT20_C.setTrustedRemote(chainId_A, CPOOLProxyOFT20_A.address)
    await CPOOLOFT20_C.setTrustedRemote(chainId_B, CPOOLOFT20_B.address)
  })

  it('sendFrom() - your own tokens', async function () {
    // verify owner has tokens
    expect(await CPOOLSrc.balanceOf(owner.address)).to.be.equal(totalSupply)

    // has no tokens on other chain
    expect(await CPOOLOFT20_B.balanceOf(owner.address)).to.be.equal(0)

    // can transfer tokens on srcChain as regular erC20
    const tokenAmount = ethers.utils.parseUnits('1234567', 18)
    await CPOOLSrc.transfer(alice.address, tokenAmount)
    expect(await CPOOLSrc.balanceOf(alice.address)).to.be.equal(tokenAmount)

    // approve the proxy to swap your tokens
    await CPOOLSrc.connect(alice).approve(CPOOLProxyOFT20_A.address, tokenAmount)

    // swaps token to other chain
    await CPOOLProxyOFT20_A.connect(alice).sendFrom(
      alice.address,
      chainId_B,
      alice.address,
      tokenAmount,
      alice.address,
      ethers.constants.AddressZero,
      '0x',
    )

    // tokens are now owned by the proxy contract, because this is the original oft chain
    expect(await CPOOLSrc.balanceOf(alice.address)).to.equal(0)
    expect(await CPOOLSrc.balanceOf(CPOOLProxyOFT20_A.address)).to.equal(tokenAmount)

    // tokens received on the dst chain
    expect(await CPOOLOFT20_B.balanceOf(alice.address)).to.be.equal(tokenAmount)

    // can send to other oft contract eg. not the original oft contract chain
    await CPOOLOFT20_B.connect(alice).sendFrom(
      alice.address,
      chainId_C,
      alice.address,
      tokenAmount,
      alice.address,
      ethers.constants.AddressZero,
      '0x',
    )

    // tokens are burned on the sending chain
    expect(await CPOOLOFT20_B.balanceOf(alice.address)).to.be.equal(0)

    // tokens received on the dst chain
    expect(await CPOOLOFT20_C.balanceOf(alice.address)).to.be.equal(tokenAmount)

    // send them back to the original chain
    await CPOOLOFT20_C.connect(alice).sendFrom(
      alice.address,
      chainId_A,
      alice.address,
      tokenAmount,
      alice.address,
      ethers.constants.AddressZero,
      '0x',
    )

    // tokens are burned on the sending chain
    expect(await CPOOLOFT20_C.balanceOf(alice.address)).to.be.equal(0)

    // received on the original chain
    expect(await CPOOLSrc.balanceOf(alice.address)).to.be.equal(tokenAmount)

    // tokens are no longer in the proxy contract
    expect(await CPOOLSrc.balanceOf(CPOOLProxyOFT20_A.address)).to.equal(0)
  })

  it('sendFrom() - reverts if not approved on proxy', async function () {
    const tokenAmount = ethers.utils.parseUnits('1234567', 18)
    // await CPOOLSrc.mint(owner.address, tokenAmount)
    await expect(
      CPOOLProxyOFT20_A.sendFrom(
        owner.address,
        chainId_B,
        owner.address,
        tokenAmount,
        owner.address,
        ethers.constants.AddressZero,
        '0x',
      ),
    ).to.be.revertedWith('Cpool::transferFrom: transfer amount exceeds spender allowance')
  })

  it('sendFrom() - reverts if from is not msgSender', async function () {
    const tokenAmount = ethers.utils.parseUnits('1234567', 18)

    // approve the proxy to swap your tokens
    await CPOOLSrc.approve(CPOOLProxyOFT20_A.address, tokenAmount)

    // swaps tokens to other chain
    await expect(
      CPOOLProxyOFT20_A.connect(alice).sendFrom(
        owner.address,
        chainId_B,
        owner.address,
        tokenAmount,
        owner.address,
        ethers.constants.AddressZero,
        '0x',
      ),
    ).to.be.revertedWith('CPOOLProxyOFT20: owner is not send caller')
  })

  it('sendFrom() - reverts if no balance to swap', async function () {
    const tokenAmount = ethers.utils.parseUnits('1234567', 18)
    // await CPOOLSrc.mint(owner.address, tokenAmount)

    // approve the proxy to swap your tokens
    await CPOOLSrc.approve(CPOOLProxyOFT20_A.address, tokenAmount)

    // swaps tokens to other chain
    await CPOOLProxyOFT20_A.sendFrom(
      owner.address,
      chainId_B,
      owner.address,
      tokenAmount,
      owner.address,
      ethers.constants.AddressZero,
      '0x',
    )

    // tokens received on the dst chain
    expect(await CPOOLOFT20_B.balanceOf(owner.address)).to.be.equal(tokenAmount)

    // reverts because other address does not own tokens
    await expect(
      CPOOLOFT20_B.connect(alice).sendFrom(
        alice.address,
        chainId_C,
        alice.address,
        tokenAmount,
        alice.address,
        ethers.constants.AddressZero,
        '0x',
      ),
    ).to.be.revertedWith('Cpool: burn amount exceeds balance')
  })

  it('sendFrom() - on behalf of other user', async function () {
    const tokenAmount = ethers.utils.parseUnits('1234567', 18)
    // await CPOOLSrc.mint(owner.address, tokenAmount)

    // approve the proxy to swap your tokens
    await CPOOLSrc.approve(CPOOLProxyOFT20_A.address, tokenAmount)

    // swaps tokens to other chain
    await CPOOLProxyOFT20_A.sendFrom(
      owner.address,
      chainId_B,
      owner.address,
      tokenAmount,
      owner.address,
      ethers.constants.AddressZero,
      '0x',
    )

    // tokens received on the dst chain
    expect(await CPOOLOFT20_B.balanceOf(owner.address)).to.be.equal(tokenAmount)

    // approve the other user to send the tokens
    await CPOOLOFT20_B.approve(alice.address, tokenAmount)

    // sends across
    await CPOOLOFT20_B.connect(alice).sendFrom(
      owner.address,
      chainId_C,
      alice.address,
      tokenAmount,
      alice.address,
      ethers.constants.AddressZero,
      '0x',
    )

    // tokens received on the dst chain
    expect(await CPOOLOFT20_C.balanceOf(alice.address)).to.be.equal(tokenAmount)
  })

  it('sendFrom() - reverts if contract is approved, but not the sending user', async function () {
    const tokenAmount = ethers.utils.parseUnits('1234567', 18)
    // await CPOOLSrc.mint(owner.address, tokenAmount)

    // approve the proxy to swap your tokens
    await CPOOLSrc.approve(CPOOLProxyOFT20_A.address, tokenAmount)

    // swaps tokens to other chain
    await CPOOLProxyOFT20_A.sendFrom(
      owner.address,
      chainId_B,
      owner.address,
      tokenAmount,
      owner.address,
      ethers.constants.AddressZero,
      '0x',
    )

    // tokens received on the dst chain
    expect(await CPOOLOFT20_B.balanceOf(owner.address)).to.be.equal(tokenAmount)

    // approve the contract to swap your tokens
    await CPOOLOFT20_B.approve(CPOOLOFT20_B.address, tokenAmount)

    // reverts because contract is approved, not the user
    await expect(
      CPOOLOFT20_B.connect(alice).sendFrom(
        owner.address,
        chainId_C,
        alice.address,
        tokenAmount,
        alice.address,
        ethers.constants.AddressZero,
        '0x',
      ),
    ).to.be.revertedWith('Cpool::spendAllowance insufficient allowance')
  })

  it('sendFrom() - reverts if not approved on non proxy chain', async function () {
    const tokenAmount = ethers.utils.parseUnits('1234567', 18)
    // await CPOOLSrc.mint(owner.address, tokenAmount)

    // approve the proxy to swap your tokens
    await CPOOLSrc.approve(CPOOLProxyOFT20_A.address, tokenAmount)

    // swaps tokens to other chain
    await CPOOLProxyOFT20_A.sendFrom(
      owner.address,
      chainId_B,
      owner.address,
      tokenAmount,
      owner.address,
      ethers.constants.AddressZero,
      '0x',
    )

    // tokens received on the dst chain
    expect(await CPOOLOFT20_B.balanceOf(owner.address)).to.be.equal(tokenAmount)

    // reverts because user is not approved
    await expect(
      CPOOLOFT20_B.connect(alice).sendFrom(
        owner.address,
        chainId_C,
        alice.address,
        tokenAmount,
        alice.address,
        ethers.constants.AddressZero,
        '0x',
      ),
    ).to.be.revertedWith('Cpool::spendAllowance insufficient allowance')
  })

  it('sendFrom() - reverts if someone else is approved, but not the sender', async function () {
    const tokenAmountA = ethers.utils.parseUnits('123', 18)
    const tokenAmountB = ethers.utils.parseUnits('456', 18)
    // mint to both owners
    // await CPOOLSrc.mint(owner.address, tokenAmountA)
    // await CPOOLSrc.mint(warlock.address, tokenAmountB)

    // approve owner.address to transfer, but not the other
    await CPOOLSrc.approve(CPOOLProxyOFT20_A.address, tokenAmountA)

    await expect(
      CPOOLProxyOFT20_A.connect(alice).sendFrom(
        alice.address,
        chainId_B,
        alice.address,
        tokenAmountB,
        alice.address,
        ethers.constants.AddressZero,
        '0x',
      ),
    ).to.be.revertedWith('Cpool::transferFrom: transfer amount exceeds spender allowance')
    await expect(
      CPOOLProxyOFT20_A.connect(alice).sendFrom(
        alice.address,
        chainId_B,
        owner.address,
        tokenAmountB,
        owner.address,
        ethers.constants.AddressZero,
        '0x',
      ),
    ).to.be.revertedWith('Cpool::transferFrom: transfer amount exceeds spender allowance')
  })

  it('sendFrom() - reverts if sender does not own token', async function () {
    const tokenAmountA = ethers.utils.parseUnits('123', 18)
    const tokenAmountB = ethers.utils.parseUnits('456', 18)
    // mint to both owners
    // await CPOOLSrc.mint(owner.address, tokenAmountA)
    // await CPOOLSrc.mint(warlock.address, tokenAmountB)

    // approve owner.address to transfer, but not the other
    await CPOOLSrc.approve(CPOOLProxyOFT20_A.address, tokenAmountA)

    await expect(
      CPOOLProxyOFT20_A.connect(alice).sendFrom(
        alice.address,
        chainId_B,
        alice.address,
        tokenAmountA,
        alice.address,
        ethers.constants.AddressZero,
        '0x',
      ),
    ).to.be.revertedWith('Cpool::transferFrom: transfer amount exceeds spender allowance')
    await expect(
      CPOOLProxyOFT20_A.connect(alice).sendFrom(
        alice.address,
        chainId_B,
        owner.address,
        tokenAmountA,
        owner.address,
        ethers.constants.AddressZero,
        '0x',
      ),
    ).to.be.revertedWith('Cpool::transferFrom: transfer amount exceeds spender allowance')
  })
})
