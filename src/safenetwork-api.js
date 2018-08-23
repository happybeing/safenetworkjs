/* TODO theWebalyst:
[ ] implement JSDocs or similar across the code
[/] npm link for development of safenetwork-fuse
[x] get simple auth working so safenetwork-fuse auths with mock
  -> CLI, so uses .fromAuthUri() then calls SafenetworkApi.setApp()
[ ] migrate features from safenetwork-webapi to:
[ ] Review features and files, perhaps:
  [ ] safenetwork-api.js App auth, access to features (SAFE API, NFS, services etc.)
  [ ] safe-services.js specialist SAFE and generic RESTful services for web app *and* desktop (both via fetch()
  [ ] safe-containers.js wrappers for root containers with simplified JSON file
      system like interface for each:
    [ ] SafeContainer
      [/] Testing using Safepress2press Safepress3press:
          - First _public entry is /remotestorage/documents/notes/517F2A9F-5409-49B7-8714-1209B3DE3834
          [/] BUG It trys getattr on _public/documents not _public/remotestorage
          [/] BUG Need to detect pseudo folder /remotestorage etc and handle different from the full entry
              could just have defaults for when I getEntryValue() fails
    [/]   PublicContainer (_public)
    [/]   PrivateContainer (_music)
    [ ]     PublicNamesContainer (_publicNames)
    [ ]   ServicesContainer
--->[ ]   NfsContainer
      [ ] wire into Public container (by automount when readdir() on its key?)
      [ ] implement simplified file interface for example:
        [ ] saveFile(path, [create])
        [ ] fileExists(path)
        [ ] readFile(path)
        [ ] deleteFile(path)
      [ ] test using Safepresspress
      [ ] test using Safepres2spress
      [ ] test using Safepres3spress
    [ ] put FUSE ops on the above for now, but later:
      [ ] if poss. move the FUSE ops back into the safenetwork-fuse
          handlers (RootHander, PublicNamesHandler, ServicesHandler, NfsHandler etc)
[ ] change to generic JSON interface
[ ] move the 'safenetworkjs and safenetwork-web' notes to README.md of both modules
[ ] get SafenetworkJs working for both desktop and web app
  [/] move safe-cli-boilerplate bootstrap() into safenetworkjs
  [ ] write an equivalent for use in web
  [ ] handle different SAFE auth/response in same module
  -> it's looking like one module could be used for both (no build needed)
  [ ] modify my SafenetworkApi authorise methods to select between the two
  [ ] update safe-cli-boilerplate to use SafenetworkJs bootstrap.js (as safenetwork-fuse now does)
*/

/*
* SafenetworkJS - Application API for SAFE Network (base level)
*
* This provides essential and utility features to build a NodeJS app.
*
* Use this in combination with related safenetwork modules, proposed:
* - FS API - filesystem features (safenetwork-fs.js)
* - Web API - RESTful Standard Web (safenetwork-web.js + safenetwork-webservices.js)

safenetworkjs and safenetwork-web
=================================

safenetworkjs (this module)
-------------
Is a NodeJS module for building Node apps which you can run from the
desktop, or use to create stand-alone cross platform apps using the
safe-cli-boilerplate to package them for Windows, Mac OS and Linux.

- includes almost all the Web code because apps can do Web access using safeApp.webFetch()
- provides a wrapper for webFetch() so a desktop or command line application can access SAFE as a RESTful client

safenetwork-web (related module for web apps)
---------------
Uses safenetworkjs to provide the same features for web apps running in
the browser.

- provides a safe: fetch (using proto-fetch) which redirects to safenetworkjs webFetch() so a web application can access SAFE as a RESTful web client
- builds a bundle suitable for a Web application

See also: http://docs.maidsafe.net/safe_app_nodejs/#safeappwebfetch

Architecture
============
The plan is to create a base class (SafenetworkApi) and extend this first
to class SafenetworkFs.

SafenetworkWeb extends SafenetworkFS, but is a separate module
because it is built for use in the browser.

I considered trying to make it possible to just pull in the base plus
whichever feature(s) you wanted with the other modules sitting on top,
but think it is simpler to understand and implement as a base with
extended classes.

Using the base SafenetworkApi is flexible in that you can either use
the features it provides for application initialisation and connection,
or you can pass it a safeApp object obtained from the native SAFE API.

By extending this to create the other classes, you can just pick the one
with the features you want and keep the flexibility of the base SafenetworkApi.

Features generic JSON i/f for:
- SAFE NFS (raw fs type features, similar to my createFile() etc)
- high level SAFE API for public names, services, account profile etc
- later, maybe also MData/IData and so on

*/

require('fast-text-encoding') // TextEncoder, TextDecoder (for desktop apps)

// Local
const containers = require('./safe-containers')
const NfsContainer = containers.NfsContainer

// Libs
const safeUtils = require('./safenetwork-utils')

// Decorated console output
const debug = require('debug')
const logApi = require('debug')('safenetworkjs:web')  // Web API
const logLdp = require('debug')('safenetworkjs:ldp')  // LDP service
const logRest = require('debug')('safenetworkjs:rest')  // REST request/response
const logTest = require('debug')('safenetworkjs:test')  // Test output

// TODO: when browser API matches this, add a build of safenetworkjs for web
let safeApi
if (typeof window !== 'undefined') {  // Browser SAFE DOM API
  safeApi = this.safeApi // TODO this from bootstrap and make bootstrap do the test on window
  const err = 'WARNING: safenetworkjs not built with support for browser yet'
  debug(err)
  throw new Error(err)
} else {                              // SAFE App NodeJS API
  safeApi = require('./bootstrap')
}

let extraDebug = false

// TODO get these from the API safeApi.CONSTANTS (see web_hosting_manager/app/safenet_comm/api.js for examples)
// See https://github.com/maidsafe/safe_app_nodejs/blob/9b3a263cade8315370422400561088495d3ec5d9/src/consts.js#L85-L95
const SN_TAGTYPE_SERVICES = 15001
const SN_TAGTYPE_WWW = 15002  // Must be used for all MD referenced by _public, _documents etc (see https://forum.safedev.org/t/changes-to-tag-type-for-md-containers-referenced-in-public-documents-etc/1906?u=happybeing)
const SN_TAGTYPE_NFS = SN_TAGTYPE_WWW
const SN_SERVICEID_WWW = 'www'

// TODO SN_TAGTYPE_LDP is set to SN_TAGTYPE_WWW so that browser fetch() works, and
// TODO apps using window.webFetch() will work as expected w/o this library,
// TODO unless or until Peruse can fetch() an LDP service tagtype (of 80655 = timbl's dob).
const SN_TAGTYPE_LDP = SN_TAGTYPE_WWW // Same tag type needed for all file containers (in _public etc), therefore best to make NFS rather than WWW?
const SN_SERVICEID_LDP = 'www'  // First try 'www' to test compat with other apps (eg Web Hosting Manager)
// TODO then try out 'ldp'

/* eslint-disable no-unused-vars */
const isFolder = safeUtils.isFolder
const docpart = safeUtils.docpart
const pathpart = safeUtils.pathpart
const hostpart = safeUtils.hostpart
const protocol = safeUtils.protocol
const parentPath = safeUtils.parentPath
const addLink = safeUtils.addLink
const addLinks = safeUtils.addLinks
const Metadata = safeUtils.Metadata
// TODO change my code and these utils to use these npm libs:
const S = safeUtils.string
const path = safeUtils.path
const url = safeUtils.url
const getFullUri = safeUtils.getFullUri
const pathBasename = safeUtils.pathBasename
const hasSuffix = safeUtils.hasSuffix
const filenameToBaseUri = safeUtils.filenameToBaseUri
const getBaseUri = safeUtils.getBaseUri
/* eslint-enable */

/*
*  Example application config for SAFE Authenticator UI
*
* const appCfg = {
*   id:     'com.happybeing',
*   name:   'Solid Plume (Testing)',
*   vendor: 'happybeing.'
* }
*
*/

// For connection without authorisation (see initReadOnly)
const untrustedAppConfig = {
  id: 'Untrusted',
  name: 'Do NOT authorise this app',
  vendor: 'Untrusted'
}

// Default permissions to request. Optional parameter to SafenetworkApi.simpleAuthorise()
//
const defaultPerms = {
  // The following defaults have been chosen to allow creation of public names
  // and containers, as required for accessing SAFE web services.
  //
  // If your app doesn't need those features it can specify only the permissions
  // it needs when calling SafenetworkApi.simpleAuthorise()
  _public: ['Read', 'Insert', 'Update', 'Delete'], // TODO maybe reduce defaults later
  _publicNames: ['Read', 'Insert', 'Update', 'Delete'] // TODO maybe reduce defaults later
}

/*
* NodeJS API for SAFEnetwork
* - app initialisation
* - connection and authorisation with SAFE Network
* - public IDs and services
* - mutable data
* - immutable data
*
* For filesystem support, see safenetwork.js
*
* @Params
*  appHandle - SAFE API app handle or null
*
*/

class SafenetworkApi {
  /*
  * Service interface template for each service implementation
  *
  * DRAFT spec: https://forum.safedev.org/t/safe-services-npm-module/1334
  */

  constructor () {
    logApi('SafenetworkApi()')

    // Make SAFE API (DOM or NodeJS available as this.safeApi)
    this.safeApi = safeApi
    if (safeApi.bootstrap !== undefined) {
      // bootstrap is for auth from node and CLI
      this.bootstrap = (appConfig, appContainers, containerOpts, argv) => {
        return safeApi.bootstrap(appConfig, appContainers, containerOpts, argv).then((safeApp) => {
          this.setSafeApi(safeApp)
          this._safeAppConfig = appConfig
          this._safeAppContainers = appContainers
          this._safeContainerOpts = containerOpts
          this._safeAuthUri = ''  // TODO refactor to get this from safeApi.bootstrap()
          return safeApp
        })
      }
    }
    this._availableServices = new Map() // Map of installed services
    this.initialise()

    // An app can install additional services as needed
    // TODO update:
    // this.setServiceImplementation(new SafeServiceWww(this)) // A default service for www (passive)
    this.setServiceImplementation(new SafeServiceLDP(this))
  }

