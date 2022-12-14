/* global describe it before ethers */

// 11 Unit tests for now

// Optional:
// To check whether diamondCut() exec correctly, we can also include event-listening for DiamondCut event...
// before assert (though assert does the real test)

// No need to necessarily run cacheBugTest.js before running this test script
// Why?
// bcz here also, we're running deploy.js and returning 3 contract abst. of 3 std. facets

// DiamondInit/ 2nd & 3rd arg. of diamondCut() NOT tested among below 12 unit tests, for now.

// 4 imports = 3 f() + 1 custom-type (struct)
const {
  getSelectors,
  FacetCutAction,
  removeSelectors,
  findAddressPositionInFacets
} = require('../scripts/libraries/diamond.js')

const { deployDiamond } = require('../scripts/deploy.js')

const { assert } = require('chai')
const { ethers } = require('hardhat')

describe('DiamondTest', async function () {
  let diamondAddress    // main
  // 3 std. facets
  let diamondCutFacet
  let diamondLoupeFacet
  let ownershipFacet
  // tx-related
  let tx
  let txReceipt
  let result
  
  const addresses = []    // scope is global across all individual "it" tests
  // to push addresses (1x1 - loop) of 3xfacets that got 'added' in the Diamond @ deployment using deploy.js

  // Deploy Diamond, return its address, and return contract abst. of all 3 std. facets using Diamond-address
  
  // PATRICK uses beforeEach{} with ethers.getContract() to return new connection with an already deployed contract (hh deploy/auto-deploy before hh test)
  before(async function () {
    // all 5 S/C deployed contained in deploy.js
    diamondAddress = await deployDiamond()    // all std. outputs will be displayed
    // diamondAddress dffers with each deployment (beforeEach)

    // return instances of contract abstractions of 3 std. facets
    diamondCutFacet = await ethers.getContractAt('DiamondCutFacet', diamondAddress)
    diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', diamondAddress)
    ownershipFacet = await ethers.getContractAt('OwnershipFacet', diamondAddress)
  })
  // test # 1: application of Loupe()
  it('should have three facets -- call to facetAddresses function', async () => {
    // const threeFacetAddresses = await diamondLoupeFacet.facetAddresses()
    for (const address of await diamondLoupeFacet.facetAddresses()) {
      addresses.push(address)   // array of addresses only
    }
    // array.length property (selectors.length): both for Solidity (LibDiamond) and JS
    assert.equal(addresses.length, 3)
  })

  // Test # 2: application of Loupe()
  it('facets should have the right function selectors -- call to facetFunctionSelectors function', async () => {
    // Facet # 1
    // 'selectors' and 'result' are array types = sameMembers
    // .sameMembers(set1, set2, [message])
    // Asserts that set1 and set2 have the same members IN ANY ORDER. 
    // Uses a strict equality check (===).
    let selectors = getSelectors(diamondCutFacet)   // in re-deploy, diamondCutFacet is new
    // console.log(`\nSelectors in DiamondCutFacet: ${selectors}`) 
    // console.log(`Facet @ addresses[0]: ${addresses[0]}`): error being thrown right here
    // if it.only this test bcz addresses[] array does Not get populated
    // bcz first unit test did not run at all
    // console.log(`\nLength of addresses array: ${addresses.length}`) - it's 3, not 6 
    // (bcz unit test 1 won't re-run for test # 2)
    // const newAddress0 = "0x0165878A594ca255338adfa4d48449f69242Eb8F"
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[0])   // in re-deploy, diamondLoupeFacet is also new
    // address passed as a string above as JS cannot read numeric literals > 2^53 (BigNumber can help)

    // console.log(`\naddresses[0] for "result": ${addresses[0]}`)
    // console.log(`\nResult in DiamondCutFacet: ${result}`)
    assert.deepEqual(result, selectors, 'Members differ')   
    // if test failed above, it won't run the subsequent code in the same unit test

    // .deepEqual(actual, expected, [message])
    // bcz deepEqual works for mixed/any type, it DOES work for 2 array-types here (also patrick Github)

    // Facet # 2
    // const newAddress1 = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853"
    selectors = getSelectors(diamondLoupeFacet)
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[1])
    assert.sameMembers(result, selectors)
    // Facet # 3
    // const newAddress2 = "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6"
    selectors = getSelectors(ownershipFacet)
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[2])
    assert.sameMembers(result, selectors)
  })

  // Test # 3 - not all 8 selectors got tested. Sample 4 tested
  it('selectors should be associated to facets correctly -- multiple calls to facetAddress function', async () => {
    assert.equal(
      addresses[0], // DiamondCutFacet.sol
      await diamondLoupeFacet.facetAddress('0x1f931c1c')  // selector hardcoded
    )
    assert.equal(
      addresses[1], // DiamondLoupeFacet.sol
      await diamondLoupeFacet.facetAddress('0xcdffacc6')
    )
    assert.equal(
      addresses[1],
      await diamondLoupeFacet.facetAddress('0x01ffc9a7')
    )
    assert.equal(
      addresses[2], // OwnershipFacet.sol
      await diamondLoupeFacet.facetAddress('0xf2fde38b')
    )
  })

  // Test # 4
  it('should add test1 functions: JS-remove-supportsInterface(bytes4)', async () => {
    // first, deploy Test1Facet.sol in 3-6-step
    console.log("\nDeploying Test1Facet.sol")
    const Test1Facet = await ethers.getContractFactory('Test1Facet')
    const test1Facet = await Test1Facet.deploy()
    await test1Facet.deployed()
    console.log(`Test1facet.sol deployed at: ${test1Facet.address}`)

    addresses.push(test1Facet.address)    // its address pushed to addresses[3]
    
    // invoked 'selectors.remove' as getSelectors() returns 'selectors' of Test1Facet.sol
    // [funcSig-array] that's why '[' used inside remove()
    // selector corrsp. to "supportsInterface" should be removed from the returned array of 'selectors' of Test1Facet
    // and save to L.H.S selectors
    // here, console.log(all selectors returned from getSelectors - its script) + then remove exec.
    const selectors = getSelectors(test1Facet).remove(['supportsInterface(bytes4)'])
    // Adding Test1Facet to Diamond.sol
    // 3-step diamondCut() tx
    console.log("Adding Test1Facet and its f() using diamondCut()")
    tx = await diamondCutFacet.diamondCut(
      [   // array of struct instances
        { // 1 such struct instance
        facetAddress: test1Facet.address,
        action: FacetCutAction.Add,     // mapping will get updated and Test1Facet will "bear" Diamond's stable address, below test # 5
        functionSelectors: selectors    // all 20 selectors sans supportsInterface (0x01ffc9a7)
        }
      ],
      ethers.constants.AddressZero, 
      '0x', 
      { gasLimit: 800000 })

    txReceipt = await tx.wait()

    if (!txReceipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }

    result = await diamondLoupeFacet.facetFunctionSelectors(test1Facet.address) // i/p is address type
    // TILL now, getSelectors() => 'selectors' ...
    // & diamondLoupeFacet.facetFunctionSelectors() => 'result'
    // ALWAYS, for "assert"
    assert.sameMembers(result, selectors)
  })

  // Test # 5
  it('should test function call of Test1Facet at Diamond-address', async () => {
    // "diamondAddress" will work here bcz Test1Facet has been added using diamondCut()
    // test1Facet is an instance of its contract_abstraction
    const test1Facet = await ethers.getContractAt('Test1Facet', diamondAddress)
    const tx = await test1Facet.test1Func10()   // tx here for display below, just in case
    /* Testing the output by actually displaying it
    const txReceipt = await tx.wait()
    console.log(`\nTransaction Receipt of test1Func10: ${JSON.stringify(txReceipt)}`)
    */
  })

  // Test # 6 - Diagramatic explanation of this test & REPLACE() in notebook @ Nov. 30
  it('should [diamondCut(Replace)] replace supportsInterface function', async () => {
    console.log("\nTest # 6")
    // we're re-deploying Test1Facet here
    const Test1Facet = await ethers.getContractFactory('Test1Facet')
    // out of the 21 selectors returned here, we "get" our target selector out of it
    // "ContractFactory" can also be used as an input here
    // taken as: contractFactory.interface.functions in actual body of getSelectors()
    // contractFactory.interface: Interface (ABI), then Interface.functions: array<functionFragments>
    // contract.interface: Interface (ABI), then, --------ditto-------------
    // that's why "keys" (funcSig) of all of those f() are being returned by Object.keys()
    // despite JS-removed above, supportsInterface still hardcoded/present in Test1Facet...
    // hence gettable here
    const selectors = getSelectors(Test1Facet).get(['supportsInterface(bytes4)'])
    console.log(`\n'selectors' after get() executed: ${selectors}`)
    // input is an array of f() Signatures and get()'s Sighash will return its selector
    const testFacetAddress = addresses[3]   
    // contains address of Test1Facet, pushed into addresses aray in test # 4
    console.log(`\nTestFacetAddress (Test1Facet-same?): ${testFacetAddress}`)
    
    // 3-step tx thing
    console.log("Replacing supportsInterface(bytes4) using diamondCut()")
    tx = await diamondCutFacet.diamondCut(
      [ //array
        { // 1st struct-type member (index = 0) of this array
        facetAddress: testFacetAddress,
        action: FacetCutAction.Replace,
        functionSelectors: selectors    // 0x01ffc9a7 = getSighash('supportsInterface(bytes4)')
        }
      ],
      ethers.constants.AddressZero, 
      '0x', 
      { gasLimit: 800000 })

    txReceipt = await tx.wait()

    if (!txReceipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    // Replace: same f() selector present in a different S/C replaces the one alrerady existing in Diamond's mapping
    // (re-pointed/updated) mappings are read by diamondLoupeFacet, NOT JS script
    // now after replacing happens thru diamondCut(), its mapping has 21 f() of Test1Facet (earlier 20)
    result = await diamondLoupeFacet.facetFunctionSelectors(testFacetAddress)
    // "testFacetAddress" is another name of address where Test1Facet is deployed (= addresses[3])
    console.log(`\nResult (result) of test # 6 (replace): ${result}`)
    // JS script reads methods hardcoded in the facet, 21 f()
    assert.sameMembers(result, getSelectors(Test1Facet))
  })

  // Test # 7
  it('should add test2 functions', async () => {
    // 3-6-step deployment
    console.log(`Deploying Test2Facet.sol`)
    const Test2Facet = await ethers.getContractFactory('Test2Facet')
    const test2Facet = await Test2Facet.deploy()
    await test2Facet.deployed()
    console.log(`\nDeployed Test2Facet at: ${test2Facet.address}`)
    console.log(`------------------------`)
    // pushing its address at index # 4 in addresses-array (after 3xstd. facets + 1xTest1Facet)
    addresses.push(test2Facet.address)
    // JS getSelectors() can be run anytime
    const selectors = getSelectors(test2Facet)
    // 3-step tx process
    console.log("\nAdding Test2Facet and its f() using diamondCut()")
    tx = await diamondCutFacet.diamondCut(
      [
        {
        facetAddress: test2Facet.address,
        action: FacetCutAction.Add,
        functionSelectors: selectors
        }
      ],
      ethers.constants.AddressZero, 
      '0x', 
      { gasLimit: 800000 })

    txReceipt = await tx.wait()

    if (!txReceipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    // Loupe f() can only test after diamondCut() exec to Add/Replace/Remove
    // bcz then only that mapping gets updated
    result = await diamondLoupeFacet.facetFunctionSelectors(test2Facet.address)
    assert.sameMembers(result, selectors, 'Members differ')
  })

  // Test # 8
  it("Should call a function in Test2Facet after getting added in Diamond", async () => {
    const test2Facet = await ethers.getContractAt("Test2Facet", diamondAddress)
    const tx = await test2Facet.test2Func1() 
    /* Some tests without asserts as well
    const txReceipt = await tx.wait()
    console.log(`\nTransaction Receipt: ${JSON.stringify(txReceipt)}`)
    */
  })

  // Test # 9
  it('should remove some test2 functions', async () => {
    const test2Facet = await ethers.getContractAt('Test2Facet', diamondAddress)
    // array of funcSigs, needs to passed in .get(functionNames)
    // later on selectors returned from Sigs using getSighash() there itself
    const functionsToKeep = ['test2Func1()', 'test2Func5()', 'test2Func6()', 'test2Func19()', 'test2Func20()']
    // below 'selectors' have all 15 f() of test2Facet except above 5 f(), as returned by .remove()
    // SEE how .remove() has been smartly put to use here
    const selectors = getSelectors(test2Facet).remove(functionsToKeep)
    // 3-step tx
    console.log("\nRemoving 15 f() of Test2Facet using diamondCut()")
    tx = await diamondCutFacet.diamondCut(
      [ // array of satruct instances
        { // only 1 struct instancxe for now
        facetAddress: ethers.constants.AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: selectors    // 15 selectros going to get removed
        }
      ],
      ethers.constants.AddressZero, 
      '0x', 
      { gasLimit: 800000 })

    txReceipt = await tx.wait()

    if (!txReceipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    // AFTER UPDRAGE, LOUPE() WILL BE USED
    // to test what all Test2Facet f() are present in the Diamond
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[4])
    // result has above 5 f() = FunctionsToKeep
    // SEE how .get() has been smartly put to use here
    assert.sameMembers(result, getSelectors(test2Facet).get(functionsToKeep))
  })

  // Test # 10
  it('should remove some test1 functions', async () => {
    const test1Facet = await ethers.getContractAt('Test1Facet', diamondAddress)

    const functionsToKeep = ['test1Func2()', 'test1Func11()', 'test1Func12()']
    // selectors below has 18 f() out of all 21 f() in Test1Facet
    const selectors = getSelectors(test1Facet).remove(functionsToKeep)
    // 3-step tx: UPGRADE Process
    console.log("\nRemoving 18 f() of Test1Facet using diamondCut()")
    tx = await diamondCutFacet.diamondCut(
      [ // array
        { // struct instance # 1
        facetAddress: ethers.constants.AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: selectors    // 18 selectors going to get removed
        }
      ],
      ethers.constants.AddressZero, 
      '0x', 
      { gasLimit: 800000 })

    txReceipt = await tx.wait()

    if (!txReceipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    // test1facet already stored at addresses[3]
    // result has 3 f()
    // AFTER UPDRAGE, LOUPE() WILL BE USED
    // to test what all Test2Facet f() are present in the Diamond
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[3])
    // Smart usage of .get()
    assert.sameMembers(result, getSelectors(test1Facet).get(functionsToKeep))
  })

  // Test # 11: 1XdiamondCut() and 3X std. Facets
  // INFO: 1. removal of f() will inevitably remove the facets-entries from the struct#1, per REMOVE() code (las line)
  // 2. 14 will be removed out of 16 f(), calc. below
  it('remove all functions and facets except \'diamondCut\' and \'facets\'', async () => {
    let selectors = []  // init to zero-value array
    // get all 5 (3 std. facets + 2 test facets) facets: Facet-struct-type (addresses, bytes4[])
    let facets = await diamondLoupeFacet.facets() // no need to init to zero-value array... 
    // passing on an actual value = 5
    for (let i = 0; i < facets.length; i++) { // 0 - 4
      // returning all the selectors = 1+5+2+3(21)+5(20) = 16(49) in all out of which 14 will be remoed
      // Spread syntax (...)
      // to access f() selectors in facets[i][j], we write facets[i].functionSelectors
      // and what gets expanded is the bytes4[]'s functionSelectors, all pushed
      selectors.push(...facets[i].functionSelectors)
      // expands all selectors contained inside this facet[i] and pushes to 'selectors'
    }
    // filter/remove facets() and diamondCut() from 'selectors' and returned the filtered array
    selectors = removeSelectors(selectors, ['facets()', 'diamondCut(tuple(address,uint8,bytes4[])[],address,bytes)'])
    
    // 14 selectors will return above

    // 3-step tx = remove
    console.log("\nRemoving selectors using diamondCut()")

    tx = await diamondCutFacet.diamondCut(
      [   // array of struct
        { // 1st element of struct array
        facetAddress: ethers.constants.AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: selectors    // 14 selectors to be removed out of 16 right now
        }
      ],
      ethers.constants.AddressZero, 
      '0x', 
      { gasLimit: 800000 })

    txReceipt = await tx.wait()

    if (!txReceipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    // facets() runs bcz still present in Diamond
    // 2 facets should be there: DLoupeF, DCutF
    facets = await diamondLoupeFacet.facets()
    console.log(`\nRemaining facets: ${facets}`)
    assert.equal(facets.length, 2)
    // for DiamondCutFacet at addresses[0]
    assert.equal(facets[0][0], addresses[0])      // 2-D array ??
    // for diamondCut((address,uint8,bytes4[])[],address,bytes) - sans 'tuple'
    assert.sameMembers(facets[0][1], ['0x1f931c1c'])
    // for DiamondLoupeFacet at addresses[1]
    assert.equal(facets[1][0], addresses[1])
    // for facets()
    assert.sameMembers(facets[1][1], ['0x7a0ed627'])
  })

  // Test # 12- Mix and match of 'Actions' in 1 single tx
  it('add most functions and facets', async () => {
    // getSelectors() will return all 5 f() of Loupe - JS hardcoded
    // diamondLoupeFacetSelectors has 4 f() except sI(b4)
    const diamondLoupeFacetSelectors = getSelectors(diamondLoupeFacet).remove(['supportsInterface(bytes4)'])
    // // maybe kept aside for now to exec replaceF() later
    // for now, Test1Facet's 'supportsInterface' is gonna be re-added, below

    const Test1Facet = await ethers.getContractFactory('Test1Facet')
    const Test2Facet = await ethers.getContractFactory('Test2Facet')

    // Any number of functions from any number of facets can be added/replaced/removed...
    // in a single transaction
    // Nothing to do for DiamondCutFacet.sol, it already has its diamondCut()
    const cut = [   // 4 elements in cut[] = _diamondCut[], 1st arg. of diamondCut()
      {
        facetAddress: addresses[1], //DiamondLoupeFacet.sol
        action: FacetCutAction.Add,
        // facets() is already there in the Diamond (Test # 11)
        functionSelectors: diamondLoupeFacetSelectors.remove(['facets()'])
        // functionSelectors has 3 f() to be re-added
      },
      {
        facetAddress: addresses[2], // OwnershipFacet.sol
        action: FacetCutAction.Add,
        // both f() of this facet need to be re-added
        functionSelectors: getSelectors(ownershipFacet)
      },
      {
        facetAddress: addresses[3], // Test1Facet.sol
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(Test1Facet) // all 21 f() need to be re-added
        // Loupe()'s supportsInterface() is Not gonna re-added bcz Test1Facet's is gonna be
        // maybe kept aside for now to exec replaceF() later
      },
      {
        facetAddress: addresses[4], // Test2Facet.sol
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(Test2Facet) // all 20 f() need to be re-added
      }
    ]
    // 3-step std. tx: 
    console.log("\nRE-Adding all 48 selectors using diamondCut()")
    tx = await diamondCutFacet.diamondCut(cut,      // 46 f() being re-added to make it a total of 48/49
      ethers.constants.AddressZero, 
      '0x', 
      { gasLimit: 8000000 })
    
    txReceipt = await tx.wait()

    if (!txReceipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }

    // facets has 5 elements in facets-array (type-struct Facets{addresses, selectors})
    const facets = await diamondLoupeFacet.facets()
    // facetAddresses array has 5 elements
    const facetAddresses = await diamondLoupeFacet.facetAddresses()
    // all 13 asserts in 1 single unit test by Nick
    assert.equal(facetAddresses.length, 5)
    assert.equal(facets.length, 5)
    assert.sameMembers(facetAddresses, addresses) // addresses array has 5 facet-addresses pushed onto it
    // facets[1-D index] contains all addresses
    assert.equal(facets[0][0], facetAddresses[0], 'first facet')
    assert.equal(facets[1][0], facetAddresses[1], 'second facet')
    assert.equal(facets[2][0], facetAddresses[2], 'third facet')
    assert.equal(facets[3][0], facetAddresses[3], 'fourth facet')
    assert.equal(facets[4][0], facetAddresses[4], 'fifth facet')
    // what's the point in having above 5 tests after assert # 3?

    // getSelectors(diamondCutFacet) has only 1 selector- diamondCut()
    // facets[findAddressPositionInFacets(addresses[0], facets)][1] returns : bytes4[]-selectors
    // the above 2 are matched against each other inside assert as both return list of selectors...
    // for all the 5 facets below
    // R.H.S in total is returning 48 f() out of 49 f()

    // findAddressPositionInFacets() returns 'i', index of 'facetAddress' inside facets-struct-array
    // ultimately, this all gets resolved to assert(facets[0][0], getSelectors(facet))
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[0], facets)][1], getSelectors(diamondCutFacet))
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[1], facets)][1], diamondLoupeFacetSelectors)
    // "diamondLoupeFacetSelectors" does NOT have sI(bytes4), that's why here we did not take getSelectors(DLoupeF)
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[2], facets)][1], getSelectors(ownershipFacet))
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[3], facets)][1], getSelectors(Test1Facet))
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[4], facets)][1], getSelectors(Test2Facet))
  })
})
