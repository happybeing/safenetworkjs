require('fast-text-encoding') // TextEncoder, TextDecoder (for desktop apps)
const { parse: parseUrl } = require('url');

const SUCCESS = null

// Local
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


class ServiceInterface {
  // An abstract class which defines the interface to a SAFE Web Service
  //
  // Extend this class to provide the implementation for a SAFE Web service.
  //
  // An application or module can add a new service or modify an existing service
  // by providing an implementation that follows this template, and installing
  // it in the SafenetworkApi object.

  /*
  * To provide a new SAFE web service extend this class to:
  * - provide a constructor which calls super(safeJs) and initialises
  *   the properties of this._serviceConfig
  * - enable the service for a given SAFE host (safe://[profile].public-name)
  *
  * Refer to class SafeServiceLDP for guidance.
  */

  constructor (safeJs) {
    this.safeJs = safeJs

    // Should be set in service implementation constructor:
    this._serviceConfig = {}
    this._serviceHandler = new Map()  // Map 'GET', 'PUT' etc to handler function

    // Properties which must be set by setupServiceForHost()
    this._host = ''
    this._serviceValue = ''
  }

  // Free any cached DOM API handles (should be called by anything discarding an active service)
  freeHandles () {}

  safeJs () { return this.safeJs }
  appHandle () { return this.safeJs.appHandle() }
  getName () { return this.getServiceConfig().friendlyName }
  getDescription () { return this.getServiceConfig().description }
  getIdString () { return this.getServiceConfig().idString }
  getTagType () { return this.getServiceConfig().tagType }
  setHandler (method, handler) { this._serviceHandler.set(method, handler) }
  getHandler (method) {
    let handler = this._serviceHandler.get(method)
    if (handler !== undefined) {
      return handler
    }

    // Default handler when service does not provide one
    todoLogApi('WARNING: \'%s\' not implemented for %s service (returning 405)', method, this.getName())
    return async function () {
      return new Response(null, {ok: false, status: 405, statusText: 'Method Not Allowed'})
    }
  }

  // Initialise a services MD with an entry for this host
  //
  // Your implementation should:
  //  - create any service specific objects on the network (e.g. a container MD to store files)
  //  - make a serviceValue to be stored in the services MD entry for this host
  //  - mutate the service MD to add the service on the MD for the given host (profile.public-name)
  //
  // @param servicesMd
  //
  // @returns a promise which resolves to the services entry value for this service
  async setupServiceForHost (host, servicesMd) {
    todoLogApi('%s.setupServiceForHost(%s,%o) - NOT YET IMPLEMENTED', this.constructor.name, host, servicesMd)
    throw new Error('ServiceInterface.setupServiceForHost() not implemented for ' + this.getName() + ' service')
    /* Example:
    TODO
    */
  }

  // Create an instance of a service inistalised for a given host
  //  - create and intitialise a new instance of this service implementation
  //
  // @param serviceValue  from the services MD for this host
  //
  // @returns a promise which resolves to a new instance of this service for the given host
  async makeServiceInstance (host, serviceValue) {
    todoLogApi('%s.makeServiceInstance(%s,%s) - NOT YET IMPLEMENTED', this.constructor.name, host, serviceValue)
    throw ('%s.makeServiceInstance() not implemented for ' + this.getName() + ' service', this.constructor.name)
    /* Example:
    let hostService = await new this.constructor(this.safeJs)
    hostService._host = host
    hostService._serviceConfig = this.getServiceConfig()
    hostService._serviceValue = serviceValue
    return hostService
    */
  }

  // Your makeServiceInstance() implementation must set the following properties:
  getHost () { return this._host }           // The host on which service is active (or null)
  getServiceConfig () { return this._serviceConfig }  // This should be a copy of this.getServiceConfig()
  getServiceSetup () { return this._serviceConfig.setupDefaults }
  getServiceValue () { return this._serviceValue }   // The serviceValue for an enabled service (or undefined)

  // TODO remove _fetch() from ServiceInterface classes - now on SafenetworkApi
  // Handle web style operations for this service in the manner of browser window.fetch()
  //
  // @params  see window.fetch() and your services specification
  //
  // @returns see window.fetch() and your services specification
  async _fetch () {
    todoLogApi('%s._fetch() - NOT YET IMPLEMENTED', this.constructor.name)
    throw new Error('ServiceInterface._fetch() not implemented for ' + this.getName() + ' service')
  }
};

module.exports.ServiceInterface = ServiceInterface
