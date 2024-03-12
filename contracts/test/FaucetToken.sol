// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import '@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol';

contract FaucetToken is ERC20PresetMinterPauser, ERC20Permit {
  uint8 private _decimals;

  constructor(
    string memory name,
    string memory symbol,
    uint8 decimals_
  ) ERC20PresetMinterPauser(name, symbol) ERC20Permit(name) {
    _decimals = decimals_;
  }

  function decimals() public view override returns (uint8) {
    return _decimals;
  }

  function faucet(uint256 amount) external {
    _mint(msg.sender, amount);
  }

  function faucetTo(address receiver, uint256 amount) external {
    _mint(receiver, amount);
  }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal virtual override(ERC20, ERC20PresetMinterPauser) {
    super._beforeTokenTransfer(from, to, amount);
  }
}