  initialise () {
    // TODO implement delete any active services (and their handles)

    // SAFE Network Services
    this._activeServices = new Map()    // Map of host (profile.public-name) to a service instance

    // DOM API settings and and authorisation status
    this._safeAuthUri = ''
    this._isConnected = false
    this._isAuthorised = false
    this._authOnAccessDenied = false  // Used by simpleAuthorise() and fetch()

    // Cached API Objects
    this._rootContainers = {} // Active SafeContainer objects
    this._nfsContainers = {}    // Active NfsContainer objects

    // Application specific configuration required for authorisation
    this._safeAppConfig = {}
    this._safeAppPermissions = {}

    /*
    * Access to helpers and constants via the object (useful when <script> including this JS)
    */
    this.isFolder = isFolder
    this.docpart = docpart
    this.pathpart = pathpart
    this.hostpart = hostpart
    this.protocol = protocol
    this.parentPath = parentPath

    this.SN_TAGTYPE_NFS = SN_TAGTYPE_NFS
    this.SN_TAGTYPE_LDP = SN_TAGTYPE_LDP
    this.SN_SERVICEID_LDP = SN_SERVICEID_LDP

    this.rootContainerNames = containers.rootContainerNames
  }

  /*
  * Local helpers
  */
  nfsPathPart (docUri) {
    let pathPart = this.pathpart(docUri)
    if (pathPart[0] === '/') {
      pathPart = pathPart.slice(1)  // safeNfs entries don't allow a leading '/'
    }
    return pathPart
  }

  /*
  * Application API - authorisation with SAFE network
  */

  // Set SAFE DOM API application handle
  //
  // If application does its own safeApp.initialise, it must call setSafeApi()
  // Application can call this again if it wants to clear/refresh DOM API handles
  //
  // @param a DOM API SAFEAppHandle, see this.safeApi.initialise()
  //

  // TODO rework for new web API when released
  setSafeApi (appHandle) {
    this.initialise()             // Clears active services (so DOM API handles will be discarded)
    this._appHandle = appHandle   // SAFE API application handle

    // SAFE API Interfaces
    this.safeApp = this._appHandle
    this.auth = this._appHandle.auth
    this.crypto = this._appHandle.crypto
    this.cypherOpt = this._appHandle.cypterOpt
    this.immutableData = this._appHandle.immutableData
    this.mutableData = this._appHandle.mutableData
    this.webFetch = this._appHandle.webFetch
  }

  // For access to SAFE API:
  appHandle () { return this._appHandle }
  getAuthUri () { return this._safeAuthUri } // TODO ensure auth URI comes from bootstrap
  isConnected () { return this._isConnected }
  isAuthorised () { return this._isAuthorised }
  services () { return this._availableServices }  // Note: these are ServiceInterface rather than ServiceContainer

  // Read only connection with SAFE network (can authorise later)
  //
  // Before you can use the SafenetworkApi methods, you must init and connect
  // with SAFE network. This function provides *read-only* init and connect, but
  // you can authorise subsequently using authAfterInit(), or directly with the
  // DOM API.
  //
  // - if using this method you don't need to do anything with the returned SAFEAppHandle
  // - if authorising using another method, you MUST call SafenetworkApi.setApi()
  //   with a valid SAFEAppHandle
  //
  // @param [optional] appConfig - information for auth UI, if ommitted generic
  //                - see DOM API this.safeApi.initialise()
  //
  // @returns a DOM API SAFEAppHandle, see this.safeApi.initialise()
  //
  async initReadOnly (appConfig = untrustedAppConfig) {
    logApi('%s.initReadOnly(%O)...', this.constructor.name, appConfig)

    // TODO remove when 'connection problems' solved (see dev forum )
    if (extraDebug) {
      // DEBUG CODE
      logApi('DEBUG WARNING using connectAuthorised() NOT connect()')
      let debugConfig = {
        id: 'com.happybeing.plume.poc',
        name: 'SAFE Plume (PoC)',
        vendor: 'com.happybeing'
      }
      return this.simpleAuthorise(debugConfig, defaultPerms)
    }

    let tmpAppHandle
    try {
      tmpAppHandle = await safeApi.initializeApp(appConfig, (newState) => {
        // Callback for network state changes
        logApi('SafeNetwork state changed to: ', newState)
        this._isConnected = newState // TODO bugchase
      })

      logApi('SAFEApp instance initialised and appHandle returned: ', tmpAppHandle)
      this.setSafeApi(tmpAppHandle)
      this._safeAppConfig = appConfig
      this._safeAppPermissions = undefined
      if (window) {
        await this.safeApi.connect(tmpAppHandle)
        logApi('SAFEApp was initialise with a read-only session on the SafeNetwork')
        this._isConnected = true // TODO to remove (see https://github.com/maidsafe/beaker-plugin-safe-app/issues/123)
      } else {
        logApi('SAFEApp was initialise with a read-only session on the SafeNetwork')
        this._isConnected = true // TODO to remove (see https://github.com/maidsafe/beaker-plugin-safe-app/issues/123)
      }
      return this._appHandle
    } catch (err) {
      logApi('WARNING: ', err)
      this.setSafeApi(null)
      throw (err)
    }
  }

  // Simplified one-step authorisation with SAFE network (init, auth and connect)
  //
  // Before you can use the SafenetworkApi methods, you must authorise your application
  // with SAFE network. This function provides simplified, one step authorisation, but
  // you can authorise separately, including using the SAFE DOM API directly to
  // obtain a valid SAFEAppHandle, which you MUST then use to initialise
  // the SafenetworkApi.
  //
  // - if using this method you don't need to do anything with the returned SAFEAppHandle
  // - if authorising using another method, you MUST call SafenetworkApi.setApi() with a valid SAFEAppHandle
  //
  // @param appConfig      - information for auth UI - see DOM API this.safeApi.initialise()
  // @param appContainers - (optional) requested permissions - see DOM API this.safeApi.authorise()
  //
  // @returns a DOM API SAFEAppHandle, see this.safeApi.initialise()
  //
  async simpleAuthorise (appConfig, appContainers) {
    logApi('%s.simpleAuthorise(%O,%O)...', this.constructor.name, appConfig, appContainers)

    // TODO ??? not sure what I'm thinking here...
    // TODO probably best to have initialise called once at start so can
    // TODO access the API with or without authorisation. So: remove the
    // TODO initialise call to a separate point and only call it once on
    // TODO load. Need to change freeSafeAPI() or not call it above.
    this._authOnAccessDenied = true // Enable auth inside SafenetworkApi.fetch() on 401

    let tmpAppHandle
    try {
      tmpAppHandle = await safeApi.initialize(appConfig, (newState) => {
        // Callback for network state changes
        logApi('SafeNetwork state changed to: ', newState)
        this._isConnected = newState // TODO bugchase
      })

      logApi('SAFEApp instance initialised and appHandle returned: ', tmpAppHandle)
      this.setSafeApi(tmpAppHandle)
      this._isConnected = true // TODO to remove (see https://github.com/maidsafe/beaker-plugin-safe-app/issues/123)
      this._safeAppConfig = appConfig
      this._safeAppPermissions = (appContainers !== undefined ? appContainers : defaultPerms)

      // await this.testsNoAuth();  // TODO remove (for test only)
      this._safeAuthUri = this.safeApp().auth.genAthUri(this._safeAppPermissions, this._safeAppConfig.options)
      await this.safeApp().auth.openUri(this._safeAuthUri)
      // ???
      this._safeAuthUri = await safeApi.authorise(tmpAppHandle, this._safeAppPermissions, this._safeAppConfig.options)
      logApi('SAFEApp was authorised and authUri received: ', this._safeAuthUri)

      await this.safeApi.connectAuthorised(tmpAppHandle, this._safeAuthUri)
      logApi('SAFEApp was authorised & a session was created with the SafeNetwork')
      await this.testsAfterAuth()  // TODO remove (for test only)
      this._isAuthorised = true
      return this._appHandle
    } catch (err) {
      logApi('WARNING: ', err)
      this.setSafeApi(null)
      throw (err)
    }
  }

  /* --------------------------
   * Simplified SAFE Containers
   * --------------------------
   *
   * Several classes are provided to allow simpler programming of
   * the standard containers for common operations.
   *
   * These include (not all implememented yet):
   *  PublicContainer for _public
   *  PrivateContainer for _documents, _music etc
   *  PublicNamesContainer for _publicNames
   *  NfsContainer for an NFS emultation Mutable Data
   *  ServicesContainer for a services Mutable Data
   *
   * In addition to the root containers, ServicesContainer simplifies
   * creation and management of SAFE services Mutable Data (but not yet
   * implemented). Note that there is a separate ServicesInterface class
   * which allows an application to access custom SAFE services with
   * a web style interface (e.g. RESTful using fetch()).
   */

  /**
   * Get an initialised root container instance
   * @param  {String} containerName Name of a root container (e.g. '_public')
   * @return {Object}               initialised instance of SafeContainer
   */

  async getSafeContainer (containerName) {
    let container = this._rootContainers[containerName]
    if (!container) {
      let ContainerClass = containers.containerClasses[containerName]
      if (ContainerClass) {
        container = new ContainerClass(this, containerName)
        container.initialise().then((result) => {
          this._rootContainers[containerName] = container
        }).catch((e) => { debug(e.message); throw e })
      }
    }

    return container
  }

