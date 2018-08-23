/**
 * Container wrapper classes for SAFE MutableData:
 *    SafeContainer
 *      PublicContainer (_public)
 *      PrivateContainer (_music, _documents etc)
 *        PublicNamesContainer (_publicNames)
 *      ServicesContainer
 *      NfsContainer
 */

require('fast-text-encoding') // TextEncoder, TextDecoder (for desktop apps)

const debug = require('debug')('safenetworkjs:container')  // Web API
const path = require('path')

// TODO remove this
const fakeReadDir = {
  '/': ['_public', 'two', 'three'],
  '/_public': ['four', 'five', 'happybeing']
}

const rootContainerNames = [
  '_public',
  '_documents',
  '_music',
  '_video',
  '_photos',
  '_publicNames'
]

const containerTypes = {
  self: 'self',                   // itemPath isn't an entry but the name of this container TODO what if a key matches this? :-/
  nfsContainer: 'nfs-container',  // itemPath matches an entry and ends with slash
  file: 'file',                   // itemPath matches an entry and doesn't end with slash
  fakeContainer: 'fake-container', // itemPath doesn't match a key (default is we fake attributes of a container)
  notValid: 'not-found'
}

/**
 * Base class for SAFE root containers
 *
 * Defaults are set for _public
 */
class SafeContainer {
  /**
   * @param {Object} safeJs  SafenetworkApi (owner)
   * @param {String} containerName the name of a SAFE root container (_public, _publicNames etc)
   */
  constructor (safeJs, containerName) {
    this._safeJs = safeJs       // SafenetworkJs instance
    this._name = containerName
  }

  /**
   * Initialise by accessing the container MutableData
   * @return {Promise} the MutableData for this container
   */
  async initialise () {
    if (containerClasses[this._name] !== PublicContainer) {
      throw new Error('Invalid PublicContainer name:' + this._name)
    }

    return this._safeJs.auth.getContainer(this._name).then((mData) => {
      this._mData = mData
    }).catch((error) => {
      let msg = 'PublicContainer initialise failed to get container: ' + this._name + ' (' + error.message + ')'
      debug(msg + '\n' + error.stack)
      throw new Error(msg)
    })
  }

  isRootContainer () { return true }
  isPublic () { return true }
  isSelf (itemPath) { return this._name.indexOf(itemPath.substr(1)) === 0 }

  async updateMetadata () {
    try {
      this._metadata = {
        size: 1024 * 1024,  // TODO get from SAFE contants?
        version: await this._mData.getVersion()
      }
      return this._metadata
    } catch (e) { debug(e.message) }
  }

  async nfs () {
    try {
      if (!this._nfs) this._nfs = await this._mData.emulateAs('NFS')
      return this._nfs
    } catch (e) {
      debug(e.message)
      throw e
    }
  }

  async getEntryValue (key) {
    try {
      return await this._safeJs.getMutableDataValue(this._mData, key)
    } catch (e) { debug(e.message) }
  }

  async getEntryAsFile (key) {
    try {
      let value = await this.getEntryValue(key)
      return this.nfs().fetch(value)
    } catch (e) { debug(e.message) }
  }

  async getEntryAsNfsContainer (key) {
    try {
      let value = await this.getEntryValue(key)
      return this._safeJs.getNfsContainer(value, false, this.isPublic(), this)
    } catch (e) { debug(e.message) }
  }

  async createNfsFolder (folderPath) {
    debug('createNfsFolder(%s)', folderPath)
  }

  async insertNfsFolder (nfsFolder) {

  }

