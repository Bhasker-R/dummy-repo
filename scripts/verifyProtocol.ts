import { verify } from './helpers/verify'

async function main() {
  const contracts = [
    'PoolFactory',
    'PoolBeacon',
    'Staking',
    'Auction',
    'CosineInterestRateModel',
    'ClearpoolLens',
    'CPOOL'
  ]
  for (let contract of contracts) {
    await verify(contract)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
