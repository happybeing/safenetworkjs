require('fast-text-encoding') // TextEncoder, TextDecoder (for desktop apps)
const { parse: parseUrl } = require('url');

const SUCCESS = null

// Local
const ServiceInterface = require('./service-interface').ServiceInterface
const containers = require('./safe-containers')
const NfsContainer = containers.NfsContainer
const isCacheableResult = containers.isCacheableResult
// Libs
const safeUtils = require('./safenetwork-utils')

// Decorated console output
const debug = console.log //require('debug')('safenetworkjs:api')
const error = console.log //require('debug')('safenetworkjs:error')

const logApi = console.log //require('debug')('safenetworkjs:web')  // Web API
logLdp = (msg) => {
  throw Error('TODO: migrate to Fleming APIs (log msg: ' + msg + ')')
}

const logLdp = console.log //require('debug')('safenetworkjs:ldp')  // LDP service
const todoLogLdp = logLdp

const logRest = console.log //require('debug')('safenetworkjs:rest')  // REST request/response
const logTest = console.log //require('debug')('safenetworkjs:test')  // Test output

let extraDebug = false

/**
 * SafenetworkJs constants, including ones not exposed by safeApi.CONSTANTS
 */
// TODO this is a mish mash because SAFE API exposes few constants & errors

const CONSTANTS = require('./constants')    // Augmented copy from Web Hosting Manager

const consts = require('./consts')          // Copy of safe_app_nodejs/src/consts.js
const errConst = require('./error_const')   // Copy of safe_app_nodejs/src/error_const.js

/**
 * SafenetworkJs error codes (assigned to Error.code)
 *
 * When all error conditions have been covered, some can be replaced
 * by the SAFE API error codes (see above).
 */
const SafenetworkJsErrors = []
SafenetworkJsErrors.NO_SUCH_ENTRY = CONSTANTS.ERROR_CODE.NO_SUCH_ENTRY // Symbol('Entry not found')

// TODO get these from the API safeApi.CONSTANTS (see web_hosting_manager/app/safenet_comm/api.js for examples)
// See https://github.com/maidsafe/safe_app_nodejs/blob/9b3a263cade8315370422400561088495d3ec5d9/src/consts.js#L85-L95
const SN_TAGTYPE_SERVICES = 15001
const SN_TAGTYPE_WWW = 15002  // Must be used for all MD referenced by _public, _documents etc (see https://forum.safedev.org/t/changes-to-tag-type-for-md-containers-referenced-in-public-documents-etc/1906?u=happybeing)
const SN_TAGTYPE_NFS = SN_TAGTYPE_WWW
const SN_SERVICEID_WWW = 'www'
const SN_SERVICEID_FLEMINGLDP = 'flem'  // TODO: dummy ID for early Fleming API

// TODO SN_TAGTYPE_LDP is set to SN_TAGTYPE_WWW so that browser fetch() works, and
// TODO apps using window.webFetch() will work as expected w/o this library,
// TODO unless or until Peruse can fetch() an LDP service tagtype (of 80655 = timbl's dob).
const SN_TAGTYPE_LDP = SN_TAGTYPE_WWW // Same tag type needed for all file containers (in _public etc), therefore best to make NFS rather than WWW?
const SN_SERVICEID_LDP = 'www'  // First try 'www' to test compat with other apps (eg Web Hosting Manager)
// TODO then try out 'ldp'

/* eslint-disable no-unused-vars */
const isFolder = safeUtils.isFolder
const isSafeFolder = safeUtils.isSafeFolder
const docpart = safeUtils.docpart
const itemPathPart = safeUtils.itemPathPart
const hostpart = safeUtils.hostpart
const protocol = safeUtils.protocol
const parentPathNoDot = safeUtils.parentPathNoDot
const addLink = safeUtils.addLink
const addLinks = safeUtils.addLinks
// TODO change my code and these utils to use these npm libs:
const S = safeUtils.string
const path = safeUtils.path
const url = safeUtils.url
const getFullUri = safeUtils.getFullUri
const itemPathBasename = safeUtils.itemPathBasename
const hasSuffix = safeUtils.hasSuffix
const filenameToBaseUri = safeUtils.filenameToBaseUri
const getBaseUri = safeUtils.getBaseUri
/* eslint-enable */

/*
* Linked Data Platform (LDP) SAFE Network Service
*
* TODO review the detail of the LPD spec against the implementation
* TODO review BasicContainer, DirectContainer, and IndirectContainer
* TODO implement PATCH, OPTIONS, SPARQL, anything else?
* TODO LDPC paging and ordering (see https://en.wikipedia.org/wiki/Linked_Data_Platform)
*
* References:
*  Linked Data Platform Primer (http://www.w3.org/TR/2015/NOTE-ldp-primer-20150423/)
*  HTTP/1.1 Status Code Definitions (https://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html)
*/

const mime = require('mime-types')
const $rdf = require('rdflib')
const ns = require('solid-namespace')($rdf)
const LdpMetadata = require('./safenetwork-utils').LdpMetadata
var { extensions } = require('mime-types')
var LinkHeader = require( 'http-link-header' )

