/* global ethers */
/* eslint prefer-const: "off" */

// 6 exported by diamond.js out of which 2 imported here (f() and kind of enum-type)
// to be used in facetCuts.push({}): FacetCut[] type: 3 arguments
const { getSelectors, FacetCutAction } = require('../scripts/libraries/diamond.js')

async function deployDiamond () {
  const accounts = await ethers.getSigners()  // returns array of accounts
  const contractOwner = accounts[0]   // Patrick's 'deployer'** (address) = accounts[0].address

  // 1). Deploy DiamondInit (3-step code)
  // DiamondInit provides a function (init()) that is called when the diamond is upgraded or deployed to initialize state variables
  // Read about how the diamondCut function works in the EIP2535 Diamonds standard
  const DiamondInit = await ethers.getContractFactory('DiamondInit')
  const diamondInit = await DiamondInit.deploy()
  await diamondInit.deployed()
  console.log('DiamondInit deployed:\n', diamondInit.address)

  // 2). Deploy all 3 facets and set the `facetCuts` array variable with 3 'keys'
  console.log('')
  console.log('Deploying facets')
  const FacetNames = [
    'DiamondCutFacet',
    'DiamondLoupeFacet',
    'OwnershipFacet'
  ]
  // The `facetCuts` variable is the FacetCut[] that contains the functions to be added to the Diamond during diamond its deployment
  const facetCuts = []
  // (3-step code inside the loop)
  for (const FacetName of FacetNames) {
    const Facet = await ethers.getContractFactory(FacetName)
    const facet = await Facet.deploy()
    await facet.deployed()
    // 2x${} inside console.log()
    console.log(`${FacetName} deployed: ${facet.address}`)

    facetCuts.push({
      // the following 3 'keys' of this array variable of struct-type are the names of members...
      // of struct FacetCut{} declared in IDiamond.sol
      // These names will be matched against the declared ones while pasing facetCuts as an arg. while deploying Diamond.sol
      facetAddress: facet.address,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(facet)
      // 'facet' is the contract's instance's abstraction object in JS
    })
  }

  // Creating a function call, TO PASS AS AN ARG. IN DIAMOND.sol's constructor
  // This call gets executed during deployment and can also be executed in upgrades
  // It is executed with delegatecall on the DiamondInit address. (2nd and 3rd arg. of diamondCut())
  let functionCall = diamondInit.interface.encodeFunctionData('init')
  // https://docs.ethers.io/v5/api/utils/abi/interface/

  // Setting arguments that will be used in the diamond constructor, below @ deployment
  const diamondArgs = {
    owner: contractOwner.address,   // deployer** (above)
    init: diamondInit.address,
    initCalldata: functionCall
  }

  // 3). Deploy Diamond (3-step code)
  const Diamond = await ethers.getContractFactory('Diamond')
  const diamond = await Diamond.deploy(facetCuts, diamondArgs)  
  // Above: facetCuts, diamondArgs = 
  // constructor(IDiamondCut.FacetCut[] memory _diamondCut, DiamondArgs memory _args)
  // and 2 f() of LibDiamond inside constructor will be executed
  await diamond.deployed()

  console.log()
  console.log('Diamond deployed:', diamond.address)

  // returning the address of the diamond
  return diamond.address
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
if (require.main === module) {
  deployDiamond()   // the f() inside which whole above code is contained
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
}

exports.deployDiamond = deployDiamond
// the f() inside which whole above code is contained, now EXPORTED to be imported & used elsewhere

// We, instead, will use module.exports and re-write deploy() with args = []...Hail Patrick Collins
