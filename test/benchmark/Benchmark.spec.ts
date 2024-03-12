import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { perSecond } from '../shared/utils'
import { Action, ActionType, Emulator, Params } from '../shared/emulator'

describe('Interest model benchmark', function () {
  let owner: SignerWithAddress
  let manager: SignerWithAddress
  let lp: SignerWithAddress
  let emulator: Emulator = new Emulator()

  const params: Params = {
    baseRatePerSecond: ethers.utils.formatUnits(perSecond(ethers.utils.parseUnits('0.02'))),
    multiplierPerSecond: ethers.utils.formatUnits(perSecond(ethers.utils.parseUnits('0.1'))),
    jumpMultiplierPerSecond: ethers.utils.formatUnits(perSecond(ethers.utils.parseUnits('2.0'))),
    kink: '0.8',
    reserveFactor: '0.05',
    insuranceFactor: '0.05',
  }

  describe('lend scenario', () => {
    let actions: Action[]

    it('', async () => {
      ;[owner, manager, lp] = await ethers.getSigners()

      actions = [
        { type: ActionType.Faucet, actor: lp, value: '1000' },
        {
          type: ActionType.Provide,
          actor: lp,
          value: '1000',
          result: {
            cash: '1000',
            users: [
              {
                address: lp.address,
                cpTokens: '1000',
              },
            ],
          },
        },
      ]
    })

    it('setup', async () => {
      await emulator.setup(params)
      await emulator.createPool(manager)
    })
    it('run actions', async () => {
      await emulator.run(actions)
    })
  })

  describe('withdraw scenario', () => {
    let actions: Action[]

    it('', async () => {
      ;[owner, manager, lp] = await ethers.getSigners()

      actions = [
        { type: ActionType.Faucet, actor: lp, value: '1000' },
        {
          type: ActionType.Provide,
          actor: lp,
          value: '1000',
        },
        {
          type: ActionType.Redeem,
          actor: lp,
          value: '999.99',
          result: {
            cash: '0.01',
            users: [
              {
                address: lp.address,
                cpTokens: '0',
              },
            ],
          },
        },
      ]
    })

    it('setup', async () => {
      await emulator.setup(params)
      await emulator.createPool(manager)
    })
    it('run actions', async () => {
      await emulator.run(actions)
    })
  })

  describe('borrow scenario', () => {
    let actions: Action[]

    it('', async () => {
      ;[owner, manager, lp] = await ethers.getSigners()

      actions = [
        { type: ActionType.Faucet, actor: lp, value: '1000' },
        {
          type: ActionType.Provide,
          actor: lp,
          value: '1000',
        },
        {
          type: ActionType.Mine,
          value: '1',
        },
        {
          type: ActionType.Borrow,
          actor: manager,
          value: '500',
        },
        {
          type: ActionType.Mine,
          value: '1',
        },
      ]
    })

    it('setup', async () => {
      await emulator.setup(params)
      await emulator.createPool(manager)
    })
    it('run actions', async () => {
      const logs = await emulator.run(actions)
      console.table(logs)
    })
  })

  describe('repay scenario', () => {
    let actions: Action[]

    it('', async () => {
      ;[owner, manager, lp] = await ethers.getSigners()

      actions = [
        { type: ActionType.Faucet, actor: lp, value: '1000' },
        {
          type: ActionType.Provide,
          actor: lp,
          value: '1000',
        },
        {
          type: ActionType.Mine,
          value: '1',
        },
        {
          type: ActionType.Borrow,
          actor: manager,
          value: '500',
        },
        {
          type: ActionType.Mine,
          value: '5',
        },
        { type: ActionType.Faucet, actor: manager, value: '1000' },
        {
          type: ActionType.Repay,
          actor: manager,
          value: 'max',
        },
      ]
    })

    it('setup', async () => {
      await emulator.setup(params)
      await emulator.createPool(manager)
    })
    it('run actions', async () => {
      const logs = await emulator.run(actions)
      console.table(logs)
    })
  })
})