// TODO move LDP stuff from here and safenetwork-utils.js to safenetwork-ldp.js
// TODO update to use SafeNfsContainer instead of calling SAFE NFS APIs
class SafeServiceLDPFleming extends ServiceInterface {
  constructor (safeJs) {
    super(safeJs)

    // TODO: info expires after 5 minutes (is this a good idea?)
    this._fileInfoCache = new safeUtils.Cache(60 * 5 * 1000)

    // Service configuration (maps to a SAFE API Service)
    this._serviceConfig = {

      // UI - to help identify the service in user interface
      //    - don't match with these in code (use the idString or tagType)
      friendlyName: 'LDP',
      description: 'LinkedData Platform (ref http://www.w3.org/TR/ldp/)',

      // Service Setup - configures behaviour of setupServiceForHost()
      // TODO: review for Fleming
      setupDefaults: {
        setupFilesContainer: false,
        defaultSafeContainer: '_public',  // ...in container (e.g. _public, _documents, _pictures etc.)
        defaultContainerName: 'root-' + SN_SERVICEID_FLEMINGLDP // ...container key: 'root-www' implies key of '_public/<public-name>/root-www'
      },

      // SAFE Network Service Identity
      // - only change this to implementing a new service
      idString: SN_SERVICEID_FLEMINGLDP, // Uses:
      // to direct URI to service (e.g. safe://ldp.somesite)
      // identify service in _publicNames (e.g. happybeing@ldp)

      tagType: SN_TAGTYPE_LDP  // Mutable data tag type (don't change!)

    }

    // LDP config from node-solid-server/lib/ldp.js

    // TODO not sure where to put this and if to export?
    const DEFAULT_CONTENT_TYPE = 'text/turtle'
    const RDF_MIME_TYPES = [
      'text/turtle',            // .ttl
      'text/n3',                // .n3
      'text/html',              // RDFa
      'application/xhtml+xml',  // RDFa
      'application/n3',
      'application/nquads',
      'application/n-quads',
      'application/rdf+xml',    // .rdf
      'application/ld+json',    // .jsonld
      'application/x-turtle'
    ]

    if (!this.suffixAcl) {
      this.suffixAcl = '.acl'
    }
    if (!this.suffixMeta) {
      this.suffixMeta = '.meta'
    }
    this.turtleExtensions = [ '.ttl', this.suffixAcl, this.suffixMeta ]

    // Provide a handler for each supported fetch() request method ('GET', 'PUT' etc)
    //
    // Each handler is a function with same parameters and return as window.fetch()
    this.setHandler('GET', this.get)
    this.setHandler('HEAD', this.get)
    this.setHandler('PUT', this.put)
    this.setHandler('POST', this.post)
    this.setHandler('DELETE', this.delete)
  }

  // TODO copy theses function header comments to ServiceInterface, (also example code)
  //
  // Your implementation should:
  //  - create any service specific objects on the network (e.g. a container to store files)
  //  - make a serviceValue to be stored in the services entry for this host
  //  - add the service to the given host (profile.public-name)
  //
  // @param host is host part of the URI (ie [profile.]public-name)
  // @param [-] optional service specific parameters, such as name for a new _public container
  //
  // @returns a promise which resolves to the services entry value for this service
  // TODO move this to the super class - many implementations will be able to just change setupConfig

  // TODO: review for Fleming (currently does nothing)
  async setupServiceForHost (host) {
    logLdp('%s.setupServiceForHost(%s)', this.constructor.name, host)
    let uriProfile = host.split('.')[0]
    let publicName = host.split('.')[1]
    if (publicName === undefined) {
      publicName = host
      uriProfile = ''
    }

    let setup = this.getServiceConfig().setupDefaults
    if (setup.setupFilesContainer) {
      throw Error('SafeServiceLDPFleming::setupServiceForHost() - FilesContainer setup not implemented')
    }
    return undefined
  }

  // TODO copy theses function header comments to ServiceInterface, (also example code)
  // Create an instance of a service inistalised for a given host
  //  - create and intitialise a new instance of this service implementation
  //
  // @param serviceValue  from the services MD for this host
  //
  // @returns a promise which resolves to a new instance of this service for the given host
  async makeServiceInstance (host, serviceValue) {
    logLdp('%s.makeServiceInstance(%s,%s)', this.constructor.name, host, serviceValue)
    let hostService = await new this.constructor(this.safeJs)
    hostService._host = host
    hostService._serviceConfig = this.getServiceConfig()
    hostService._serviceValue = serviceValue
    return hostService
  }

  /*
  * Service handlers
  *
  * These must be assigned to service methods (e.g. GET, PUT etc) in the
  * constructor of this service implementation. These will then be called
  * by the fetch() when this service has been set up for the host in
  * a safe: URI
  */

