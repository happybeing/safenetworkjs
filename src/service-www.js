
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

// Keep this service implementation here because it is simple and illustrates
// the basics of providing an implementation. Other implementations would
// probably best be in separate files.
class SafeServiceWww extends ServiceInterface {
  constructor (safeJs) {
    super(safeJs)

    // Service configuration (maps to a SAFE API Service)
    this._serviceConfig = {
      // UI - to help identify the service in user interface
      //    - don't match with these in code (use the idString or tagType)
      friendlyName: 'WWW',
      description: 'www service (defers to SAFE webFetch)',

      // Service Setup - configures behaviour of setupServiceForHost()
      setupDefaults: {
        setupNfsContainer: true,        // Automatically create a file store for this host
        defaultSafeContainer: '_public',  // ...in container (e.g. _public, _documents, _pictures etc.)
        defaultContainerName: 'root-' + SN_SERVICEID_WWW // ...container key: 'root-www' implies key of '_public/<public-name>/root-www'
      },

      // Don't change this unless you are defining a brand new service
      idString: 'www', // Uses:
      // to direct URI to service (e.g. safe://www.somesite)
      // identify service in _publicNames (e.g. happybeing@www)
      // Note: SAFE WHM 0.4.4 leaves blank for www (i.e. happybeing@) (RFC needs to clarify)

      tagType: SN_TAGTYPE_WWW  // Mutable data tag type (don't change!)
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
    // This is not implemented for www because this service is passive (see _fetch() below)
    // and so a www service must be set up using another application such as
    // the Maidsafe Web Hosting Manager example. This can't be done here
    // because the user must specify a name for a public container.
    todoLogApi('%s.setupServiceForHost(%s,%o) - NOT YET IMPLEMENTED', this.constructor.name, host, servicesMd)
    throw ('%s.setupServiceForHost() not implemented for ' + this.getName() + ' service', this.constructor.name)

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
    logLdp('%s.makeServiceInstance(%s,%s)', this.constructor.name, host, serviceValue)
    let hostService = await new this.constructor(this.safeJs)
    hostService._host = host
    hostService._serviceConfig = this.getServiceConfig()
    hostService._serviceValue = serviceValue
    return hostService
  }

  // Handle web style operations for this service in the manner of browser window.fetch()
  //
  // @params  see window.fetch() and your services specification
  //
  // @returns see window.fetch() and your services specification
  async _fetch () {
    todoLogApi('%s._fetch(%o) calling this.safeApp.webFetch()', this.constructor.name, arguments)
    return this.safeApp.webFetch.apply(null, arguments)
  }
}

// TODO move most of the implementation to the ServiceInterface class so that
// TODO it is easy to implement a service with a SAFE NFS storage container
// TODO then move this service implementation into its own file and require() to use it

module.exports.SafeServiceWww = SafeServiceWww
