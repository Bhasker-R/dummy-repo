const day = 60 * 60 * 24
const blocksPerDay = 5760 // ~ 15s per block

export const tokens = {
  mainnet: {
    cpool: '0x66761fa41377003622aee3c7675fc7b5c1c2fac5',
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    cpoolOft: '0x2a4a3494e1f8D8fD3eEf2b53c6105F2bB0C07322',
  },
  goerli: {
    cpool: '0x04Fdb7c92e9fEd88DE4Be367bb866014DDb97db7',
    usdc: '0x2ca374a943e3b0D3170dd23d02A4B2aeeE29a14c',
    cpoolOft: '0xc44A76CDCA8f76de1DC31DAd4A7A47310F62899A',
  },
  polygon: {
    cpool: '0xb08b3603C5F2629eF83510E6049eDEeFdc3A2D91',
    usdc: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
    cpoolOft: '0xb08b3603C5F2629eF83510E6049eDEeFdc3A2D91',
  },
  mumbai: {
    cpool: '0x79430f572c7D3FBced572082fB67b6038bf874fb',
    usdc: '0xaE6d5186b4418edB13dfE54Bd2F673b710C7333b',
    cpoolOft: '0x79430f572c7D3FBced572082fB67b6038bf874fb',
  },
  zkevm: {
    cpool: '0xc3630b805F10E91c2de084Ac26C66bCD91F3D3fE',
    usdc: '0xA8CE8aee21bC2A48a5EF670afCc9274C7bbbC035',
    cpoolOft: '0xc3630b805F10E91c2de084Ac26C66bCD91F3D3fE',
  },
  arbitrum: {
    cpool: '0xc3630b805F10E91c2de084Ac26C66bCD91F3D3fE',
    usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    usdt: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    cpoolOft: '0xc3630b805F10E91c2de084Ac26C66bCD91F3D3fE',
  },
  optimism: {
    cpool: '0xc3630b805F10E91c2de084Ac26C66bCD91F3D3fE',
    usdc: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
    usdt: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    cpoolOft: '0xc3630b805F10E91c2de084Ac26C66bCD91F3D3fE',
  },
  mantleTest: {
    cpool: '0x0765A218F2Edc70cf98A0Ef7Daae8F993459D10D',
    cpoolOft: '0x0765A218F2Edc70cf98A0Ef7Daae8F993459D10D',
  },
  mantle: {
    cpool: '0x0c8927de225Bb1eD9DB05aA7d641E434B95279d8',
    cpoolOft: '0x0c8927de225Bb1eD9DB05aA7d641E434B95279d8',
  },
}

export const governor: Record<string, string> = {
  zkevm: '0xd1dDB90b2CC9A305454cCfeb64c6da0a05541eb5',
  arbitrum: '0x965Bc529D6133fbfCC7E159C6ecE1771Df12C19B',
  optimism: '0x144Fe9807C92C64acc4BB8E3B8917723EFC0d557',
  mantle: '0x002e481909EFC86c8cf90837b35c044fFCc7c260',
}

type Config = {
  // Cosine IRM config
  zeroRate: string
  fullRate: string
  kink: string
  kinkRate: string
  //  Staking config
  managerMinimalStake: string
  // Auction config
  auctionDuration: number
  periodToStartAuction: number
  minBidFactor: string
  //  Governor config
  flashGovernorQuorumVotes: string
  flashGovernorVotingPeriod: number
  // Reserves config
  reserveFactor: string
  insuranceFactor: string
  //  Pools config
  warningUtilization: string
  provisionalDefaultUtilization: string
  provisionalRepaymentUtilization: string
  warningGracePeriod: number
  inactivePeriod: number
  treasury?: string
  incrementPercent?: string
  incrementMaxAmount?: string
}

export interface BorrowerInfo {
  manager: string
  info: {
    name: string
    ticker: string
    description: string
    twitter: string
    linkedin: string
    website: string
  }
  ipfsHashHex?: string
  reward?: string
  liquidity?: { [index: string]: string }
  currency?: string
}

