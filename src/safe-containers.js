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
const u = require('./safenetwork-utils')
const SafeJs = require('./safenetwork-api')
const NfsContainerFiles = require('./nfs-files').NfsContainerFiles

// TODO remove this
const fakeReadDir = {
  '/': ['_public', 'two', 'three'],
  '/_public': ['four', 'five', 'happybeing']
}

const defaultContainerNames = [
  '_public',
  '_documents',
  '_music',
  '_video',
  '_photos',
  '_publicNames'
]

const containerTypeCodes = {
  defaultContainer: 'default-container',  // SAFE default container (e.g. _public, _publicNames etc)
  nfsContainer: 'nfs-container',    // an NFS container, or if in a default container an entry that ends with slash
  file: 'file',                     // an entry that doesn't end with slash
  fakeContainer: 'fake-container',  // a path ending with '/' that matches part of an entry (default is we fake attributes of a container)
  servicesContainer: 'services-container',  // Services container for a public name
  service: 'service',               // Services container for a public name
  notFound: 'not-found',
  notValid: 'not-valid'
}

/**
 * A cache used by the filesystem (FS) interface methods of SafeContainer
 *
 * More than just a cache, this tracks the parent child entries which
 * means that when a container is accessed via the cache it is gauranteed
 * to be up to date (e.g. if the entry in the parent has changed).
 *
 * A container is invalid if it has a different version from its entry in its
 * parent container.
 *
 * On access, an invalid container will be re-validated and any child containers
 * present in the cache will be removed. So a container returned from the
 * cache will always be valid.
 *
 * The cache and FS interface work with standard SAFE containers and with
 * stand-alone containers (created from an XOR address) so long as they
 * are ALWAYS created with a unique containerPath, i.e. its place in the
 * heirarchy, because the containerPath is used to index the container
 * in the ContainerMap.
 *
 * Implementation
 * --------------
 * The cache is a simple map of containerPath to container object.
 *
 */
class ContainerMap {
  constructor () {
    this._map = []
  }

  put (containerPath, container) {
    this._map[containerPath] = container
  }

  async get (containerPath) {
    let container
    try {
      container = this._map[containerPath]
      if (container && container._parent) {
        container.initialise()  // Checks container._entryValueVersion valid, if not will update
      }
    } catch (e) {
      this._map[containerPath] = undefined
      container = undefined
      debug(e.message)
    }
    return container
  }
}

const containerMap = new ContainerMap()

/**
 * Base class for SAFE containers
 *
 * Defaults are set for _public
 */
class SafeContainer {
  /**
   * A template class for creating and managing SAFE containers, each a wrapper for a mutable data
   *
   * The container classes provide simplified APIs for accessing mutable
   * data, including a filesystem (FS) style interface for the standard
   * SAFE container types.
   *
   * SafeContainer is a template which is extended to create classes
   * which handle the SAFE default containers (_public, _publicNames),
   * services containers, and NFS containers.
   *
   * You can also access 'stand-alone containers' via an XOR address (see below)
   *
   * All instantiated containers are held within the containerMap which
   * gaurantees any returned container is valid (e.g. that if it has
   * a parent container, the parent entry has not changed).
   *
   * Stand-alone Containers
   * ----------------------
   * A stand-alone container is not a default container *and* has no parent
   * container.
   *
   * If you wish to use the file system (FS) interface with a stand-alone
   * container you MUST provide a containerPath on creation, and this
   * must end with the XOR address of the container being created. For
   * example: '/mds/<xor-name>'. You can then use the FS
   * interface as implemented in these classes or derive your own
   * class to override those operations.
   *
   * @param {Object} safeJs  SafenetworkApi (owner)
   * @param {String} containerName the name of the container (e.g. '_public') or an XOR address if tagType is defined
   * @param {String} containerPath     where this container appears in the SAFE container tree (e.g. '/_public', '/mds')
   * @param {String} subTree       [optional] undefined or '' to mount the whole container, or a sub-tree of the container being 'mounted'
   * @param {String} parent        [optional] parent container
   * @param {String} parentEntryKey [optional] key for this container's entry within parent container
   * @param {Number} tagType       [optional] mutable data tag_type (required when containerName is an XOR address)
   *
   * NOTE: The terms 'mount' and 'mounted' are used loosely, to indicate the
   *       effect rather than a filesystem style mount.
   */
  constructor (safeJs, containerName, containerPath, subTree, parent, parentEntryKey, tagType) {
    this._safeJs = safeJs       // SafenetworkJs instance
    this._name = containerName
    this._containerPath = containerPath + (u.isFolder(containerPath, '/') ? '' : '/')
    if (!subTree) subTree = ''
    this._subTree = subTree + (subTree.length && !u.isFolder(subTree, '/') ? '/' : '')
    this._parent = (parent === undefined ? undefined : parent)
    this._parentEntryKey = (parentEntryKey === undefined ? undefined : parentEntryKey)
    this._tagType = (tagType === undefined ? undefined : tagType)
  }

  /**
   * Initialise by accessing a SAFE container or existing MutableData on the network
   *
   * Also called by ContainerMap to validate existing child container up
   * to date with its entry in a parent
   *
   * See also create()
   *
   * @return {Promise} the MutableData for this container
   */
  async initialise () {
    try {
      if (this._mData) return this._mData

      if (this.isDefaultContainer()) {
        // TODO check we have th desired permissions and if not request them
        this._mData = await this._safeJs.auth.getContainer(this._name)
      } else if (this._parent && this._parentEntryKey) {
        // Get xor address from parent entry
        let valueVersion = await this._parent.getValueVersion(this._parentEntryKey)
        if (!this._entryValueVersion || this._entryValueVersion.version !== valueVersion.version) {
          // Invalidated or not yet initialised
          this._mData = await this._initialiseFromXorName(valueVersion.buf)
          if (this._mData) this._entryValueVersion = valueVersion
        }
      } else {
        this._mData = await this._initialiseFromXorName(this._name, this._tagType)
      }

      if (this._mData) await this.initialiseNfs()

      // Add to FS cache if it has a containerPath
      if (this._containerPath !== '') containerMap.put(this._containerPath, this)
    } catch (error) {
      let msg = 'SafeContainer initialise failed: ' + this._name + ' (' + error.message + ')'
      debug(msg + '\n' + error.stack)
      throw new Error(msg)
    }
  }

  async _initialiseFromXorName (xorName, tagType) {
    if (tagType === undefined) tagType = this._tagType
    try {
      if (tagType === undefined) throw new Error(this.constructor.name + '._initialiseFromXorName() - tagType not defined')
      return this._safeJs.getMdFromHash(xorName, tagType)
    } catch (e) { debug(e.message) }
  }

  create () {
    // Template only - should be implemented in extender
    // class (i.e. NfsContainer, ServicesContainer etc) to
    // ensure any parent is updated correctly
    throw new Error(this.constructor.name + '.create() - TODO (not yet implemented in extener class)')
  }

  // SafeContainer assumes it is a default container, so override this in non-default container classes
  isDefaultContainer () {
    // Catch call on non-default container due to lack of override:
    if (this._parent) throw new Error(this.constructor.name + '.isDefaultContainer() - TODO (not yet implemented in extener class)')

    return true
  }

  isPublic () { return true }
  isSelf (itemPath) { return itemPath === '' }  // Empty path is equivalent to '.'

  // TODO implement isValidKey() here for default folders, and override in other containers where needed
  isValidKey (key) { return true }          // Containers should sanity check keys in case of corruption
                                            // but still cope with a valid key that has an invalid value
  isHiddenEntry (key) {
    return key === '_metadata' || // Containers for which this is not hidden should override
           !this.isValidKey(key)
  }

