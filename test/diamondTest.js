/* global describe it before ethers */

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
  
  const addresses = []    
  // to push addresses (1x1 - loop) of 3xfacets that got 'added' in the Diamond @ deployment using deploy.js

  // Deploy Diamond, return its address, and return contract abst. of all 3 std. facets using Diamond-address
  before(async function () {
    // all 5 S/C deployed contained in deploy.js
    diamondAddress = await deployDiamond()    // all std. outputs will be displayed

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
    let selectors = getSelectors(diamondCutFacet)
    // console.log(`Facet @ addresses[0]: ${addresses[0]}`): error being thrown right here
    // if it.only this test bcz addresses[] array does Not get populated
    // bcz first unit test did not run at all
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[0])
    assert.deepEqual(result, selectors, 'Members differ')
    // .deepEqual(actual, expected, [message])
    // bcz deepEqual works for mixed/any type, it DOES work for 2 array-types here (also patrick Github)

    // Facet # 2
    selectors = getSelectors(diamondLoupeFacet)
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[1])
    assert.sameMembers(result, selectors)
    // Facet # 3
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
  it.only('should add test1 functions', async () => {
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
        action: FacetCutAction.Add,
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

  it('should test function call', async () => {
    const test1Facet = await ethers.getContractAt('Test1Facet', diamondAddress)
    await test1Facet.test1Func10()
  })

  it('should replace supportsInterface function', async () => {
    const Test1Facet = await ethers.getContractFactory('Test1Facet')
    const selectors = getSelectors(Test1Facet).get(['supportsInterface(bytes4)'])
    const testFacetAddress = addresses[3]
    tx = await diamondCutFacet.diamondCut(
      [{
        facetAddress: testFacetAddress,
        action: FacetCutAction.Replace,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
    txReceipt = await tx.wait()
    if (!txReceipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    result = await diamondLoupeFacet.facetFunctionSelectors(testFacetAddress)
    assert.sameMembers(result, getSelectors(Test1Facet))
  })

  it('should add test2 functions', async () => {
    const Test2Facet = await ethers.getContractFactory('Test2Facet')
    const test2Facet = await Test2Facet.deploy()
    await test2Facet.deployed()
    addresses.push(test2Facet.address)
    const selectors = getSelectors(test2Facet)
    tx = await diamondCutFacet.diamondCut(
      [{
        facetAddress: test2Facet.address,
        action: FacetCutAction.Add,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
    txReceipt = await tx.wait()
    if (!txReceipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    result = await diamondLoupeFacet.facetFunctionSelectors(test2Facet.address)
    assert.sameMembers(result, selectors)
  })

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

  it('remove all functions and facets accept \'diamondCut\' and \'facets\'', async () => {
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