  // Handle both GET and HEAD (which is like GET but does not return a body)
  async get (docUri, options) {
    options.includeBody = (options.method === 'GET')

    logLdp('%s.get(%s,%O)', this.constructor.name, docUri, options)

    /* TODO if get() returns 404 (not found) return empty listing to fake existence of empty container
    if (response.status === 404)
    todoLogLdp('WARNING: SafenetworkLDP::_fetch() may need to return empty listing for non-existant containers')
    return response;
    */
    if (isSafeFolder(docUri)) {
      return this._getFolder(docUri, options)
    } else {
      return this._getFile(docUri, options)
    }
  }

  // Add Solid response header links
  //
  // See node-solid-server/lib/header.js linksHandler()
  async addHeaderLinks (docUri, options, headers) {
    let fileMetadata = new LdpMetadata()
    if (S(docUri).endsWith('/')) {
      fileMetadata.isContainer = true
      fileMetadata.isBasicContainer = true
    } else {
      fileMetadata.isResource = true
    }

    if (fileMetadata.isContainer && options.method === 'OPTIONS') {
      headers.header('Accept-Post', '*/*')
    }
    // Add ACL and Meta Link in header
    safeUtils.addLink(headers, safeUtils.itemPathBasename(docUri) + this.suffixAcl, 'acl')
    safeUtils.addLink(headers, safeUtils.itemPathBasename(docUri) + this.suffixMeta, 'describedBy')
    // Add other Link headers
    safeUtils.addLinks(headers, fileMetadata)
  }

  async put (docUri, options) {
    todoLogLdp('%s.put(%s,%O)', this.constructor.name, docUri, options)
    let body = options.body
    let contentType = options.contentType

    // TODO Refactor to get rid of putDone...
    const putDone = async (docUri, options, response) => {
      try {
        // mrhTODO response.status checks for versions are untested
        todoLogLdp('%s.put putDone(status: ' + response.status + ') for path: %s', this.constructor.name, docUri)
        if (response.status >= 200 && response.status < 300) {
          let fileInfo = await this._getFileInfo(itemPathPart(docUri))
          var etagWithoutQuotes = (typeof (fileInfo.ETag) === 'string' ? fileInfo.ETag : undefined)
          let res = new Response(null, {
            status: 200, headers: new Headers({
              Location: docUri,
              'contentType': contentType,
              revision: etagWithoutQuotes,
              'MS-Author-Via': 'SPARQL'
            })
          })
          this.addHeaderLinks(docUri, options, res.headers)
          return res
        } else if (response.status === 412) {   // Precondition failed
          todoLogLdp('putDone(...) conflict - resolving with status 412')
          return new Response(null, {status: 412, revision: 'conflict'})
        } else {
          throw new Error('PUT failed with status ' + response.status + ' (' + response.statusText + ')')
        }
      } catch (err) {
        todoLogLdp('putDone() failed: ' + err)
        throw err
      }
    }

    try {
      let fileInfo = await this._getFileInfo(itemPathPart(docUri))
      if (fileInfo) {
        if (options && (options.ifNoneMatch === '*')) { // Entity exists, version irrelevant)
          return putDone(docUri, options, { status: 412, statusText: 'Precondition failed' })
        }
        return putDone(docUri, options, await this._updateFile(docUri, body, contentType, options))
      } else {
        return putDone(docUri, options, await this._createFile(docUri, body, contentType, options))
      }
    } catch (err) {
      todoLogLdp('put failed: %s', err)
      throw err
    }
  }

  parseMetadataFromHeader (options) {
    let headers = options.headers
    var fileMetadata = new LdpMetadata()
    if (!headers || !headers.link) {
      options.metadata = { 'fileMetadata': fileMetadata }
    } else {
      // See also node-solid-server/src/handlers/post.js one() etc
      fileMetadata.mimeType = headers.contentType ? headers.contentType.replace(/\s*;.*/, '') : ''
      fileMetadata.extension = fileMetadata.mimeType in extensions ? `.${extensions[mimeType][0]}` : ''
      let links = LinkHeader.parse(headers.link)
      todoLogLdp('links: %O', links)
      let rels = links.rel('type')

      for (var rel in rels) {
        switch (rels[rel].uri) {
          case 'http://www.w3.org/ns/ldp#Resource':
          fileMetadata.isResource = true
          break
          case 'http://www.w3.org/ns/ldp#RDFSource':
            fileMetadata.isSourceResource = true
          break
          case 'http://www.w3.org/ns/ldp#Container':
            fileMetadata.isContainer = true
          break
          case 'http://www.w3.org/ns/ldp#BasicContainer':
            fileMetadata.isBasicContainer = true
          break
          case 'http://www.w3.org/ns/ldp#DirectContainer':
            fileMetadata.isDirectContainer = true
          default:
        }
      }
      options.metadata = { 'links': links, 'fileMetadata': fileMetadata }
    }

    return options
  }

  // TODO specialise put/post (RemoteStorage service just has put - so leave til imp RS service)
  async post (docUri, options) {
    todoLogLdp('%s.post(%s, %O)', this.constructor.name, docUri, options)

    options = this.parseMetadataFromHeader(options)
    const fileMetadata = options.metadata.fileMetadata
    if (fileMetadata.isContainer && docUri.slice(-1) !== '/') {
      docUri += '/'
    } else if (options.headers.slug){
      let slug = decodeURIComponent(options.headers.slug)
      if (slug.match(/\/|\||:/)) {
        return new Response(null, {ok: false, status: 400, statusText: 'The name of new file POSTed may not contain : | or /'})
      }
      docUri = docUri + (docUri.slice(-1) === '/' ? '' : '/') + slug
    }

    if (fileMetadata.isContainer) {
      return this._fakeCreateContainer(docUri, options)
    }

    return this.put(docUri, options)
  }