  encryptKeys () { return this._encryptKeys === true }
  encryptValues () { return this._encryptValues === true }

  async initialiseNfs () {} // Override in classes which support NFS

  async updateMetadata () {
    try {
      this._metadata = {
        size: 1024 * 1024,  // TODO get from SAFE contants?
        version: await this._mData.getVersion()
      }
      return this._metadata
    } catch (e) { debug(e.message) }
  }

  async getValueVersion (key) {
    try {
      return this._safeJs.getMutableDataValueVersion(this._mData, key)
    } catch (e) {
      debug(e.message)
      throw e
    }
  }

  async getEntryValue (key) {
    try {
      let valueVersion = await this._safeJs.getMutableDataValueVersion(this._mData, key)
      return (valueVersion ? valueVersion.buf : undefined)
    } catch (e) {
      debug('%s.getEntryValue(%s) failed', this.constructor.name, key)
      throw e
    }
  }

  /**
   * Get the MutableData entry for entryKey
   * @param  {String}         entryKey
   * @return {Promise}        resolves to ValueVersion
   */
  async getEntry (entryKey) {
    // TODO uses this._mData rather than NFS emulation with this.nfs()
  }

  async getEntryAsFile (key) {
    try {
      return this.nfs().fetch(key)
    } catch (e) { debug(e.message) }
  }

  async getEntryAsNfsContainer (key) {
    // TODO review value of getEntryAsNfsContainer and use of safeJs.getNfsContainer rather than new NfsContainer
    try {
      let value = await this.getEntryValue(key)
      return this._safeJs.getNfsContainer(value, false, this.isPublic(), this)
    } catch (e) { debug(e.message) }
  }

  async createNfsFolder (folderPath) {
    debug('TODO createNfsFolder(\'%s\')', folderPath)
  }

  async insertNfsFolder (nfsFolder) {
    debug('TODO insertNfsFolder(\'%s\')', nfsFolder)
  }

  // TODO add further helper methods to the above

  // File System Interface
  // =====================
  //
  // The following methods provide a simplified FS interface as
  // a way to access and manipulate containers. You can always
  // get the mutable data of a container and use that directly
  // instead or as well as this interface.
  //
  // Any app can interact with a SAFE through this FS style
  // interface, not just for access to storage but also
  // features such as public names and SAFE services using
  // the corresponding container classes.
  //
  // This interface assumes a heirarchy of containers as follows:
  //    /<default-container>
  //                    \--<NFS-container>
  //                    \--<NFS-container>
  //                              :
  //                    \--<NFS-container>
  //    Where:
  //          <default-container> is a default container for files
  //          such as _public, _music etc
  //          <NFS-container> is a mutable data used to store files
  //          using the SAFE API emulate as 'NFS' feature.
  //
  //    /_publicNames
  //                  \--<services-container>
  //                                        \--<service-value>
  //                                        \--<service-value>
  //                                                  :
  //                                        \--<service-value>
  //
  //    Where:
  //          <services-container> is used to store services on a public name
  //          <service-value> depends on the service (e.g. for www it will be
  //          an <NFS-container>)
  //
  // The safenetwork-fuse app uses this interface to provide a
  // virtual SAFE file system which can be mounted locally but maintains
  // an independent heirarchy which allows any container to be
  // mounted at an arbitrary path, whereas the above heirarchy is
  // fixed.
  //
  // TODO consider supporting stand-alone containers for arbitrary mutable data as follows:
  //    /_mutabledata
  //                \--<md-container>
  //                \--<md-container>
  //                          :
  //                \--<md-container>
  // Adding a container holder class for /_mutabledata will allow
  // the use of the MutableDataContainer class to hold a list of
  // MutableDataContainers of arbitrary type. This is intended only
  // for *STAND-ALONE* mutable data (i.e. where they are not linked
  // together). For linked mutable data (as in the heirarchy) new
  // classes should be used to ensure that the cache map is able
  // to automatically update the MD of a child if it changes in
  // the parent.

  /**
   * Internal helpers - the implementations here are templates which
   * should be overriden in each container class.
   **/

  /**
   * Get portion of the key to use as a relative path within this container
   *
   * @param  {String}  itemPath full path to the item (not just relative to this container's 'root')
   * @return {String}           the part of itemPath that lies within this container's 'mount', or undefined
   */
  _getKeyPartOf (itemPath) {
    let key
    if (itemPath.indexOf(this._containerPath) === 0) key = itemPath.substring(this._containerPath.length)
    return key
  }

  /**
   * Create a container object of the appropriate class to wrap an MD pointed to an entry in this (parent) container
   *
   * @param  {String}  key a string matching a mutable data entry in this (parent) container
   * @return {Promise}     a suitable SAFE container for the entry value (mutable data)
   */
  async _createChildContainerForEntry (key) {
    let msg = '_createChildContainerForEntry() should be overridden in extending class: ' + this.constructor.name
    debug(msg)
    throw new Error(msg)
  }

  async _getContainerForKey (key) {
    debug('%s._getContainerForKey(\'%s\')', this.constructor.name, key)

    let container
    try {
      container = await containerMap.get(key)
      if (!container) {
        container = await this._createChildContainerForEntry(key)
        if (container) {
          containerMap.put(key, container)
          await container.initialise()
        }
      }
    } catch (error) { debug(error.message) }

    return container
  }

  // FS implementations

  // These methods operate on the data held in a mutable data container class
  // so long as the path lies within the container itself. If the path is
  // longer, and refers to data held by a child, the child will be called
  // to perform the operation after stripping the part of the path
  // relating to the parent. So folderPath is always relative to the
  // current container.
  //

  /**
   * Return a copy of Mutable Data Entry with additional decoded members: plainKey and plainValue
   *
   * This implementation attempts to decrypt keys and entries.
   *
   * Child classes can implement a simpler version that always or never decrypts, as needed
   *
   * @param  {Object}  entry   An entry object, such as those returned by MutableData.listEntries()
   * @param  {Object}  options [optional] when omitted, decode key and value, otherwise depends on properties of decodeKey and decodeValue
   * @return {Promise}         [description]
   */
  // TODO delete this safe-node-app v0.8.1 version:
  async _decodeEntry081 (key, val, options) {
    let entry = {'key': key, 'value': val}
    return this._decodeEntry(entry, options)
  }

  async _decodeEntry (entry, options) {
    let decodedEntry = entry
    try {
      let enc = new TextDecoder()

      if (!options || options.decodeKey) {
        let plainKey = entry.key
        try { plainKey = await this._mData.decrypt(plainKey) } catch (e) { console.log('Key decryption ERROR: %s', e) }
        plainKey = enc.decode(new Uint8Array(plainKey))
        if (plainKey !== entry.key.toString())
          debug('Key (encrypted): ', entry.key.toString())
        debug('Key            : ', plainKey)
        decodedEntry.plainKey = plainKey
      }

      if (!options || options.decodeValue) {
        let plainValue = entry.value.buf
        try { plainValue = await this._mData.decrypt(plainValue) } catch (e) { debug('Value decryption ERROR: %s', e) }
        plainValue = enc.decode(new Uint8Array(plainValue))
        if (plainValue !== entry.value.buf.toString())
          debug('Value (encrypted): ', entry.value.buf.toString())
        debug('Value            :', plainValue)

        debug('Version: ', entry.value.version)
        decodedEntry.plainValue = plainValue
      }

      return decodedEntry
    } catch (e) { debug(e) }
  }

