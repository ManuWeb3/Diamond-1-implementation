// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
/******************************************************************************\
* Author: Nick Mudge <nick@perfectabstractions.com> (https://twitter.com/mudgen)
* EIP-2535 Diamonds: https://eips.ethereum.org/EIPS/eip-2535

* Cloned and editied: Manu Kapoor
/******************************************************************************/

// The functions in DiamondLoupeFacet MUST be added to a diamond.
// The EIP-2535 Diamond standard requires these functions.

import { LibDiamond } from  "../libraries/LibDiamond.sol";
import { IDiamondLoupe } from "../interfaces/IDiamondLoupe.sol";
import { IERC165 } from "../interfaces/IERC165.sol";
import "hardhat/console.sol";
// by default, compiler will look into node_modules for any file, e.g. hardhat for console.sol
// notation: Lib.func() = console.log() where log() has too many versions inside console.sol lib.
// All 4 f() of IDiamondLoupe are defined here

contract DiamondLoupeFacet is IDiamondLoupe, IERC165 {
    // Diamond Loupe Functions
    ////////////////////////////////////////////////////////////////////
    /// These functions are expected to be called frequently by tools (like louper.dev, etc.)
    // The struct is a part of IDiamondLoupe interface of EIP2535
    // struct Facet {
    //     address facetAddress;
    //     bytes4[] functionSelectors;
    // }
    /// @notice Gets all facets and their selectors.
    /// @return facets_ Facet

    // kept the visibility external, same as the one in Interface (mandatory)
    function facets() external override view returns (Facet[] memory facets_) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        // storgae bcz LibDiamond.diamondStorage() returns struct in 'storage' - f() sign
        uint256 selectorCount = ds.selectors.length;
        // 'selectors' contain all f() of the Diamond irrespective of the facets
        
        // --------------------- 3 Parametres to iterate thru all facets and their resp. f()
        // create an array set to the maximum size possible = selectorCount
        // count of factes <= count of all f() i nany Diamond.
        // Yes, there can be made a contact in solidity with zero f() but that will be of no use in Diamond as delegatecall() will not work.
        // will loop thru Facet[]
        facets_ = new Facet[](selectorCount);   // 4, with my classic 2*(1->2) e.g.
        
        // does Facet[]'s value get populated with Diamond's facetAddress & functionSelectors, if at all, via FacetCut{} struct ??
        // create an array for counting the number of selectors for each facet
        // will loop thru selectors of the Facet[] var facet_ above
        // max. count considered to be 65,535 selectors in a given facet => uint16 (0-65,535)
        uint16[] memory numFacetSelectors = new uint16[](selectorCount);    // 4, with my classic 2*(1->2) e.g.
        // above array is empty for now unlike facets_

        // total number of facets
        // this will give us a definite count of facets inside a contract < = selectorCount 
        uint256 numFacets;                      // 2, with my classic 2*(1->2) e.g.
        // ---------------------

        // loop through function selectors
        // 1st fresh loop
        for (uint256 selectorIndex; selectorIndex < selectorCount; selectorIndex++) {
            // using 'selectorIndex (position)',retrieve 1st selector and its resp. facet address
            // below 2 (ds.1 and ds.2) are accessible as we imported LibDiamond.sol here
            bytes4 selector = ds.selectors[selectorIndex];
            address facetAddress_ = ds.facetAddressAndSelectorPosition[selector].facetAddress;
            // loop ops. start--------------------
            bool continueLoop = false;
            // find the functionSelectors array (of Facet struct) for selector and add selector to it, for display
            // 1st nested loop under 1st fresh loop
            for (uint256 facetIndex; facetIndex < numFacets; facetIndex++) {
                // DEFINITELY, facets_ has afcetAddresses till this if{}, else always false
                if (facets_[facetIndex].facetAddress == facetAddress_) { // 1st iteration: address @ 0 = add.
                    facets_[facetIndex].functionSelectors[numFacetSelectors[facetIndex]] = selector;
                    // added 1st selector at 0+0 index of functionSelectors array                               
                    numFacetSelectors[facetIndex]++;
                    continueLoop = true;
                    break;
                }
            } // nested loop ends here

            // Nick: if functionSelectors array exists for selector then continue loop... (unlike below * comment)
            // bcz NO Need to create functionSelectors array for this selector
            // btw, when will functionSelectors array exist for this selector ?... 
            // We already assigned selector to it in the nested loop
            if (continueLoop) {
                continueLoop = false;
                continue;
            } // continue @ 1st fresh loop (not nested one). Below code won't execute

            // Nick: create a new functionSelectors array for selector... 
            // bcz functionSelectors array did not exist for this selector (unlike above * comment)
            facets_[numFacets].facetAddress = facetAddress_;
            facets_[numFacets].functionSelectors = new bytes4[](selectorCount);
            facets_[numFacets].functionSelectors[0] = selector;
            numFacetSelectors[numFacets] = 1;
            numFacets++;
        }   // 1st fresh loop ends here
        
        // 2nd fresh loop
        for (uint256 facetIndex; facetIndex < numFacets; facetIndex++) {
            uint256 numSelectors = numFacetSelectors[facetIndex];
            bytes4[] memory selectors = facets_[facetIndex].functionSelectors;
            // setting the number of selectors
            assembly {
                mstore(selectors, numSelectors)
            }
        }
        // all 3 (2 fresh + 1 nested) loop ops. end------------------

        // setting the number of facets
        assembly {
            mstore(facets_, numFacets)
        }
    }

    /// @notice Gets all the function selectors supported by a specific facet.
    /// @param _facet The facet address.
    /// @return _facetFunctionSelectors The selectors associated with a facet address.
    function facetFunctionSelectors(address _facet) external override view returns (bytes4[] memory _facetFunctionSelectors) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        uint256 selectorCount = ds.selectors.length;
        uint256 numSelectors;
        _facetFunctionSelectors = new bytes4[](selectorCount);
        // loop through function selectors
        for (uint256 selectorIndex; selectorIndex < selectorCount; selectorIndex++) {
            bytes4 selector = ds.selectors[selectorIndex];
            address facetAddress_ = ds.facetAddressAndSelectorPosition[selector].facetAddress;
            if (_facet == facetAddress_) {
                _facetFunctionSelectors[numSelectors] = selector;
                numSelectors++;
            }
        }
        // Set the number of selectors in the array
        assembly {
            mstore(_facetFunctionSelectors, numSelectors)
        }
    }

    /// @notice Get all the facet addresses used by a diamond.
    /// @return facetAddresses_
    function facetAddresses() external override view returns (address[] memory facetAddresses_) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        uint256 selectorCount = ds.selectors.length;
        // create an array set to the maximum size possible
        facetAddresses_ = new address[](selectorCount);
        uint256 numFacets;
        // loop through function selectors
        for (uint256 selectorIndex; selectorIndex < selectorCount; selectorIndex++) {
            bytes4 selector = ds.selectors[selectorIndex];
            address facetAddress_ = ds.facetAddressAndSelectorPosition[selector].facetAddress;
            bool continueLoop = false;
            // see if we have collected the address already and break out of loop if we have
            for (uint256 facetIndex; facetIndex < numFacets; facetIndex++) {
                if (facetAddress_ == facetAddresses_[facetIndex]) {
                    continueLoop = true;
                    break;
                }
            }
            // continue loop if we already have the address
            if (continueLoop) {
                continueLoop = false;
                continue;
            }
            // include address
            facetAddresses_[numFacets] = facetAddress_;
            numFacets++;
        }
        // Set the number of facet addresses in the array
        assembly {
            mstore(facetAddresses_, numFacets)
        }
    }

    /// @notice Gets the facet address that supports the given selector.
    /// @dev If facet is not found return address(0).
    /// @param _functionSelector The function selector.
    /// @return facetAddress_ The facet address.
    function facetAddress(bytes4 _functionSelector) external override view returns (address facetAddress_) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        facetAddress_ = ds.facetAddressAndSelectorPosition[_functionSelector].facetAddress;
    }

    // This implements ERC-165.
    function supportsInterface(bytes4 _interfaceId) external override view returns (bool) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        return ds.supportedInterfaces[_interfaceId];
    }
}