  async delete (docUri, options) {
    todoLogLdp('%s.delete(%s,%O)', this.constructor.name, docUri, options)
    let docPath = this.safeJs.nfsPathPart(docUri)

    try {
      let fileInfo = await this._getFileInfo(docPath)
      if (!fileInfo) {
        return new Response(null, {status: 404, statusText: 'Not Found'})
      }

      var etagWithoutQuotes = (typeof (fileInfo.ETag) === 'string' ? fileInfo.ETag : undefined)
      if (options && options.ifMatch && (options.ifMatch !== etagWithoutQuotes)) {
        return new Response(null, {status: 412, revision: etagWithoutQuotes})
      }

      if (isSafeFolder(docUri)) {
        return this._fakeDeleteContainer(docUri, options)
      }

      if (!isSafeFolder(docPath)) {
        todoLogLdp('safeNfs.delete() param this.storageNfs(): ' + await this.storageNfs())
        todoLogLdp('                 param path: ' + docPath)
        todoLogLdp('                 param version: ' + fileInfo.version)
        todoLogLdp('                 param containerVersion: ' + fileInfo.containerVersion)
        let perms // if auth is needed, request default permissions
        await safeJs.nfsMutate(await this.storageNfs(), perms, 'delete', docPath, undefined, fileInfo.version + 1)
        this._deleteFileInfo(docPath)
        return new Response(null, {status: 204, statusText: 'No Content'})
      }
    } catch (err) {
      todoLogLdp('%s.delete() failed: %s', this.constructor.name, err)
      this._deleteFileInfo(docPath)
      return this.safeJs._httpResponseError('DELETE', err)
    }
  }

  /*
  * Helpers for service handlers
  */

  // TODO review container emulation (create,delete,get)
  async _fakeCreateContainer (path, options) {
    todoLogLdp('fakeCreateContainer(%s,{%o})...')
    return new Response(null, {ok: true, status: 201, statusText: 'Created'})
  }

  // TODO this should error if the container is not empty, so check this
  // TODO (check Solid and/or LDP spec)
  async _fakeDeleteContainer (path, options) {
    todoLogLdp('fakeDeleteContainer(%s,{%o})...')
    return new Response(null, {status: 204, statusText: 'No Content'})
  }

  // TODO the remaining helpers should probably be re-written just for LDP because
  // TODO it was only moderately refactored from poor quality RS.js imp

  // Update file
  //
  // @returns promise which resolves to a Resonse object
  async _updateFile (docUri, body, contentType, options) {
    todoLogLdp('%s._updateFile(\'%s\',%O,%o,%O)', this.constructor.name, docUri, body, contentType, options)
    let docPath = this.safeJs.nfsPathPart(docUri)

    try {
      // mrhTODO GoogleDrive only I think:
      // if ((!contentType.match(/charset=/)) &&
      //     (encryptedData instanceof ArrayBuffer || WireClient.isArrayBufferView(encryptedData))) {
      //       contentType += '; charset=binary';
      // }

      let fileInfo = await this._getFileInfo(docPath)
      if (!fileInfo) {
        // File doesn't exist so create (ref: https://stackoverflow.com/questions/630453
        return this._createFile(docUri, body, contentType, options)
      }

      var etagWithoutQuotes = (typeof (fileInfo.ETag) === 'string' ? fileInfo.ETag : undefined)
      if (options && options.ifMatch && (options.ifMatch !== etagWithoutQuotes)) {
        return new Response(null, {status: 412, statusText: 'Precondition Failed', revision: etagWithoutQuotes})
      }

      // Only act on files (directories are inferred so no need to create)
      if (isSafeFolder(docUri)) {
        // Strictly we shouldn't get here as the caller should test, but in case we do
        todoLogLdp('WARNING: attempt to update a folder')
      } else {
        // Store content as new immutable data (pointed to by nfsFile)
        todoLogLdp('Storing immutable content on SAFE...')
        let nfsFile = await (await this.storageNfs()).create(body)
        todoLogLdp('Content stored (create() successful), now to update.')

        // Add file to directory (by inserting nfsFile into container)
        // nfsFile = await (await this.storageNfs()).update(docPath, nfsFile, fileInfo.containerVersion + 1)
        let perms // if auth is needed, request default permissions
        todoLogLdp('Updating SAFE container...')
        await safeJs.nfsMutate(await this.storageNfs(), perms, 'update', docPath, nfsFile, fileInfo.version + 1)
        await this._updateFileInfo(nfsFile, docPath)

        // TODO implement LDP PUT response https://www.w3.org/TR/ldp-primer/
        return new Response(null, {status: (nfsFile ? 200 : 400)})
      }
    } catch (err) {
      todoLogLdp('Unable to update file \'%s\' : %s', docUri, err.message)
      todoLogLdp('err: %o', err)
      // TODO can we decode the SAFE API errors to provide better error responses
      return new Response(null, {status: 500, statusText: '500 Internal Server Error (' + err + ')'})
    }
  }