  /**
   * Get an initialised ServicesContainer instance for the publicName
   * @param  {String} publicName
   * @param  {boolean}  createNew access (false) or create (true) services MutableData
   * @return {Object}            initialised instance of ServicesContainer
   */
  async getServicesContainer (publicName, createNew) {
    let container = this._servicesContainers[publicName]
    if (!container) {
      container = new ServicesContainer(this, publicName)
      container.intitialise(createNew).then(() => {
        this._servicesContainers[publicName] = container
      }).catch((e) => { debug(e.message); throw e })
    }

    return container
  }

  /**
   * Get an initialised NfsContainer instance
   * @param {String} nameOrKey  Either the path (starting with a public container) or the XOR address
   * @param  {Boolean}  createNew (optional) true if you want to create a new NFS MutableData
   * @param  {Boolean}  isPublic (optional) if createNew, specify true to make it shareable (eg in _public)
   * @param {Object} parent (optional) typically a SafeContainer (ServiceContainer?) but if parent is not defined, nameOrKey must be an XOR address
   * @return {Object}               initialised instance of NfsContainer
   */
  async getNfsContainer (nameOrKey, createNew, isPublic, parent) {
    let container = this._nfsContainers[nameOrKey]
    if (!container) {
      if (!createNew) createNew = false
      container = new NfsContainer(this, nameOrKey, parent)
      if (createNew) {
        if (!isPublic) isPublic = false // Defaut to private
        let ownerName = ''  // Not known (typically a public name so this is just omitted)
        container.createNew(ownerName, isPublic).then(() => {
          this._nfsContainers[nameOrKey] = container
        }).catch((e) => { debug(e.message) })
      } else {
        container.initialiseExisting().then(() => {
          this._nfsContainers[nameOrKey] = container
        }).catch((e) => { debug(e.message); throw e })
      }
    }

    return container
  }

  /* --------------------------
  * Simplified MutableData API
  * --------------------------
  */

  // Get the key/value of an entry from a mutable data object
  //
  // Encryption is handled automatically by the DOM APIs
  // - if the MD is public, they do nothing
  // - if the MD is private, they encrypt/decrypt using the MD private key
  //
  // @param mdHandle handle of a mutable data, with permission to 'Read'
  // @param key the key to read
  //
  // @returns a Promise which resolves to a ValueVersion
  async getMutableDataValue (mData, key) {
    logApi('getMutableDataValue(%s,%s)...', mData, key)
    let useKey = await mData.encryptKey(key)
    try {
      let valueVersion = await mData.get(useKey)
      valueVersion.buf = mData.decrypt(valueVersion.buf)
      return valueVersion
    } catch (err) {
      logApi("getMutableDataValue() WARNING no entry found for key '%s'", key)
      throw err
    }
  }

  // Set (ie insert or update) an entry in a mutable data object
  //
  // User must be logged in
  // App must have 'Insert'/'Update' permissions as appropriate
  //
  // Encryption is handled automatically by the DOM APIs
  // - if the MD is public, they do nothing
  // - if the MD is private, they encrypt/decrypt using the MD private key
  //
  // @param mData
  // @param key
  // @param value
  // @param mustNotExist  [defaults to false] if true, will fail if the key exists in the MD object
  //
  // @returns a Promise which resolves true if successful
  async setMutableDataValue (mData, key, value, mustNotExist) {
    if (mustNotExist === undefined) {
      mustNotExist = true
    }

    logApi('setMutableDataValue(%s,%s,%s,%s)...', mData, key, value, mustNotExist)
    let entry = null
    try {
      // Check for an existing entry
      try {
        let encryptedKey = await mData.encryptKey(key)
        entry = await mData.get(encryptedKey)
      } catch (err) {}

      if (entry && mustNotExist) {
        throw new Error("Key '" + key + "' already exists")
      }

      let entries = await mData.getEntries()
      let mutation = await entries.mutate()

      // Note: these only encrypt if the MD is private
      let useKey = await mData.encryptKey(key)
      let useValue = await mData.encryptValue(value)
      if (entry) {
        await mutation.update(useKey, useValue.version + 1)
      } else {
        await mutation.insert(useKey, useValue)
      }

      await mData.applyEntriesMutation(mutation)
      logApi('Mutable Data Entry %s', (mustNotExist ? 'inserted' : 'updated'))
      return true
    } catch (err) {
      logApi('WARNING - unable to set mutable data value: ', err)
      throw err
    }
  }

  /* ----------------
  * Public Names API
  * ----------------
  */

  // Get the key/value of a public name's entry in the _publicNames container
  //
  // User must:
  //  - be logged into the account owning the public name for this to succeed.
  //  - authorise the app to 'Read' _publicNames on this account.
  //
  // @param publicName
  //
  // @returns a Promise which resolves to an object containing the key and ValueVersion
  // The returned object is null on failure, or contains:
  //  - a 'key' of the format: '_publicNames/<public-name>'
  //  - a 'ValueVersion', the value part will be the XOR name of the services entry MD for the public name
  async getPublicNameEntry (publicName) {
    logApi('getPublicNameEntry(%s)...', publicName)
    try {
      // TODO wrap access to some MDs (eg for _publicNames container) in a getter that is passed permissions
      // TODO checks those permissions, gets the MD, and caches the value, or returns it immediately if not null
      let publicNamesMd = await this.safeApi.getContainer(this.safeApp, '_publicNames')
      let entriesHandle = await this.mutableData.getEntries(publicNamesMd)
      let entryKey = this.makePublicNamesEntryKey(publicName)
      let encryptedKey = await this.mutableData.encryptKey(publicNamesMd, entryKey)
      let valueVersion = await this.mutableDataEntries.get(entriesHandle, encryptedKey)
      valueVersion.buf = await this.mutableData.decrypt(publicNamesMd, valueVersion.buf)
      return {
        key: entryKey,
        valueVersion: valueVersion
      }
    } catch (err) {
      logApi('getPublicNameEntry() WARNING no _publicNames entry found for: %s', publicName)
    }

    return null
  }

  // Create/reserve a new public name and set it up with a hosted service
  //
  // See also createPublicName()
  //
  // User must be logged in
  // User must authorise the app to 'Read' and 'Insert' _publicNames on this account
  //
  // Fails if it finds there is already a _publicNames entry, otherwise it
  // creates a new services MD for the public name, and inserts it, and sets
  // up the service on the MD.
  //
  // Fails if the requested service is not available.
  //
  // Fails if it can't create the services MD because it already exists, which implies that
  // the public name is already taken. You could pre-check for this using getServicesMdFor().
  //
  // @param publicName
  // @param hostProfile a prefix which identifyies the host for the service where host=[profile.]public-name
  // @param serviceId   the string form of service identity (e.g. 'www', 'ldp' etc.)
  //
  // @returns a Promise which resolves to an object containing the _public entry's key, value and handle:
  //  - key:          of the format: '_publicNames/<public-name>'
  //  - value:        the XOR name of the services MD of the new public name
  //  - serviceValue: the value of the services MD entry for this host (ie [profile.]public-name)
  async createPublicNameAndSetupService (publicName, hostProfile, serviceId) {
    logApi('createPublicNameAndSetupService(%s,%s,%s)...', publicName, hostProfile, serviceId)
    let createResult

    try {
      let service = await this._availableServices.get(serviceId)
      if (!service) {
        throw new Error('requested service \'' + serviceId + '\' is not available')
      }

      createResult = await this._createPublicName(publicName)

      let host = publicName
      if (hostProfile !== undefined && hostProfile !== '') { host = hostProfile + '.' + publicName }

      createResult.serviceValue = await service.setupServiceForHost(host, createResult.servicesMd)
    } catch (err) {
      throw new Error('Failed to create public name with service - Error: ' + err)
    }

    return createResult
  }

  // Create/reserve a new public name
  //
  // See also createPublicNameAndSetupService()
  //
  // This includes creating a new services MD and inserting it into the _publicNames container
  //
  // User must be logged in
  // User must authorise the app to 'Read' and 'Insert' _publicNames on this account
  //
  // Fails if it finds there is already a _publicNames entry, otherwise it
  // creates a new services MD for the public name, and inserts it.
  //
  // Fails if it can't create the services MD because it already exists, which implies that
  // the public name is already taken. You could pre-check for this using getServicesMdFor().
  //
  // @param publicName
  //
  // @returns a Promise which resolves to an object containing the new entry's key, value and handle:
  //  - key:        of the format: '_publicNames/<public-name>'
  //  - value:      the XOR name of the services entry MD for the public name
  async createPublicName (publicName) {
    logApi('createPublicName(%s)...', publicName)
    try {
      let createResult = await this._createPublicName(publicName)
      delete await createResult.servicesMd
    } catch (err) {
      logApi('Unable to create public name \'' + publicName + '\': ', err)
      throw err
    }
  }

