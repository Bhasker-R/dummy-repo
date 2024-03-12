// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '../libraries/Decimal.sol';

contract ATokenMock is ERC20 {
  using Decimal for uint256;

  uint256 public currentIndex;

  uint256 private _supply;

  mapping(address => uint256) private _balances;

  // CONSTRUCTOR

  constructor() ERC20('AToken', 'AT') {
    currentIndex = Decimal.ONE;
  }

  // PUBLIC

  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }

  function burn(address to, uint256 amount) external {
    _burn(to, amount);
  }

  function scaleIndex(uint256 by) external {
    currentIndex = currentIndex.mulDecimal(by);
  }

  // VIEW

  function totalSupply() public view override returns (uint256) {
    return _supply.mulDecimal(currentIndex);
  }

  function balanceOf(address account) public view override returns (uint256) {
    return _balances[account].mulDecimal(currentIndex);
  }

  // INTERNAL

  function _transfer(address from, address to, uint256 amount) internal override {
    uint256 scaled = amount.divDecimal(currentIndex);
    _balances[from] -= scaled;
    _balances[to] += scaled;
  }

  function _mint(address to, uint256 amount) internal override {
    uint256 scaled = amount.divDecimal(currentIndex);
    _balances[to] += scaled;
    _supply += scaled;
  }

  function _burn(address from, uint256 amount) internal override {
    uint256 scaled = amount.divDecimal(currentIndex);
    _balances[from] -= scaled;
    _supply -= scaled;
  }
}