  /**
   * get a list of folders
   *
   * @param  {String}  folderPath path relative to this._containerPath
   * @return {Promise}            list of sub-folder names at folderPath
   */

  // Simulate safe-node-app v0.9.1 function:
  async _listEntriesHack (entries) {
    let entriesList = []
    try {
      await entries.forEach((key, val) => {
        entriesList.push({'key': key, 'value': val})
      })
    } catch (e) { debug(e) }
    debug('entriesList: %O', entriesList)
    return entriesList
  }

  async listFolder (folderPath) {
    debug('%s.listFolder(\'%s\')', this.constructor.name, folderPath)

    let listing = []
    try {
      // TODO remove debug calls (and comment out the value parts until moved elsewhere)
      // TODO if a defaultContainer check cache against sub-paths of folderPath (longest first)
      // Only need to check container entries if that fails

      // In some cases the name of the container appears at the start
      // of the key (e.g. '/_public/happybeing/root-www').
      // In other such as an NFS container it is just the file name
      // or possibly a path which could container directory separators
      // such as 'index.html' or 'images/profile-picture.png'

      // We add this._subTree to the front of the path
      let folderMatch = this._subTree + folderPath

      // For matching we ignore a trailing '/' so remove if present
      folderMatch = (u.isFolder(folderMatch, '/') ? folderMatch.substring(0, folderMatch.length - 1) : folderMatch)

      let listingQ = []
      let entries = await this._mData.getEntries()
      // TODO revert to safe-node-app v0.9.1 code:
      // let entriesList = await entries.listEntries()
      // TODO remove safe-node-app v0.8.1 code:
      let entriesList = await this._listEntriesHack(entries)
      entriesList.forEach(async (entry) => {
        listingQ.push(new Promise(async (resolve, reject) => {
          let decodedEntry = await this._decodeEntry(entry)
          let plainKey = decodedEntry.plainKey

        // For matching we ignore a trailing '/' so remove if present
          let matchKey = (u.isFolder(plainKey, '/') ? plainKey.substring(0, plainKey.length - 1) : plainKey)
          debug('Match Key      : ', matchKey)
          debug('Folder Match   : ', folderMatch)
          // Some containers don't list all entries (e.g. if they holdd metadata)
          if (this.isHiddenEntry(plainKey)) {
            resolve()
            return // Skip this one
          }

          if (folderMatch === '') { // Check if the folderMatch is root of the key
            // Item is the first part of the path
            let item = plainKey.split('/')[0]
            if (item && item.length && listing.indexOf(item) === -1) {
              debug('listing-1.push(\'%s\')', item)
              listing.push(item)
            }
          } else if (plainKey.indexOf(folderMatch) === 0 && plainKey.length > folderMatch.length) {
            // As the folderMatch is at the start of the key, and *shorter*,
            // item is the first part of the path after the folder (plus a '/')
            let item = plainKey.substring(folderMatch.length).split('/')[1]
            if (item && item.length && listing.indexOf(item) === -1) {
              debug('listing-2.push(\'%s\')', item)
              listing.push(item)
            }
          } else if (folderMatch.indexOf(plainKey) === 0) {
            // We've matched the key of a child container, so pass to child
            let matchedChild = await this._getContainerForKey(plainKey)
            let subFolder = folderMatch.substring(plainKey.length)
            if (subFolder[0] === '/') subFolder = subFolder.substring(1)
            let childList = await matchedChild.listFolder(subFolder)
            listing = listing.concat(childList)
            debug('%s.listing-3: %o', constructor.name, listing)
          }
          resolve() // Resolve the entry's promise
        }).catch((e) => debug(e.message)))
      })
      await Promise.all(listingQ).catch((e) => debug(e.message))
      debug('%s.listing-4-END: %o', constructor.name, listing)
      return listing
    } catch (e) {
      debug(e.message)
      debug('ERROR %s.listFolder(\'%s\') failed')
    }

    debug('%s.listing-5-END: %o', constructor.name, listing)
    return listing
  }

  async listFolder_FIRSTATTEMPT (folderPath) {
    debug('%s.listFolder(\'%s\')', this.constructor.name, folderPath)

    let listing = []
    try {
      // TODO remove debug calls (and comment out the value parts until moved elsewhere)
      // TODO if a defaultContainer check cache against sub-paths of folderPath (longest first)
      // Only need to check container entries if that fails

      // In some cases the name of the container appears at the start
      // of the key (e.g. '/_public/happybeing/root-www').
      // In other such as an NFS container it is just the file name
      // or possibly a path which could container directory separators
      // such as 'index.html' or 'images/profile-picture.png'

      // We add this._subTree to the front of the path
      let folderMatch = this._subTree + folderPath

      // For matching we ignore a trailing '/' so remove if present
      folderMatch = (u.isFolder(folderMatch, '/') ? folderMatch.substring(0, folderMatch.length - 1) : folderMatch)

      // TODO remove safe-node-app v0.8.1 code:
      // TODO revert to safe-node-app v0.9.1 code:
      let listingQ = []
      // TODO remove safe-node-app v0.8.1 code:
      let entries = await this._mData.getEntries()
      entries.forEach(async (key, val) => {
        listingQ.push(new Promise(async (resolve, reject) => {
          let decodedEntry = await this._decodeEntry081(key, val)

      // TODO revert to safe-node-app v0.9.1 code:
      // let entries = await this._mData.getEntries()
      // let entriesList = await entries.listEntries()
      // entriesList.forEach(async (entry) => {
        // listingQ.push(new Promise(async (resolve, reject) => {
        //   let decodedEntry = await this._decodeEntry(entry)
          let plainKey = decodedEntry.plainKey

        // For matching we ignore a trailing '/' so remove if present
          let matchKey = (u.isFolder(plainKey, '/') ? plainKey.substring(0, plainKey.length - 1) : plainKey)
          debug('Match Key      : ', matchKey)
          debug('Folder Match   : ', folderMatch)
          // Some containers don't list all entries (e.g. if they holdd metadata)
          if (this.isHiddenEntry(plainKey)) {
            resolve()
            return // Skip this one
          }

          if (folderMatch === '') { // Check if the folderMatch is root of the key
            // Item is the first part of the path
            let item = plainKey.split('/')[0]
            if (item && item.length && listing.indexOf(item) === -1) {
              debug('listing-1.push(\'%s\')', item)
              listing.push(item)
            }
          } else if (plainKey.indexOf(folderMatch) === 0 && plainKey.length > folderMatch.length) {
            // As the folderMatch is at the start of the key, and *shorter*,
            // item is the first part of the path after the folder (plus a '/')
            let item = plainKey.substring(folderMatch.length).split('/')[1]
            if (item && item.length && listing.indexOf(item) === -1) {
              debug('listing-2.push(\'%s\')', item)
              listing.push(item)
            }
          } else if (folderMatch.indexOf(plainKey) === 0) {
            // We've matched the key of a child container, so pass to child
            let matchedChild = await this._getContainerForKey(plainKey)
            let subFolder = folderMatch.substring(plainKey.length)
            if (subFolder[0] === '/') subFolder = subFolder.substring(1)
            let childList = await matchedChild.listFolder(subFolder)
            listing = listing.concat(childList)
            debug('%s.listing-3: %o', constructor.name, listing)
          }
          resolve() // Resolve the entry's promise
        }).catch((e) => debug(e.message)))
      })
      await Promise.all(listingQ).catch((e) => debug(e.message))
      debug('%s.listing-4-END: %o', constructor.name, listing)
      return listing
    } catch (e) {
      debug(e.message)
      debug('ERROR %s.listFolder(\'%s\') failed')
    }

    debug('%s.listing-5-END: %o', constructor.name, listing)
    return listing
  }

