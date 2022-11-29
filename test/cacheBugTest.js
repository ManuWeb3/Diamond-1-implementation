/* global ethers describe before it */
/* eslint-disable prefer-const */

// () not needed below for deployDiamond(), to import
const { deployDiamond } = require('../scripts/deploy.js')
// imported complete f() here to deploy all 5 S/C in 3 categories (Init, 3xfacets, Diamond.sol)

const { FacetCutAction } = require('../scripts/libraries/diamond.js')  
// data structure of 'Action'/Upgrading a Diamond (not getSelectors(), etc. for now)

const { assert } = require('chai')

// The diamond example comes with 8 function selectors (excl. Diamond.sol itself, its fallback(), & LibDiamond.sol)
// 3 std. Facets: 
// 1XDiamondCutFacet, 5XDiamondLoupeFacet, 2XOwnershipFacet
// [cut, loupe, loupe, loupe, loupe, erc165, transferOwnership, owner]

// This bug manifests if you delete something from the final
// selector slot array, so we'll fill up a new slot with
// things, and have a fresh row to work with.
describe('Cache bug test', async () => {    // no need for async
  let diamondLoupeFacet
  let test1Facet

  // All slots below refer to Test1Facet.sol's contract storage
  const ownerSel = '0x8da5cb5b'   // slot 0

  const sel0 = '0x19e3b533' // fills up slot 1  =   keccak256(test1Func1()) = TestLib.setMyAddress(address(this));
  const sel1 = '0x0716c2ae' // fills up slot 1  =   keccak256(test1Func2())
  const sel2 = '0x11046047' // fills up slot 1  =   keccak256(test1Func3())
  const sel3 = '0xcf3bbe18' // fills up slot 1  =   keccak256(test1Func4())
  const sel4 = '0x24c1d5a7' // fills up slot 1  =   keccak256(test1Func5())
  const sel5 = '0xcbb835f6' // fills up slot 1  =   keccak256(test1Func6())
  const sel6 = '0xcbb835f7' // fills up slot 1  =   random selectors ahead

  const sel7 = '0xcbb835f8' // fills up slot 2
  const sel8 = '0xcbb835f9' // fills up slot 2
  const sel9 = '0xcbb835fa' // fills up slot 2
  const sel10 = '0xcbb835fb' // fills up slot 2

  // async needed so that await-instructions can be exec below
  before(async function () {
    let tx
    let txReceipt

    let selectors = [
      sel0,   // test1Func1() = TestLib.setMyAddress(address(this));
      sel1,
      sel2,
      sel3,
      sel4,
      sel5,
      sel6,
      sel7,
      sel8,
      sel9,
      sel10
    ]

    // all 5 S/C compiled and deployed here, below
    let diamondAddress = await deployDiamond()  // only value returned by this f() in deploy.js
    // get below 2 contracts' deployed instances - abstraction objects
    let diamondCutFacet = await ethers.getContractAt('DiamondCutFacet', diamondAddress)
    // getContractAt() returns Promise<Contract>...
    // to interact with an already deployed contract's instance at a given address, below
    // connected to default deployer (accounts[0].address <= 1st a/c returned by getSigners())
    diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', diamondAddress)
    
    // Test1Facet.sol already compiled till now and contractFactory returned just deploys @ next step
    // Std. 3-6-step deployment
    console.log("Deploying Test1Facet.sol")
    const Test1Facet = await ethers.getContractFactory('Test1Facet')  // no camelCasing for C.F.
    test1Facet = await Test1Facet.deploy()        // camelCasing for C.
    await test1Facet.deployed()
    console.log(`Test1Facet.sol deployed at: ${test1Facet.address}`)
    console.log("--------------------------")

    // Add f() / facet () to contract---------------------------------
    // add functions
    // '(' for diamondCut()
    // inside it, '[' for array (if any) along with '{' for individual struct instance
    tx = await diamondCutFacet.diamondCut([
    // below 1 3-element-set corresponds to 1 instance of _diamondCut array of struct FacetCut[] type
      { 
        // below 3 are the keys (LHS) = variable names of types/members of FacetCut struct in IDiamond.sol
        // baisc premise of Diamond: f() already written in test1facet.sol
        // this action (Add) just adds its context in Diamond:
        // called: "Adding f() / facet() to the Diamond"
        facetAddress: test1Facet.address,
        action: FacetCutAction.Add,   
        // FacetCutAction is created as a sp. type in diamond.js
        // action: diamondCutFacet.FacetCutAction.Add can also be used with diamondCutFacet
        // not really any need to create FacetCutAction separately in diamond.js
        functionSelectors: selectors
      }
    ], 
    ethers.constants.AddressZero,   // address _init = address(0) here
    '0x',                           // _calldata calldata = null here ... means no initialization at upgrade
    { gasLimit: 800000 })           // optional argument
    // it seems that we can pass on such optional overrides (likewise .deploy()) in a f() call in JS

    txReceipt = await tx.wait()     // something that contract.deployed() does

    // provider.getTransactionReceipt( hash ) ⇒ Promise< TransactionReceipt >
    // gives output incl status: 1 or 0 (uint, not bool)
    if (!txReceipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)   // Response-hash, NOT receipt-hash
      // specifically, this tx rep. thru 'tx.hash' failed, so, no upgrade happened
    }
    // --------------------------------------------------------------

    // Remove function selectors-------------------------------------
    // Function selector for the owner function in slot 0
    selectors = [
      ownerSel, // owner selector = slot 0
      sel5,
      sel10
    ]
    tx = await diamondCutFacet.diamondCut([
      {
        facetAddress: ethers.constants.AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: selectors
      }
    ], ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
    txReceipt = await tx.wait()
    if (!txReceipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
  })
  // --------------------------------------------------------------

  // Test for Cache Bug now
  // async
  it('should not exhibit the cache bug', async () => {
    // Get the test1Facet's registered functions
    let selectors = await diamondLoupeFacet.facetFunctionSelectors(test1Facet.address)

    // Check individual correctness
    assert.isTrue(selectors.includes(sel0), 'Does not contain sel0') 
    // "sel0" = test1Func1() = TestLib.setMyAddress(address(this));
    assert.isTrue(selectors.includes(sel1), 'Does not contain sel1')
    assert.isTrue(selectors.includes(sel2), 'Does not contain sel2')
    assert.isTrue(selectors.includes(sel3), 'Does not contain sel3')
    assert.isTrue(selectors.includes(sel4), 'Does not contain sel4')
    assert.isTrue(selectors.includes(sel6), 'Does not contain sel6')
    assert.isTrue(selectors.includes(sel7), 'Does not contain sel7')
    assert.isTrue(selectors.includes(sel8), 'Does not contain sel8')
    assert.isTrue(selectors.includes(sel9), 'Does not contain sel9')

    assert.isFalse(selectors.includes(ownerSel), 'Contains ownerSel')
    // ownerSel in slot 0
    assert.isFalse(selectors.includes(sel10), 'Contains sel10')
    assert.isFalse(selectors.includes(sel5), 'Contains sel5')
  })
})
