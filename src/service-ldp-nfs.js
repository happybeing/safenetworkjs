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
todoLogApi = (msg) => {
  throw Error('TODO: migrate to Fleming APIs (log msg: ' + msg + ')')
}

const logLdp = console.log //require('debug')('safenetworkjs:ldp')  // LDP service
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
class SafeServiceLDPNFS extends ServiceInterface {
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
      setupDefaults: {
        setupNfsContainer: true,        // Automatically create a file store for this host
        defaultSafeContainer: '_public',  // ...in container (e.g. _public, _documents, _pictures etc.)
        defaultContainerName: 'root-' + SN_SERVICEID_LDP // ...container key: 'root-www' implies key of '_public/<public-name>/root-www'
      },

      // SAFE Network Service Identity
      // - only change this to implementing a new service
      idString: SN_SERVICEID_LDP, // Uses:
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
  // Initialise a services MD with an entry for this host
  //
  // User must grant permission on a services MD, and probably also the
  // _public container, if the service creates file storage for example
  //
  // NOTE: the SAFE _public container has entries for each MD being used
  // as a file store, and by convention the name reflects both the
  // public name and the service which created the container. So for
  // a www service on host 'blog.happybeing' you would expect
  // an entry in _public with key '_public/qw2/root-www' and a
  // value which is a hash of the MD used to store files (see SAFE NFS).
  //
  // Your implementation should:
  //  - create any service specific objects on the network (e.g. a container MD to store files)
  //  - make a serviceValue to be stored in the services MD entry for this host
  //  - mutate the service MD to add the service on the MD for the given host (profile.public-name)
  //
  // @param host is host part of the URI (ie [profile.]public-name)
  // @param servicesMd
  // @param [-] optional service specific parameters, such as name for a new _public container
  //
  // @returns a promise which resolves to the services entry value for this service
  // TODO move this to the super class - many implementations will be able to just change setupConfig
  async setupServiceForHost (host, servicesMd) {
    logLdp('%s.setupServiceForHost(%s,%o)', this.constructor.name, host, servicesMd)
    let uriProfile = host.split('.')[0]
    let publicName = host.split('.')[1]
    if (publicName === undefined) {
      publicName = host
      uriProfile = ''
    }
    let serviceKey = this.safeJs.makeServiceEntryKey(uriProfile, this.getIdString())

    let serviceValue = ''   // Default is do nothing
    let setup = this.getServiceConfig().setupDefaults
    if (setup.setupNfsContainer) {
      let nameAndTag = await this.safeJs.createNfsContainerMd(setup.defaultSafeContainer, publicName, setup.defaultContainerName, this.getTagType())

      serviceValue = nameAndTag.name.buffer
      await this.safeJs.setMutableDataValue(servicesMd, serviceKey, serviceValue)
      // TODO remove this excess DEBUG:
      if (extraDebug) {
        logLdp('Pubic name \'%s\' services:', publicName)
        await this.safeJs.listMd(servicesMd, publicName + ' public name MD')
      }
    }
    return serviceValue
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
  * SAFE NFS Container based service implementation:
  *
  * Many web services revolve around storage and a RESTful/CRUD style
  * interface. This is a default implementation based on the
  * SAFE www service, which uses a public Mutable Data as a
  * container for the service.
  *
  */

  // Get the nfs emulation of the service's storage MD
  //
  // @returns a promise which resolves to the NfsHandle
  async storageNfs () {
    if (this._storageNfs) { return this._storageNfs }

    logLdp('storageNfs()')
    try {
      this._storageNfs = await (await this.storageMd()).emulateAs('NFS')
      logLdp('this.storageMd: %s', await this.storageMd())
      return this._storageNfs
    } catch (err) {
      logLdp('Unable to access NFS storage for %s service: %s', this.getName(), err)
      throw (err)
    }
  }

  // Get Mutable Data handle of the service's storage container
  //
  // @returns a promise which resolves to the Mutable Handle
  async storageMd () {
    if (this._storageMd) {
      return this._storageMd
    }

    try {
      // The service value is the address of the storage container (Mutable Data)
      this._storageMd = await this.appHandle().mutableData.newPublic(this.getServiceValue().buf, this.getTagType())
      // TODO remove this existence check:
      await this._storageMd.getVersion()

      logLdp('storageMd() - set: %s', this._storageMd)
      return this._storageMd
    } catch (err) {
      logLdp('storageMd() - Unable to access Mutable Data for %s service: %s', this.getName(), err)
      throw (err)
    }
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
    logLdp('WARNING: SafenetworkLDP::_fetch() may need to return empty listing for non-existant containers')
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
    logLdp('%s.put(%s,%O)', this.constructor.name, docUri, options)
    let body = options.body
    let contentType = options.contentType

    // TODO Refactor to get rid of putDone...
    const putDone = async (docUri, options, response) => {
      try {
        // mrhTODO response.status checks for versions are untested
        logLdp('%s.put putDone(status: ' + response.status + ') for path: %s', this.constructor.name, docUri)
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
          logLdp('putDone(...) conflict - resolving with status 412')
          return new Response(null, {status: 412, revision: 'conflict'})
        } else {
          throw new Error('PUT failed with status ' + response.status + ' (' + response.statusText + ')')
        }
      } catch (err) {
        logLdp('putDone() failed: ' + err)
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
      logLdp('put failed: %s', err)
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
      logLdp('links: %O', links)
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
    logLdp('%s.post(%s, %O)', this.constructor.name, docUri, options)

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
    logLdp('%s.delete(%s,%O)', this.constructor.name, docUri, options)
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
        logLdp('safeNfs.delete() param this.storageNfs(): ' + await this.storageNfs())
        logLdp('                 param path: ' + docPath)
        logLdp('                 param version: ' + fileInfo.version)
        logLdp('                 param containerVersion: ' + fileInfo.containerVersion)
        let perms // if auth is needed, request default permissions
        await safeJs.nfsMutate(await this.storageNfs(), perms, 'delete', docPath, undefined, fileInfo.version + 1)
        this._deleteFileInfo(docPath)
        return new Response(null, {status: 204, statusText: 'No Content'})
      }
    } catch (err) {
      logLdp('%s.delete() failed: %s', this.constructor.name, err)
      this._deleteFileInfo(docPath)
      return this.safeJs._httpResponseError('DELETE', err)
    }
  }

