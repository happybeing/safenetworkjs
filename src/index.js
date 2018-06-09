// Core SAFE API functionality
const SafenetworkApi = require('./safenetwork-api')

// SafenetworkApi plus filesystem support
const SafenetworkFs = require('./safenetwork-fs')

exports = module.exports = SafenetworkApi
module.exports.SafenetworkApi = new SafenetworkApi
//module.exports.SafenetworkFs = new SafenetworkFs