  async callFunctionOnItem (itemPath, functionName, p2, p3, p4, p5) {
    debug('%s.callFunctionOnItem(%s, %s, %s, %s, %s, %s)', this.constructor.name, itemPath, functionName, p2, p3, p4, p5)

    let result
    try {
      // TODO if a defaultContainer check cache against sub-paths of folderPath (longest first)
      // Only need to check container entries if that fails

      // In some cases the name of the container appears at the start
      // of the key (e.g. '/_public/happybeing/root-www').
      // In other such as an NFS container it is just the file name
      // or possibly a path which could container directory separators
      // such as 'index.html' or 'images/profile-picture.png'

      // For matching we ignore a trailing '/' so remove if present
      let itemMatch = (u.isFolder(itemPath, '/') ? itemPath.substring(0, itemPath.length - 1) : itemPath)

      // We add this._subTree to the front of the path
      itemMatch = this._subTree + itemMatch

// ???      return new Promise(async (resolve, reject) => {
      // TODO remove debug calls (and comment out the value parts until moved elsewhere)
      let entries = await this._mData.getEntries()
      // TODO revert to safe-node-app v0.9.1 code:
      // let entriesList = await entries.listEntries()
      // TODO remove safe-node-app v0.8.1 code:
      let entriesList = await this._listEntriesHack(entries)
      let entryQ = []
      entriesList.forEach(async (entry) => {
        entryQ.push(new Promise(async (resolve, reject) => {
          if (!result) {
            let decodedEntry = await this._decodeEntry(entry)
            let plainKey = decodedEntry.plainKey

            // let plainValue = entry.value.buf
            // try { plainValue = await this._mData.decrypt(entry.value.buf) } catch (e) { debug('Value decryption ERROR: %s', e) }
            //
            // let enc = new TextDecoder()
            // let plainKey = enc.decode(new Uint8Array(entry.key))
            // if (plainKey !== entry.key.toString())
            //   debug('Key (encrypted): ', entry.key.toString())

            // For matching we ignore a trailing '/' so remove if present
            let matchKey = (u.isFolder(plainKey, '/') ? plainKey.substring(0, plainKey.length - 1) : plainKey)
            debug('Key            : ', plainKey)
            debug('Match Key      : ', matchKey)

            // plainValue = enc.decode(new Uint8Array(plainValue))
            // if (plainValue !== entry.value.buf.toString())
            //   debug('Value (encrypted): ', entry.value.buf.toString())
            //
            // debug('Value            :', plainValue)
            //
            // debug('Version: ', entry.value.version)

            if (!this.isHiddenEntry(plainKey)) {
              // Check it the itemMatch is at the start of the key, and *shorter*
              if (plainKey.indexOf(itemMatch) === 0 && plainKey.length > itemMatch.length) {
                // Item is the first part of the path after the folder (plus a '/')
                let item = plainKey.substring(itemMatch.length + 1).split('/')[1]
                result = this[functionName](item, p2, p3, p4, p5)
                debug('loop result-1: %o', await result)
                resolve(result)
              } else if (itemMatch.indexOf(plainKey) === 0) {
                // We've matched the key of a child container, so pass to child
                let matchedChild = await this._getContainerForKey(plainKey)
                result = await matchedChild[functionName](itemMatch.substring(plainKey.length + 1), p2, p3, p4, p5)
                debug('loop result-2: %o', await result)
                resolve(result)
              }
            }
          }
          resolve(undefined)
        }))
      })
      await Promise.all(entryQ).catch((e) => debug(e.message))
      if (!result) {
        debug('WARNING: %s.callFunctionOnItem(%s, %s) - item not found to call', this.constructor.name, itemPath, functionName)
        result = containerTypeCodes.notFound
      }
      debug('%s.call returning result: %o', constructor.name, result)
      return result
    } catch (e) {
      debug('ERROR: %s.callFunctionOnItem(%s, %s) failed', this.constructor.name, itemPath, functionName)
      debug(e.message)
    }
  }

  async itemInfo (itemPath) {
    debug('%s.itemInfo(\'%s\')', this.constructor.name, itemPath)
    try {
      if (this.isSelf(itemPath)) {
        return this._safeJs.mutableDataStats(this._mData)
      } else if (this.itemType(itemPath) === containerTypeCodes.fakeContainer) {
        return {
          // TODO consider using listFolder to count folders, recursing, and then adding info from NFS containers
          // TODO these members are junk (inherited from IPFS code so change them!)
          repoSize: 12345,
          storageMax: 99999,
          numObjects: 321
        }
      } else {
        // Pass to the child container
        return this.callFunctionOnItem(itemPath, 'itemInfo')
      }
    } catch (error) { debug(error.message) }
  }

  /**
   * Get the type of the item as one of containerTypeCodes values
   *
   * @param  {String} itemPath A partial or full key within the scope of the container
   * @return {String}          A containerTypeCodes value
   */

  _entryTypeOf (key) {
    // This caters for default folders, except _publicNames
    return containerTypeCodes.nfsContainer
  }

  async itemType (itemPath) {
    debug('%s.itemType(\'%s\')', this.constructor.name, itemPath)
    let type = containerTypeCodes.notValid
    try {
      let itemKey = this._subTree + itemPath
      let value = await this.getEntryValue(itemKey)
      if (value) {  // itemPath exact match with entry key, so determine entry type for this container
        type = this._entryTypeOf(itemKey)
      } else if (this.isSelf(itemPath)) {
        type = containerTypeCodes.defaultContainer
      } else {
        // Check for fakeContainer or NFS container
        let itemAsFolder = (u.isFolder(itemPath, '/') ? itemPath : itemPath + '/')
        let shortestEnclosingKey = await this._getShortestEnclosingKey(itemAsFolder)
        if (shortestEnclosingKey) {
          if (shortestEnclosingKey.length !== itemPath.length) {
            type = containerTypeCodes.fakeContainer
          } else {
            type = containerTypeCodes.nfsContainer
          }
        } else {
          // Attempt to call itemType on a child container
          type = await this.callFunctionOnItem(itemPath, 'itemType')
        }
      }
    } catch (error) {
      debug('file not found')
      debug(error.message)
      throw error
    }
    debug('itemType(%s) returning: ', itemPath, type)
    return type
  }

  // Get the shortest key where itemPath is part of the key
  // TODO this is probably horribly inefficient
  async _getShortestEnclosingKey (itemPath) {
    debug('%s._getShortestEnclosingKey(\'%s\')', this.constructor.name, itemPath)

    // We add this._subTree to the front of the path
    let itemMatch = this._subTree + itemPath
    debug('Matching path: ', itemMatch)

    let result
    let resultQ = []
    try {
      let entries = await this._mData.getEntries()
      // TODO revert to safe-node-app v0.9.1 code:
      // let entriesList = await entries.listEntries()
      // TODO remove safe-node-app v0.8.1 code:
      let entriesList = await this._listEntriesHack(entries)
      entriesList.forEach(async (entry) => {
        resultQ.push(new Promise(async (resolve, reject) => {
          let decodedEntry = await this._decodeEntry(entry, {decodeKey: true})
          let plainKey = decodedEntry.plainKey
          debug('Key            : ', plainKey)
          debug('Matching against: ', itemMatch)

          if (plainKey.indexOf(itemMatch) === 0) {
            if (!result || result.length > plainKey.length) {
              result = plainKey
              debug('MATCHED: ', plainKey)
            }
          }
          resolve()
        }).catch((e) => debug(e)))
      })
      return Promise.all(resultQ).then(_ => {
        debug('MATCH RESULT: ', (result !== undefined ? result : '<no match>'))
        return result
      }).catch((e) => debug(e))
    } catch (e) { debug(e) }
  }

