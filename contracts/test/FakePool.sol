// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import '../interfaces/IPoolFactory.sol';

contract FakePool {
  IPoolFactory public factory;

  bool public constant IS_FAKE = true;

  constructor(IPoolFactory factory_) {
    factory = factory_;
  }

  function manager() external pure returns (address) {
    return address(0);
  }

  function currency() external pure returns (address) {
    return address(0);
  }

  function close() external {
    factory.closePool();
  }
}
