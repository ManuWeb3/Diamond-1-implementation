const {run} = require("hardhat")

const verify = async (contractAddress, args) => {               
    console.log("Verifying the contract, please wait...")
    try {
    await run("verify:verify", {    
      address: contractAddress,
      constructorArguments: args,   
  })}
  
  catch (e) {

    if(e.message.toLowerCase().includes("already verified")) {
        console.log("Already Verified")
      }
      else {
        console.log(e)
      }
    }
} // body of verify
      
module.exports = {verify}