  // Create a new random MutableData for NFS storage, inserts into a root container MD if specified
  //
  // @param {String} rootContainer an empty string, or name of a top level public container (e.g. '_public', '_documents' etc)
  // @param {String} publicName    the public name which owns the container (or '' if none)
  // @param {String} containerName an arbitrary name which may be specified by the user, such as 'root-photos'
  // @param {Number} mdTagType     tag_type for new Mutable Data (currently can only be SN_TAGTYPE_WWW)
  // @param {Boolean} isPrivate    (optional) defaults to false
  //
  // @returns   Promise<NameAndTag>: the name and tag values of the newly created MD
  async createNfsContainerMd (rootContainer, publicName, containerName, mdTagType, isPrivate) {
    logApi('createNfsContainerMd(%s,%s,%s,%s,%s)...', rootContainer, publicName, containerName, mdTagType, isPrivate)
    try {
      let ownerPart = (publicName !== '' ? '/' + publicName : '') // Usually a folder is associated with a service on a public name
      let rootKey = rootContainer + '/' + ownerPart + '/' + containerName

      let rootMd
      if (rootContainer !== '') {
        // Check the container does not yet exist
        rootMd = await this.auth.getContainer(this.safeApp, rootContainer)

        // Check the public container doesn't already exist
        let existingValue = null
        try {
          existingValue = await this.getMutableDataValue(rootMd, rootKey)
        } catch (err) {
        } // Ok, key doesn't exist yet
        if (existingValue) {
          throw new Error("root container '" + rootContainer + "' already has entry with key: '" + rootKey + "'")
        }
      }

      // Create the new container
      let mdHandle = await this.mutableData.newRandomPublic(this.safeApp, mdTagType)
      let entriesHandle = await this.mutableData.newEntries(this.safeApp)
      // TODO review this with Web Hosting Manager (where it creates a new root-www container)
      // TODO clarify what setting these permissions does - and if it means user can modify with another app (e.g. try with WHM)
      let pmSet = ['Read', 'Update', 'Insert', 'Delete', 'ManagePermissions']
      let pubKey = await this.crypto.getAppPubSignKey(this.safeApp)
      let pmHandle = await this.mutableData.newPermissions(this.safeApp)
      await this.mutableDataPermissions.insertPermissionsSet(pmHandle, pubKey, pmSet)
      await this.mutableData.put(mdHandle, pmHandle, entriesHandle)
      let nameAndTag = await this.mutableData.getNameAndTag(mdHandle)

      // TODO BUG subfolder: try with 'posts/rand/', to chase bug in _getFolder() where we have a subfolder
      /*
      logLdp('DEBUG testing newly created service container, mdHandle: %s', mdHandle)
      let randText = 'posts/' + Date.now()
      logLdp('DEBUG try insert a random filename', randText)
      let nfsHandle = await this.mutableData.emulateAs(mdHandle,'NFS')
      logLdp('DEBUG 1 - create a file...')
      let nfsFile = await this.storageNfs().create(randText)
      logLdp('DEBUG 2 - insert file nfsFile: %s', nfsFile)
      await this.storageNfs().insert(nfsFile, randText)
      logLdp('...done.')
      */

      if (rootMd) {
        // Create an entry in rootContainer (fails if key exists for this container)
        await this.setMutableDataValue(rootMd, rootKey, nameAndTag.name.buffer)
        this.mutableData.free(mdHandle)
      }

      return nameAndTag
    } catch (err) {
      logApi('unable to create public container: ', err)
      throw err
    }
  }

  // Set up a service on a host / public name
  //
  // See also createPublicName()
  //
  // User must be logged in and grant permissions (TODO - what precisley?)
  //
  // Fails if the requested service is not available.
  //
  // @param host (i.e. [profile.]public-name)
  // @param serviceId   the string form of service identity (e.g. 'www', 'ldp' etc.)
  //
  // @returns   the value of the services MD entry for this host (ie [profile.]public-name)
  async setupServiceOnHost (host, serviceId) {
    logApi('setupServiceServiceOnHost(%s,%s)...', host, serviceId)
    let serviceValue

    try {
      let service = await this._availableServices.get(serviceId)
      if (!service) {
        throw new Error('requested service \'' + serviceId + '\' is not available')
      }

      let servicesMd = await this.getServicesMdFor(host)
      serviceValue = await service.setupServiceForHost(host, servicesMd)
      this.mutableData.free(servicesMd)
    } catch (err) {
      throw new Error('Failed to set up service \'' + serviceId + '\' - Error: ' + err)
    }

    return serviceValue
  }

  // Internal version returns a handle which must be freed by the caller
  //
  // TODO ensure publicName is valid before attempting (eg lowercase, no illegal chars)
  // @param publicName
  //
  // @returns a Promise which resolves to an object containing the new entry's key, value and handle:
  //  - key:        of the format: '_publicNames/<public-name>'
  //  - value:      the XOR name of the services entry MD for the public name
  //  - servicesMd: the handle of the newly created services MD
  async _createPublicName (publicName) {
    logApi('_createPublicName(%s)...', publicName)
    try {
      // Check for an existing entry (before creating services MD)
      let entry = null
      try {
        entry = await this.getPublicNameEntry(publicName)
      } catch (err) {} // No existing entry, so ok...

      if (entry) {
        throw new Error("Can't create _publicNames entry, already exists for `" + publicName + "'")
      }
      // Create a new services MD (fails if the publicName is taken)
      // Do this before updating _publicNames and even if that fails, we
      // still own the name so TODO check here first, if one exists that we own
      let servicesMdName = await this.makeServicesMdName(publicName)
      let servicesMd = await this.mutableData.newPublic(this.safeApp, servicesMdName, SN_TAGTYPE_SERVICES)

      var enc = new TextDecoder()
      logApi('created services MD with servicesMdName: %s', enc.decode(new Uint8Array(servicesMdName)))

      let servicesEntriesHandle = await this.mutableData.newEntries(this.safeApp)

      // TODO review this with Web Hosting Manager (separate into a make or init servicesMd function)
      // TODO clarify what setting these permissions does - and if it means user can modify with another app (e.g. try with WHM)
      let pmSet = ['Read', 'Update', 'Insert', 'Delete', 'ManagePermissions']
      let pubKey = await this.crypto.getAppPubSignKey(this.safeApp)
      let pmHandle = await this.mutableData.newPermissions(this.safeApp)
      await this.mutableDataPermissions.insertPermissionsSet(pmHandle, pubKey, pmSet)
      await this.mutableData.put(servicesMd, pmHandle, servicesEntriesHandle)

      // TODO do I also need to set metadata?
      // TODO - see: http://docs.maidsafe.net/beaker-plugin-safe-app/#windowsafemutabledatasetmetadata
      // TODO free stuff!
      // TODO   - pubKey? - ask why no free() functions for cyrpto library handles)
      // TODO   - servicesEntriesHandle (this.mutableData.newEntries doesn't say it should be freed)
      await this.mutableDataPermissions.free(pmHandle)

      // TODO remove (test only):
      let r = await this.mutableData.getNameAndTag(servicesMd)
      logApi('servicesMd created with tag: ', r.type_tag, ' and name: ', r.name, ' (%s)', enc.decode(new Uint8Array(r.name)))

      let publicNamesMd = await this.safeApi.getContainer(this.safeApp, '_publicNames')
      let entryKey = this.makePublicNamesEntryKey(publicName)
      let entriesHandle = await this.mutableData.getEntries(publicNamesMd)
      let namesMutation = await this.mutableDataEntries.mutate(entriesHandle)
      let encryptedKey = await this.mutableData.encryptKey(publicNamesMd, entryKey)
      let encryptedValue = await this.mutableData.encryptValue(publicNamesMd, servicesMdName)
      await this.mutableDataMutation.insert(namesMutation, encryptedKey, encryptedValue)
      await this.mutableData.applyEntriesMutation(publicNamesMd, namesMutation)
      await this.mutableDataMutation.free(namesMutation)

      // TODO remove (test only):
      r = await this.mutableData.getNameAndTag(servicesMd)
      /* logApi('DEBUG new servicesMd created with tag: ', r.type_tag, ' and name: ', r.name)
      logApi('DEBUG _publicNames entry created for %s', publicName)
      logApi('DEBUG servicesMd for public name \'%s\' contains...', publicName)
      await this.listMd(servicesMd, publicName + ' servicesMd')
      logApi('DEBUG _publicNames MD contains...')
      await this.listMd(publicNamesMd, '_publicNames MD')
      */

      return {
        key: entryKey,
        value: servicesMdName,
        'servicesMd': servicesMd
      }
    } catch (err) {
      logApi('_createPublicName() failed: ', err)
      throw err
    }
  }

  // Test if a given Mutable Data exists on the network
  //
  // Use this on a handle from one the safeApp.MutableData.newPublic()
  // or newPrivate() APIs. Those don't create a MutableData on the network
  // but a handle which you can then use to do so. So we use that to test if
  // it already exists.
  //
  // This method is really just to help clarify the SAFE API, so you could
  // just do what this does in your code.
  //
  // @param mdHandle the handle of a Mutable Data object
  //
  // @returns a promise which resolves true if the Mutable Data exists
  async mutableDataExists (mdHandle) {
    try {
      await this.mutableData.getVersion(mdHandle)
      logApi('mutableDataExists(%s) TRUE', mdHandle)
      return true
    } catch (err) {
      logApi('mutableDataExists(%s) FALSE', mdHandle)
      return false  // Error indicates this MD doens't exist on the network
    }
  }

  async mutableDataStats (mData) {
    // TODO work out some useful stats for a container and use the values in safenetwork-fuse/fuse-operations/statfs.js
    // TODO probably worth basing this on the MD entry count and size (if poss)
    return {
      // TODOThese members are junk (inherited from IPFS code so change them!)
      repoSize: 12345,
      storageMax: 99999,
      numObjects: 321
    }
  }

  // Get the services MD for any public name or host, even ones you don't own
  //
  // This is always public, so no need to be logged in or own the public name.
  //
  // @param host (or public-name), where host=[profile.]public-name
  //
  // @returns promise which resolves to the services MD of the given name
  // You should free() the returned handle with this.mutableData.free
  async getServicesMdFor (host) {
    logApi('getServicesMdFor(%s)', host)
    let publicName = host.split('.')[1]
    try {
      if (publicName === undefined) {
        publicName = host
      }

      logApi("host '%s' has publicName '%s'", host, publicName)
      let servicesName = await this.makeServicesMdName(publicName)
      let mdHandle = await this.mutableData.newPublic(this.safeApp, servicesName, SN_TAGTYPE_SERVICES)
      if (await this.mutableDataExists(mdHandle)) {
        var enc = new TextDecoder()
        logApi('Look up SUCCESS for MD XOR name: ' + enc.decode(new Uint8Array(servicesName)))
        return mdHandle
      }
      throw new Error("services Mutable Data not found for public name '" + publicName + "'")
    } catch (err) {
      var enc = new TextDecoder()
      logApi('Look up FAILED for MD XOR name: ' + enc.decode(new Uint8Array(await this.makeServicesMdName(publicName))))
      logApi('getServicesMdFor ERROR: ', err)
      throw err
    }
  }