  /*
  * Helpers for service handlers
  */

  // TODO review container emulation (create,delete,get)
  async _fakeCreateContainer (path, options) {
    logLdp('fakeCreateContainer(%s,{%o})...')
    return new Response(null, {ok: true, status: 201, statusText: 'Created'})
  }

  // TODO this should error if the container is not empty, so check this
  // TODO (check Solid and/or LDP spec)
  async _fakeDeleteContainer (path, options) {
    logLdp('fakeDeleteContainer(%s,{%o})...')
    return new Response(null, {status: 204, statusText: 'No Content'})
  }

  // TODO the remaining helpers should probably be re-written just for LDP because
  // TODO it was only moderately refactored from poor quality RS.js imp

  // Update file
  //
  // @returns promise which resolves to a Resonse object
  async _updateFile (docUri, body, contentType, options) {
    logLdp('%s._updateFile(\'%s\',%O,%o,%O)', this.constructor.name, docUri, body, contentType, options)
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
        logLdp('WARNING: attempt to update a folder')
      } else {
        // Store content as new immutable data (pointed to by nfsFile)
        logLdp('Storing immutable content on SAFE...')
        let nfsFile = await (await this.storageNfs()).create(body)
        logLdp('Content stored (create() successful), now to update.')

        // Add file to directory (by inserting nfsFile into container)
        // nfsFile = await (await this.storageNfs()).update(docPath, nfsFile, fileInfo.containerVersion + 1)
        let perms // if auth is needed, request default permissions
        logLdp('Updating SAFE container...')
        await safeJs.nfsMutate(await this.storageNfs(), perms, 'update', docPath, nfsFile, fileInfo.version + 1)
        await this._updateFileInfo(nfsFile, docPath)

        // TODO implement LDP PUT response https://www.w3.org/TR/ldp-primer/
        return new Response(null, {status: (nfsFile ? 200 : 400)})
      }
    } catch (err) {
      logLdp('Unable to update file \'%s\' : %s', docUri, err.message)
      logLdp('err: %o', err)
      // TODO can we decode the SAFE API errors to provide better error responses
      return new Response(null, {status: 500, statusText: '500 Internal Server Error (' + err + ')'})
    }
  }

  // Create file
  //
  // @returns promise which resolves to a Resonse object
  // TODO add header links addLinks() - see node-solid-server/lib/handlers/post.js function one ()
  async _createFile (docUri, body, contentType, options) {
    logLdp('%s._createFile(\'%s\',%O,%o,%O)', this.constructor.name, docUri, body, contentType, options)
    let docPath = this.safeJs.nfsPathPart(docUri)

    try {
      // this.safeJs.listContainer('_publicNames') // TODO remove this debug

      logLdp('DEBUG:  this.storageNfs().create()...')
      let nfsFile = await (await this.storageNfs()).create(body)
      // mrhTODOx set file metadata (contentType) - how?

      // Add file to directory (by inserting nfsFile into container)

      // TODO delete comments
      logLdp('DEBUG:  this.storageNfs().insert(nfsFile,%s)...',docPath)
      // nfsFile = await (await this.storageNfs()).insert(docPath, nfsFile)
      const valueVersion = await safeJs.getMutableDataValueVersion(await this.storageMd(), docPath)
      const version = valueVersion ? valueVersion.version : 0
      const operation = valueVersion ? 'update' : 'insert'

      let perms // if auth is needed, request default permissions
      await safeJs.nfsMutate(await this.storageNfs(), perms, operation, docPath, nfsFile, version + 1)

      logLdp('DEBUG:  this._updateFileInfo(...)...')
      this._updateFileInfo(nfsFile, docPath)

      // TODO implement LDP POST response https://www.w3.org/TR/ldp-primer/
      return new Response(null, {status: 200, statusText: 'OK'})
    } catch (err) {
      logLdp('Unable to create file \'%s\' : %s', docUri, err)
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
    let docPath = this.safeJs.nfsPathPart(docUri)
    let fileInfo = {}
    let nfsFile
    let retResponse
    try {
      if (!this.safeJs.isConnected()) {
        return new Response(null, {status: 503, statusText: '503 not connected to SAFE network'})
      }

      // TODO If the options are being used to retrieve specific version
      // should we get the latest version from the API first?
      try {
        logLdp('this.storageNfs().fetch(%s)...', docPath)
        nfsFile = await (await this.storageNfs()).fetch(docPath)
        logLdp('fetched nfsFile: %o', nfsFile)
        fileInfo = await this._makeFileInfo(nfsFile, fileInfo, docPath)
      } catch (err) {
        todoLogApi(err)
        return new Response(null, {status: 404, statusText: 'File not found'})
      }
      fileInfo.openHandle = await (await this.storageNfs()).open(nfsFile, this.safeJs.safeApi.CONSTANTS.NFS_FILE_MODE_READ)
      logLdp('safeNfs.open() returns handle: %o', fileInfo.openHandle)

      var etagWithoutQuotes = fileInfo.ETag
      // Request is for changed file, so if eTag matches return "304 Not Modified"
      if (options && options.ifNoneMatch && etagWithoutQuotes && (etagWithoutQuotes === options.ifNoneMatch)) {
        return new Response(null, {status: 304, statusText: 'Not Modified'})
      }

      var contentType = mime.lookup(docPath) || this.DEFAULT_CONTENT_TYPE
      if (safeUtils.hasSuffix(docPath, this.turtleExtensions)) {
        contentType = 'text/turtle'
      }

      let body = null
      if (options.includeBody) {
        let content = await fileInfo.openHandle.read(0, fileInfo.size)
        logLdp('%s bytes read from file.', content.byteLength)

        let decoder = new TextDecoder()
        body = decoder.decode(content)
        logLdp('body: \'%s\'', body)
      }

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
    } finally {
      if (fileInfo.openHandle) {
        await fileInfo.openHandle.close()
      }
    }
  }

  // Use nfsFile to insert metadata into given fileInfo
  //
  // returns a Promise which resolves to a fileInfo object
  // Note: if the fileInfo object includes an openHandle this should be closed by the caller
  async _makeFileInfo (nfsFile, fileInfo, docPath) {
    try {
      fileInfo.size = await nfsFile.size()
      fileInfo.created = nfsFile.created
      fileInfo.modified = nfsFile.modified
      fileInfo.version = nfsFile.version
      fileInfo.ETag = nfsFile.version
      fileInfo.dataMapName = nfsFile.dataMapName // TODO Debug only!
      this._fileInfoCache.set(docPath, nfsFile)    // Update the cached version
      return fileInfo
    } catch (err) {
      logLdp('_makeFileInfo(%s) > nfsFile metadata access FAILED: %s', docPath, err)
      throw err
    }
  }

  // Use nfsFile to update cached fileInfo with metadata
  //
  // returns a Promise which resolves to an updated fileInfo
  async _updateFileInfo (nfsFile, docPath) {
    try {
      let fileInfo = await this._makeFileInfo(nfsFile, {}, docPath)
      if (fileInfo) {
        return fileInfo
      } else { throw new Error('_updateFileInfo( ' + docPath + ') - unable to update - no existing fileInfo') }
    } catch (err) {
      logLdp('unable to update file info: %s', err)
      throw err
    }
  }

  // Obtain folder listing
  //

  async _getFolder (docUri, options) {
    logLdp('%s._getFolder(%s,%O)', this.constructor.name, docUri, options)
    let docPath = this.safeJs.nfsPathPart(docUri)
    let response

    // TODO delete this
    // const containerPrefixes = {
    //   posts: '',
    //   ldp: 'http://www.w3.org/ns/ldp#',
    //   terms: 'http://purl.org/dc/terms/',
    //   XML: 'http://www.w3.org/2001/XMLSchema#',
    //   st: 'http://www.w3.org/ns/posix/stat#',
    //   tur: 'http://www.w3.org/ns/iana/media-types/text/turtle#'
    // }

    var listing = {} // TODO listing output - to be removed now o/p is via an RDF graph
    //    var rdfGraph = N3.Writer({ prefixes: containerPrefixes })
    var rdfGraph = $rdf.graph()

    // TODO Can we improve 'stat()' for container. See node-solid-server/lib/ldp-container.js addContainerStats()
    let resourceGraph = rdfGraph
    rdfGraph.add(resourceGraph.sym(docUri), ns.rdf('type'), ns.ldp('BasicContainer'))
    rdfGraph.add(resourceGraph.sym(docUri), ns.rdf('type'), ns.ldp('Container'))

    try {
      debug('safe:TMP 1')
      // Create listing by enumerating container keys beginning with docPath
      const directoryEntries = []
      logLdp('storageMd() returns: %o', await this.storageMd())
      let entries = await (await this.storageMd()).getEntries()
      let entriesList = await entries.listEntries()
      debug('safe:TMP 2')
      entriesList.forEach(async (entry) => {
        directoryEntries.push(new Promise(async (resolve, reject) => {

          debug('safe:TMP 3')
          // Skip metadata entry and deleted entries
          if (entry.value.buf.length === 0 || entry.key.toString() === CONSTANTS.MD_METADATA_KEY) {
            // TODO try without this...
            debug('safe:TMP 4')
            resolve()
            return  // Next
          }
          logLdp('Key: ', entry.key.toString())
          logLdp('Value: ', entry.value.buf.toString('base64'))
          logLdp('entryVersion: ', entry.value.version)

          var dirPath = docPath
          if (dirPath.length && dirPath.slice(-1) !== '/') { dirPath += '/' } // Ensure a trailing slash

          var key = entry.key.toString()
          // If the folder matches the start of the key, the key is within the folder
          if (key.length > dirPath.length && key.substr(0, dirPath.length) === dirPath) {
            debug('safe:TMP 5')
            var remainder = key.slice(dirPath.length)
            var itemName = remainder // File name will be up to but excluding first '/'
            var firstSlash = remainder.indexOf('/')
            if (firstSlash !== -1) {
              itemName = remainder.slice(0, firstSlash + 1) // Directory name with trailing '/'
            }

            // That's it for HEAD, for GET add entries to listing
            if (options.includeBody) {
              debug('safe:TMP 6')
              let testPath = docPath + this.suffixMeta
              let fullItemUri = docUri + itemName
              let metaFilePath

              try {
                debug('safe:TMP 7')
                /*              if (await this.appHandle().mutableDataEntries.get(entriesHandle, testPath)) {
                metaFilePath = testPath
              }
              */            } catch (err) {
              debug('safe:TMP 8')
            } // metaFilePath - file not found
            logLdp('calling _addListingEntry for %s', itemName)
            await this._addListingEntry(rdfGraph, fullItemUri, docUri, itemName, metaFilePath)
            debug('safe:TMP 9')
          }
        }
        resolve()
      }))
    })
    await Promise.all(directoryEntries).catch((err) => {
      // TODO review error handling and responses
      logLdp('safeNfs.getEntries(\'%s\') failed: %s', docUri, err)
      // TODO are their any SAFE API codes we need to detect?
      return new Response(null, {status: 404, statusText: 'Resource Not Found'})
    })

    logLdp('Iteration finished')
    //        let triples = await new $rdf.Serializer(rdfGraph).toN3(rdfGraph)

    let triples
    $rdf.serialize(null, rdfGraph, docUri, 'text/turtle',
    function (err, result) {
      if (!err) {
        triples = result
      } else {
        throw err
      }
    })

    let body = null
    if (options.includeBody) {
      body = triples
    }

    response = new Response(body,{ status: 200,
      statusText: 'OK',
      headers: new Headers({ 'Content-Type': 'text/turtle',
      'MS-Author-Via': 'SPARQL' }) })
      logLdp('%s._getFolder(\'%s\', ...) response %s body:\n %s', this.constructor.name, docUri, response.status, triples)

    } catch(err) {
      // TODO review error handling and responses
      logLdp('safeNfs.getEntries(\'%s\') failed: %s', docUri, err)
      // TODO are their any SAFE API codes we need to detect?
      return new Response(null, {status: 404, statusText: 'Resource Not Found'})
    }

    return response
  }

  // Adds a entry to directory listing (file or folder to the RDF graph)
  async _addListingEntry (resourceGraph, fullItemUri, containerUri, itemName, metaFilePath) {
    logLdp('%s._addListingEntry(g,%s,%s,%s,%s)', this.constructor.name, fullItemUri, containerUri, itemName, metaFilePath)
    let fileInfo = await this._getFileInfo(itemPathPart(fullItemUri))
    resourceGraph = await this._addFileInfo(resourceGraph, fullItemUri, fileInfo)

    // Add to `contains` list
    let newTriple = resourceGraph.add(resourceGraph.sym(containerUri),
    ns.ldp('contains'),
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
  // Ref: node-solid-server/lib/ldp-container.js addFile()
  // TODO _getMetadataGraph() returns an $rdf.graph() which may not be compat with N3
  async _addFileMetadata (resourceGraph, metaFilePath, docUri) {
    logLdp('%s._addFileMetadata(%O,%s,%s)...', this.constructor.name, resourceGraph, metaFilePath, docUri)

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
    logLdp('%s._getMetadataGraph(%s,%s)...', this.constructor.name, metaFilePath, docUri)

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
          logLdp('%s bytes read from file.', content.byteLength)

          // TODO review: to keep lib small, we avoid require('rdflib) and leave
          // TODO for the application to assign one to $rdf member of the service interface (this)
          if (!this.$rdf) {
            throw new Error('%s has no $rdf (rdflib) object - must be set by application to support meta files')
          }

          let decoder = new TextDecoder()
          try {
            metadataGraph = this.$rdf.graph()
            $rdf.parse(decoder.decode(content),
            metadataGraph,
            docUri,
            'text/turtle')
          } catch (err) {
            logLdp('_getMetadataGraph(): ', err)
            logLdp('ERROR - can\'t parse metadata file: %s', metaFilePath)
          }
        }
      }
    } catch (err) {
      logLdp(err)
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
  async _addFileInfo (resourceGraph, reqUri, fileInfo) {
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

  // Check if file/folder exists and if it does, returns metadata which is kept in a cache
  //
  // Checks if the file (docPath) is in the _fileInfoCache(), and if
  // not found attempts to get its metadata
  //
  // Folders - a folder is inferred, so:
  // - a folder is deemed valid if any *file* path contains it
  // - fileInfo for a folder lacks a version or eTag
  //
  // @param docPath  the path of a file/folder in the storage container
  // @param optional refreshCache, if true clears cache first
  //
  // @returns a promise with
  //   if a file { path: string, ETag: string, 'Content-Length': number, ldpMetadata: object }
  //   if a folder { path: string, ETag: string, ldpMetadata: object }
  //   if root '/' { path: '/', ETag: string, ldpMetadata: object }
  //   or {} if file/folder doesn't exist, or the cached info doesn't match version
  //
  // See _getFolder() to confirm the above content values (as it creates
  // fileInfo objects)
  //
  // TODO ??? implement version param - check if anything needs this first?
  // TODO ??? implement Solid metadata for folders (Solid uses stat()) (note nfs MDs have metadata in the _metadata key)
  async _getFileInfo (docPath, refreshCache) {
    if (docPath[0] !== '/') {
      docPath = '/' + docPath
    }

    logLdp('%s._getFileInfo(%s)', this.constructor.name, docPath)
    try {
      if (refreshCache) {
        this._deleteFileInfo(docPath)
      }

      let fileInfo
      if (docPath !== '/') {
        fileInfo = await this._fileInfoCache.get(docPath)
        if (fileInfo) {
          logLdp('returning cached fileInfo: %O', fileInfo)
          return fileInfo
        }
      }
      // Not yet cached or doesn't exist

      // Folders //

      // Default folderInfo:
      var folderInfo = {
        path:     docPath,
        docPath:  docPath,// Used by _fileInfoCache() but nothing else
        isFolder: true,
        mtime: Date.now(),    // TODO this is a hack to please apps that expect this (e.g. users of solid-file-client/src/folderUtils.js)
        modified: Date.now(),    // TODO implement metadata (modified) on SAFE container
        size: 0           // TODO implement metadata (size) on SAFE container
      }
      let smd = await this.storageMd()
      let containerVersion = await smd.getVersion()
      if (docPath === '/') {
        folderInfo.ETag = containerVersion.toString()
        logLdp('returning folderInfo: %O', folderInfo)
        return folderInfo
      } // Dummy fileInfo to stop at "root"

      if (isSafeFolder(docPath)) {
        // TODO Could use _getFolder() in order to generate Solid metadata
        folderInfo.containerVersion = containerVersion
        this._fileInfoCache.set(docPath, folderInfo)
        logLdp('returning folderInfo: %O', folderInfo)
        return folderInfo
      }

      // Files //
      let nfsFile
      try {
        let nfsPath = docPath.slice(1)
        nfsFile = await (await this.storageNfs()).fetch(nfsPath)
        logLdp('_getFileInfo() - fetched nfsFile: %s', nfsFile.toString())
        fileInfo = await this._makeFileInfo(nfsFile, {}, docPath)
        fileInfo.containerVersion = containerVersion
        fileInfo.isFolder = false
      } catch (err) {
        fileInfo = null
      }
      if (fileInfo && fileInfo.openHandle) {
        await window.safeNfsFile.close(fileInfo.openHandle)
        delete fileInfo.openHandle
      }

      if (fileInfo) {
        this._fileInfoCache.set(docPath, fileInfo)

        logLdp('returning fileInfo: %O', fileInfo)
        return fileInfo
      } else {
        // file, doesn't exist
        logLdp('_getFileInfo(%s) file does not exist, no fileInfo available ', docPath)
        return null
      }
    } catch (err) {
      todoLogApi('_getFileInfo(%s) FAILED: %s', docPath, err)
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

module.exports.SafeServiceLDPNFS = SafeServiceLDPNFS