export const testnetConfig: Config = {
  // CosineIRM config
  zeroRate: '0.1', // 10% anually
  fullRate: '0.2', // 20% anually
  kink: '0.8', // 80%
  kinkRate: '0.05', // 5% anually
  //  Staking config
  managerMinimalStake: '500000', //  500000 CPOOL
  // Auction config
  auctionDuration: 7 * day, // 7 days
  periodToStartAuction: 3 * day, // 3 days
  minBidFactor: '1',
  //  Governor config
  flashGovernorQuorumVotes: '300000000', // 30% of 1B CPOOL
  flashGovernorVotingPeriod: blocksPerDay, // 1 day
  // Reserves config
  reserveFactor: '0.05', // 5%
  insuranceFactor: '0.05', // 5%
  //  Pools config
  warningUtilization: '0.95', // 95%
  provisionalDefaultUtilization: '0.99', // 99%
  provisionalRepaymentUtilization: '0.85', //85%
  warningGracePeriod: 5 * day, // 5 days
  inactivePeriod: 14 * day, // 14 days
  incrementPercent: '0.01', // 1%
  incrementMaxAmount: '500000', // 500000 Tokens
}

export const stageConfig: Config = {
  ...testnetConfig,
  //  Staking config
  managerMinimalStake: '100', //  100 CPOOL
  // Auction config
  auctionDuration: 300, // 300 seconds
  periodToStartAuction: 300, // 300 seconds
  //  Pools config
  warningGracePeriod: 300, // 300 seconds
  inactivePeriod: 300, // 300 seconds
}

export const testConfig: Config = {
  ...testnetConfig,
  minBidFactor: '10',
}

export const mainnetConfig: Config = {
  // CosineIRM config
  zeroRate: '0.1338', // *100 to get %, i.e. 0.15 == 15%
  fullRate: '0.2432', // *100 to get %, i.e. 0.15 == 15%
  kink: '0.85', // *100 to get %, i.e. 0.15 == 15%
  kinkRate: '0.0976', // *100 to get %, i.e. 0.15 == 15%
  //  Staking config
  managerMinimalStake: '0', //  0 CPOOL
  // Auction config
  auctionDuration: 5 * day, // 5 days
  periodToStartAuction: 7 * day, // 7 days
  minBidFactor: '1',
  //  Governor config
  flashGovernorQuorumVotes: '300000000', // 30% of 1B CPOOL
  flashGovernorVotingPeriod: blocksPerDay, // 1 day
  // Reserves config
  reserveFactor: '0.05', // 5%
  insuranceFactor: '0.05', // 5%
  //  Pools config
  warningUtilization: '0.95', // 95%
  provisionalDefaultUtilization: '0.99', // 99%
  provisionalRepaymentUtilization: '0.85', // 85%
  warningGracePeriod: 5 * day, // 5 days
  inactivePeriod: 14 * day, // 14 days
  treasury: '0x455011f2704c6E192b09d9CC1430299C70af3454',
  incrementPercent: '0.01', // 1%
  incrementMaxAmount: '1000000000', // 1000000000 Tokens
}

export const polygonBorrowers: BorrowerInfo[] = [
  {
    manager: '0x44C8e19Bd59A8EA895fFf60DBB4e762028f2fb71',
    info: {
      name: 'Folkvang',
      ticker: 'FOL',
      description: `Folkvang is a native crypto trading firm. With their proprietary technology, they trade on all major crypto markets around the clock. Since they began trading, they have grown the team from two people in Asia in 2018 to a global team of nine core contributors.`,
      twitter: 'https://twitter.com/folkvangtrading',
      linkedin: 'https://www.linkedin.com/company/folkvang/',
      website: 'https://folkvang.io/',
    },
  },
  {
    manager: '0xBD797718851BE088E69106243e7bc67D9274Ae12',
    info: {
      name: 'Wintermute',
      ticker: 'WIN',
      description:
        'Wintermute is a leading global algorithmic trading firm and one of the largest players in digital asset markets. With an average daily trading volume of over $5bn, Wintermute facilitates OTC trading of 350+ tokens and provides liquidity across 80+ centralized and decentralized exchanges',
      twitter: 'https://twitter.com/wintermute_t',
      linkedin: 'https://www.linkedin.com/company/wintermute-trading/',
      website: 'https://www.wintermute.com/',
    },
  },
  {
    manager: '0x13f28A0a3f3d8A203268c4c60Fa572c0ca9092a8',
    info: {
      name: 'Parallel Capital',
      ticker: 'PAR',
      description: `Founded in 2018, Parallel Capital is an algorithmic, high frequency proprietary trading firm
that specializes in providing liquidity within the cryptocurrency markets 24/7/365.

Parallel Capital is a major though under-the-radar player in the cryptocurrency market making
ecosystem, founded by industry veterans from both Wall Street and Silicon Valley in a
melding of finance and tech.

Parallel Capital profitably trades tens of billions of USD per month with over USD$100M in AUM and zero monthly drawdowns since inception, outperforming much larger and better funded teams.`,
      twitter: '',
      linkedin: 'https://www.linkedin.com/company/parallel-crypto/',
      website: 'https://www.parallelcapital.co',
    },
  },
]