  // Get the services MD for a public name or host (which you must own)
  //
  // User must be logged into the account owning the public name for this to succeed.
  // User must authorise the app to 'Read' _publicNames on this account
  //
  // @param host (or public-name), where host=[profile.]public-name
  //
  // @returns promise which resolves to the services MD of the given name, or null
  // You should free() the returned handle with this.mutableData.free
  async getServicesMdFromContainers (host) {
    logApi('getServicesMdFromContainers(%s)', host)
    try {
      let publicName = host.split('.')[1]
      if (publicName === undefined) {
        publicName = host
      }
      logApi("host '%s' has publicName '%s'", host, publicName)

      let nameKey = this.makePublicNamesEntryKey(publicName)
      let mdHandle = await this.safeApi.getContainer(this.safeApp, '_publicNames')
      logApi('_publicNames ----------- start ----------------')
      let entriesHandle = await this.mutableData.getEntries(mdHandle)
      await this.mutableDataEntries.forEach(entriesHandle, (k, v) => {
        logApi('Key: ', k.toString())
        logApi('Value: ', v.buf.toString())
        logApi('Version: ', v.version)
        if (k === nameKey) {
          logApi('Key: ' + nameKey + '- found')
          return v.buf
        }
      })
      logApi('Key: ' + nameKey + '- NOT found')
      logApi("getServicesMdFromContainers() - WARNING: No _publicNames entry for '%s'", publicName)
      return null
    } catch (err) {
      logApi('getServicesMdFromContainers() ERROR: ', err)
      throw err
    }
  }

  /* -----------------
  * SAFE Services API
  * -----------------
  */

  // Make a service available for use in this API
  //
  // - replaces any service with the same service idString
  //
  // @param a service specific implementation object, of class which extends ServiceInterface
  //
  // @returns a promise which resolves to true
  async setServiceImplementation (serviceImplementation) {
    this._availableServices.set(serviceImplementation.getIdString(), serviceImplementation)
    return true
  }

  // Get the service implementation for a service if available
  //
  // @param serviceId
  //
  // @returns the ServiceInterface implementation for the service, or null
  async getServiceImplementation (serviceId) {
    return this._availableServices.get(serviceId)
  }

  // Make service active for a host address
  //
  // - replaces an active service instance if present
  //
  // @param host
  // @param a service instance which handles service requests for this host
  //
  // @returns a promise which resolves to true
  async setActiveService (host, serviceInstance) {
    let oldService = await this.getActiveService(host)
    if (oldService) {
      oldService.freeHandles()
    }

    this._activeServices.set(host, serviceInstance)
    return true
  }

  // Get the service instance active for this host address
  //
  // @param host
  //
  // @returns the ServiceInterface implementation for the service, or null
  async getActiveService (host) {
    return this._activeServices.get(host)
  }

  // Get the service enabled for a URI
  //
  // Maintains a cache of handlers for each host, so once a service has
  // been assigned to a host address the service implementation is already known
  // for any URI with that host. If the appropriate service for a host changes,
  // it would be necessary to clear its cached service by setting _activeServices.delete(<host>)
  // to null, and the next call would allocate a service from scratch.
  //
  // @param a valid safe:// style URI
  // @returns a promise which evaluates to a ServiceInterface which supports fetch() operations
  //
  // @param a valid safe:// style URI
  // @returns a promise which evaluates to a service implementation object, or null if no service installed on host
  async getServiceForUri (uri) {
    logApi('getServiceForUri(%s)...', uri)
    try {
      let host = hostpart(uri)
      let service = await this._activeServices.get(host)
      if (service) {
        return service
      } // Already initialised

      // Look up the service on this host: profile.public-name
      let uriProfile = host.split('.')[0]
      let publicName = host.split('.')[1]
      if (publicName === undefined) {
        publicName = host
        uriProfile = ''
      }
      logApi("URI has profile '%s' and publicName '%s'", uriProfile, publicName)

      // Get the services MD for publicName
      let servicesMd = await this.getServicesMdFor(publicName)
      let entriesHandle = await this.mutableData.getEntries(servicesMd)
      logApi("checking servicesMd entries for host '%s'", host)
      this.hostedService = null
      await this.mutableDataEntries.forEach(entriesHandle, async (k, v) => {
        logApi('Key: ', k.toString())
        logApi('Value: ', v.buf.toString())
        logApi('Version: ', v.version)
        let serviceKey = k.toString()
        let serviceProfile = serviceKey.split('@')[0]
        let serviceId = serviceKey.split('@')[1]
        if (serviceId === undefined) {
          serviceId = serviceKey
          serviceProfile = ''
        }

        let serviceValue = v
        logApi("checking: serviceProfile '%s' has serviceId '%s'", serviceProfile, serviceId)
        if (serviceProfile === uriProfile) {
          let serviceFound = this._availableServices.get(serviceId)
          if (serviceFound) {
            // Use the installed service to enable the service on this host
            let newHostedService = await serviceFound.makeServiceInstance(host, serviceValue)
            this.setActiveService(host, newHostedService) // Cache the instance for subsequent uses
            logApi('Service activated - %s (serviceName: %s, serviceId: %s)', newHostedService.getDescription(), newHostedService.getName(), newHostedService.getIdString())
            this.hostedService = newHostedService
          } else {
            let errMsg = "WARNING service '" + serviceId + "' is setup on '" + host + "' but no implementation is available"
          }
        }
      })

      if (!this.hostedService) {
        logApi("WARNING no service setup for host '" + host + "'")
      }
      return this.hostedService
    } catch (err) {
      logApi('getServiceForUri(%s) FAILED: %s', uri, err)
      return null
    } finally {
      // TODO implement memory freeing stuff using 'finally' throughout the code!
    }
  }

  /* --------------
  * Helper Methods
  * --------------
  */

  /**
   * Test if a standard SAFE root container name is public
   * @param  {String}  name  the name of a root container ('_public', '_documents' etc)
   * @return {Boolean}       true if the name is a recognised as a public root container
   */
  isPublicContainer (containerName) {
      // Currently there is only _public
      return contanerName === '_public'
  }

  // Helper to get a mutable data handle for an MD hash
  //
  // @param hash
  // @param tagType
  //
  // @returns a promise which resolves to an MD handle
  async getMdFromHash (hash, tagType) {
    logApi('getMdFromHash(%s,%s)...', hash, tagType)
    try {
      return this.mutableData.newPublic(this.safeApp, hash, tagType)
    } catch (err) {
      logApi('getMdFromHash() ERROR: %s', err)
      throw err
    }
  }

  // Helper to create the services MD name corresponding to a public name
  //
  // Standardised naming makes it possile to retrieve services MD for any public name.
  //
  // See final para: https://forum.safedev.org/t/container-access-any-recent-dom-api-changes/1314/13?u=happybeing
  //
  // @param publicName
  //
  // @returns the XOR name as a String, for the services MD unique to the given public name
  async makeServicesMdName (publicName) {
    logApi('makeServicesMdName(%s)', publicName)
    return this.crypto.sha3Hash(this.safeApp, publicName)
  }

  // Helper to create the key for looking up a public name entry in the _publicNames container
  //
  // @param publicName
  //
  // @returns the key as a string, corresponding to the public name's entry in _publicNames
  makePublicNamesEntryKey (publicName) {
    return publicName
  }

  /*
  * Web Services API
  *
  * This API provides a way to implement Web like services on safe:// URIs.
  *
  * The API allows for new service implementations to be provided, replacing
  * or adding to the services *available* on this API, each of which is
  * implemented by extending the service implementation class: ServiceInterface.
  *
  * This API enables you to *install* any of the *available* services on a host, where
  * host means: [profile.]public-name (e.g. ldp.happybeing) which can then be
  * accessed by clients using fetch() on safe: URIs such as safe://ldp.happybeing/profile/me#card
  */

  // Helper to create the key for looking up the service installed on a host
  //
  // TODO ensure hostProfile is valid before attempting (eg lowercase, no illegal chars such as '@')
  //
  // @param hostProfile prefix of a host address, which is [profile.]public-name
  // @param serviceId
  //
  // @returns the key as a string, corresponding to a service entry in a servicesMD
  makeServiceEntryKey (hostProfile, serviceId) {
    if (serviceId === SN_SERVICEID_WWW) {
      return (hostProfile & hostProfile.length > 0 ? hostProfile : 'www')
    }

    return (hostProfile + '@' + serviceId)
  }

  // ////// TODO END of 'move to Service class/implementation'

  /*
  * Support safe:// URIs
  *
  * To enable safe:// URI support in any website/web app, all the app needs to
  * do is use the standard window.fetch(), rather than XmlHttpRequest etc
  *
  */
  //