  // Create file
  //
  // @returns promise which resolves to a Resonse object
  // TODO add header links addLinks() - see node-solid-server/lib/handlers/post.js function one ()
  async _createFile (docUri, body, contentType, options) {
    todoLogLdp('%s._createFile(\'%s\',%O,%o,%O)', this.constructor.name, docUri, body, contentType, options)
    let docPath = this.safeJs.nfsPathPart(docUri)

    try {
      // this.safeJs.listContainer('_publicNames') // TODO remove this debug

      todoLogLdp('DEBUG:  this.storageNfs().create()...')
      let nfsFile = await (await this.storageNfs()).create(body)
      // mrhTODOx set file metadata (contentType) - how?

      // Add file to directory (by inserting nfsFile into container)

      // TODO delete comments
      todoLogLdp('DEBUG:  this.storageNfs().insert(nfsFile,%s)...',docPath)
      // nfsFile = await (await this.storageNfs()).insert(docPath, nfsFile)
      const valueVersion = await safeJs.getMutableDataValueVersion(await this.storageMd(), docPath)
      const version = valueVersion ? valueVersion.version : 0
      const operation = valueVersion ? 'update' : 'insert'

      let perms // if auth is needed, request default permissions
      await safeJs.nfsMutate(await this.storageNfs(), perms, operation, docPath, nfsFile, version + 1)

      todoLogLdp('DEBUG:  this._updateFileInfo(...)...')
      this._updateFileInfo(nfsFile, docPath)

      // TODO implement LDP POST response https://www.w3.org/TR/ldp-primer/
      return new Response(null, {status: 200, statusText: 'OK'})
    } catch (err) {
      todoLogLdp('Unable to create file \'%s\' : %s', docUri, err)
      // TODO can we decode the SAFE API errors to provide better error responses
      return new Response(null, {status: 500, statusText: '500 Internal Server Error (' + err + ')'})
    }
  }

  // get the full content of file stored using safeNfs
  //
  // @param fullPath is the path of the file (according to its safeNfs entry key)
  // @param if options.includeBody is true, the response includes content (data)
  //
  // @returns a Promise which resolves to a Response object. On success, the response
  // will contain file metadata available from the NFS emulation nfsFile and a
  // contentType based on the file extension
  //
  // TODO add support for content negotiation see node-solid-server/lib/handlers/get.js
  // TODO add support for data browser node-solid-server/lib/handlers/get.js
  async _getFile (docUri, options) {
    logLdp('%s._getFile(%s,%O)', this.constructor.name, docUri, options)
    let fileInfo = {}
    let retResponse

// ******** NEXT ********
// TODO: _getFolder() add mime type based on FilesContainer file metadata?
// BUG: folders end up with multiple size values (multiple tripes?) - one per subfile entry

    try {
      if (!this.safeJs.isConnected()) {
        return new Response(null, {status: 503, statusText: 'not connected to SAFE network'})
      }
      // Let's parse a URL
      console.log("Let's parse ", `${docUri}`);
      let parsed_url = this.safeJs.safeApi.parse_url(`${docUri}`);
      console.log("Parsed URL: ", parsed_url);

      // Let's parse ann resolve a URL
      console.log("Let's parse and resolve ", `${docUri}`);
      parsed_url = this.safeJs.safeApi.parse_and_resolve_url(`${docUri}`);
      console.log("Parsed and resolved URL: ", parsed_url);

      // TODO If the options are being used to retrieve specific version
      // should we get the latest version from the API first?
      let safe_data
      let content
      try {
        safe_data = this.safeJs.safeApi.fetch(docUri)
        logLdp("Result of fetch() URL: %o", safe_data);

        if (safe_data.PublishedImmutableData) {
          content = String.fromCharCode.apply(null, safe_data.PublishedImmutableData.data);
          logLdp("Fetched content: ", content);
        }

      } catch (err) {
        logLdp(err)
        return new Response(null, {status: 404, statusText: 'File not found'})
      }

      //??? fileInfo = await this._makeFileInfo(nfsFile, fileInfo, docPath)

      var etagWithoutQuotes = 'safe://' + safe_data.PublishedImmutableData.xorname // ???was fileInfo.ETag
      // Request is for changed file, so if eTag matches return "304 Not Modified"
      if (options && options.ifNoneMatch && etagWithoutQuotes && (etagWithoutQuotes === options.ifNoneMatch)) {
        return new Response(null, {status: 304, statusText: 'Not Modified'})
      }

      var contentType = mime.lookup(docPath) || this.DEFAULT_CONTENT_TYPE
      if (safeUtils.hasSuffix(docPath, this.turtleExtensions)) {
        contentType = 'text/turtle'
      }

      let body = options.includeBody ? content : null

      retResponse = new Response(body, {
        status: 200,
        statusText: 'OK',
        revision: etagWithoutQuotes,
        // TODO how to get contentType from from metadata?
        headers: new Headers({
          'Content-Type': contentType,
          container: false,
          'MS-Author-Via': 'SPARQL'
        })
      })
      this.addHeaderLinks(docUri, options, retResponse.headers) // TODO is docUri correct
      return retResponse
    } catch (err) {
      logLdp('Unable to get file: %s', err)
      // TODO can we decode the SAFE API errors to provide better error responses
      return new Response(null, {status: 500, statusText: '500 Internal Server Error (' + err + ')'})
    }
  }