  async itemAttributes (itemPath) {
    debug('%s.itemAttributes(\'%s\')', this.constructor.name, itemPath)
    const now = Date.now()
    try {
      if (this.isSelf(itemPath)) {
        debug('%s is type: %s', itemPath, containerTypeCodes.defaultContainer)
        await this.updateMetadata()
        return {
          // TODO improve this if SAFE accounts ever have suitable values for size etc:
          modified: now,
          accessed: now,
          created: now,
          size: this._metadata.size,
          version: this._metadata.version,
          'isFile': false,
          entryType: containerTypeCodes.defaultContainer
        }
      }

      let type = await this.itemType(itemPath)
      if (type === containerTypeCodes.file ||
          type === containerTypeCodes.nfsContainer ||
          type === containerTypeCodes.service ||
          type === containerTypeCodes.servicesContainer) {
        debug('%s is type: %s', itemPath, type)
        return await this.callFunctionOnItem(itemPath, 'itemAttributes')
      }

      if (type === containerTypeCodes.fakeContainer) {
        // Fake container
        debug('%s is type: %s', itemPath, containerTypeCodes.fakeContainer)
        // Default values (used as is for containerTypeCodes.nfsContainer)
        return {
          modified: now,
          accessed: now,
          created: now,
          size: 0,
          version: -1,
          'isFile': false,
          entryType: type
        }
      } else if (type === containerTypeCodes.notFound) {
        return { entryType: type }
      }
    } catch (e) {
      debug(e.message)
      throw e
    }
  }

  async openFile (itemPath, nfsFlags) {
    debug('%s.openFile(\'%s\', %s)', this.constructor.name, itemPath, nfsFlags)
    try {
      // Default is a container of containers, not files so pass to child container
      return await this.callFunctionOnItem(itemPath, 'openFile', nfsFlags)
    } catch (e) { debug(e.message) }
  }

  async createFile (itemPath) {
    debug('%s.createFile(\'%s\')', this.constructor.name, itemPath)
    try {
      // Default is a container of containers, not files so pass to child container
      return await this.callFunctionOnItem(itemPath, 'createFile')
    } catch (e) { debug(e.message) }
  }

  async closeFile (itemPath, fd) {
    debug('%s.closeFile(\'%s\', %s)', this.constructor.name, itemPath, fd)
    try {
      // Default is a container of containers, not files so pass to child container
      return await this.callFunctionOnItem(itemPath, 'closeFile', fd)
    } catch (e) {
      debug(e.message)
    }
  }

  /**
   * Get user metadata for a file (file does not need to be open)
   * @param  {String} itemPath
   * @param  {Number} fd       [optional] file descriptor obtained from openFile() or createFile()
   * @return {Promise}         A buffer containing any metadata as previously set
   */
  async getFileMetadata (itemPath, fd) {
    try {
      // Default is a container of containers, not files so pass to child container
      return await this.callFunctionOnItem(itemPath, 'getFileMetadata', fd)
    } catch (e) { debug(e.message) }
  }

  /**
   * Set metadata to be written when on closeFile() (for a file opened for write)
   *
   * Note: must only be called after succesful createFile() or openFile() for write
   * @param  {String}  itemPath
   * @param  {Number}  fd       [optional] file descriptor
   * @param  {Buffer}  metadata Metadata that will be written on closeFile()
   */
  async setFileMetadata (itemPath, fd, metadata) {
    try {
      // Default is a container of containers, not files so pass to child container
      return await this.callFunctionOnItem(itemPath, 'setFileMetadata', fd, metadata)
    } catch (e) { debug(e.message) }
  }

  // Read up to len bytes starting from pos
  // return as a String
  async readFile (itemPath, fd, pos, len) {
    debug('%s.readFile(\'%s\', %o, %s, %s)', this.constructor.name, itemPath, fd, pos, len)
    try {
      // Default is a container of containers, not files so pass to child container
      return await this.callFunctionOnItem(itemPath, 'readFile', fd, pos, len)
    } catch (e) { debug(e.message) }
  }

  // Write up to len bytes into buf (Uint8Array), starting at pos
  // return number of bytes written
  async readFileBuf (itemPath, fd, buf, pos, len) {
    debug('%s.readFileBuf(\'%s\', %o, %s, %s)', this.constructor.name, itemPath, fd, buf, pos, len)
    try {
      // Default is a container of containers, not files so pass to child container
      return await this.callFunctionOnItem(itemPath, 'readFileBuf', fd, buf, pos, len)
    } catch (e) {
      debug(e.message)
    }
  }

  /**
   * Write up to len bytes starting from pos
   *
   * This function can be used in one of two ways:
   * - simple: just call writeFile() and it will write data, and if the
   *   file is not open yet, it will do that first
   * - you can call openFile() before, to open in a specific mode using flags
   *
   * Note: if this function fails, the cached file state is purged and any file
   *       descriptor will be invalidated
   *
   * @param  {String}  itemPath path (key) of the file (in container which owns this NfsContainerFiles)
   * @param  {Number}  fd       [optional] file descriptor obtained from openFile()
   * @param  {Buffer|String}  content      (Number | CONSTANTS.NFS_FILE_END)
   * @return {Promise}          String container bytes read
   */
  async writeFile (itemPath, fd, content) {
    debug('%s.writeFile(\'%s\', %s, ...)', this.constructor.name, itemPath, fd)
    try {
      // Default is a container of containers, not files so pass to child container
      return await this.callFunctionOnItem(itemPath, 'writeFile', fd, content)
    } catch (e) {
      debug(e.message)
    }
  }

  /**
   * Write to file, len bytes from buf (Uint8Array)
   *
   * This function can be used in one of two ways:
   * - simple: just call writeFileBuf() and it will write data, and if the
   *   file is not open yet, it will do that first
   * - you can call openFile() before, to open in a specific mode using flags
   *
   * Note: if this function fails, the cached file state is purged and any file
   *       descriptor will be invalidated
   *
   * @param  {String}  itemPath path (key) of the file (in container which owns this NfsContainerFiles)
   * @param  {Number}  fd       [optional] file descriptor obtained from openFile()
   * @param  {Uint8Array}  buf      [description]
   * @param  {Number}  len
   * @return {Promise}          Number of bytes written to file
   */
  async writeFileBuf (itemPath, fd, buf, len) {
    debug('%s.writeFileBuf(\'%s\', %s, %s, %s)', this.constructor.name, itemPath, fd, buf, len)

    try {
      // Default is a container of containers, not files so pass to child container
      return await this.callFunctionOnItem(itemPath, 'writeFileBuf', fd, buf, len)
    } catch (e) {
      debug(e.message)
    }
  }
}

/**
 * Wrapper for _public (SAFE default container)
 *
 * @extends SafeContainer
 */
class PublicContainer extends SafeContainer {
  /**
   * @param {Object} safeJs  SafenetworkApi (owner)
   */
  constructor (safeJs, containerName) {
    let containerPath = '/' + containerName
    let subTree = containerName + '/'
    super(safeJs, containerName, containerPath, subTree)
  }