  // fetch() implementation for 'safe:' URIs
  //
  // This fetch is not intended to be called by the app directly. Instead,
  // the app can use window.fetch() as normal, and that will automatically
  // be redirected to this implementation for 'safe:' URIs.
  //
  // This means that an existing website/web app which uses window.fetch()
  // will automatically support 'safe:' URIs without needing to change
  // and fetch() calls. If it uses an older browser API such as
  // XmlHttpRequest, then to support 'safe:' URIs it must first be
  // converted from those to use window.fetch() instead.
  //
  // @param docUri {String}
  // @param options {Object}
  //
  // @returns null if not handled, or a {Promise<Object} on handling a safe: URI
  //
  async fetch (docUri, options) {
    logApi('%s.fetch(%s,%o)...', this.constructor.name, docUri, options)

    let allowAuthOn401 = false // TODO reinstate: true
    try {
      // console.assert('safe' === protocol(docUri),protocol(docUri))
      return this._fetch(docUri, options)
    } catch (err) {
      try {
        if (err.status === '401' && this._authOnAccessDenied && allowAuthOn401) {
          allowAuthOn401 = false // Once per fetch attempt
          await this.simpleAuthorise(this._safeAppConfig, this._safeAppPermissions)
          return this._fetch(docUri, options)
        }
      } catch (err) {
        logApi('WARNING: ' + err)
        throw err
      }
    }
  }

  // Handle web style operations for this service in the manner of browser window.fetch()
  //
  // @params  see window.fetch() and your services specification
  //
  // @returns see window.fetch() and your services specification
  async _fetch (docUri, options) {
    logApi('%s._fetch(%s,%o)', this.constructor.name, docUri, options)

    let response
    options = options || {}
    try {
      let service = await this.getServiceForUri(docUri)

      if (service) {
        if (!options.method) {
          options.method = 'GET'
        }

        logRest('%s %s %s', service.getIdString(), options.method, docUri)
        let handler = service.getHandler(options.method)
        response = await handler.call(service, docUri, options)
        logRest('    response: %s %s', response.status, response.statusText)
      }
    } catch (err) {
      logApi('%s._fetch() error: %s', this.constructor.name, err)
    }

    if (!response) {
      logApi('%s._fetch() - no service available, defaulting to webFetch()...', this.constructor.name)

      try {
        response = await this.safeApi.webFetch(this.safeApp, docUri, options)
      } catch (err) {
        logApi('%s._fetch() error: %s', this.constructor.name, err)
        response = new Response(null, {status: 404, statusText: '404 Not Found'})
      }
    }

    return response
  }

  // //// TODO debugging helpers (to remove):

  testsNoAuth () {
    logTest('testsNoAuth() called!')
  }

  // TODO prototyping only for now:
  async testsAfterAuth () {
    logTest('>>>>>> T E S T S testsAfterAuth()')

    try {
      await this.listContainer('_public')
      await this.listContainer('_publicNames')

      // Change public name / host for each run (e.g. testname1 -> testname2)
      //      this.test_createPublicNameAndSetupService('xxx1','test','ldp')

      // This requires that the public name of the given host already exists:
      //      this.test_setupServiceOnHost('testname10','ldp')
    } catch (err) {
      logTest('Error: ', err)
    }
  }

  async testServiceCreation1 (publicName) {
    logTest('>>>>>> TEST testServiceCreation1(%s)...', publicName)
    let name = publicName

    logTest('TEST: create public name')
    let newNameResult = await this.createPublicName(name)
    await this.listContainer('_publicNames')
    let entry = await this.getPublicNameEntry(name)
    logTest('_publicNames entry for \'%s\':\n   Key: \'%s\'\n   Value: \'%s\'\n   Version: %s', name, entry.key, entry.valueVersion.value, entry.valueVersion.version)
    await this.listAvailableServices()
    await this.listHostedServices()

    logTest('TEST: install service on \'%s\'', name)
    // Install an LDP service
    let profile = 'ldp'
    //    name = name + '.0'
    let serviceId = 'ldp'
    let servicesMd = await this.getServicesMdFor(name)
    if (servicesMd) {
      logTest("servicesMd for public name '%s' contains...", name)
      await this.listMd(servicesMd, name + ' services MD')

      let serviceInterface = await this.getServiceImplementation(serviceId)
      let host = profile + '.' + name

      // Set-up the servicesMD
      let serviceValue = await serviceInterface.setupServiceForHost(host, servicesMd)

      // Activate the service for this host
      let hostedService = await serviceInterface.makeServiceInstance(host, serviceValue)
      this.setActiveService(host, hostedService)

      logTest("servicesMd for public name '%s' contains...", name)
      await this.listMd(servicesMd, name + ' services MD')
    }

    await this.listHostedServices()

    logTest('<<<<<< TEST END')
  }

  async test_createPublicNameAndSetupService (publicName, hostProfile, serviceId) {
    logTest('>>>>>> TEST: createPublicNameAndSetupService(%s,%s,%s)...', publicName, hostProfile, serviceId)
    let createResult = await this.createPublicNameAndSetupService(publicName, hostProfile, 'ldp')
    logTest('test result: %O', createResult)

    await this.listContainer('_publicNames')
    await this.listContainer('_public')
    await this.listHostedServices()
    logTest('<<<<<< TEST END')
  }

  async test_setupServiceOnHost (host, serviceId) {
    logTest('>>>>>> TEST setupServiceOnHost(%s,%s)', host, serviceId)
    let createResult = await this.setupServiceOnHost(host, serviceId)
    logTest('test result: %O', createResult)

    await this.listContainer('_publicNames')
    await this.listContainer('_public')
    await this.listHostedServices()
    logTest('<<<<<< TEST END')
  }

  async listAvailableServices () {
    logTest('listAvailableServices()...')
    await this._availableServices.forEach(async (v, k) => {
      logTest("%s: '%s' - %s", k, await v.getName(), await v.getDescription())
    })
  }

  async listHostedServices () {
    logTest('listHostedServices()...')
    await this._activeServices.forEach(async (v, k) => {
      logTest("%s: '%s' - %s", k, await v.getName(), await v.getDescription())
    })
  }

  async listContainer (containerName) {
    logTest('listContainer(%s)...', containerName)
    logTest(containerName + ' ----------- start ----------------')
    let mdHandle = await this.safeApi.getContainer(this.safeApp, containerName)
    await this.listMd(mdHandle, containerName)
    logTest(containerName + '------------ end -----------------')
  }

  async listMd (mdHandle, name) {
    let entriesHandle = await this.mutableData.getEntries(mdHandle)
    logTest('list mdHandle: %s', mdHandle)
    await this.mutableDataEntries.forEach(entriesHandle, async (k, v) => {
      let plainKey = k
      try { plainKey = await this.mutableData.decrypt(mdHandle, k) } catch (e) { debug('Key decryption ERROR: %s', e) }
      let plainValue = v.buf
      try { plainValue = await this.mutableData.decrypt(mdHandle, v.buf) } catch (e) { debug('Value decryption ERROR: %s', e) }
      let enc = new TextDecoder()

      plainKey = enc.decode(new Uint8Array(plainKey))
      if (plainKey !== k.toString())
        logTest('%s Key (encrypted): ', name, k.toString())

      logTest('%s Key            : ', name, plainKey)

      plainValue = enc.decode(new Uint8Array(plainValue))
      if (plainValue !== v.buf.toString() )
        logTest('%s Value (encrypted): ', name, v.buf.toString())

      logTest('%s Value            :', name, plainValue)

      logTest('%s Version: ', name, v.version)
    })
  }
  // //// END of debugging helpers
}

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
  * - provide a constructor which calls super(safeWeb) and initialises
  *   the properties of this._serviceConfig
  * - enable the service for a given SAFE host (safe://[profile].public-name)
  *
  * Refer to class SafeServiceLDP for guidance.
  */

  constructor (safeWeb) {
    this._safeWeb = safeWeb

    // Should be set in service implementation constructor:
    this._serviceConfig = {}
    this._serviceHandler = new Map()  // Map 'GET', 'PUT' etc to handler function

    // Properties which must be set by setupServiceForHost()
    this._host = ''
    this._serviceValue = ''
  }

  // Free any cached DOM API handles (should be called by anything discarding an active service)
  freeHandles () {}

  safeWeb () { return this._safeWeb }
  appHandle () { return this._safeWeb.appHandle() }
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
    logApi('WARNING: \'%s\' not implemented for %s service (returning 405)', method, this.getName())
    return async function () {
      return new Response(null, {ok: false, status: 405, statusText: '405 Method Not Allowed'})
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
    logApi('%s.setupServiceForHost(%s,%o) - NOT YET IMPLEMENTED', host, this.constructor.name, servicesMd)
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
    logApi('%s.makeServiceInstance(%s,%s) - NOT YET IMPLEMENTED', this.constructor.name, host, serviceValue)
    throw ('%s.makeServiceInstance() not implemented for ' + this.getName() + ' service', this.constructor.name)
    /* Example:
    let hostService = await new this.constructor(this.safeWeb())
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
    logApi('%s._fetch() - NOT YET IMPLEMENTED', this.constructor.name)
    throw new Error('ServiceInterface._fetch() not implemented for ' + this.getName() + ' service')
  }
};

// Keep this service implementation here because it is simple and illustrates
// the basics of providing an implementation. Other implementations would
// probably best be in separate files.
class SafeServiceWww extends ServiceInterface {
  constructor (safeWeb) {
    super(safeWeb)

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
    logApi('%s.setupServiceForHost(%s,%o) - NOT YET IMPLEMENTED', host, this.constructor.name, servicesMd)
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
    logApi('%s.makeServiceInstance(%s,%s) - NOT YET IMPLEMENTED', this.constructor.name, host, serviceValue)
    throw ('%s.makeServiceInstance() not implemented for ' + this.getName() + ' service', this.constructor.name)
    /* Example:
    let hostService = await new this.constructor(this.safeWeb())
    hostService._host = host
    hostService._serviceConfig = this.getServiceConfig()
    hostService._serviceValue = serviceValue
    return hostService
    */
  }

  // Handle web style operations for this service in the manner of browser window.fetch()
  //
  // @params  see window.fetch() and your services specification
  //
  // @returns see window.fetch() and your services specification
  async _fetch () {
    logApi('%s._fetch(%o) calling this.safeApi.webFetch()', this.constructor.name, arguments)
    return this.safeApi.webFetch.apply(null, this.safeApp, arguments)
  }
}

