// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Example library to show a simple example of diamond storage

library TestLib {

  bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("diamond.standard.test.storage");
  
  struct TestState {
      address myAddress;
      uint256 myNum;
  }
  // 'ds' will be stored in the contract storage that imports/USES this lib.
  // can use pure if accessing only constants within body. 
  // why? bcz constants are Not stored in storage unlike SV
  function diamondStorage() internal pure returns (TestState storage ds) {
      bytes32 position = DIAMOND_STORAGE_POSITION;
      assembly {
          ds.slot := position
      }
  }
  // retrieve ds and set
  function setMyAddress(address _myAddress) internal {
    TestState storage testState = diamondStorage();
    testState.myAddress = _myAddress;
  }
  // retrieve ds and get/return
  function getMyAddress() internal view returns (address) {
    TestState storage testState = diamondStorage();
    return testState.myAddress;
  }
}

// no need to import lib., it's right here
contract Test1Facet {
    event TestEvent(address something);   // nowhere emitted
  // 2 f() with bodies (accessing lib.)
   function test1Func1() external {
      TestLib.setMyAddress(address(this));
    }
    // no passing arg. Hardcoded set
    // at deploy, null values. At calling this f(), address set

    function test1Func2() external view returns (address){
      return TestLib.getMyAddress();
    }

    // 18 f() defined (though with empty bodies below)
    function test1Func3() external {}
    // there is a body => f() is defined but it's kept empty unlike an Interface

    function test1Func4() external {}

    function test1Func5() external {}

    function test1Func6() external {}

    function test1Func7() external {}

    function test1Func8() external {}

    function test1Func9() external {}

    function test1Func10() external {}

    function test1Func11() external {}

    function test1Func12() external {}

    function test1Func13() external {}

    function test1Func14() external {}

    function test1Func15() external {}

    function test1Func16() external {}

    function test1Func17() external {}

    function test1Func18() external {}

    function test1Func19() external {}

    function test1Func20() external {}

    function supportsInterface(bytes4 _interfaceID) external view returns (bool) {}
    // why view? 
    // bcz it reads the SV mapping (bytes4 => bool)
}