  // Obtain folder listing
  //

  async _getFolder (docUri, options) {
    logLdp('%s._getFolder(%s,%O)', this.constructor.name, docUri, options)

    // Let's parse a URL
    console.log("Let's parse ", `${docUri}`);
    let parsed_url = this.safeJs.safeApi.parse_url(`${docUri}`);
    console.log("Parsed URL: ", parsed_url);

    // Let's parse ann resolve a URL
    console.log("Let's parse and resolve ", `${docUri}`);
    parsed_url = this.safeJs.safeApi.parse_and_resolve_url(`${docUri}`);
    console.log("Parsed and resolved URL: ", parsed_url);

    let docPath = this.safeJs.nfsPathPart(docUri)
    let response
    let listing = []  // Build listing first so can accumulate folder size from subfiles
    try {
      debug('safe:TMP 1')
      let filesContainer = this.safeJs.safeApi.fetch(docUri).FilesContainer
      logLdp("Result of fetch() URL: %o", filesContainer);

      debug('safe:TMP 2')
      // Enumerate file keys beginning with docPath
      Object.keys(filesContainer.files_map).forEach((k) => {
        let key = k.toString()
        let value = filesContainer.files_map[key]
        if (key[0] === '/') key = key.slice(1)

        logLdp('Key: ', key)
        logLdp('Value: ', JSON.stringify(value))

        var dirPath = docPath
        if (dirPath.length && dirPath.slice(-1) !== '/') { dirPath += '/' } // Ensure a trailing slash

        // If the folder matches the start of the key, the key is within the folder
        debug('safe:TMP 5')
        var itemName = key
        var firstSlash = key.indexOf('/') // Folder name will be up to but excluding first '/'
        if (firstSlash !== -1) {
          itemName = key.slice(0, firstSlash + 1) // Folder, so include trailing '/'
        }

        // That's it for HEAD, for GET add entries to listing
        if (options.includeBody) {
          debug('safe:TMP 6')
          let testPath = docPath + this.suffixMeta
          let fullItemUri = docUri + itemName

          try {
            debug('safe:TMP 7')
            /*              if (await this.appHandle().mutableDataEntries.get(entriesHandle, testPath)) {
            metaFilePath = testPath
          }
          */            } catch (err) {
          debug('safe:TMP 8')
        } // metaFilePath - file not found

        if (listing[itemName] === undefined) {
          // Note: if itemName is a folder, the value will be from first subfile
          value.fullItemUri = fullItemUri
          listing[itemName] = value
        } else {
          // Must be file in folder (itemName) so accumulate subfile size into folder size
          listing[itemName].size = Number(listing[itemName].size) + Number(value.size)
          // TODO set listing[].modified to value.modified (if later). Currently it is the modification date of the first file in the folder. Wants to be the latest.
        }
      }
    })

    var rdfGraph = $rdf.graph()

    // TODO Can we improve 'stat()' for container. See node-solid-server/lib/ldp-container.js addContainerStats()
    let resourceGraph
     = rdfGraph
    rdfGraph.add(resourceGraph.sym(docUri), ns.rdf('type'), ns.ldp('BasicContainer'))
    rdfGraph.add(resourceGraph.sym(docUri), ns.rdf('type'), ns.ldp('Container'))

    Object.keys(listing).forEach((k) => {
      logLdp('calling _addListingEntry for %s', k)
      logLdp('listing[%s].value: %o', k, listing[k].value)
      let metaFilePath
      let fileInfo = this._makeFileInfo(filesContainer, k, listing[k])
      this._addListingEntry(rdfGraph, listing[k].fullItemUri, docUri, k, fileInfo, metaFilePath)
      debug('safe:TMP 9')
    })

    let triples
    let body = null
    if (options.includeBody) {
      $rdf.serialize(null, rdfGraph, docUri, 'text/turtle',
      function (err, result) {
        if (!err) {
          triples = result
        } else {
          logLdp('RDF serialisation failed: ' + err)
          throw err
        }
      })

      body = triples
    }

    response = new Response(body,{ status: 200,
      statusText: 'OK',
      headers: new Headers({ 'Content-Type': 'text/turtle',
      'MS-Author-Via': 'SPARQL' }) })
      logLdp('%s._getFolder(\'%s\', ...) response %s body:\n %s', this.constructor.name, docUri, response.status, triples)

    } catch(err) {
      // TODO review error handling and responses
      logLdp('_getFolder(\'%s\') failed: %s', docUri, err)
      // TODO are their any SAFE API codes we need to detect?
      return new Response(null, {status: 404, statusText: 'Resource Not Found'})
    }

    return response
  }