  async listFolder (folderPath) {
    debug('listFolder(%s)', folderPath)
    // In some cases the name of the container appears at the start
    // of the key (e.g. '/_public/happybeing/root-www').
    // In other such as an NFS container it is just the file name
    // or possibly a path which could container directory separators
    // such as 'index.html' or 'images/profile-picture.png'
    // So we strip the container name if present in each case,
    // first from folderPath
    let folderMatch = folderPath
    if (this.isRootContainer()) {
      if (folderPath.indexOf('/' + this._name) === 0) folderMatch = folderPath.substr(this._name.length + 1)
    }

    let listing = []
    try {
      // TODO remove debug calls (and comment out the value parts until moved elsewhere)
      let entries = await this._mData.getEntries()
      await entries.forEach(async (k, v) => {
        let plainValue = v.buf
        try { plainValue = await this._mData.decrypt(v.buf) } catch (e) { debug('Value decryption ERROR: %s', e) }

        let enc = new TextDecoder()
        let plainKey = enc.decode(new Uint8Array(k))
        if (plainKey !== k.toString())
          debug('Key (encrypted): ', k.toString())

        if (plainKey[0] !== path.sep) plainKey = path.sep + plainKey
        debug('Key            : ', plainKey)

        plainValue = enc.decode(new Uint8Array(plainValue))
        if (plainValue !== v.buf.toString())
          debug('Value (encrypted): ', v.buf.toString())

        debug('Value            :', plainValue)

        debug('Version: ', v.version)

        let itemMatch = plainKey
        if (this.isRootContainer()) {
          // Strip the container name from the front of the item and the folder path
          if (itemMatch.indexOf('/' + this._name) === 0) itemMatch = itemMatch.substr(this._name.length + 1)
        }

        debug('folderPath: %s, folderMatch: %s', folderPath, folderMatch)
        debug('plainKey: %s \nitemMatch: %s', plainKey, itemMatch)

        // Check it the folderMatch contains the itemMatch
        if (itemMatch.indexOf(folderMatch) === 0) {
          // Item is the first part of the path after the folder (plus a '/')
          let item = itemMatch.substr(folderMatch.length + 1).split(path.sep)[0]
          if (item && item.length && listing.indexOf(item) === -1) {
            debug('push(\'%s\')', item)
            listing.push(item)
          }
        }
      }).catch((e) => { debug(e.message) })
    } catch (e) {
      debug(e.message)
    }
    debug('listing: %o', listing)
    return listing
  }

  async itemInfo (itemPath) {
    debug('itemInfo(%s)', itemPath)
    if (this.isSelf(itemPath)) {
      return this._safeJs.mutableDataStats(this._mData)
    } else {
      return this._safeJs.mutableDataStats(this._mData) // TODO replace with info for the entry
    }
  }

  /**
   * Get the type of the entry as one of containerTypes values
   *
   * @param  {String} itemPath A partial or full key within the container Mutable Data
   * @return {String}          A containerTypes value
   */

  async itemType (itemPath) {
    let type = containerTypes.nfsContainer
    let value = await this.getEntryValue(itemPath)
    if (value) {
      type = (itemPath.substr(-1) === '/' ? containerTypes.nfsContainer : containerTypes.file)
    } else if (this.isSelf(itemPath)) {
      type = containerTypes.self
    } else if (this.itemMatchesKeyPath(itemPath)) {
      type = containerTypes.fakeContainer
    } else {
      let msg = 'file does not exist'
      debug(msg)
    }
    return type
  }

  // Check if itemPath is a valid part of the path of any key
  // TODO this is probably horribly inefficient
  async itemMatchesKeyPath (itemPath) {
    debug('itemMatchesKeyPath(%s)', itemPath)

    if (this.isRootContainer()) {
      // If present, strip the container name from the front of the itemPath ready to match entry keys below
      if (itemPath.indexOf('/' + this._name) === 0) itemPath = itemPath.substr(this._name.length + 1)
    }
    debug('Matching path: ', itemPath)

    let matched = false
    let entries = await this._mData.getEntries()
    await entries.forEach(async (k, v) => {
      if (matched) return true

      let enc = new TextDecoder()
      let plainKey = enc.decode(new Uint8Array(k))
      if (plainKey !== k.toString())
        debug('Key (encrypted): ', k.toString())

      if (plainKey[0] !== path.sep) plainKey = path.sep + plainKey
      debug('Key            : ', plainKey)

      let itemMatch = plainKey
      if (this.isRootContainer()) {
        // If present, strip the container name from the front of the key (as already done for itemPath)
        if (itemMatch.indexOf('/' + this._name) === 0) itemMatch = itemMatch.substr(this._name.length + 1)
      }
      debug('Matching against: ', itemMatch)

      if (itemMatch.indexOf(itemPath) === 0 && itemMatch.substr(itemPath.length, 1) === '/') {
        debug('MATCHED: ', plainKey)
        matched = true
      }
    }).catch((e) => { debug(e.message) })

    if (!matched) debug('NO MATCH')

    return matched
  }

  async itemAttributes (itemPath) {
    debug('itemAttributes(%s)', itemPath)
    const now = Date.now()
    try {
      if (this.isSelf(itemPath)) {
        debug('%s is type: %s', itemPath, containerTypes.self)
        return {
          // TODO improve this if SAFE accounts ever have suitable values for size etc:
          modified: now,
          accessed: now,
          created: now,
          size: 0,
          version: -1,
          'isFile': false,
          entryType: containerTypes.self
        }
      }

      let type = await this.itemType(itemPath)
      if (type === containerTypes.file) {
        debug('%s is type: %s', itemPath, containerTypes[type])
        let file = await this.getEntryAsFile(itemPath)
        return {
          modified: file.modified,
          accessed: now,
          created: file.created,
          size: file.size,
          version: file.version,
          'isFile': true,
          entryType: type
        }
      } else {
        debug('%s is type: %s', itemPath, containerTypes[type])
        // Default values (used as is for containerTypes.nfsContainer)
        let attributes = {
          modified: now,
          accessed: now,
          created: now,
          size: 0,
          version: -1,
          'isFile': false,
          entryType: type
        }

        if (type === containerTypes.self || type === containerTypes.nfsContainer) {
          let container = this
          if (type !== containerTypes.self) {
            container = await this.getEntryAsNfsContainer(itemPath)
          }
          await container.updateMetadata()
          attributes.size = container.size
          attributes.version = container.version
        }
        return attributes
      }
    } catch (e) {
      debug(e.message)
    }
  }