  /**
   * Create a container object of the appropriate class to wrap an MD pointed to an entry in this (parent) container
   *
   * @param  {String}  key a string matching a mutable data entry in this (parent) container
   * @return {Promise}     a suitable SAFE container for the entry value (mutable data)
   */
  async _createChildContainerForEntry (key) {
    debug('%s._createChildContainerForEntry(\'%s\') ', this.constructor.name, key)
    let containerPath = key
    return new NfsContainer(this._safeJs, key, containerPath, this, true)
  }
}

/**
 * Wrapper for private default container such as '_documents', '_music'
 *
 * TODO implement support for private containers (_documents, _music etc)
 * TODO implement support for application own container
 */
class PrivateContainer extends SafeContainer {
  /**
   * @param {Object} safeJs  SafenetworkApi (owner)
   * @param {String} containerName Name of a private default container such as '_documents'
   */
  constructor (safeJs, containerName) {
    super(safeJs, containerName)
    if (defaultContainers[containerName] !== PrivateContainer) {
      throw new Error('Invalid PrivateContainer name:' + containerName)
    }
  }

  isPublic () { return false }
}

/**
 * Simplified access to the _publicNames container, including a file system API
 * @extends SafeContainer
 *
 * Refs:
 *  https://github.com/maidsafe/rfcs/blob/master/text/0046-new-auth-flow/containers.md
 */
class PublicNamesContainer extends SafeContainer {
  /**
   * @param {Object} safeJs  SafenetworkApi (owner)
   */
  constructor (safeJs) {
    let containerName = '_publicNames'
    let containerPath = '/' + containerName
    let subTree = ''
    super(safeJs, containerName, containerPath, subTree)
    if (defaultContainers[this._name] !== PublicNamesContainer) {
      throw new Error('Invalid PublicNamesContainer name:' + containerName)
    }
  }

  _entryTypeOf (key) {
    return containerTypeCodes.servicesContainer
  }

  // Containers should sanity check keys in case of corruption
  // but still cope with a valid key that has an invalid value
  //
  isValidKey (key) {
    return this._safeJs.isValidPublicName(key)
  }

  isHiddenKey (key) { return super.isHiddenKey(key) || !this.isValidKey(key) }

  async itemType (itemPath) {
    debug('%s.itemType(\'%s\')', this.constructor.name, itemPath)
    let type = containerTypeCodes.notValid
    try {
      let itemKey = this._subTree + itemPath
      let value = await this.getEntryValue(itemKey)
      if (value) {
        // itemPath exact match with entry key, so determine entry type from the key
        type = this._entryTypeOf(itemKey)
      } else {
        // Attempt to call itemType on a child container
        type = await this.callFunctionOnItem(itemPath, 'itemType')
      }
    } catch (error) {
      type = containerTypeCodes.notValid
      debug('public name not found: ', itemPath)
      debug(error.message)
    }

    return type
  }

  /**
   * Create a container object of the appropriate class to wrap an MD pointed to an entry in this (parent) container
   *
   * @param  {String}  key a string matching a mutable data entry in this (parent) container
   * @return {Promise}     a suitable SAFE container for the entry value (mutable data)
   */
  async _createChildContainerForEntry (key) {
    debug('%s._createChildContainerForEntry(\'%s\') ', this.constructor.name, key)
    return new ServicesContainer(this._safeJs, this, key)
  }
}

/**
 * Wrapper for MutableData services container (for a public name)
 */
// TODO extends SafeContainer or something else?
class ServicesContainer extends SafeContainer {
  /**
   * [constructor description]
   * @param {SafenetworkJs} safeJs  SafenetworkJS API object
   * @param {Object} parent (required) the PublicNamesContainer object
   * @param {String} parentEntryKey  the key in _publicNames where this MD is/will be stored
   */
  constructor (safeJs, parent, parentEntryKey) {
    if (!parent || parent.constructor.name !== 'PublicNamesContainer') throw new Error('ServicesContainer must have a parent PublicNamesContainer')

    let subTree = ''
    super(safeJs, 'services', parentEntryKey, subTree, parent, parentEntryKey, safeJs.SN_TAGTYPE_SERVICES)
    this._mdName = safeJs.makeServicesMdName(parentEntryKey)
    this._isPublic = true
  }

  isDefaultContainer () { return false }
  isPublic () { return this._isPublic }

  /**
   * Initialise by accessing existing MutableData compatible with NFS emulation
   * @return {Promise}
   */
  async initialiseExisting () {
    try {
      if (this._parent) {
        let valueVersion = await this._parent.getEntry(this._parentEntryKey)
        this._mdName = valueVersion.value
      }

      this._mData = await this._safeJs.mutableData().newPublic(this._mdName, this._tagType)
      this._mdVersion = await this._mDate.getVersion()  // This verifies it exists
    } catch (err) {
      let info = (this._parent ? this._parent.name + '/' + this._parentEntryKey : this._mdName)
      debug('%s failed to init existing MD for ', this.constructor.name, info)
      debug(err.message)
    }
  }

  async _createChildContainerForEntry (key) {
    debug('%s._createChildContainerForEntry(\'%s\') ', this.constructor.name, key)
    let containerPath = this._parentEntryKey + '/' + key
    return new NfsContainer(this._safeJs, key, containerPath, this, true)
  }

  /**
   * Create a services MutableData and insert into parent PublicNamesContainer
   * @return {Promise}          a newly created {MutableData}
   */
  async createPublicName () {
    this._mData = await this._safeJs.createPublicName(this._parentEntryKey)
    this._mdVersion = this._mData.getVersion()
    return this._mData
  }

  // TODO add support for creating services when resuming support for services
  //      in safeJs (see setupServiceForHost)

  // TODO add methods to access existing service entries (e.g. enumerate, get by name)

  // Containers should sanity check keys in case of corruption
  // but still cope with a valid key that has an invalid value
  //
  isValidKey (key) {
    let decodedKey = this._safeJs.decodeServiceKey(key)

    return this._safeJs.isValidSubdomain(decodedKey.hostProfile) &&
           this._safeJs.isValidServiceId(decodedKey.serviceId)
  }

  isValidServiceName (name) { return this._safeJs.isValidServiceName(name) }

  isHiddenKey (key) {
    return super.isHiddenKey(key) ||
    !this.isValidKey(key)
  }

  _entryTypeOf (key) {
    return containerTypeCodes.service
  }

  async itemType (itemPath) {
    debug('%s.itemType(\'%s\')', this.constructor.name, itemPath)
    let type = containerTypeCodes.notValid
    try {
      let itemKey = this._subTree + itemPath
      let value = await this.getEntryValue(itemKey)
      if (value) {  // itemPath exact match with entry key, so determine entry type for this container
        type = this._entryTypeOf(itemKey)
      } else if (this.isSelf(itemPath)) {
        type = containerTypeCodes.servicesContainer
      } else {
        // Attempt to call itemType on a child container
        type = await this.callFunctionOnItem(itemPath, 'itemType')
      }
      // TODO test the above four lines of code with services that
      //      don't have an NFS container as their value, to see if
      //      the following stricter code is needed...
      //
      // This is a stricter alternative to the above final 'else'
      // but it may be ok to handle the error.
      // } else {
      //   // Check for NFS container
      //   let serviceKey = itemPath.split('/')[0]
      //   let serviceProperties = this._safeJs.decodeServiceKey(serviceKey)
      //   if (serviceProperties && this._isContainerService(serviceProperties.serviceId)) {
      //     // Service with container, so pass to child
      //     debug('%s has a container: %s', itemPath, type)
      //     return await this.callFunctionOnItem(itemPath, 'itemType')
      //   }
    } catch (error) {
      type = containerTypeCodes.notValid
      debug('file not found')
      debug(error.message)
    }

    return type
  }