export const mainnetBorrowers: BorrowerInfo[] = [
  {
    manager: '0x948d589df907c3f5cef1c62eeb051428fccbc709',
    info: {
      name: 'Folkvang',
      ticker: 'FOL',
      description: `Folkvang is a native crypto trading firm. With their proprietary technology, they trade on all major crypto markets around the clock. Since they began trading, they have grown the team from two people in Asia in 2018 to a global team of nine core contributors.<br /><br />In March 2020, Folkvang became more official and took on investment from SBF to seriously scale up their capital base and trading operations. They have been a part of global on-screen crypto flows ever since, trading billions of dollars every day on all major coins and exchanges.<br /><br />As a quantitative trading firm, Folkvang employs a variety of trading strategies, ranging from low latency HFT arbitrage on the biggest markets to degen yield farming. They are best known for the former, where their market-neutral HFT strategies make money from market-making, arbitrage, funding, and basis.<br /><br />On a weekly basis, Folkvang have had zero drawdowns since their start in March 2019.`,
      twitter: 'https://twitter.com/folkvangtrading',
      linkedin: 'https://www.linkedin.com/company/folkvang/',
      website: 'https://folkvang.io/',
    },
  },
  {
    manager: '0xa71A93bAd6dc59253E5bfB604ec7ec2dfAFB7843',
    info: {
      name: 'FBG Capital',
      ticker: 'FBG',
      description: `FBG Capital is an industry-leading digital asset management company. FBG supports hundreds of blockchain projects worldwide and is one of the largest liquidity providers for high-profile crypto exchanges. <br /><br />Founder Vincent Zhou is one of the pioneering investors/traders in this space, having worked with IBM and Oracle earlier. FBG has quickly institutionalized and built a global presence across North America and Asia.<br /><br />Token Limited is the entity used by FBG Capital for investments.`,
      twitter: 'https://twitter.com/FBGCapital',
      linkedin: 'https://www.linkedin.com/company/fbgcapital/about/',
      website: 'www.fbg.capital/',
    },
  },
  {
    manager: '0xA1614eC01d13E04522ED0b085C7a178ED9E99bc9',
    info: {
      name: 'Wintermute',
      ticker: 'WIN',
      description: `Founded in June 2017, Wintermute Trading Ltd is a market-neutral market-maker and proprietary high-frequency trader. Active in CeFi and DeFi markets, we provide liquidity to over 50 crypto exchanges and trade over $6bn daily across more than 200 digital assets.<br /><br />Based in London, UK, Wintermute’s most recent Series B round was led by Lightspeed Venture Partners and Pantera Capital. With 45 employees and growing, Wintermute looks forward to continuing to provide liquidity and fair markets, fuelling the further growth and adoption of cryptocurrency.<br /><br />Wintermute Trading follows a market-neutral trading strategy.<br /><br />With as close to zero positional risk as possible, Wintermute strives to provide the best and fairest liquidity to the demands of the global crypto market.`,
      twitter: 'https://twitter.com/wintermute_t',
      linkedin: 'https://www.linkedin.com/company/wintermute-trading/',
      website: 'https://www.wintermute.com/',
    },
  },
  {
    manager: '0xA337321a3b9909aEC6e7053Ef8e8FDb24e4614F2',
    info: {
      name: 'Amber Group',
      ticker: 'AMB',
      description: `Amber Group is a leader in digital asset trading, products and infrastructure. We work with companies ranging from crypto-native companies, banks and fintech firms, to sports teams, game developers, brands and creators. Operating at the center of markets, we act as liquidity providers, miners and validators on all major exchanges, applications, and networks. Across all products and categories, we have turned over >$1T in volumes since inception.<br /><br />We are a team of 800+ dynamic, entrepreneurial technologists, traders and engineers on a mission to enable frictionless marketplaces. We operate around the clock and around the globe, headquartered in Singapore with a presence in Athens, Chicago, Geneva, Dubai, Hong Kong, Istanbul, London, Mexico City, New York, Salt Lake City, Seoul, Taipei, Tokyo, Vancouver, and Zurich.`,
      twitter: 'https://twitter.com/ambergroup_io',
      linkedin: 'https://www.linkedin.com/company/amberbtc/',
      website: 'https://www.ambergroup.io/',
    },
  },
  {
    manager: '0x07B6c7bC3d7dc0f36133b542eA51aA7Ac560E974',
    info: {
      name: 'Auros',
      ticker: 'AUR',
      description: `Auros is a leading cryptocurrency market making and high frequency trading firm operating across all major venues and instruments. A 24/7/365 business, it possesses a world-class team of trading and engineering talent across 15 geographies globally, combining remote work and physical offices in Hong Kong and New York. <br /><br />Auros is one of the largest participants in cryptocurrency markets, generating daily notional turnover in the billions of dollars. Their long-standing technological heritage combines a systematic approach with sophisticated pricing models and state-of-the-art execution capabilities, regularly iterating to ensure robust, reliable trading performance. Their partnership-based approach to external liquidity provision has rapidly established them as a go-to market maker for token projects.`,
      twitter: 'https://twitter.com/globalauros',
      linkedin: 'https://hk.linkedin.com/company/aurosglobal',
      website: 'https://auros.global/',
    },
  },
]

