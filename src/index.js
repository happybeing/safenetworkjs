// Core SAFE API functionality
const SafenetworkApi = require('./safenetwork-api')

// SafenetworkApi plus filesystem support
const SafenetworkFs = require('./safenetwork-fs')

let safeNetworkJsApi = new SafenetworkApi
safeNetworkJsApi.safeApi = require('./bootstrap')

exports = module.exports = SafenetworkApi

module.exports.SafenetworkApi = safeNetworkJsApi
//module.exports.SafenetworkFs = new SafenetworkFs
