// SAFE Client Libs API is attached to SAFE Browser window
if (typeof window === 'undefined') {
  let errMsg = 'ERROR: SAFE Browser window is undefined'
  console.log(errMsg)
  throw new Error(errMsg)
}

// SafenetworkJs library
const Safenetworkjs = require('./safenetwork-api')

// SafenetworkApi class
exports = module.exports = Safenetworkjs.SafenetworkApi
module.exports.SafenetworkApi = Safenetworkjs.SafenetworkApi

// SafenetworkApi instance with SAFE Client Libs API
const safeJs = new Safenetworkjs.SafenetworkApi
safeJs.safeApi = window.safe
module.exports.safeJs = safeJs

module.exports.protoFetch = Safenetworkjs.protoFetch