  // Adds a entry to directory listing (file or folder to the RDF graph)
  _addListingEntry (resourceGraph, fullItemUri, containerUri, itemName, fileInfo, metaFilePath) {
    logLdp('%s._addListingEntry(g,%s,%s,%s,%o,%s)', this.constructor.name, fullItemUri, containerUri, itemName, fileInfo, metaFilePath)
    resourceGraph = this._addFileInfo(resourceGraph, fullItemUri, fileInfo)

    // Add to `contains` list
    resourceGraph.add(resourceGraph.sym(containerUri), ns.ldp('contains'),
      resourceGraph.sym(fullItemUri))

    // Set up a metaFile path
    // Earlier code used a .ttl file as its own meta file, which
    // caused massive data files to parsed as part of directory listings just looking for type triples
    if (metaFilePath) resourceGraph = this._addFileMetadata(resourcesGraph, metaFilePath, fullItemUri)

    return resourceGraph
  }

  // get LDP metadata for an LDPC container or LDPR/LDP-NR file
  //
  // @returns a Promise which resolves to an LdpMetadata
  //
  //  Note: to avoid having to parse large files, node-solid-server
  //  stores file metadata in a .meta file.
  //
  //  CONTAINERS
  //  LDP PATCH or PUT to create a container
  //  places the body of the request in a .meta file within
  //  the container, but that behaviour is due to be
  //  removed, see https://github.com/solid/node-solid-server/issues/547
  //
  //  FILES
  //  I can't find how the .meta is created, but they
  //  are read. See node-solid-server/lib/ldp-container.js addFile().
  //  @timbl (Solid gitter 26-feb-18) mentions that they are intended to
  //  allow information about a resource to be stored, and gives this
  //  example: https://www.w3.org/2012/ldp/hg/ldp-primer/ldp-primer.html#creating-a-non-rdf-binary-resource-post-an-image-to-an-ldp-bc
  //
  //  For now we could take the hit reading the whole file, but obvs
  //  for large files this becomes unacceptably onerous.
  //
  // TODO not implemented!
  //   - as file .meta seems to be little used for now
  //   - and container .meta has been dropped from the Solid spec
  //
  // Ref: node-solid-serveetr/lib/ldp-container.js addFile()
  // TODO _getMetadataGraph() returns an $rdf.graph() which may not be compat with N3
  async _addFileMetadata (resourceGraph, metaFilePath, docUri) {
    todoLogLdp('%s._addFileMetadata(%O,%s,%s)...', this.constructor.name, resourceGraph, metaFilePath, docUri)

    let metadataGraph = await this._getMetadataGraph(metaFilePath, docUri)

    if (metadataGraph) {
      // Add Container or BasicContainer types
      if (safeUtils.isDirectory(docUri)) {
        resourceGraph.add(metadataGraph.sym(docUri), ns.rdf('type'), ns.ldp('BasicContainer'))
        resourceGraph.add(metadataGraph.sym(docUri), ns.rdf('type'), ns.ldp('Container'))
      }
      // Add generic LDP type
      resourceGraph.add(metadataGraph.sym(docUri), ns.rdf('type'), ns.ldp('Resource'))

      // Add type from metadataGraph
      metadataGraph
      .statementsMatching(metadataGraph.sym(docUri),
      ns.rdf('type'),
      undefined)
      .forEach(function (typeStatement) {
        // If the current is a file and its type is BasicContainer,
        // This is not possible, so do not infer its type!
        if (
          (
            typeStatement.object.uri !== ns.ldp('BasicContainer').uri &&
            typeStatement.object.uri !== ns.ldp('Container').uri
          ) ||
          isSafeFolder(docUri)
        ) {
          resourceGraph.add(resourceGraph.sym(docUri),
          typeStatement.predicate,
          typeStatement.object)
        }
      })
    }
  }

  async _getMetadataGraph (metaFilePath, docUri) {
    todoLogLdp('%s._getMetadataGraph(%s,%s)...', this.constructor.name, metaFilePath, docUri)

    let nfsFile
    let fileInfo = {}
    let metadataGraph
    try {
      nfsFile = await (await this.storageNfs()).fetch(metaFilePath)
    } catch (err) {}

    try {
      // Metadata file exists
      if (nfsFile) {
        fileInfo.openHandle = await (await this.storageNfs()).open(nfsFile, this.safeJs.safeApi.CONSTANTS.NFS_FILE_MODE_READ)
        let content = await fileInfo.openHandle.read(0, fileInfo.size)

        if (content) {
          todoLogLdp('%s bytes read from file.', content.byteLength)

          // TODO review: to keep lib small, we avoid require('rdflib) and leave
          // TODO for the application to assign one to $rdf member of the service interface (this)
          if (!this.$rdf) {
            throw new Error('%s has no $rdf (rdflib) object - must be set by application to support meta files')
          }

          // let decoder = new TextDecoder()
          try {
            metadataGraph = this.$rdf.graph()
            $rdf.parse(content,//???decoder.decode(content),
            metadataGraph,
            docUri,
            'text/turtle')
          } catch (err) {
            todoLogLdp('_getMetadataGraph(): ', err)
            todoLogLdp('ERROR - can\'t parse metadata file: %s', metaFilePath)
          }
        }
      }
    } catch (err) {
      todoLogLdp(err)
    } finally {
      if (fileInfo.openHandle) {
        await fileInfo.openHandle.close()
      }
    }

    return metadataGraph
  }

