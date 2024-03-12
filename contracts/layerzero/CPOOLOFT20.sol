// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import './OFTCore.sol';
import './CPOOLCore.sol';

contract CPOOLOFT20 is CPOOLCore, OFTCore {
  constructor(address _layerZeroEndpoint) CPOOLCore() OFTCore(_layerZeroEndpoint) {}

  function circulatingSupply() public view virtual override returns (uint256) {
    return totalSupply;
  }

  function _debitFrom(
    address _from,
    uint16,
    bytes memory,
    uint256 _amount
  ) internal virtual override {
    address spender = _msgSender();
    if (_from != spender) _spendAllowance(_from, spender, _amount);
    _burn(_from, _amount);
  }

  function _creditTo(uint16, address _toAddress, uint256 _amount) internal virtual override {
    _mint(_toAddress, _amount);
  }
}