  /**
   * Get the MutableData entry for entryKey
   * @param  {String}         entryKey
   * @return {Promise}        resolves to ValueVersion
   */
  async getEntry (entryKey) {
    // TODO
  }
}

/**
 * Wrapper for _public (SAFE root container)
 *
 * @extends SafeContainer
 */
class PublicContainer extends SafeContainer {
  /**
   * @param {Object} safeJs  SafenetworkApi (owner)
   */
  constructor (safeJs, containerName) {
    super(safeJs, '_public')
  }
}

/**
 * Wrapper for private root container such as '_documents', '_music'
 *
 * TODO implement support for private containers (_documents, _music etc)
 * TODO implement support for application own container
 */
class PrivateContainer extends SafeContainer {
  /**
   * @param {Object} safeJs  SafenetworkApi (owner)
   * @param {String} containerName Name of a private root container such as '_documents'
   */
  constructor (safeJs, containerName) {
    super(safeJs, containerName)
    if (containerClasses[containerName] !== PrivateContainer) {
      throw new Error('Invalid PrivateContainer name:' + containerName)
    }
  }

  isPublic () { return false }
}

/* TODO not sure if this is best as 'extends' or a stand-alone class
class PublicNamesContainer {
  constructor (safeJs) {
    super(safeJs, '_publicNames')
    if (containerClasses[this._name] !== PublicNamesContainer) {
      throw new Error('Invalid PublicNamesContainer name:' + containerName)
    }
  }
}
*/

/**
 * Wrapper for MutableData services container (for a public name)
 */
// TODO extends SafeContainer or something else?
class ServicesContainer extends SafeContainer {
  /**
   * @param {Object} safeJs  SafenetworkApi (owner)
   * @param {String} publicName public name for which this holds services
   */
  constructor (safeJs, publicName) {
    throw new Error('ServicesContainer not yet implemented')
  }

  isRootContainer () { return false }

  /**
   * Initialise by accessing services MutableData for a public name
   * @return {Promise}
   */
  async initialiseExisting () {
    this._mData = undefined // TODO
  }

  // TODO add methods to access existing service entries (e.g. enumerate, get by name)
}

/**
 * Wrapper for 'NFS' emulation MutableData
 *
 * TODO NfsContainer - implement private MD (currently only creates public MDs)
 */

// NOTES:
// The method for creating public SAFE NFS containers is not currently
// documented by MaidSafe and is instead defined by the Web Hosting Manager
// example, here:
//   https://github.com/maidsafe/safe_examples/blob/master/web_hosting_manager/app/safenet_comm/api.js#L150
//
// In summary, when the Web Hosting Manager creates an NFS container for a www
// service it uses newRandomPublic(CONSTANTS.TYPE_TAG.WWW) to create the MutableData
// container, uses quickSetup to apply metadata as:
//   const metaName = `Service Root Directory for: serviceName.publicName`;
//   const metaDesc = `Has the files hosted for the service: serviceName.publicName`;
//   await servFolder.quickSetup({}, metaName, metaDesc);
// It then inserts an entry into the _public container with
//   key:   service path, such as 'somefolder/lastfolder' (default for www service is '<public-name>/www-root')
//   value: the XoR-name/address on the network (as a Buffer from from getNameAndTag())

// TODO extends SafeContainer or something else?
class NfsContainer extends SafeContainer {
  /**
   * [constructor description]
   * @param {SafenetworkJs} safeJs  SafenetworkJS API object
   * @param {String} nameOrKey  MD name, or if a parent container is given, the key of the MD entry containing the name
   * @param {Object} parent (optional) typically a SafeContainer (ServiceContainer?) but if parent is not defined, nameOrKey must be an XOR address
   * @param {Boolean} isPublic  (defaults to true) used only when creating an MD
   */
  constructor (safeJs, nameOrKey, parent, isPublic) {
    super(safeJs, nameOrKey)
    if (parent) {
      this._parent = parent
      this._entryKey = nameOrKey
    } else {
      this._parent = undefined
      this._mdName = nameOrKey
      this._isPublic = isPublic
      this._tagType = safeJs.SN_TAGTYPE_NFS
    }
  }

