// Get SAFE API from Browser window
if (typeof window === 'undefined') {
  console.log('ERROR: Browser window is undefined')
  throw new Error('ERROR: Browser window is undefined')
}

// Core SAFE API functionality
const SafenetworkApi = require('./safenetwork-api')
SafenetworkApi.safeApi = this.safeApi

// SafenetworkApi plus filesystem support
// const SafenetworkFs = require('./safenetwork-fs')

let safeNetworkJsApi = new SafenetworkApi
safeNetworkJsApi.safeApi = this.safeApi

exports = module.exports = SafenetworkApi
module.exports.SafenetworkApi = new SafenetworkApi
// module.exports.SafenetworkFs = new SafenetworkFs