  // TODO use safeJs service support when resuming that code
  _isContainerService (serviceId) {
    return (serviceId === 'www' || serviceId === 'ldp')
  }

  async itemInfo (itemPath) {
    debug('%s.itemInfo(\'%s\')', this.constructor.name, itemPath)
    try {
      if (this.isSelf(itemPath)) {
        return this._safeJs.mutableDataStats(this._mData)
      } else {
        let serviceProperties = this._safeJs.decodeServiceKey(itemPath)
        if (serviceProperties && this._isContainerService(serviceProperties.name)) {
          // Pass to the child container
          return this.callFunctionOnItem(itemPath, 'itemInfo')
        } else {
          debug('Unrecognised service: ', itemPath)
        }
      }
    } catch (error) { debug(error.message) }
  }

  async itemAttributes (itemPath) {
    debug('%s.itemAttributes(\'%s\')', this.constructor.name, itemPath)
    const now = Date.now()
    try {
      if (this.isSelf(itemPath)) {
        debug('%s is type: %s', itemPath, containerTypeCodes.servicesContainer)
        await this.updateMetadata()
        return {
          // TODO improve this if SAFE accounts ever have suitable values for size etc:
          modified: now,
          accessed: now,
          created: now,
          size: this._metadata.size,
          version: this._metadata.version,
          'isFile': false,
          entryType: containerTypeCodes.servicesContainer
        }
      }

      let type = containerTypeCodes.service
      let serviceProperties = this._safeJs.decodeServiceKey(itemPath)
      if (serviceProperties && this._isContainerService(serviceProperties.serviceId)) {
        // Service with container, so pass to child
        debug('%s has a container: %s', itemPath, type)
        return await this.callFunctionOnItem(itemPath, 'itemAttributes')
      }

      // Service without its own container (or unkown service)
      debug('%s is type: %s', itemPath, type)
      // Default values (used as is for containerTypeCodes.nfsContainer)
      return {
        modified: now,
        accessed: now,
        created: now,
        size: 0,
        version: -1,
        'isFile': true,
        entryType: containerTypeCodes.service
      }
    } catch (e) {
      debug(e.message)
    }
  }
}

/**
 * Wrapper for 'NFS' emulation MutableData
 *
 * TODO NfsContainer - implement private MD (currently only creates public MDs)
 */