  isRootContainer () { return false }
  isPublic () { return this._isPublic }

  /**
   * Initialise by accessing existing MutableData compatible with NFS emulation
   * @return {Promise}
   */
  async initialiseExisting () {
    if (!this._parent) {
      throw new Error('TODO add support for XOR nameOrKey to NfsContainer')
    }

    try {
      if (this._parent) {
        let valueVersion = await this._parent.getEntry(this._entryKey)
        this._mdName = valueVersion.value
      }

      this._mData = await this._safeJs.mutableData().newPublic(this._mdName, this._tagType)
    } catch (err) {
      let info = (this._parent ? this._parent.name + '/' + this._entryKey : this._mdName)
      debug('NfsContainer failed to init existing MD for ' + info)
      debug(err.message)
    }
  }

  /**
   * create an NFS MutableData and insert into a parent container if present
   * @param  {String} ownerName (optional) if provided, usually the public name on which this folder is used
   * @param  {Boolean} isPublic (optional) if present overrides constructor
   * @return {Promise}          a newly created {MutableData}
   */
  async createNew (ownerName, isPublic) {
    if (!ownerName) ownerName = ''
    if (!isPublic) isPublic = this._isPublic
    let containerName = (this._parent ? this._parent._name : '')
    return this._safeJs.createNfsContainerMd(containerName, ownerName, this._mdName, this._tagType, !isPublic)
  }

  /**
   * create a general purpose NFS container in _public
   * @param  {Number}  tagType         (optional) SAFE MutableData tagType
   * @param  {String}  metaName        (optional) metadata describing what this is for
   * @param  {String}  metaDescription (optional) metadata explaining what this contains
   * @return {Promise}                 ???
   */
  // TODO create a general purpose NFS container in _public
  async createPublicFolder (tagType, metaName, metaDescription) {
    throw new Error('createPublicFolder() not yet implemented')
    // if (!tagType) tagType = ???
    // if (!metaName) metaName = ???
    // if (!metaDescription) metaDescription = ???

    // TODO
  }

  /**
   * create an NFS container in _public for a SAFE service
   * @param  {number}  tagType     (optional) SAFE MutableData tagType (defaults to www)
   * @param  {String}  servicePath (optional) Defaults to <public-name>@www
   * @param  {String}  metaFor     will be of `serviceName.publicName` format
   * @return {Promise}             ???
   */
  // When to use the container classes, SafenetworkApi or ServicesInterface classes?
  //
  // The SafeContainer, ServicesContainer, NfsContainer etc classes provide
  // a simple API to manage the main SAFE API types and their containers, while
  // the classes and methods which they rely on (including methods on SafenetworkApi
  // and the ServiceInteface class) provide greater control and additional
  // functionality such as SAFE services accessible via fetch() in web
  // applications, and possibly also on desktop. For example, a web library which
  // uses fetch() to access RESTful web services could be used without
  // modification along with SafenetworkJs to access those services on
  // SAFE Network, if implemented using a custom ServiceInterface (cf. SafeServiceLDP)
  //
  // So if you just want to access and create standard SAFE containers and
  // data types such as public names or share public files and websites,
  // the container classes are intended to do everything you might need.
  // You can still dip into the other methods where needed.

  // TODO create an NFS container in _public for a SAFE service
  // TODO modify this to use the service classes and service configs rather than have duplicate code
  // TODO I think servicePath might change - check status with Gabriel re my proposals
  // TODO here: https://forum.safedev.org/t/proposals-for-restful-service-handling/1550
  // TODO Gabriel had some responses/alternatives which I liked but can't find those.
  async createServiceFolder (tagType, servicePath, metaFor) {
    throw new Error('createServiceFolder() not yet implemented')
    // if (!tagType) tagType = safeApi.CONSTANTS.TYPE_TAG.WWW
    // if (!metaName) metaName = `Service Root Directory for: ${metaFor}`
    // if (!metaDescription) metaDescription = `Has the files hosted for the service: ${metaFor}`

    // TODO implement - see TO DO notes above
  }
}

// Map of SAFE root container name to wrapper class
const containerClasses = {
  '_public': PublicContainer,
  '_documents': PrivateContainer,
  '_photos': PrivateContainer,
  '_music': PrivateContainer,
  '_video': PrivateContainer
// TODO  '_publicNames': PublicNamesContainer
}

module.exports.rootContainerNames = rootContainerNames
module.exports.containerTypes = containerTypes
module.exports.containerClasses = containerClasses
module.exports.PublicContainer = PublicContainer
module.exports.NfsContainer = NfsContainer
