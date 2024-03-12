// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {DataTypes} from '../interfaces/aave/DataTypes.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '../libraries/Decimal.sol';
import './ATokenMock.sol';

contract LendingPoolMock {
  using SafeERC20 for IERC20;
  using Decimal for uint256;

  mapping(address => DataTypes.ReserveData) public getReserveData;

  function deposit(address asset, uint256 amount, address, uint16) external {
    IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
    ATokenMock(getReserveData[asset].aTokenAddress).mint(msg.sender, amount);
  }

  function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
    ATokenMock(getReserveData[asset].aTokenAddress).burn(msg.sender, amount);
    IERC20(asset).safeTransfer(to, amount);
    return amount;
  }

  function createAToken(address asset) external {
    getReserveData[asset].aTokenAddress = address(new ATokenMock());
  }

  function scale(address asset, uint256 by) external {
    ATokenMock(getReserveData[asset].aTokenAddress).scaleIndex(by);
  }
}
