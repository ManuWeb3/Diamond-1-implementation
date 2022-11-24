// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { LibDiamond } from "../libraries/LibDiamond.sol";
import { IERC173 } from "../interfaces/IERC173.sol";

contract OwnershipFacet is IERC173 {
    // set (transfer) Owner
    function transferOwnership(address _newOwner) external override {
        // can only transfer/set by the owner
        LibDiamond.enforceIsContractOwner();
        LibDiamond.setContractOwner(_newOwner);
    }
    // get Owner
    function owner() external override view returns (address owner_) {
        owner_ = LibDiamond.contractOwner();
    }
}

