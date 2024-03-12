import { run, ethers } from 'hardhat'

enum Accounts {
  Owner,
  Bidder,
  LP_1,
  LP_2,
  LP_3,
  LP_4,
  LP_5,
  LP_6,
  LP_7,
  LP_8,
  LP_9,
  B_1,
  B_2,
  B_3,
  B_4,
  B_5,
  B_6,
  B_7,
  B_8,
  B_9,
  B_10,
  B_11,
}

async function main() {
  // Deploy stage configuration
  await run('run', { script: 'scripts/deployStage.ts' })

  // Run setup

  async function borrow(manager: string, amount: string) {
    const Factory = await ethers.getContractAt('PoolFactory', process.env.POOL_FACTORY!)

    const poolAddress = (await Factory.managerInfo(manager)).pool

    const Pool = await ethers.getContractAt('PoolMaster', poolAddress)
    const signer = await ethers.getSigner(manager)
    const currency = await ethers.getContractAt('ERC20', await Pool.currency())
    const decimals = await currency.decimals()
    const tokens = ethers.utils.parseUnits(amount, decimals)
    await Pool.connect(signer).borrow(tokens, manager)
  }

  async function repayAndClose(manager: string) {
    const Factory = await ethers.getContractAt('PoolFactory', process.env.POOL_FACTORY!)

    const USDC = await ethers.getContractAt('FaucetToken', process.env.USDC!)

    const poolAddress = (await Factory.managerInfo(manager)).pool

    const Pool = await ethers.getContractAt('PoolMaster', poolAddress)
    const signer = await ethers.getSigner(manager)
    const tokens = ethers.constants.MaxUint256
    const tx = await USDC.connect(signer).approve(poolAddress, tokens)

    await tx.wait()
    await Pool.connect(signer).repay(tokens, true)
  }

  async function withdraw(manager: string, lp: string, amount: string) {
    const Factory = await ethers.getContractAt('PoolFactory', process.env.POOL_FACTORY!)

    const poolAddress = (await Factory.managerInfo(manager)).pool

    const Pool = await ethers.getContractAt('PoolMaster', poolAddress)
    const signer = await ethers.getSigner(lp)
    const currency = await ethers.getContractAt('ERC20', await Pool.currency())
    const decimals = await currency.decimals()
    const tokens = ethers.utils.parseUnits(amount, decimals)
    await Pool.connect(signer).redeem(tokens)
  }

  const signers = await ethers.getSigners()

  const owner = signers[Accounts.Owner]
  const bidder = signers[Accounts.Bidder]
  // LPs
  const LP_1 = signers[Accounts.LP_1]
  const LP_2 = signers[Accounts.LP_2]
  const LP_3 = signers[Accounts.LP_3]
  const LP_4 = signers[Accounts.LP_4]
  const LP_5 = signers[Accounts.LP_5]
  const LP_6 = signers[Accounts.LP_6]
  const LP_7 = signers[Accounts.LP_7]
  const LP_8 = signers[Accounts.LP_8]
  const LP_9 = signers[Accounts.LP_9]

  // Borrowers
  const B_1 = signers[Accounts.B_1]
  const B_2 = signers[Accounts.B_2]
  const B_3 = signers[Accounts.B_3]
  const B_4 = signers[Accounts.B_4]
  const B_5 = signers[Accounts.B_5]
  const B_6 = signers[Accounts.B_6]
  const B_7 = signers[Accounts.B_7]
  const B_8 = signers[Accounts.B_8]
  const B_9 = signers[Accounts.B_9]
  const B_10 = signers[Accounts.B_10]
  const B_11 = signers[Accounts.B_11]

  // Send 100000 USDC to LP_2
  await run('faucet', {
    account: owner.address,
    amount: '10000000',
    cpool: '0',
  })

  // SETUP CASE #1
  // Create the B1 pool
  await run('create-pool', {
    account: B_1.address,
    symbol: 'B1',
  })
  // Send 100000 USDC to LP_2
  await run('faucet', {
    account: LP_2.address,
    amount: '100000',
    cpool: '0',
  })

  // SETUP CASE #2
  // Create the B2 pool
  await run('create-pool', {
    account: B_2.address,
    symbol: 'B2',
  })
  // Send 100000 USDC to LP_2
  await run('faucet', {
    account: LP_3.address,
    amount: '100000',
    cpool: '0',
  })
  // Provide 100000 USDC from LP_2 to B2 pool
  await run('provide-liquidity', {
    manager: B_2.address,
    provider: LP_3.address,
    amount: '100000',
  })

  // SETUP CASE #3
  // Create the B3 pool
  await run('create-pool', {
    account: B_3.address,
    symbol: 'B3',
  })
  // Provide 100000 USDC from owner to B3 pool
  await run('provide-liquidity', {
    manager: B_3.address,
    provider: owner.address,
    amount: '100000',
  })

  // SETUP CASE #4
  // Send 7000 USDC to B_4
  await run('faucet', {
    account: B_4.address,
    amount: '7000',
    cpool: '0',
  })

  // Create the B4 pool
  await run('create-pool', {
    account: B_4.address,
    symbol: 'B4',
  })
  // Provide 100000 USDC from owner to B4 pool
  await run('provide-liquidity', {
    manager: B_4.address,
    provider: owner.address,
    amount: '100000',
  })
  // B4 borrows 70000 USDC
  await borrow(B_4.address, '70000')

  // SETUP CASE #5
  // Create the B5 pool
  await run('create-pool', {
    account: B_5.address,
    symbol: 'B5',
  })
  // Provide 100000 USDC from owner to B5 pool
  await run('provide-liquidity', {
    manager: B_5.address,
    provider: owner.address,
    amount: '100000',
  })

  // SETUP CASE #6
  // Create the B6 pool
  await run('create-pool', {
    account: B_6.address,
    symbol: 'B6',
  })
  // Send 100000 USDC to LP4
  await run('faucet', {
    account: LP_4.address,
    amount: '110000',
    cpool: '0',
  })
  // Provide 100000 USDC from LP4 to B6 pool
  await run('provide-liquidity', {
    manager: B_6.address,
    provider: LP_4.address,
    amount: '100000',
  })
  // B6 borrows 95000 USDC
  await borrow(B_6.address, '95000')
  await withdraw(B_6.address, LP_4.address, '4000')

  // SETUP CASE #7
  // Create the B6 pool
  await run('create-pool', {
    account: B_7.address,
    symbol: 'B7',
  })
  // Send 100000 USDC to B7
  await run('faucet', {
    account: B_7.address,
    amount: '100000',
    cpool: '0',
  })
  // Send 100000 USDC to LP5
  await run('faucet', {
    account: LP_5.address,
    amount: '100000',
    cpool: '0',
  })
  // Provide 50000 USDC from LP5 to B7 pool
  await run('provide-liquidity', {
    manager: B_7.address,
    provider: LP_5.address,
    amount: '50000',
  })
  // B7 borrows 45000 USDC
  await borrow(B_7.address, '45000')

  // Provide 10000 to bidder
  await run('faucet', {
    account: bidder.address,
    amount: '10000',
    cpool: '0',
  })

  // SETUP CLAIM TESTS
  await run('faucet', {
    account: LP_6.address,
    amount: '100000',
    cpool: '0',
  })
  await run('faucet', {
    account: LP_7.address,
    amount: '100000',
    cpool: '0',
  })
  await run('faucet', {
    account: LP_8.address,
    amount: '100000',
    cpool: '0',
  })
  await run('faucet', {
    account: LP_9.address,
    amount: '100000',
    cpool: '0',
  })
  await run('faucet', {
    account: B_9.address,
    amount: '100000',
    cpool: '0',
  })
  await run('faucet', {
    account: B_11.address,
    amount: '100000',
    cpool: '0',
  })

  await run('create-pool', {
    account: B_8.address,
    symbol: 'B8',
  })
  await run('create-pool', {
    account: B_9.address,
    symbol: 'B9',
  })
  await run('create-pool', {
    account: B_10.address,
    symbol: 'B10',
  })
  await run('create-pool', {
    account: B_11.address,
    symbol: 'B11',
  })

  await run('provide-liquidity', {
    manager: B_8.address,
    provider: LP_6.address,
    amount: '100000',
  })

  await run('provide-liquidity', {
    manager: B_9.address,
    provider: LP_7.address,
    amount: '100000',
  })

  await run('provide-liquidity', {
    manager: B_10.address,
    provider: LP_8.address,
    amount: '20000',
  })

  await run('provide-liquidity', {
    manager: B_10.address,
    provider: LP_9.address,
    amount: '20000',
  })

  await run('provide-liquidity', {
    manager: B_11.address,
    provider: LP_8.address,
    amount: '20000',
  })

  await run('provide-liquidity', {
    manager: B_11.address,
    provider: LP_9.address,
    amount: '20000',
  })

  await run('set-reward', {
    manager: B_8.address,
    reward: '1',
    deposit: '11000000',
  })

  await run('set-reward', {
    manager: B_9.address,
    reward: '1',
    deposit: '11000000',
  })

  await run('set-reward', {
    manager: B_10.address,
    reward: '1',
    deposit: '11000000',
  })

  await run('set-reward', {
    manager: B_11.address,
    reward: '1',
    deposit: '11000000',
  })

  await borrow(B_8.address, '80000')
  await borrow(B_9.address, '80000')
  await borrow(B_10.address, '15000')
  await borrow(B_11.address, '35000')

  // Wait until the pool is default (at least 6 days)
  await run('increase-time', { seconds: 7 * 24 * 60 * 60 })

  await repayAndClose(B_9.address)
  await repayAndClose(B_11.address)
  await withdraw(B_10.address, LP_8.address, '20000')

  // Bidders are whitelisted
  await run('set-bidder', { account: bidder.address })
  await run('set-bidder', { account: LP_4.address })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
