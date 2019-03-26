/*
 * Local helpers
 */

const path = require('path')  // Cross platform itemPath handling

const isFolder = function (itemPath, separator) {
  if (!separator) separator = path.sep
  return (itemPath.slice(-1) === separator)
}

const isNfsFolder = function (itemPath) {
  return itemPath.slice(-1) === '/'
}

// Strip fragment for URI (removes everything from first '#')
const docpart = function (uri) {
  var i
  i = uri.indexOf('#')
  if (i < 0) {
    return uri
  } else {
    return uri.slice(0, i)
  }
}

// Return full document itemPath from root (strips host and fragment)
const itemPathPart = function (uri) {
  let hostlen = hostpart(uri).length
  uri = uri.slice(protocol(uri).length)
  if (uri.indexOf('://') === 0) {
    uri = uri.slice(3)
  }
  return docpart(uri.slice(hostlen))
}

const hostpart = function (uri) {
  var m = /[^\/]*\/\/([^\/]*).*/.exec(uri)
  if (m) {
    return m[1]
  } else {
    return ''
  }
}

const protocol = function (uri) {
  var i
  i = uri.indexOf(':')
  if (i < 0) {
    return null
  } else {
    return uri.slice(0, i)
  }
}

const parentPath = function (itemPath) {
  return path.dirname(itemPath)
}

// Return '' rather than '.' for current directory
const parentPathNoDot = function (itemPath) {
  let parentPath = path.dirname(itemPath)
  if (parentPath === '.') parentPath = ''
  return parentPath
}

// Used to cache file info
const Cache = function (maxAge) {
  this.maxAge = maxAge
  this._items = {}
}

// Cache of file version info
Cache.prototype = {
  get: function (key) {
    var item = this._items[key]
    var now = new Date().getTime()
    // Google backend expires cached fileInfo, so we do too
    // but I'm not sure if this is helpful. No harm tho.
    return (item && item.t >= (now - this.maxAge)) ? item.v : undefined
  },

  set: function (key, value) {
    this._items[key] = {
      v: value,
      t: new Date().getTime()
    }
  },

  'delete': function (key) {
    if (this._items[key]) {
      delete this._items[key]
    }
  }
}

/*
 * Adapted from node-solid-server/lib/metadata.js
 */

class  LdpMetadata {
  constructor() {
    this.filename = ''
    this.isResource = false
    this.isSourceResource = false
    this.isContainer = false
    this.isBasicContainer = false
    this.isDirectContainer = false
  }
}


function ldpMetadata () {
  this.filename = ''
  this.isResource = false
  this.isSourceResource = false
  this.isContainer = false
  this.isBasicContainer = false
  this.isDirectContainer = false
}

/*
* Adapted from node-solid-server/lib/headers.js
*/

function addLink (headers, value, rel) {
  var oldLink = headers.get('Link')
  if (oldLink === undefined) {
    headers.set('Link', '<' + value + '>; rel="' + rel + '"')
  } else {
    headers.set('Link', oldLink + ', ' + '<' + value + '>; rel="' + rel + '"')
  }
}

function addLinks (headers, fileMetadata) {
  if (fileMetadata.isResource) {
    addLink(headers, 'http://www.w3.org/ns/ldp#Resource', 'type')
  }
  if (fileMetadata.isSourceResource) {
    addLink(headers, 'http://www.w3.org/ns/ldp#RDFSource', 'type')
  }
  if (fileMetadata.isContainer) {
    addLink(headers, 'http://www.w3.org/ns/ldp#Container', 'type')
  }
  if (fileMetadata.isBasicContainer) {
    addLink(headers, 'http://www.w3.org/ns/ldp#BasicContainer', 'type')
  }
  if (fileMetadata.isDirectContainer) {
    addLink(headers, 'http://www.w3.org/ns/ldp#DirectContainer', 'type')
  }
}

/*
 * Copied from node-solid-server/lib/utils.js
 */
 /**
  * Composes and returns the fully-qualified URI for the request, to be used
  * as a base URI for RDF parsing or serialization. For example, if a request
  * is to `Host: example.com`, `GET /files/` using the `https:` protocol,
  * then:
  *
  *   ```
  *   getFullUri(req)  // -> 'https://example.com/files/'
  *   ```
  *
  * @param req {IncomingMessage}
  *
  * @return {string}
  */
function getFullUri (req) {
  return getBaseUri(req) + url.resolve(req.baseUrl, req.itemPath)
}

function itemPathBasename (fullitemPath) {
  var basename = ''
  if (fullitemPath) {
    basename = (fullitemPath.lastIndexOf('/') === fullitemPath.length - 1)
     ? ''
     : fullitemPath.substring(fullitemPath.lastIndexOf('/') + 1)
  }
  return basename
}

function hasSuffix (itemPath, suffixes) {
  for (var i in suffixes) {
    if (itemPath.indexOf(suffixes[i], itemPath.length - suffixes[i].length) !== -1) {
      return true
    }
  }
  return false
}

function filenameToBaseUri (filename, uri, base) {
  var uriPath = S(filename).strip(base).toString()
  return uri + '/' + uriPath
}

function getBaseUri (req) {
  return req.protocol + '://' + req.get('host')
}

/*
 * npm modules
 */
const S = module.exports.string = require('string')
const url = module.exports.url = require('url')

module.exports.path = path
/*
 * Local helpers
 */
module.exports.isFolder = isFolder
module.exports.isNfsFolder = isNfsFolder
module.exports.docpart = docpart
module.exports.itemPathPart = itemPathPart
module.exports.hostpart = hostpart
module.exports.protocol = protocol
module.exports.parentPath = parentPath
module.exports.parentPathNoDot = parentPathNoDot
module.exports.Cache = Cache

// Adapted/copied from node-solid-server
module.exports.LdpMetadata = LdpMetadata
module.exports.addLink = addLink
module.exports.addLinks = addLinks

module.exports.getFullUri = getFullUri
module.exports.itemPathBasename = itemPathBasename
module.exports.hasSuffix = hasSuffix
module.exports.filenameToBaseUri = filenameToBaseUri
module.exports.getBaseUri = getBaseUri