  // SAFE NFS API file metadata comprises created, modified, version & dataMapName
  //
  // For an Solid we also need resource metadata from an optional separate meta
  // file (eg resource-filename.meta)
  //
  // See node-solid-server/lib/ldp-container.js addStats()
  _addFileInfo (resourceGraph, reqUri, fileInfo) {
    logLdp('%s._addFileInfo(g,%s,%o)', this.constructor.name, reqUri, fileInfo)

    resourceGraph.add(resourceGraph.sym(reqUri),
    ns.dct('modified'),
    fileInfo.modified) // An actual datetime value from a Date object

    // Include mtime to satisfy apps which expect this (e.g. users of solid-file-client/src/folderUtils.js/getStats())
    resourceGraph.add(resourceGraph.sym(reqUri),
    ns.stat('mtime'),
    fileInfo.modified)

    resourceGraph.add(resourceGraph.sym(reqUri),
    ns.stat('size'),
    fileInfo.size)

    if (fileInfo.isFolder) {
      resourceGraph.add(
        resourceGraph.sym(reqUri),
        ns.rdf('type'),
        ns.ldp('BasicContainer'))
      resourceGraph.add(
        resourceGraph.sym(reqUri),
        ns.rdf('type'),
        ns.ldp('Container'))
    }

    if (mime.lookup(reqUri)) { // Is the file has a well-known type,
      let type = 'http://www.w3.org/ns/iana/media-types/' + mime.lookup(reqUri) + '#Resource'
      resourceGraph.add(resourceGraph.sym(reqUri),
      ns.rdf('type'), // convert MIME type to RDF
      resourceGraph.sym(type))
    }

    return resourceGraph
  }

  // Test path is file or folder, returns file infor object (dummy for a folder)
  //
  // Folders - a folder is inferred, so:
  // - a folder is deemed valid if any *file* path contains it
  // - fileInfo for a folder lacks a version or eTag
  //
  // @param filesContainer the SAFE FilesContainer which holds the file/folder
  // @param docPath  the path of a file/folder in the container
  // @param fileMapEntry FilesContainer.files_map value for the file/folder
  //
  // @returns a promise resolving to object with properties:
  //   FileInfo { isFolder: boolean, path: string, ETag: string, size: number, created: date, modified: date, containerVersion: number, version: number }
  //
  //  Note: the following properties are only present for files: created, version
  //
  // TODO ??? implement Solid metadata for folders (Solid uses stat()) (note nfs MDs have metadata in the _metadata key)
  _makeFileInfo (filesContainer, docPath, fileMapEntry) {
    if (docPath[0] !== '/') {
      docPath = '/' + docPath
    }

    logLdp('%s._makeFileInfo(fc, %s, %o)', this.constructor.name, docPath, fileMapEntry)
    try {

      // Folders //
      var folderInfo = {
        isFolder: true,
        path:  docPath,

        // Caller accumulates these values from contained files
        modified: fileMapEntry.modified,
        size: fileMapEntry.size
      }
      if (docPath === '/') {
        let decoder = new TextDecoder()
        // folderInfo.ETag = decoder.decode(Uint8Array.from(filesContainer.xorname)) //TODO: decode properly to xor address
        folderInfo.ETag = 'safe://' + String.fromCharCode.apply(null, filesContainer.xorname)
        folderInfo.containerVersion = filesContainer.version.toString()
        logLdp('returning folderInfo: %O', folderInfo)
        return folderInfo
      } // Dummy fileInfo to stop at "root"

      if (isSafeFolder(docPath)) {
        // TODO Could use _getFolder() in order to generate Solid metadata
        folderInfo.ETag = fileMapEntry.link
        folderInfo.containerVersion = filesContainer.version.toString()
        logLdp('returning folderInfo: %O', folderInfo)
        return folderInfo
      }

      // Files //
      let fileInfo = {
        isFolder: false,
        containerVersion: filesContainer.version,
        created:  fileMapEntry.created,
        modified: fileMapEntry.modified,
        size:     fileMapEntry.size,
        version:  fileMapEntry.version,
        ETag:     fileMapEntry.link
      }

      logLdp('returning fileInfo: %O', fileInfo)
      return fileInfo
    } catch (err) {
      logApi('_makeFileInfo(%s) FAILED: %s', docPath, err)
      throw err
    }
  }

  async _deleteFileInfo (docPath) {
    if (docPath[0] !== '/') {
      docPath = '/' + docPath
    }
    this._fileInfoCache.delete(docPath)
  }
}

module.exports.SafeServiceLDPFleming = SafeServiceLDPFleming
