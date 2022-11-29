/* global ethers */

// custom (enum-type) var in JS
const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 }    //inspired from IDiamond.sol's facetCutAction-enum

// get function selectors from ABI - typical JS setup - advance level
// Contract => all its selectors

// ALL NOTES reg. new f() of JS/ethers.js @ NOV 27 - notebook

 function getSelectors (contract) {
  // Object.keys(object): returns 'key(s)' part of the key-value pair inside array (index) / JSON obj. {keys}
  console.log(`\n contract.interface.functions: \n ${JSON.stringify(contract.interface.functions)}`)
  const signatures = Object.keys(contract.interface.functions)
  console.log(`\n Signatures (from Object.keys()): ${signatures}`)

  const selectors = signatures.reduce((acc, val) => {   
    // Actual Selectors (array type = acc, below) returned @ the end to this var 'selectors' above
    // error: console.log(`\n'Selectors' returned from signatures.reduce((acc, val): ${selectors}`)
    console.log(`\n variable Val: ${val}`)
    if (val !== 'init(bytes)') {
      // error: console.log(`\n Init(bytes) for now: ${init(bytes)}`)
      console.log(`\n Individual Sighashes: ${contract.interface.getSighash(val)}`)
      acc.push(contract.interface.getSighash(val))      
    }
    console.log(`\n Array variable Acc: ${acc}`)
    return acc
  }, [])
  selectors.contract = contract
  selectors.remove = remove   // remove some functionSelectors from the array corresponding to the array of funcSignatures
  selectors.get = get         // get functionSelectors from the array of corresponding funcSignatures
  console.log(`\n Selectors in the contract: ${selectors}`)
  console.log("--------------------------")
  return selectors
}

// get function selector from function signature: 2-step process in JS
// Function (sign) => only its selector
 function getSelector (func) {
  console.log(`\n Function passed in: ${func}`)
  // Step: 1
  const abiInterface = new ethers.utils.Interface([func])
  // create a new Interface from obj rep. the ABI- this case: func (an ABI with single function - sort of)
  // Step: 2
  return abiInterface.getSighash(ethers.utils.Fragment.from(func))
  // Fragment is an Error, Event, Funcitons, Constructor - all that describes an ABI of the contract
  // Topic Hash is the first slot that has a keccak256 hash value at [0] - sort of event ID
  // interface.getSighash(): iface.getSighash("balanceOf(address)"); = '0x70a08231'
  // ethers.utils.Fragment.from(func): this creates a new sub-class of type Fragment
}

// used with getSelectors to remove selectors from an array of selectors
// functionNames argument is an array of function signatures
// details - lo??
 function remove (functionNames) {
  const selectors = this.filter((v) => {    // body of arg.-test f() wrote inside filter() itself as per ES6
    // .filter(): creates a new array (here: 'selectors') with the results returned out of the f() that executes a test, that's passed into filter() as an arg.
    for (const functionName of functionNames) {
      if (v === this.contract.interface.getSighash(functionName)) {   // looping var 'functionName'
        return false  // if anyone matched (present = not removed)
      }
    }
    return true       // if None matched (absent = removed)
  })
  // after all funcSelectors iterated thru, below will exec.
  selectors.contract = this.contract
  selectors.remove = this.remove
  selectors.get = this.get
  // filtered selectors returned
  console.log(`Filerted Selectors (remove): ${selectors}`)
  return selectors
}

// used with getSelectors to get selectors from an array of selectors
// functionNames argument is an array of function signatures
 function get (functionNames) {
  const selectors = this.filter((v) => {
    for (const functionName of functionNames) {
      if (v === this.contract.interface.getSighash(functionName)) {   // looping var 'functionName'
        return true   // if any matched (present = gettable)
      }
    }
    return false      // if None matched (absent = non-gettable)
  })
  // after all funcSelectors iterated thru, below will exec.
  selectors.contract = this.contract
  selectors.remove = this.remove
  selectors.get = this.get
  // filtered selectors returned
  console.log(`Filerted Selectors (get): ${selectors}`)
  return selectors
}

// remove selectors using an array of signatures - details ??
 function removeSelectors (selectors, signatures) {
  console.log(`Signatures as an arg.: ${signatures}`)
  const iface = new ethers.utils.Interface(signatures.map(v => 'function ' + v))
  // .map() creates a new array by calling a f() for every element in the orig. array by exec that f() only once per element
  const removeSelectors = signatures.map(v => iface.getSighash(v))
  selectors = selectors.filter(v => !removeSelectors.includes(v))
  console.log(`Selectors as return var.: ${selectors}`)
  return selectors
}

// find a particular address' position in the ('factes' array) return value of diamondLoupeFacet.facets()
// 'diamondLoupeFacet' is an instance of contract abstraction for: DiamondLoupeFacet.sol, in JS
// and factes() is its first f()
// ooking for the index/position of a facet's address in the factes array of struct Factes with 2 members: addresses and bytes4[]
 function findAddressPositionInFacets (facetAddress, facets) {
  for (let i = 0; i < facets.length; i++) {
    if (facets[i].facetAddress === facetAddress) {
      return i
    }
  }
}

// ADDED async to all above which NICK did NOT
// added module.exports = {}
// module.exports = {getSelectors, getSelector, FacetCutAction, remove, removeSelectors, findAddressPositionInFacets}
// except 'get', all exported.


exports.getSelectors = getSelectors
exports.getSelector = getSelector
exports.FacetCutAction = FacetCutAction
exports.remove = remove
exports.removeSelectors = removeSelectors
exports.findAddressPositionInFacets = findAddressPositionInFacets
