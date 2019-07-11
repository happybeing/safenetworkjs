// Check we're not running in a browser
if (typeof window !== 'undefined') {
  let errMsg = 'ERROR: Web apps must use Safenetworkjs browser build'
  console.log(errMsg)
  throw new Error(errMsg)
}

// SafenetworkJs libraries
const Safenetworkjs = require('./safenetwork-api')

// SafenetworkApi instance with SAFE Client Libs API
const safeApi = require('./bootstrap')
const safeJs = new Safenetworkjs.SafenetworkApi(safeApi)

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
module.exports.WebIdProfile = require('./webid_profile')