// NOTES:
// In contrast to the default containers which hold other containers, an
// NFS container can only hold files, or rather pointers to immutable data.
// An NFS container cannot hold other containers because it would then
// be possible to create multiple entries corresponding to a single
// path (for example, by having folders in _public that 'overlap'
// with a container within an NFS container.
//
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
   * @param {String} containerPath     where this container appears in the SAFE container tree (e.g. '/_public', '/mds')
   * @param {Object} parent (optional) typically a SafeContainer (ServiceContainer?) but if parent is not defined, nameOrKey must be an XOR address
   * @param {Boolean} isPublic  (defaults to true) used only when creating an MD
   */
  constructor (safeJs, nameOrKey, containerPath, parent, isPublic) {
    super(safeJs, nameOrKey, containerPath, '', parent, nameOrKey, safeJs.SN_TAGTYPE_NFS)
    if (parent) {
      this._parentEntryKey = nameOrKey
    } else {
      this._mdName = nameOrKey
      this._isPublic = isPublic
    }
  }

  isDefaultContainer () { return false }
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
        let valueVersion = await this._parent.getEntry(this._parentEntryKey)
        this._mdName = valueVersion.value
      }

      this._mData = await this._safeJs.mutableData().newPublic(this._mdName, this._tagType)
    } catch (err) {
      let info = (this._parent ? this._parent.name + '/' + this._parentEntryKey : this._mdName)
      debug('NfsContainer failed to init existing MD for ' + info)
      debug(err.message)
    }
  }

  async initialiseNfs () {
    if (!this._nfs) {
      this._nfs = await this._mData.emulateAs('NFS')
      this._files = new NfsContainerFiles(this._nfs)
    }
    return this._nfs
  }

  nfs () { return this._nfs }
  files () { return this._files }

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
  }

  // TODO see if the SafeContainer listFolder can be made to handle this
  // -> start with just deleting this:
  // async listFolder (folderPath) {
  //     return ['TODO', 'write-nfs-container', 'listfolder']
  // }

  async itemInfo (itemPath) {
    debug('%s.itemInfo(\'%s\')', this.constructor.name, itemPath)
    try {
      if (this.isSelf(itemPath)) {
        return this._safeJs.mutableDataStats(this._mData)
      } else if (this.itemType(itemPath) === containerTypeCodes.fakeContainer) {
        return {
          // TODO consider using listFolder to count folders, recursing, and then adding info from files
          // TODO these members are junk (inherited from IPFS code so change them!)
          repoSize: 12345,
          storageMax: 99999,
          numObjects: 321
        }
      } else {
        // Pass to the child container
        return this.callFunctionOnItem(itemPath, 'itemInfo')
      }
    } catch (error) { debug(error.message) }
  }

  _entryTypeOf (key) {
    return containerTypeCodes.file
  }

  async itemType (itemPath) {
    debug('%s.itemType(\'%s\')', this.constructor.name, itemPath)
    let type = containerTypeCodes.notValid

    try {
      let fileState = await this._files.getOrFetchFileState(itemPath)
      if (fileState) {
        type = containerTypeCodes.file
      } else {
        let itemKey = this._subTree + itemPath
        let value = await this.getEntryValue(itemKey)
        if (value) {  // itemPath exact match with entry key, so determine entry type for this container
          type = this._entryTypeOf(itemKey)
        } else if (this.isSelf(itemPath)) {
          type = containerTypeCodes.defaultContainer
        } else {
          // Check for fakeContainer or NFS container
          let itemAsFolder = (u.isFolder(itemPath, '/') ? itemPath : itemPath + '/')
          let shortestEnclosingKey = await this._getShortestEnclosingKey(itemAsFolder)
          if (shortestEnclosingKey) {
            type = containerTypeCodes.fakeContainer
          } else {
            type = containerTypeCodes.notFound
          }
        }
      }
    } catch (error) {
      type = containerTypeCodes.notValid
      debug('file not found')
      debug(error.message)
    }

    debug('%s is type: ', itemPath, type)
    return type
  }

  async itemAttributes (itemPath) {
    debug('%s.itemAttributes(\'%s\')', this.constructor.name, itemPath)
    const now = Date.now()
    try {
      if (this.isSelf(itemPath)) {
        debug('%s is type: %s', itemPath, containerTypeCodes.nfsContainer)
        await this.updateMetadata()
        let result = {
          // TODO improve this if SAFE accounts ever have suitable values for size etc:
          modified: now,
          accessed: now,
          created: now,
          size: this._metadata.size,
          version: this._metadata.version,
          'isFile': false,
          entryType: containerTypeCodes.nfsContainer
        }
        return result
      }

      let type
      let fileState = await this._files.getOrFetchFileState(itemPath)
      if (fileState) {
        type = containerTypeCodes.file
      } else {
        type = await this.itemType(itemPath)
      }
      if (type === containerTypeCodes.file) {
        // File
        return {
          modified: fileState._file.modified,
          accessed: now,
          created: fileState._file.created,
          size: 0, // TODO await fileState._file.size(),
          version: fileState._file.version,
          'isFile': true,
          entryType: containerTypeCodes.file
        }
      } else {
        // Fake container
        debug('%s is type: %s', itemPath, containerTypeCodes.fakeContainer)
        // Default values (used as is for containerTypeCodes.nfsContainer)
        return {
          modified: now,
          accessed: now,
          created: now,
          size: 0,
          version: -1,
          'isFile': false,
          entryType: containerTypeCodes.fakeContainer
        }
      }
    } catch (e) {
      debug(e.message)
    }
  }

  async openFile (itemPath, nfsFlags) {
    debug('%s.openFile(\'%s\', %s)', this.constructor.name, itemPath, nfsFlags)
    try {
      return this._files.openFile(itemPath, nfsFlags)
    } catch (e) {
      debug(e.message)
    }
  }

  async createFile (itemPath) {
    debug('%s.createFile(\'%s\')', this.constructor.name, itemPath)
    try {
      return this._files.createFile(itemPath)
    } catch (e) {
      debug(e.message)
    }
  }

  async closeFile (itemPath, fd) {
    debug('%s.closeFile(\'%s\', %s)', this.constructor.name, itemPath, fd)
    try {
      return this._files.closeFile(itemPath, fd)
    } catch (e) {
      debug(e.message)
    }
  }

  /**
   * Get user metadata for a file (file does not need to be open)
   * @param  {String} itemPath
   * @param  {Number} fd       [optional] file descriptor obtained from openFile() or createFile()
   * @return {Promise}         A buffer containing any metadata as previously set
   */
  async getFileMetadata (itemPath, fd) {
    try {
      return this._files.getFileMetadata(itemPath, fd)
    } catch (e) {
      debug(e.message)
    }
  }

  /**
   * Set metadata to be written when on closeFile() (for a file opened for write)
   *
   * Note: must only be called after succesful createFile() or openFile() for write
   * @param  {String}  itemPath
   * @param  {Number}  fd       [optional] file descriptor
   * @param  {Buffer}  metadata Metadata that will be written on closeFile()
   */
  async setFileMetadata (itemPath, fd, metadata) {
    try {
      return this._files.setFileMetadata(itemPath, fd, metadata)
    } catch (e) {
      debug(e.message)
    }
  }

  /**
   * Read up to len bytes starting from pos
   *
   * readFile() can be used in one of two ways:
   * - simple: just call readFile() and it will read data, and if the
   *   file is not open yet, it will do that first
   * - you can call openFile() before, to open in a specific mode using flags
   *
   * Note: if this function fails, the file state is flushed and any file descriptor
   *       will be invalidated
   *
   * @param  {String}  itemPath path (key) of the file (in container which owns this NfsContainerFiles)
   * @param  {Number}  fd       [optional] file descriptor obtained from openFile()
   * @param  {Number}  pos      (Number | CONSTANTS.NFS_FILE_START)
   * @param  {Number}  len      (Number | CONSTANTS.NFS_FILE_END)
   * @return {Promise}          String container bytes read
   */
  async readFile (itemPath, fd, pos, len) {
    debug('%s.readFile(\'%s\', %s, %s, %s)', this.constructor.name, itemPath, fd, pos, len)
    try {
      return this._files.readFile(itemPath, fd, pos, len)
    } catch (e) {
      debug(e.message)
    }
  }

  /**
   * Read up to len bytes into buf (Uint8Array), starting at pos
   *
   * readFileBuf() can be used in one of two ways:
   * - simple: just call readFile() and it will read data, and if the
   *   file is not open yet, it will do that first
   * - you can call openFile() before, to open in a specific mode using flags
   *
   * Note: if this function fails, the file state is flushed and any file descriptor
   *       will be invalidated
   *
   * @param  {String}  itemPath path (key) of the file (in container which owns this NfsContainerFiles)
   * @param  {Number}  fd       [optional] file descriptor obtained from openFile()
   * @param  {Uint8Array}  buf  buffer to fill with data
   * @param  {Number}  pos      (Number | CONSTANTS.NFS_FILE_START)
   * @param  {Number}  len      (Number | CONSTANTS.NFS_FILE_END)
   * @return {Promise}          Number of bytes read into buf
   */
  async readFileBuf (itemPath, fd, buf, pos, len) {
    debug('%s.readFileBuf(\'%s\', %s, %s, %s)', this.constructor.name, itemPath, fd, buf, pos, len)
    try {
      return this._files.readFileBuf(itemPath, fd, buf, pos, len)
    } catch (e) {
      debug(e.message)
    }
  }

  /**
   * Write up to len bytes starting from pos
   *
   * This function can be used in one of two ways:
   * - simple: just call writeFile() and it will write data, and if the
   *   file is not open yet, it will do that first
   * - you can call openFile() before, to open in a specific mode using flags
   *
   * Note: if this function fails, the cached file state is purged and any file
   *       descriptor will be invalidated
   *
   * @param  {String}  itemPath path (key) of the file (in container which owns this NfsContainerFiles)
   * @param  {Number}  fd       [optional] file descriptor obtained from openFile()
   * @param  {Buffer|String}  content      (Number | CONSTANTS.NFS_FILE_END)
   * @return {Promise}          String container bytes read
   */
  async writeFile (itemPath, fd, content) {
    debug('%s.writeFile(\'%s\', %s, ...)', this.constructor.name, itemPath, fd)
    try {
      return this._files.writeFile(itemPath, fd, content)
    } catch (e) {
      debug(e.message)
    }
  }

  /**
   * Write to file, len bytes from buf (Uint8Array)
   *
   * This function can be used in one of two ways:
   * - simple: just call writeFileBuf() and it will write data, and if the
   *   file is not open yet, it will do that first
   * - you can call openFile() before, to open in a specific mode using flags
   *
   * Note: if this function fails, the cached file state is purged and any file
   *       descriptor will be invalidated
   *
   * @param  {String}  itemPath path (key) of the file (in container which owns this NfsContainerFiles)
   * @param  {Number}  fd       [optional] file descriptor obtained from openFile()
   * @param  {Uint8Array}  buf      [description]
   * @param  {Number}  len
   * @return {Promise}          Number of bytes written to file
   */
  async writeFileBuf (itemPath, fd, buf, len) {
    debug('%s.writeFileBuf(\'%s\', %s, %s, %s)', this.constructor.name, itemPath, fd, buf, len)

    try {
      return this._files.writeFileBuf(itemPath, fd, buf, len)
    } catch (e) {
      debug(e.message)
    }
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
  // TODO here: https://forum.safedeentry.value.org/t/proposals-for-restful-service-handling/1550
  // TODO Gabriel had some responses/alternatives which I liked but can't find those.
  async createServiceFolder (tagType, servicePath, metaFor) {
    throw new Error('createServiceFolder() not yet implemented')
    // if (!tagType) tagType = safeApi.CONSTANTS.TYPE_TAG.WWW
    // if (!metaName) metaName = `Service Root Directory for: ${metaFor}`
    // if (!metaDescription) metaDescription = `Has the files hosted for the service: ${metaFor}`

    // TODO implement - see TO DO notes above
  }
}

// TODO use these to create list of default permissions to request on auth (bootstrap)
// Map of SAFE default container names to wrapper class
const defaultContainers = {
  '_public': PublicContainer,
  '_documents': PrivateContainer,
  '_photos': PrivateContainer,
  '_music': PrivateContainer,
  '_video': PrivateContainer,
  '_publicNames': PublicNamesContainer
}

// Container classes are all default containers plus...
const containerClasses = defaultContainers
containerClasses._services = ServicesContainer

module.exports.defaultContainerNames = defaultContainerNames
module.exports.containerTypeCodes = containerTypeCodes
module.exports.defaultContainers = defaultContainers
module.exports.containerClasses = containerClasses
module.exports.PublicContainer = PublicContainer
module.exports.NfsContainer = NfsContainer