// TODO move most of the implementation to the ServiceInterface class so that
// TODO it is easy to implement a service with a SAFE NFS storage container
// TODO then move this service implementation into its own file and require() to use it

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
//
class SafeServiceLDP extends ServiceInterface {
  constructor (safeWeb) {
    super(safeWeb)

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

  // TODO copy theses function header comments to above, (also example code)
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
    let serviceKey = this.safeWeb().makeServiceEntryKey(uriProfile, this.getIdString())

    let serviceValue = ''   // Default is do nothing
    let setup = this.getServiceConfig().setupDefaults
    if (setup.setupNfsContainer) {
      let nameAndTag = await this.safeWeb().createNfsContainerMd(setup.defaultSafeContainer, publicName, setup.defaultContainerName, this.getTagType())

      serviceValue = nameAndTag.name.buffer
      await this.safeWeb().setMutableDataValue(servicesMd, serviceKey, serviceValue)
      // TODO remove this excess DEBUG:
      if (extraDebug) {
        logLdp('Pubic name \'%s\' services:', publicName)
        await this.safeWeb().listMd(servicesMd, publicName + ' public name MD')
      }
    }
    return serviceValue
  }

  // TODO copy theses function header comments to above, (also example code)
  // Create an instance of a service inistalised for a given host
  //  - create and intitialise a new instance of this service implementation
  //
  // @param serviceValue  from the services MD for this host
  //
  // @returns a promise which resolves to a new instance of this service for the given host
  async makeServiceInstance (host, serviceValue) {
    logLdp('%s.makeServiceInstance(%s,%s)', this.constructor.name, host, serviceValue)
    let hostService = await new this.constructor(this.safeWeb())
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
      this._storageNfs = await this.storageMd().emulateAs('NFS')
      logLdp('this.storageMd: %s', await this.storageMd())
      /* TODO remove debug code:
      logLdp('DEBUG this._storageNfs: %s', this._storageNfs)
      let randText = 'rand/' + Date.now()
      logLdp('DEBUG try insert a random filename', randText)
      logLdp('DEBUG 1 - create a file...')
      let nfsFile = await this.storageNfs().create(randText)
      logLdp('DEBUG 2 - insert file nfsFile: %s', nfsFile)
      await this.storageNfs().insert('filename',nfsFile)
      logLdp('...done.')
      */
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
      this._storageMd = await this.mutableData.newPublic(this.safeApp, this.getServiceValue().buf, this.getTagType())
      // TODO remove this existence check:
      await this.mutableData.getVersion(this._storageMd)

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
    if (isFolder(docUri)) {
      return this._getFolder(docUri, options)
    } else {
      return this._getFile(docUri, options)
    }
  }

  // Add Solid response header links
  //
  // See node-solid-server/lib/header.js linksHandler()
  async addHeaderLinks (docUri, options, headers) {
    let fileMetadata = new Metadata()
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
    safeUtils.addLink(headers, safeUtils.pathBasename(docUri) + this.suffixAcl, 'acl')
    safeUtils.addLink(headers, safeUtils.pathBasename(docUri) + this.suffixMeta, 'describedBy')
    // Add other Link headers
    safeUtils.addLinks(headers, fileMetadata)
  }

