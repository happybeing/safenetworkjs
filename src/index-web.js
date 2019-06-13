// SAFE Client Libs API is attached to SAFE Browser window
if (typeof window === 'undefined') {
  let errMsg = 'ERROR: window is not defined but are you are using the browser build of SafeentworkJS'
  console.log(errMsg)
  throw new Error(errMsg)
}

if (typeof window.safe === 'undefined') {
  let errMsg = 'WARNING: window.safe (SAFE Network API) is not defined, are you running in SAFE Browser?'
  console.log(errMsg)
  throw new Error(errMsg)
}

// SafenetworkJs library
const Safenetworkjs = require('./safenetwork-api')

// SafenetworkApi instance with SAFE Client Libs API
const safeJs = new Safenetworkjs.SafenetworkApi
window.safeJs = safeJs

safeJs.safeApi = require('./bootstrap-web')

/*
 *  Override window.fetch() in order to support safe:// URIs
 */

// Protocol handlers for fetch()
const httpFetch = require('isomorphic-fetch')
const protoFetch = require('proto-fetch')

// map protocols to fetch()
const fetch = protoFetch({
  http: httpFetch,
  https: httpFetch,
  safe: safeJs.fetch.bind(safeJs)
//  https: Safenetwork.fetch.bind(Safenetwork), // Debugging with SAFE mock browser
})

// SafenetworkApi class
exports = module.exports = Safenetworkjs.SafenetworkApi
module.exports.SafenetworkApi = Safenetworkjs.SafenetworkApi

module.exports.safeJs = safeJs
module.exports.protoFetch = protoFetch
