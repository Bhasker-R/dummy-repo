// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import '@prb/math/contracts/PRBMathUD60x18.sol';
import './InterestRateModelBase.sol';

/// @notice This contract represent default interest rate calculation model for a pool
contract DefaultInterestRateModel is InterestRateModelBase {
  using PRBMathUD60x18 for uint256;

  /// @notice Type of the model
  string public constant TYPE = 'Default';

  /// @notice Base interest rate (as 18-digit decimal)
  uint256 public immutable baseRate;

  /// @notice Interest rate multiplier (as 18-digit decimal)
  uint256 public immutable multiplier;

  /// @notice Interest rate jump multiplier (as 18-digit decimal)
  uint256 public immutable jumpMultiplier;

  /// @notice Utilization above which jump multiplier is applied
  uint256 public immutable kink;

  /// @notice Contract's constructor
  /// @param baseRate_ Base rate value
  /// @param multiplier_ Multiplier value
  /// @param jumpMultiplier_ Jump multiplier value
  /// @param kink_ Kink value
  constructor(uint256 baseRate_, uint256 multiplier_, uint256 jumpMultiplier_, uint256 kink_) {
    baseRate = baseRate_;
    multiplier = multiplier_;
    jumpMultiplier = jumpMultiplier_;
    kink = kink_;
  }

  /// @notice Function that calculates borrow interest rate for pool
  /// @param balance Total pool balance
  /// @param borrows Total pool borrows
  /// @param reserves Sum of pool reserves and insurance
  /// @return Borrow rate per second
  function getBorrowRate(
    uint256 balance,
    uint256 borrows,
    uint256 reserves
  ) public view override returns (uint256) {
    if (borrows == 0) {
      return 0;
    }

    uint256 util = utilizationRate(balance, borrows, reserves);
    uint256 rate;
    if (util <= kink) {
      rate = baseRate + multiplier.mul(util);
    } else {
      rate = baseRate + multiplier.mul(kink) + jumpMultiplier.mul(util - kink);
    }
    require(rate <= MAX_RATE, 'HMR');
    return rate;
  }
}
