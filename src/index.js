// Check we're not running in a browser
if (typeof window !== 'undefined') {
  let errMsg = 'ERROR: Web apps must use Safenetworkjs browser build'
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
safeJs.safeApi = require('./bootstrap')
module.exports.safeJs = safeJs

module.exports.protoFetch = Safenetworkjs.protoFetch
