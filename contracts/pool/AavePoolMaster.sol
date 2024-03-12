// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {SafeERC20Upgradeable} from '@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol';
import {IERC20Upgradeable} from '@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol';
import {PoolMaster} from './PoolMaster.sol';
import {ILendingPool} from '../interfaces/aave/ILendingPool.sol';

/// @notice This is contract for the Aave boosted pool variant
contract AavePoolMaster is PoolMaster {
  using SafeERC20Upgradeable for IERC20Upgradeable;

  ILendingPool public lendingPool;

  uint256 public depositedToLendingPool;

  bool public upgraded;

  // UPGRADER

  function upgradeTo(ILendingPool lendingPool_) external onlyGovernor {
    require(!upgraded, 'OU');

    lendingPool = lendingPool_;
    approveLendingPool();

    // Deposit all un-utilized liquidity to Aave
    uint256 balance = currency.balanceOf(address(this));
    if (balance > 0) {
      lendingPool.deposit(address(currency), balance, address(this), 0);
      depositedToLendingPool += balance;
    }

    upgraded = true;
  }

  // VERSION

  function version() external pure override returns (string memory) {
    return '1.2.0';
  }

  // PUBLIC GOVERNOR FUNCTIONS

  function approveLendingPool() public onlyGovernor {
    currency.approve(address(lendingPool), type(uint256).max);
  }

  function collectAaveInterest() external onlyGovernor {
    address aToken = lendingPool.getReserveData(address(currency)).aTokenAddress;
    uint256 interest = IERC20Upgradeable(aToken).balanceOf(address(this)) - depositedToLendingPool;
    lendingPool.withdraw(address(currency), interest, factory.treasury());
  }

  // INTERNAL

  function _transferIn(address from, uint256 amount) internal override {
    currency.safeTransferFrom(from, address(this), amount);

    lendingPool.deposit(address(currency), amount, address(this), 0);
    depositedToLendingPool += amount;
  }

  function _transferOut(address to, uint256 amount) internal override {
    uint256 amountFromLendingPool;
    if (amount > currency.balanceOf(address(this))) {
      amountFromLendingPool = amount - currency.balanceOf(address(this));
      depositedToLendingPool -= amountFromLendingPool;
      lendingPool.withdraw(address(currency), amountFromLendingPool, to);
    }
    if (amount - amountFromLendingPool > 0) {
      currency.safeTransfer(to, amount - amountFromLendingPool);
    }
  }

  // PUBLIC VIEW

  function cash() public view override returns (uint256) {
    return super.cash() + depositedToLendingPool;
  }
}
