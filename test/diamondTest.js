/* global describe it before ethers */

// 11 Unit tests for now

// No need to necessarily run cacheBugTest.js before running this test script
// Why?
// bcz here also, we're running deploy.js and returning 3 contract abst. of 3 std. facets

// 4 imports = 3 f() + 1 custom-type (struct)
const {
  getSelectors,
  FacetCutAction,
  removeSelectors,
  findAddressPositionInFacets
} = require('../scripts/libraries/diamond.js')

const { deployDiamond } = require('../scripts/deploy.js')

const { assert } = require('chai')

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
  it.only('should have three facets -- call to facetAddresses function', async () => {
    // const threeFacetAddresses = await diamondLoupeFacet.facetAddresses()
    for (const address of await diamondLoupeFacet.facetAddresses()) {
      addresses.push(address)   // array of addresses only
    }
    // array.length property (selectors.length): both for Solidity (LibDiamond) and JS
    assert.equal(addresses.length, 3)
  })

  // Test # 2: application of Loupe()
  it.only('facets should have the right function selectors -- call to facetFunctionSelectors function', async () => {
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
  it.only('selectors should be associated to facets correctly -- multiple calls to facetAddress function', async () => {
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
  it.only('should add test1 functions: JS-remove-supportsInterface(bytes4)', async () => {
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
  it.only('should test function call of Test1Facet at Diamond-address', async () => {
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
  it.only('should [diamondCut(Replace)] replace supportsInterface function', async () => {
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
    const Test2Facet = await ethers.getContractFactory('Test2Facet')
    const test2Facet = await Test2Facet.deploy()
    await test2Facet.deployed()

    addresses.push(test2Facet.address)

    const selectors = getSelectors(test2Facet)

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

    result = await diamondLoupeFacet.facetFunctionSelectors(test2Facet.address)
    assert.sameMembers(result, selectors, 'Members differ')
  })

  // Test # 8
  it('should remove some test2 functions', async () => {
    const test2Facet = await ethers.getContractAt('Test2Facet', diamondAddress)
    const functionsToKeep = ['test2Func1()', 'test2Func5()', 'test2Func6()', 'test2Func19()', 'test2Func20()']
    const selectors = getSelectors(test2Facet).remove(functionsToKeep)
    tx = await diamondCutFacet.diamondCut(
      [{
        facetAddress: ethers.constants.AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
    txReceipt = await tx.wait()
    if (!txReceipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[4])
    assert.sameMembers(result, getSelectors(test2Facet).get(functionsToKeep))
  })

  it('should remove some test1 functions', async () => {
    const test1Facet = await ethers.getContractAt('Test1Facet', diamondAddress)
    const functionsToKeep = ['test1Func2()', 'test1Func11()', 'test1Func12()']
    const selectors = getSelectors(test1Facet).remove(functionsToKeep)
    tx = await diamondCutFacet.diamondCut(
      [{
        facetAddress: ethers.constants.AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
    txReceipt = await tx.wait()
    if (!txReceipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[3])
    assert.sameMembers(result, getSelectors(test1Facet).get(functionsToKeep))
  })

  it('remove all functions and facets except \'diamondCut\' and \'facets\'', async () => {
    let selectors = []
    let facets = await diamondLoupeFacet.facets()
    for (let i = 0; i < facets.length; i++) {
      selectors.push(...facets[i].functionSelectors)
    }
    selectors = removeSelectors(selectors, ['facets()', 'diamondCut(tuple(address,uint8,bytes4[])[],address,bytes)'])
    tx = await diamondCutFacet.diamondCut(
      [{
        facetAddress: ethers.constants.AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
    txReceipt = await tx.wait()
    if (!txReceipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    facets = await diamondLoupeFacet.facets()
    assert.equal(facets.length, 2)
    assert.equal(facets[0][0], addresses[0])
    assert.sameMembers(facets[0][1], ['0x1f931c1c'])
    assert.equal(facets[1][0], addresses[1])
    assert.sameMembers(facets[1][1], ['0x7a0ed627'])
  })

  it('add most functions and facets', async () => {
    const diamondLoupeFacetSelectors = getSelectors(diamondLoupeFacet).remove(['supportsInterface(bytes4)'])
    const Test1Facet = await ethers.getContractFactory('Test1Facet')
    const Test2Facet = await ethers.getContractFactory('Test2Facet')
    // Any number of functions from any number of facets can be added/replaced/removed in a
    // single transaction
    const cut = [
      {
        facetAddress: addresses[1],
        action: FacetCutAction.Add,
        functionSelectors: diamondLoupeFacetSelectors.remove(['facets()'])
      },
      {
        facetAddress: addresses[2],
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(ownershipFacet)
      },
      {
        facetAddress: addresses[3],
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(Test1Facet)
      },
      {
        facetAddress: addresses[4],
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(Test2Facet)
      }
    ]
    tx = await diamondCutFacet.diamondCut(cut, ethers.constants.AddressZero, '0x', { gasLimit: 8000000 })
    txReceipt = await tx.wait()
    if (!txReceipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    const facets = await diamondLoupeFacet.facets()
    const facetAddresses = await diamondLoupeFacet.facetAddresses()
    assert.equal(facetAddresses.length, 5)
    assert.equal(facets.length, 5)
    assert.sameMembers(facetAddresses, addresses)
    assert.equal(facets[0][0], facetAddresses[0], 'first facet')
    assert.equal(facets[1][0], facetAddresses[1], 'second facet')
    assert.equal(facets[2][0], facetAddresses[2], 'third facet')
    assert.equal(facets[3][0], facetAddresses[3], 'fourth facet')
    assert.equal(facets[4][0], facetAddresses[4], 'fifth facet')
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[0], facets)][1], getSelectors(diamondCutFacet))
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[1], facets)][1], diamondLoupeFacetSelectors)
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[2], facets)][1], getSelectors(ownershipFacet))
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[3], facets)][1], getSelectors(Test1Facet))
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[4], facets)][1], getSelectors(Test2Facet))
  })
})
