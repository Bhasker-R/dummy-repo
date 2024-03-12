// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract Faucet is Ownable {
  /// @notice Token that this contract faucets
  IERC20 public token;

  /// @notice Amount given per one claim
  uint256 public amountPerClaim;

  /// @notice Interval between claims
  uint256 public claimInterval;

  /// @notice Mapping of addresses to their last claim times
  mapping(address => uint256) public lastClaim;

  // CONSTRUCTOR

  /**
   * @notice Contract consturctor
   * @param token_ Token value
   * @param amountPerClaim_ Amount per claim value
   * @param claimInterval_ Claim interval value
   */
  constructor(IERC20 token_, uint256 amountPerClaim_, uint256 claimInterval_) Ownable() {
    token = token_;
    amountPerClaim = amountPerClaim_;
    claimInterval = claimInterval_;
  }

  // PUBLIC FUNCTIONS

  /**
   * @notice Function that is used to claim tokens
   */
  function claim() external {
    require(canClaim(msg.sender), 'Sender can not claim yet');

    token.transfer(msg.sender, amountPerClaim);
    lastClaim[msg.sender] = block.timestamp;
  }

  // VIEW FUNCTIONS

  /**
   * @notice Function that returns flag if given account can claim now
   * @param account Address to check for
   * @return True if account can claim, false otherwise
   */
  function canClaim(address account) public view returns (bool) {
    return block.timestamp >= lastClaim[account] + claimInterval;
  }

  // RESTRICTED FUNCTIONS

  /**
   * @notice Function that is used by owner to set new amount per claim
   * @param amountPerClaim_ Amount per claim value
   */
  function setAmountPerClaim(uint256 amountPerClaim_) external onlyOwner {
    amountPerClaim = amountPerClaim_;
  }

  /**
   * @notice Function that is used by owner to set new claim interval
   * @param claimInterval_ Claim interval value
   */
  function setClaimInterval(uint256 claimInterval_) external onlyOwner {
    claimInterval = claimInterval_;
  }
}
