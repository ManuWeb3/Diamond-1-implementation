// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/******************************************************************************\
* Author: Nick Mudge <nick@perfectabstractions.com> (https://twitter.com/mudgen)
* EIP-2535 Diamonds: https://eips.ethereum.org/EIPS/eip-2535

* Cloned and editied: Manu Kapoor
/******************************************************************************/
import { IDiamond } from "../interfaces/IDiamond.sol";
import { IDiamondCut } from "../interfaces/IDiamondCut.sol";

// Remember to add the loupe functions from DiamondLoupeFacet to the diamond.
// The loupe functions are required by the EIP2535 Diamonds standard
// loupe are a MUST for transparency and enhancing trust

error NoSelectorsGivenToAdd();
error NotContractOwner(address _user, address _contractOwner);
error NoSelectorsProvidedForFacetForCut(address _facetAddress);
error CannotAddSelectorsToZeroAddress(bytes4[] _selectors);
error NoBytecodeAtAddress(address _contractAddress, string _message);
error IncorrectFacetCutAction(uint8 _action);
error CannotAddFunctionToDiamondThatAlreadyExists(bytes4 _selector);
error CannotReplaceFunctionsFromFacetWithZeroAddress(bytes4[] _selectors);
error CannotReplaceImmutableFunction(bytes4 _selector);
error CannotReplaceFunctionWithTheSameFunctionFromTheSameFacet(bytes4 _selector);
error CannotReplaceFunctionThatDoesNotExists(bytes4 _selector);
error RemoveFacetAddressMustBeZeroAddress(address _facetAddress);
error CannotRemoveFunctionThatDoesNotExist(bytes4 _selector);
error CannotRemoveImmutableFunction(bytes4 _selector);
error InitializationFunctionReverted(address _initializationContractAddress, bytes _calldata);

library LibDiamond {
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("diamond.standard.diamond.storage");
    // set this first

    struct FacetAddressAndSelectorPosition {
        // 2 state vars.
        address facetAddress;
        uint16 selectorPosition;
        // 'selectorPosition' kept in a diff struct so as to retrieve & update during removeF()
        // only brought to use in removeFunctions()
        // selectorPosition in bytes4[] selectors array in DiamondStorage struct        
    }

    struct DiamondStorage {
        // 4 state variables

        // function selector => struct(facet address and selector position): position in selectors array
        mapping(bytes4 => FacetAddressAndSelectorPosition) facetAddressAndSelectorPosition;
        bytes4[] selectors;     // selectorPosition (index) defined in above struct
        // mostly, how the flow has worked... 
        // we input an a local var (index) to bytes4[] selectors, get selector,... 
        // then input again to the mapping above to get facetAddress from struct#1
        mapping(bytes4 => bool) supportedInterfaces;
        // owner of the contract
        address contractOwner;
        // set thru Library's setContractOwner() when called inside Diamond.sol's constructor
        // accessed iside Diamond via diamondStorage()
    }

    function diamondStorage() internal pure returns (DiamondStorage storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
            // Only direct number costants and references to these constants... 
            // are supported by inline assembly
            // => Error: ds.slot := DIAMOND_STORAGE_POSITION
        }
    }

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    // IERC173 not imported/used for this event

    function setContractOwner(address _newOwner) internal {
        // contractOwner: State var in DiamondStorage struct
        DiamondStorage storage ds = diamondStorage();
        address previousOwner = ds.contractOwner;
        ds.contractOwner = _newOwner;
        emit OwnershipTransferred(previousOwner, _newOwner);
    }

    function contractOwner() internal view returns (address contractOwner_) {
        // contractOwner: State var in DiamondStorage struct
        contractOwner_ = diamondStorage().contractOwner;
    }

    function enforceIsContractOwner() internal view {
        if(msg.sender != diamondStorage().contractOwner) {
            revert NotContractOwner(msg.sender, diamondStorage().contractOwner);
        }        
    }

    event DiamondCut(IDiamondCut.FacetCut[] _diamondCut, address _init, bytes _calldata);
    // IDiamondCut inherits IDiamond that has FacetCut struct declared

    // Internal function version of diamondCut
    function diamondCut(
        IDiamondCut.FacetCut[] memory _diamondCut,
        address _init,
        bytes memory _calldata
    ) internal {            // 1 of the internal calls comes from Diamond.sol
        for (uint256 facetIndex; facetIndex < _diamondCut.length; facetIndex++) {
            // facetIndex: facetAddress: refers to address of facet which is first var in struct FacetCut
            // 3 in-f() vars. declared here to save gas------------
            bytes4[] memory functionSelectors = _diamondCut[facetIndex].functionSelectors;
            // assigned to temporary array 'functionSelectors' inside this f() to avoid... 
            // R/W ops. in storage for '_diamondCut[facetIndex].functionSelectors' - cheaper, as Patrick taught
            address facetAddress = _diamondCut[facetIndex].facetAddress;
            // address != 0, will be checked in the resp. f(): add/replace/remove below
            
            // Suppose, we want toremove an entire facet,
            // still, have to give all selectors as an arg. along with facet address. Only facetAdress won't help
            if(functionSelectors.length == 0) {
                revert NoSelectorsProvidedForFacetForCut(facetAddress);
            }
            IDiamondCut.FacetCutAction action = _diamondCut[facetIndex].action;
            // ----------------------------------------------------
            if (action == IDiamond.FacetCutAction.Add) {
                addFunctions(facetAddress, functionSelectors);
            } else if (action == IDiamond.FacetCutAction.Replace) {
                replaceFunctions(facetAddress, functionSelectors);
            } else if (action == IDiamond.FacetCutAction.Remove) {
                removeFunctions(facetAddress, functionSelectors);
            } else {
                revert IncorrectFacetCutAction(uint8(action));
                // uint8(action) will give the number to compare with enum-action 0,1,2
            }
        }       // for loop ends
        // will emit ALL changes/upgrades (_diamondCut) after for loop in 1 single event emission
        emit DiamondCut(_diamondCut, _init, _calldata);
        // init the Diamond right after upgrade in the single f() call to avoid inconsistency
        initializeDiamondCut(_init, _calldata);
    }

    // single iteration of for-loop of diamondCut is going on for either of the below 3 f()
    // _facetAddress & _functionSelectors retrieved from for-loop
    function addFunctions(address _facetAddress, bytes4[] memory _functionSelectors) internal {        
        // if address exists
        if(_facetAddress == address(0)) {
            revert CannotAddSelectorsToZeroAddress(_functionSelectors);
        }

        DiamondStorage storage ds = diamondStorage();
        uint16 selectorCount = uint16(ds.selectors.length);     // needed to run for{} below
        // count != 0, already checked in diamondCut()
        // for i=0, 'selectorCount' above is zero
        // 'selectorCount' keeps value only till the f() runs, temp. storage. 
        // Future additions, have to again get value from ds.selectors.length to point to next position to add
        enforceHasContractCode(_facetAddress, "LibDiamondCut: Add facet has no code");
        // the contract must have been constructed by the time extcodesize(addrs) is called OR an EOA/emptyCode will be reverted

        for (uint256 selectorIndex; selectorIndex < _functionSelectors.length; selectorIndex++) {
            bytes4 selector = _functionSelectors[selectorIndex];    // selectors array
            address oldFacetAddress = ds.facetAddressAndSelectorPosition[selector].facetAddress;
            // oldFacetAddress SHOULD BE zero if this selector is Not already present in the Diamond else revert
            if(oldFacetAddress != address(0)) {
                revert CannotAddFunctionToDiamondThatAlreadyExists(selector);
            }            
            ds.facetAddressAndSelectorPosition[selector] = FacetAddressAndSelectorPosition(_facetAddress, selectorCount);
            // here selectorCount is setting the SV selectorPosition above inside this struct format **
            // the 'selectorPosition' for this 'selector' is zero, assigned from 'selectorCount' above, for i=0
            // here exactly, we added facetAddress of a S/C to the diamond.
            ds.selectors.push(selector);
            // added this new 'selector' in the 'selectors' array, earlier empty at i=0
            // selectorCount is a loca lvar declared right inside this f() **
            selectorCount++;
            // to point to the next position in the array to add next selector, whenever it happens
        }
    }

    function replaceFunctions(address _facetAddress, bytes4[] memory _functionSelectors) internal {        
        DiamondStorage storage ds = diamondStorage();
        // SV inside it already got populated in addF() above ideally, not empty now.

        // if address exists
        if(_facetAddress == address(0)) {
            revert CannotReplaceFunctionsFromFacetWithZeroAddress(_functionSelectors);
        }
        // if it exists, is it a code
        enforceHasContractCode(_facetAddress, "LibDiamondCut: Replace facet has no code");
        
        for (uint256 selectorIndex; selectorIndex < _functionSelectors.length; selectorIndex++) {
            bytes4 selector = _functionSelectors[selectorIndex];
            address oldFacetAddress = ds.facetAddressAndSelectorPosition[selector].facetAddress;
            // can't replace immutable functions -- functions defined directly in the diamond in this case
            
            // Library's f() are immutable
            if(oldFacetAddress == address(this)) {
                revert CannotReplaceImmutableFunction(selector);
            }
            // retrieved oldFacetAddress = target _facetAddress with, of course, same f()
            if(oldFacetAddress == _facetAddress) {
                revert CannotReplaceFunctionWithTheSameFunctionFromTheSameFacet(selector);
            }
            // no facet, f() does not exist yet in the Diamond.
            if(oldFacetAddress == address(0)) {
                revert CannotReplaceFunctionThatDoesNotExists(selector);
            }
            // replace old facet address
            ds.facetAddressAndSelectorPosition[selector].facetAddress = _facetAddress;
        }
    }

    // removeF() actually REORDERS the mapping and then... 
    // remove selectors element + remove that mapping element from struct # 1
    function removeFunctions(address _facetAddress, bytes4[] memory _functionSelectors) internal {        
        DiamondStorage storage ds = diamondStorage();
        // array will be used here as was used in addF()
        uint256 selectorCount = ds.selectors.length;
        // facet exists at non-zero address? if yes, then REVERT
        // _facetAddress has to be = address(0)
        if(_facetAddress != address(0)) {
            revert RemoveFacetAddressMustBeZeroAddress(_facetAddress);
        }        
        
        // have to loop here, no other option        
        for (uint256 selectorIndex; selectorIndex < _functionSelectors.length; selectorIndex++) {
            bytes4 selector = _functionSelectors[selectorIndex];
            // retrieve original/old facetAddress
            // due to mapping: gas-eff way to check whether f() exists... 
            // else looping thru some array costs gas

            // entering target selector below gives me target struct # 1's element
            FacetAddressAndSelectorPosition memory oldFacetAddressAndSelectorPosition = ds.facetAddressAndSelectorPosition[selector];
            // interesting way to check if function exists ? 
            // no need to loop thru any array, hence, save gas
            if(oldFacetAddressAndSelectorPosition.facetAddress == address(0)) {
                revert CannotRemoveFunctionThatDoesNotExist(selector);
            }
                        
            // can't remove immutable functions -- functions defined directly in the diamond
            // any f() defined here in is termed as 'directly defined in Diamond' -- immutable
            if(oldFacetAddressAndSelectorPosition.facetAddress == address(this)) {
                revert CannotRemoveImmutableFunction(selector);
            }
            // replace selector with last selector count: it's a local var
            // to bring it to last element/index of selectors array
            selectorCount--;    
            // retrieve position of selector in struct#1 from selectors array in struct#2
            // this selectorPosition is reading directly the SV selectorPosition inside struct#1
            // BUT, it's NOT reading the last saved value of selectorPosition
            if (oldFacetAddressAndSelectorPosition.selectorPosition != selectorCount) {
                // if true above, retrieve last added Selector in selectors array (my e.g. at index 3, i.e. 4th selector
                bytes4 lastSelector = ds.selectors[selectorCount];
                // assgined that lastSelector to index # 1 (my target selector to be removed) in selectors array
                // this way, it got out of the selectors array, here
                ds.selectors[oldFacetAddressAndSelectorPosition.selectorPosition] = lastSelector;
                // update [lastSelector].selectorPosition to be '1', from orig. value '3' 
                ds.facetAddressAndSelectorPosition[lastSelector].selectorPosition = oldFacetAddressAndSelectorPosition.selectorPosition;
                // still, in my e.g., oldFacetAddressAndSelectorPosition.selectorPosition = 1 
            }
            
            // if above cond. is false @ both values = 3 (my orig. e.g. add 2 facets with 2 f() each), it means...
            // we're already pointing to last selector, our target selector to be removed
            ds.selectors.pop();         // delete last selector (also works when same lastSelector got updated at indices # 1 and #3...) 
            // the case when above 'if' is true, the case when I want to remove selector @ index #1, not the last one)

            // FINALLY, delete that mapping as well - a MUST
            delete ds.facetAddressAndSelectorPosition[selector];
        }
    }

    function initializeDiamondCut(address _init, bytes memory _calldata) internal {
        // when I don't want any init code to run right after any upgrade thru diamondCut()
        if (_init == address(0)) {
            return;
        }

        enforceHasContractCode(_init, "LibDiamondCut: _init address has no code"); 
               
        (bool success, bytes memory error) = _init.delegatecall(_calldata);
        if (!success) {
            if (error.length > 0) {
                // bubble up error
                /// @solidity memory-safe-assembly
                assembly {
                    let returndata_size := mload(error)
                    revert(add(32, error), returndata_size)
                }
            } else {
                revert InitializationFunctionReverted(_init, _calldata);
            }
        }        
    }

    function enforceHasContractCode(address _contract, string memory _errorMessage) internal view {
        uint256 contractSize;
        assembly {
            contractSize := extcodesize(_contract)
        }
        if(contractSize == 0) {
            revert NoBytecodeAtAddress(_contract, _errorMessage);
        }        
    }
}
