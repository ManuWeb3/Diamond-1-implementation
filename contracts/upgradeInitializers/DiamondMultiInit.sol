// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/******************************************************************************\
* Author: Nick Mudge <nick@perfectabstractions.com> (https://twitter.com/mudgen)
* EIP-2535 Diamonds: https://eips.ethereum.org/EIPS/eip-2535
*
* Implementation of a diamond.

* Cloned and editied: Manu Kapoor
/******************************************************************************/

import { LibDiamond } from "../libraries/LibDiamond.sol";

error AddressAndCalldataLengthDoNotMatch(uint256 _addressesLength, uint256 _calldataLength);

contract DiamondMultiInit {    

    // This function is/can be provided in the third parameter of the `diamondCut` function, where 2nd arg. will be address of this contract
    // The `diamondCut` function executes this function to execute 'multiple initializer functions' for a single deployment/upgrade.

    /// @notice : One of those multi/array contracts(init) and functions(calldata)
    /// can be the DiamondInit.sol+its' native init()
    /// and the rest of the array elements can be other contracts + their resp. f() that we want to get exec
    /// during our custom Diamond's deploytment and upgradation

    function multiInit(address[] calldata _addresses, bytes[] calldata _calldata) external {        
        if(_addresses.length != _calldata.length) {
            revert AddressAndCalldataLengthDoNotMatch(_addresses.length, _calldata.length);
        }
        for(uint i; i < _addresses.length; i++) {
            LibDiamond.initializeDiamondCut(_addresses[i], _calldata[i]);            
        }
        // Lib imported here to call initializeDiamondCut() with the array inputs
        // single init already in the LibDiamond's default diamondCut()
    }
}
