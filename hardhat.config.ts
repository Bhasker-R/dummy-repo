import * as dotenv from 'dotenv'
import { HardhatUserConfig, task } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import '@openzeppelin/hardhat-upgrades'
import 'hardhat-gas-reporter'
import 'hardhat-docgen'
import 'hardhat-dependency-compiler'
import 'hardhat-contract-sizer'

import './tasks'

dotenv.config()
task('accounts', 'Prints the list of accounts', async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners()

  for (const account of accounts) {
    console.log(account.address)
  }
})

const accounts =
  process.env.DEPLOYER_PRIVATE_KEY !== undefined ? [process.env.DEPLOYER_PRIVATE_KEY] : []

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.17',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ]
  },
  networks: {
    hardhat: {
      accounts: {
        count: 30
      },
      allowUnlimitedContractSize: false,
      chainId: 1337
    },
    fork: {
      url: 'http://127.0.0.1:8545/',
      accounts
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}` || '',
      accounts:
        process.env.MAINNET_PRIVATE_KEY !== undefined ? [process.env.MAINNET_PRIVATE_KEY] : []
    },
    zkEVMTest: {
      chainId: 1442,
      url: `https://rpc.public.zkevm-test.net`,
      accounts
    },
    zkevm: {
      chainId: 1101,
      url: `https://zkevm-rpc.com`,
      accounts:
        process.env.MAINNET_PRIVATE_KEY !== undefined ? [process.env.MAINNET_PRIVATE_KEY] : []
    },
    goerli: {
      url: `https://eth-goerli.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}` || '', // if you have error with network during deployment, this is because Alchemy does work; try to use Infura instead (see config.network.mainnet)
      accounts
    },
    sepolia: {
      chainId: 11155111,
      url: `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}` || '',
      accounts
    },
    mumbai: {
      url: `https://polygon-mumbai.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}` || '',
      accounts
    },
    polygon: {
      url: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}` || '',
      accounts:
        process.env.MAINNET_PRIVATE_KEY !== undefined ? [process.env.MAINNET_PRIVATE_KEY] : []
    },
    arbitrum: {
      url: `https://arb1.arbitrum.io/rpc`,
      accounts:
        process.env.MAINNET_PRIVATE_KEY !== undefined ? [process.env.MAINNET_PRIVATE_KEY] : []
    },
    optimism: {
      url: `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`,
      accounts:
        process.env.MAINNET_PRIVATE_KEY !== undefined ? [process.env.MAINNET_PRIVATE_KEY] : []
    },
    mantle: {
      chainId: 5000,
      url: 'https://rpc.mantle.xyz',
      accounts:
        process.env.MAINNET_PRIVATE_KEY !== undefined ? [process.env.MAINNET_PRIVATE_KEY] : []
    },
    mantleTest: {
      chainId: 5001,
      url: 'https://rpc.testnet.mantle.xyz',
      accounts
    }
  },
  docgen: {
    path: './docs',
    clear: true,
    runOnCompile: false,
    only: [
      'contracts/CPOOL.sol',
      'contracts/Auction.sol',
      'contracts/MembershipStaking.sol',
      'contracts/PoolFactory.sol',
      'contracts/pool/PoolMaster.sol',
      'contracts/irm/DefaultInterestRateModel.sol',
      'contracts/irm/CosineInterestRateModel.sol'
    ]
  },
  typechain: {
    outDir: 'typechain'
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: 'USD'
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || '',
      goerli: process.env.ETHERSCAN_API_KEY || '',
      sepolia: process.env.ETHERSCAN_API_KEY || '',
      polygon: process.env.POLYGONSCAN_API_KEY || '',
      mumbai: process.env.POLYGONSCAN_API_KEY || '',
      zkEVMTest: process.env.ZK_POLYGONSCAN_API_KEY || '',
      zkevm: process.env.ZK_POLYGONSCAN_API_KEY || '',
      optimisticEthereum: process.env.OPTIMISM_API_KEY || '',
      arbitrumOne: process.env.ARBISCAN_API_KEY || '',
      mantleTest: process.env.ETHERSCAN_API_KEY || '',
      mantle: process.env.ETHERSCAN_API_KEY || '',
    },
    customChains: [
      {
        network: 'mumbai',
        chainId: 80001,
        urls: {
          apiURL: 'https://api-testnet.polygonscan.com/api',
          browserURL: 'https://mumbai.polygonscan.com/'
        }
      },
      {
        network: 'zkEVMTest',
        chainId: 1442,
        urls: {
          apiURL: 'https://api-testnet-zkevm.polygonscan.com/api',
          browserURL: 'https://testnet-zkevm.polygonscan.com'
        }
      },
      {
        network: 'zkevm',
        chainId: 1101,
        urls: {
          apiURL: 'https://api-zkevm.polygonscan.com/api',
          browserURL: 'https://zkevm.polygonscan.com'
        }
      },
      {
        network: 'mantle',
        chainId: 5000,
        urls: {
          apiURL: 'https://explorer.mantle.xyz/api',
          browserURL: 'https://explorer.mantle.xyz',
        },
      },
      {
        network: 'mantleTest',
        chainId: 5001,
        urls: {
          apiURL: 'https://explorer.testnet.mantle.xyz/api',
          browserURL: 'https://explorer.testnet.mantle.xyz',
        },
      },
    ]
  },
  dependencyCompiler: {
    paths: [
      '@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol',
      '@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol'
    ]
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: false,
    strict: true,
    only: [':AavePoolMaster$']
  }
}

export default config