export const testnetBorrowers: BorrowerInfo[] = [
  {
    manager: '0x9160BBD07295b77BB168FF6295D66C74E575B5BE',
    ipfsHashHex: '0x56d60df3694fe43db85aa7e9a2ee84a60c4c9bcd9741357aa10ca7aa081151bd',
    info: {
      name: 'Folkvang',
      ticker: 'FOL',
      description: `Folkvang is a native crypto trading firm. With their proprietary technology, they trade on all major crypto markets around the clock. Since they began trading, they have grown the team from two people in Asia in 2018 to a global team of nine core contributors.<br /><br />In March 2020, Folkvang became more official and took on investment from SBF to seriously scale up their capital base and trading operations. They have been a part of global on-screen crypto flows ever since, trading billions of dollars every day on all major coins and exchanges.<br /><br />As a quantitative trading firm, Folkvang employs a variety of trading strategies, ranging from low latency HFT arbitrage on the biggest markets to degen yield farming. They are best known for the former, where their market-neutral HFT strategies make money from market-making, arbitrage, funding, and basis.<br /><br />On a weekly basis, Folkvang have had zero drawdowns since their start in March 2019.`,
      twitter: 'https://twitter.com/folkvangtrading',
      linkedin: 'https://www.linkedin.com/company/folkvang/',
      website: 'https://folkvang.io/',
    },
    currency: 'USDC',
  },
  {
    manager: '0x7Bc71F32E6Abb6bE619B5e31565fef0006a8e31d',
    ipfsHashHex: '0xc8843641f68dace69624e3e0bd53bce1fe6bcfeea2acfee0a918e78fd28a059e',
    info: {
      name: 'FBG Capital',
      ticker: 'FBG',
      description: `FBG Capital is an industry-leading digital asset management company. FBG supports hundreds of blockchain projects worldwide and is one of the largest liquidity providers for high-profile crypto exchanges. <br /><br />Founder Vincent Zhou is one of the pioneering investors/traders in this space, having worked with IBM and Oracle earlier. FBG has quickly institutionalized and built a global presence across North America and Asia.<br /><br />Token Limited is the entity used by FBG Capital for investments.`,
      twitter: 'https://twitter.com/FBGCapital',
      linkedin: 'https://www.linkedin.com/company/fbgcapital/about/',
      website: 'www.fbg.capital/',
    },
    currency: 'USDC',
  },
  {
    manager: '0x64fe981ee766237EA2614F095c07e5aF2E28a451',
    ipfsHashHex: '0xe27e0d706b96a2b11aae5ae852a69ec0f123f9f50804a8e298c22459fac9924a',
    info: {
      name: 'Wintermute',
      ticker: 'WIN',
      description: `Founded in June 2017, Wintermute Trading Ltd is a market-neutral market-maker and proprietary high-frequency trader. Active in CeFi and DeFi markets, we provide liquidity to over 50 crypto exchanges and trade over $6bn daily across more than 200 digital assets.<br /><br />Based in London, UK, Wintermute’s most recent Series B round was led by Lightspeed Venture Partners and Pantera Capital. With 45 employees and growing, Wintermute looks forward to continuing to provide liquidity and fair markets, fuelling the further growth and adoption of cryptocurrency.<br /><br />Wintermute Trading follows a market-neutral trading strategy.<br /><br />With as close to zero positional risk as possible, Wintermute strives to provide the best and fairest liquidity to the demands of the global crypto market.`,
      twitter: 'https://twitter.com/wintermute_t',
      linkedin: 'https://www.linkedin.com/company/wintermute-trading/',
      website: 'https://www.wintermute.com/',
    },
    currency: 'USDT',
  },
  {
    manager: '0xC506B0F6Cf8329711B318719235f49d03F337cdD',
    ipfsHashHex: '0x437f131c32dcec902f01bf48e23283a8e349a57e57c10639e8388780161988be',
    info: {
      name: 'Amber Group',
      ticker: 'AMB',
      description: `Amber Group is a leader in digital asset trading, products and infrastructure. We work with companies ranging from crypto-native companies, banks and fintech firms, to sports teams, game developers, brands and creators. Operating at the center of markets, we act as liquidity providers, miners and validators on all major exchanges, applications, and networks. Across all products and categories, we have turned over >$1T in volumes since inception.<br /><br />We are a team of 800+ dynamic, entrepreneurial technologists, traders and engineers on a mission to enable frictionless marketplaces. We operate around the clock and around the globe, headquartered in Singapore with a presence in Athens, Chicago, Geneva, Dubai, Hong Kong, Istanbul, London, Mexico City, New York, Salt Lake City, Seoul, Taipei, Tokyo, Vancouver, and Zurich.`,
      twitter: 'https://twitter.com/ambergroup_io',
      linkedin: 'https://www.linkedin.com/company/amberbtc/',
      website: 'https://www.ambergroup.io/',
    },
    currency: 'WETH',
  },
  {
    manager: '0xCFB55841Bf9Bf1Bd0dB9f6627Ae6003d34b4fcEe',
    ipfsHashHex: '0x692cb482fdb262a5d2794f03152224d707b8774dab496f8045268b67ad24beae',
    info: {
      name: 'Auros',
      ticker: 'AUR',
      description: `Auros is a leading cryptocurrency market making and high frequency trading firm operating across all major venues and instruments. A 24/7/365 business, it possesses a world-class team of trading and engineering talent across 15 geographies globally, combining remote work and physical offices in Hong Kong and New York. <br /><br />Auros is one of the largest participants in cryptocurrency markets, generating daily notional turnover in the billions of dollars. Their long-standing technological heritage combines a systematic approach with sophisticated pricing models and state-of-the-art execution capabilities, regularly iterating to ensure robust, reliable trading performance. Their partnership-based approach to external liquidity provision has rapidly established them as a go-to market maker for token projects.`,
      twitter: 'https://twitter.com/globalauros',
      linkedin: 'https://hk.linkedin.com/company/aurosglobal',
      website: 'https://auros.global/',
    },
    currency: 'WBTC',
  },
]

export const clearpoolBorrower: BorrowerInfo = {
  manager: '0xe43420E1f83530AAf8ad94e6904FDbdc3556Da2B',
  info: {
    name: 'Clearpool',
    ticker: 'CPL',
    description: `Revolutionizing debt capital markets. A paradigm shift in how institutions borrow uncollateralized liquidity is upon us`,
    twitter: 'https://twitter.com/clearpoolFin',
    linkedin:
      'https://www.linkedin.com/company/clearpool/?lipi=urn%3Ali%3Apage%3Ad_flagship3_search_srp_companies%3BihFIcNJ4TRmDBXBvLfja%2Bg%3D%3D',
    website: 'https://clearpool.finance/',
  },
}

export const mantleBorrowers: BorrowerInfo[] = []
