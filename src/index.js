// Core SAFE API functionality
const SafenetworkApi = require('./safenetwork-api')

// SafenetworkApi plus filesystem support
const SafenetworkFs = require('./safenetwork-fs')

exports = module.exports = SafenetworkApi
module.exports.SafenetworkApi = SafenetworkApi
module.exports.SafenetworkFs = SafenetworkFs