  async put (docUri, options) {
    logLdp('%s.put(%s,%O)', this.constructor.name, docUri, options)
    let body = options.body
    let contentType = options.contentType

    // TODO Refactor to get rid of putDone...
    const putDone = async (docUri, opotions, response) => {
      try {
        // mrhTODO response.status checks for versions are untested
        logLdp('%s.put putDone(status: ' + response.status + ') for path: %s', this.constructor.name, docUri)
        if (response.status >= 200 && response.status < 300) {
          let fileInfo = await this._getFileInfo(pathpart(docUri))
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
      let fileInfo = await this._getFileInfo(pathpart(docUri))
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

  // TODO specialise put/post (RemoteStorage service just has put - so leave til imp RS service)
  async post (docUri, options) {
    logLdp('%s.post(%s,%O)', this.constructor.name, docUri, options)

    if (isFolder(docUri)) {
      return this._fakeCreateContainer(docUri, options)
    }

    return this.put(docUri, options)
  }

  async delete (docUri, options) {
    logLdp('%s.delete(%s,%O)', this.constructor.name, docUri, options)
    let docPath = this.safeWeb().nfsPathPart(docUri)

    try {
      let fileInfo = await this._getFileInfo(pathpart(docUri))
      if (!fileInfo) {
        return new Response(null, {status: 404, statusText: '404 Not Found'})
      }

      var etagWithoutQuotes = (typeof (fileInfo.ETag) === 'string' ? fileInfo.ETag : undefined)
      if (options && options.ifMatch && (options.ifMatch !== etagWithoutQuotes)) {
        return new Response(null, {status: 412, revision: etagWithoutQuotes})
      }

      if (isFolder(docUri)) {
        return this._fakeDeleteContainer(docUri, options)
      }

      if (!isFolder(docPath)) {
        logLdp('safeNfs.delete() param this.storageNfs(): ' + await this.storageNfs())
        logLdp('                 param path: ' + docPath)
        logLdp('                 param version: ' + fileInfo.version)
        logLdp('                 param containerVersion: ' + fileInfo.containerVersion)
        await this.storageNfs().delete(docPath, fileInfo.version + 1)
        this._fileInfoCache.delete(docUri)
        return new Response(null, {status: 204, statusText: '204 No Content'})
      }
    } catch (err) {
      logLdp('%s.delete() failed: %s', err)
      this._fileInfoCache.delete(docUri)
      // TODO can we decode the SAFE API errors to provide better error responses
      return new Response(null, {status: 500, statusText: '500 Internal Server Error (' + err + ')'})
    }
  }

  /*
  * Helpers for service handlers
  */

  // TODO review container emulation (create,delete,get)
  async _fakeCreateContainer (path, options) {
    logLdp('fakeCreateContainer(%s,{%o})...')
    return new Response(null, {ok: true, status: 201, statusText: '201 Created'})
  }

  // TODO this should error if the container is not empty, so check this
  // TODO (check Solid and/or LDP spec)
  async _fakeDeleteContainer (path, options) {
    logLdp('fakeDeleteContainer(%s,{%o})...')
    return new Response(null, {status: 204, statusText: '204 No Content'})
  }

  // TODO the remaining helpers should probably be re-written just for LDP because
  // TODO it was only moderately refactored from poor quality RS.js imp

  // Update file
  //
  // @returns promise which resolves to a Resonse object
  async _updateFile (docUri, body, contentType, options) {
    logLdp('%s._updateFile(\'%s\',%O,%o,%O)', this.constructor.name, docUri, body, contentType, options)
    let docPath = this.safeWeb().nfsPathPart(docUri)

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
        return new Response(null, {status: 412, statusText: '412 Precondition Failed', revision: etagWithoutQuotes})
      }

      // Only act on files (directories are inferred so no need to create)
      if (isFolder(docUri)) {
        // Strictly we shouldn't get here as the caller should test, but in case we do
        logLdp('WARNING: attempt to update a folder')
      } else {
        // Store content as new immutable data (pointed to by nfsFile)
        let nfsFile = await this.storageNfs().create(body)

        // Add file to directory (by inserting nfsFile into container)
        nfsFile = await this.storageNfs().update(docPath, nfsFile, fileInfo.containerVersion + 1)
        await this._updateFileInfo(nfsFile, docPath)

        // TODO implement LDP PUT response https://www.w3.org/TR/ldp-primer/
        return new Response(null, {status: (nfsFile ? 200 : 400)})
      }
    } catch (err) {
      logLdp('Unable to update file \'%s\' : %s', docUri, err)
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
    let docPath = this.safeWeb().nfsPathPart(docUri)

    try {
      this.safeWeb().listContainer('_publicNames') // TODO remove this debug

      // logLdp('DEBUG:  this.storageNfs().create()...')
      let nfsFile = await this.storageNfs().create(body)
      // mrhTODOx set file metadata (contentType) - how?

      // Add file to directory (by inserting nfsFile into container)
      // logLdp('DEBUG:  this.storageNfs().insert(nfsHandle,nfsFile,%s)...',docPath)
      nfsFile = await this.storageNfs().insert(nfsFile, docPath)

      // logLdp('DEBUG:  this._updateFileInfo(...)...')
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
    let docPath = this.safeWeb().nfsPathPart(docUri)
    let fileInfo = {}
    let nfsFile
    let retResponse
    try {
      if (!this.safeWeb().isConnected()) {
        return new Response(null, {status: 503, statusText: '503 not connected to SAFE network'})
      }

      // TODO If the options are being used to retrieve specific version
      // should we get the latest version from the API first?
      try {
        logLdp('this.storageNfs().fetch(nfsHandle,%s)...', docPath)
        nfsFile = await this.storageNfs().fetch(docPath)
        logLdp('fetched nfsFile: %s', nfsFile.toString())
        fileInfo = await this._makeFileInfo(nfsFile, fileInfo, docPath)
      } catch (err) {
        return new Response(null, {status: 404, statusText: '404 File not found'})
      }
      logLdp('safeNfs.open() returns handle: %s', fileInfo.openHandle.toString())

      var etagWithoutQuotes = fileInfo.ETag
      // Request is for changed file, so if eTag matches return "304 Not Modified"
      if (options && options.ifNoneMatch && etagWithoutQuotes && (etagWithoutQuotes === options.ifNoneMatch)) {
        return new Response(null, {status: 304, statusText: '304 Not Modified'})
      }
/* ??? Note, for LDP service need to add:
const mime = require('mime-types')
const ns = require('solid-namespace')($rdf)
*/
      var contentType = mime.lookup(docPath) || this.DEFAULT_CONTENT_TYPE
      if (safeUtils.hasSuffix(docPath, this.turtleExtensions)) {
        contentType = 'text/turtle'
      }

      let body = null
      if (options.includeBody) {
        let content = await window.safeNfsFile.read(fileInfo.openHandle, 0, fileInfo.size)
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
        window.safeNfsFile.close(fileInfo.openHandle)
      }
    }
  }

  // Use nfsFile to insert metadata into given fileInfo
  //
  // returns a Promise which resolves to a fileInfo object
  // Note: if the fileInfo object includes an openHandle this should be closed by the caller
  async _makeFileInfo (nfsFile, fileInfo, docPath) {
    try {
//      fileInfo.openHandle = await nfsFile.open(4/* read TODO get from safeApp.CONSTANTS */)
      fileInfo.size = nfsFile.size
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
    let docPath = this.safeWeb().nfsPathPart(docUri)
    let response

    // TODO delete this
    const containerPrefixes = {
      posts: '',
      ldp: 'http://www.w3.org/ns/ldp#',
      terms: 'http://purl.org/dc/terms/',
      XML: 'http://www.w3.org/2001/XMLSchema#',
      st: 'http://www.w3.org/ns/posix/stat#',
      tur: 'http://www.w3.org/ns/iana/media-types/text/turtle#'
    }

    var listing = {} // TODO listing output - to be removed now o/p is via an RDF graph
    //    var rdfGraph = N3.Writer({ prefixes: containerPrefixes })
    var rdfGraph = $rdf.graph()

    // TODO Can we improve 'stat()' for container. See node-solid-server/lib/ldp-container.js addContainerStats()
    let resourceGraph = rdfGraph
    rdfGraph.add(resourceGraph.sym(docUri), ns.rdf('type'), ns.ldp('BasicContainer'))
    rdfGraph.add(resourceGraph.sym(docUri), ns.rdf('type'), ns.ldp('Container'))

    try {
      debug('safe:TMP')('1')
      // Create listing by enumerating container keys beginning with docPath
      const directoryEntries = []
      let entriesHandle = await this.mutableData.getEntries(await this.storageMd())
      debug('safe:TMP')('2')
      await this.mutableDataEntries.forEach(entriesHandle, async (k, v) => {
        debug('safe:TMP')('3')
        // Skip deleted entries
        if (v.buf.length === 0) {
          // TODO try without this...
          debug('safe:TMP')('4')
          return true  // Next
        }
        logLdp('Key: ', k.toString())
        logLdp('Value: ', v.buf.toString('base64'))
        logLdp('entryVersion: ', v.version)

        var dirPath = docPath
        if (dirPath.slice(-1) !== '/') { dirPath += '/' } // Ensure a trailing slash

        var key = k.toString()
        // If the folder matches the start of the key, the key is within the folder
        if (key.length > dirPath.length && key.substr(0, dirPath.length) === dirPath) {
          debug('safe:TMP')('5')
          var remainder = key.slice(dirPath.length)
          var itemName = remainder // File name will be up to but excluding first '/'
          var firstSlash = remainder.indexOf('/')
          if (firstSlash !== -1) {
            itemName = remainder.slice(0, firstSlash + 1) // Directory name with trailing '/'
          }

          if (options.includeBody) {
            debug('safe:TMP')('6')
            let testPath = docPath + this.suffixMeta
            let fullItemUri = docUri + itemName
            let metaFilePath

            try {
              debug('safe:TMP')('7')
              /*              if (await this.mutableDataEntries.get(entriesHandle, testPath)) {
              metaFilePath = testPath
            }
            */            } catch (err) {
            debug('safe:TMP')('8')
          } // metaFilePath - file not found
          logLdp('calling _addListingEntry for %s', itemName)
          directoryEntries.push(this._addListingEntry(rdfGraph, fullItemUri, docUri, itemName, metaFilePath))
          debug('safe:TMP')('9')
        }
      }
    })
    .then(async _ => Promise.all(directoryEntries)
    .then(async _ => {
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

        return response
      }))
    } catch (err) { // TODO review error handling and responses
      logLdp('safeNfs.getEntries(\'%s\') failed: %s', docUri, err)
      // TODO are their any SAFE API codes we need to detect?
      return new Response(null, {status: 404, statusText: '404 Resource Not Found'})
    }

    return response
  }

  // Adds a entry to directory listing (file or folder to the RDF graph)
  async _addListingEntry (resourceGraph, fullItemUri, containerUri, itemName, metaFilePath) {
    logLdp('%s._addListingEntry(g,%s,%s,%s,%s)', this.constructor.name, fullItemUri, containerUri, itemName, metaFilePath)
    let fileInfo = await this._getFileInfo(pathpart(fullItemUri))
    resourceGraph = await this._addFileInfo(resourceGraph, fullItemUri, fileInfo)

    // Add to `contains` list
    let newTriple = resourceGraph.add(resourceGraph.sym(containerUri),
    ns.ldp('contains'),
    resourceGraph.sym(fullItemUri))

    // Set up a metaFile path
    // Earlier code used a .ttl file as its own meta file, which
    // caused massive data files to parsed as part of deirectory listings just looking for type triples
    if (metaFilePath)
    resourceGraph = this._addFileMetadata(resourcesGraph, metaFilePath, fullItemUri)

    return resourceGraph
  }

  // get LDP metadata for an LDPC container or LDPR/LDP-NR file
  //
  // @returns a Promise which resolves to an ldpMetadata
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
          safeUtils.isFolder(docUri)
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
      nfsFile = await this.storageNfs().fetch(metaFilePath)
    } catch (err) {}

    try {
      // Metadata file exists
      if (nfsFile) {
        fileInfo.openHandle = await this.storageNfs().open(nfsFile, 4/* read TODO get from safeApp.CONSTANTS */)
        let content = await window.safeNfsFile.read(fileInfo.openHandle, 0, fileInfo.size)

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
        await window.safeNfsFile.close(fileInfo.openHandle)
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
    ns.stat('size'),
    fileInfo.size)

    resourceGraph.add(resourceGraph.sym(reqUri),
    ns.dct('modified'),
    fileInfo.modified) // An actual datetime value from a Date object

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
        this._fileInfoCache.delete(docPath)
      }

      let fileInfo
      if (docPath !== '/') {
        fileInfo = await this._fileInfoCache.get(docPath)
        if (fileInfo) { return fileInfo }
      }
      // Not yet cached or doesn't exist

      // Folders //
      let smd = await this.storageMd()
      let containerVersion = await this.mutableData.getVersion(smd)
      if (docPath === '/') {
        return { path: docPath, ETag: containerVersion.toString() }
      } // Dummy fileInfo to stop at "root"

      if (isFolder(docPath)) {
        // TODO Could use _getFolder() in order to generate Solid metadata
        var folderInfo = {
          docPath: docPath, // Used by _fileInfoCache() but nothing else
          'containerVersion': containerVersion
        }
        this._fileInfoCache.set(docPath, folderInfo)
        return folderInfo
      }

      // Files //
      let nfsFile
      try {
        let nfsPath = docPath.slice(1)
        nfsFile = await this.storageNfs().fetch(nfsPath)
        logLdp('_getFileInfo() - fetched nfsFile: %s', nfsFile.toString())
        fileInfo = await this._makeFileInfo(nfsFile, {}, docPath)
        fileInfo.containerVersion = containerVersion
      } catch (err) {
        fileInfo = null
      }
      if (fileInfo && fileInfo.openHandle) {
        await window.safeNfsFile.close(fileInfo.openHandle)
        delete fileInfo.openHandle
      }

      if (fileInfo) {
        this._fileInfoCache.set(docPath, fileInfo)

        return fileInfo
      } else {
        // file, doesn't exist
        logLdp('_getFileInfo(%s) file does not exist, no fileInfo available ', docPath)
        return null
      }
    } catch (err) {
      logApi('_getFileInfo(%s) FAILED: %s', docPath, err)
      throw err
    }
  }
}

// Usage: create the web API and install the built in services
// let safeWeb = new SafenetworkApi()

module.exports = SafenetworkApi

module.exports.PublicContainer = containers.PublicContainer
module.exports.ServicesContainer = containers.ServicesContainer
module.exports.NfsContainer = containers.NfsContainer

// Constants
module.exports.rootContainerNames = containers.rootContainerNames // List of default SAFE containers (_public, _music, _publicNames etc)

// TODO ??? change to export class, something like this (example rdflib Fetcher.js)
// class SafenetworkApi {...}
// let safeWeb = new SafenetworkApi()
// module.exports = SafenetworkApi
// module.exports.safeWeb = safeWeb

/* TODO remove this and all refs to safeWeb (for current usage see README.md)
module.exports.safeWeb = safeWeb
module.exports.setSafeApi = SafenetworkApi.prototype.setSafeApi.bind(safeWeb)
module.exports.listContainer = SafenetworkApi.prototype.listContainer.bind(safeWeb)
module.exports.testsNoAuth = SafenetworkApi.prototype.testsNoAuth.bind(safeWeb)
module.exports.testsAfterAuth = SafenetworkApi.prototype.testsAfterAuth.bind(safeWeb)
*/

module.exports.isFolder = safeUtils.isFolder
module.exports.docpart = safeUtils.docpart
module.exports.pathpart = safeUtils.pathpart
module.exports.hostpart = safeUtils.hostpart
module.exports.protocol = safeUtils.protocol
module.exports.parentPath = safeUtils.parentPath

module.exports.SN_TAGTYPE_LDP = SN_TAGTYPE_LDP
module.exports.SN_SERVICEID_LDP = SN_SERVICEID_LDP

/*
*  Override window.fetch() in order to support safe:// URIs
*/
