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
  rootContainer: 'root-container',// root container (e.g. _public)
  nfsContainer: 'nfs-container',  // an NFS container, or if in a root container an entry that ends with slash
  file: 'file',                   // an entry that doesn't end with slash
  fakeContainer: 'fake-container', // a path ending with '/' that matches part of an entry (default is we fake attributes of a container)
  notValid: 'not-found'
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

  async put (containerPath, container) {
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

const containerMap = new ContainerMap

/**
 * Base class for SAFE root containers
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
   * which handle the SAFE root containers (_public, _publicNames),
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
   * A stand-alone container is not a root container *and* has no parent
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
    this._subTree = subTree + (subTree === '' || !u.isFolder(subTree, '/') ? '/' : '')
    this._parent = (parent === undefined ? undefined : parent)
    this._parentEntryKey = (parentEntryKey === undefined ? undefined : parentEntryKey)
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

      if (this.isRootContainer()) {
        this._mData = await this._safeJs.auth.getContainer(this._name)
      } else if (this._parent && this._parentEntryKey) {
        // Default assumes child is NfsContainer, so others (e.g. ServicesContainer) must override initialise()
        let valueVersion = await this._parent.getValueVersion(this._parentEntryKey)
        if (!this._entryValueVersion || this._entryValueVersion.version !== valueVersion.version) {
          // Invalidated or not yet initialised
          valueVersion.plainValue = valueVersion.buf
          try { valueVersion.plainValue = await this._parent._mData.decrypt(valueVersion.buf) } catch (e) { debug('Value decryption ERROR: %s', e) }
          await this._initialiseNfsContainer(valueVersion.plainValue)
          this._entryValueVersion = valueVersion
        }
      } else {
        await this._initialiseMutableDataContainer(this._name, this._tagType)
      }

      // Add to FS cache if it has a containerPath
      if (this._containerPath !== '') await containerMap.put(this._containerPath, this)
    } catch (error) {
      let msg = 'SafeContainer initialise failed: ' + this._name + ' (' + error.message + ')'
      debug(msg + '\n' + error.stack)
      throw new Error(msg)
    }
  }

  async _initialiseNfsContainer (xorName) {
    try {
      return this._initialiseMutableDataContainer(xorName, this._safeJs.SN_TAGTYPE_NFS).catch((e) => { debug(e.message) })
    } catch (e) { debug(e.message) }
  }

  async _initialiseMutableDataContainer (xorName, tagType) {
    try {
      this._mData = await this._safeJs.getMdFromHash(xorName, tagType)
    } catch (e) { debug(e.message) }
  }

  create() {
    // Template only - should be implemented in extender
    // class (i.e. NfsContainer, ServicesContainer etc) to
    // ensure any parent is updated correctly
    throw new Error(this.constructor.name + '.create() - TODO (not yet implemented in extener class)')
  }

  // SafeContainer assumes root, so override this in non-root container classes
  isRootContainer () {
    // Catch call on non-root container due to lack of override:
    if (this._parent) throw new Error(this.constructor.name + '.isRootContainer() - TODO (not yet implemented in extener class)')

    return true
  }

  isPublic () { return true }
  isSelf (itemPath) { return itemPath === '' }  // Empty path is equivalent to '.'

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

  async getValueVersion (key) {
    try {
      return this._mData.get(key)
    } catch (e) { debug(e.message) }
  }

  async getEntryValue (key) {
    try {
      return await this._safeJs.getMutableDataValue(this._mData, key)
    } catch (e) { debug(e.message) }
  }

  /**
   * Get the MutableData entry for entryKey
   * @param  {String}         entryKey
   * @return {Promise}        resolves to ValueVersion
   */
  async getEntry (entryKey) {
    // TODO
  }

  async getEntryAsFile (key) {
    try {
      let value = await this.getEntryValue(key)
      return this.nfs().fetch(value)
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
    debug('TODO insertNfsFolder(\'%s\')', folderPath)
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
  //    /<root-container>
  //                    \--<NFS-container>
  //                    \--<NFS-container>
  //                              :
  //                    \--<NFS-container>
  //    Where:
  //          <root-container> is a default container for files
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

  async getContainerForKey (key) {
    debug('%s.getContainerForKey(\'%s\')', this.constructor.name, key)

    let container
    try {
      container = await containerMap.get(key)
      if (!container) {
        container = await this._createChildContainerForEntry(key)
        if (container) {
          containerMap.put(key, container)
          container.initialise()
        }
      }
    } catch (error) { debug(error.message) }

    return container
  }

// ************** TODO delete the following commented out code
//   /**
//    * Get the child container object that wraps an entry in this container
//    *
//    * Maintains a map of child containers, creating them as necessary
//    * though much on this will be implemented in more specific classes.
//    *
//    * Extensions to SafeContainer should implement the _isContainerForItem()
//    * and _createChildContainerForEntry() methods on which this method relies
//    *
//    * @param  {String}  itemPath path relative to root or, if a child, relative to the key of my parent entry
//    * @return {Promise}          an object which implements SafeContainer FS operations
//    */
//   async _getContainerForKey (itemPath) {
//     debug('%s._getContainerForKey(\'%s\')', this.constructor.name, itemPath)
//     debug('TODO when working, introduce caching 1) of _lastChild, 2) of all _childContainers')
//     let key = this._getKeyPartOf(itemPath)
//     if (key === undefined) {
//       let msg = 'path \'' + itemPath + '\' does not map to container at ' + this._containerPath
//       debug(msg)
//       throw new Error(msg)
//     }
//
//     if (this.isRootContainer()) {
//       // If present, strip the container name from the front of the itemPath ready to match entry keys below
//       if (itemPath.indexOf('/' + this._name) === 0) itemPath = itemPath.substr(this._name.length + 1)
//     }
//
//     debug('itemPath: ', itemPath)
//     debug('key     : ', key)
//
//     try {
//       if (this._isContainerForItem(key)) {
//         return this
//       } else {
//         return this._createChildContainerForEntry(key)._getContainerForKey(key)
//       }
//     } catch (e) { debug(e.message) }
//
//     // Caching version starts here
// ??? we should recurse (unless we match the cached child?)
//
//     // First level single item cache to speed multiple ops on an item in succession
//     // is invalidated if the parent container's (this) version changes
// // TODO ??? not sure about containerPath here
// // TODO ??? may need to trim parent path from itemPath first
//     if (this._lastChild && this._lastChild._isContainerForItem(itemPath)) {
//       if ( this._lastChildVersion && this._lastChildVersion === this.getVersion() ) return this._lastChild
//     }
//
//     // Second level cache of all child containers used so far
//     // is invalidated if the parent container's (this) version changes
//     if ( this._childContainersVersion !== this.getVersion() ) {
//       this._childContainers = []
//     }
//     this._childContainers.forEach((child, path) => {
//       if (!foundContainer && itemPath.indexOf(child.containerPath) === 0) {
//         foundContainer = child
//         this._lastChild = child
//         this._lastChildVersion = child.getVersion()
//       })
//     })
//
//     if (!foundContainer) {
//       ??? is this where to create a new child and add it to _childContainers
//     }
//
//     return foundContainer
//     // ???
//     throw new Error('TODO _getContainerFor()')
//   }
//
//   /* Wrappers which first call _getContainerFor()
//    */
//
//   async listFolder (folderPath) {
//     return this._getContainerFor(folderPath)._listFolder(folderPath)
//   }
//
//   async itemInfo (itemPath) {
//     return this._getContainerFor(itemPath)._itemInfo(itemPath)
//   }
//
//   async itemType (itemPath) {
//     return this._getContainerFor(itemPath)._itemType(itemPath)
//   }
//
//   async itemAttributes (itemPath) {
//     return this._getContainerFor(itemPath)._itemAttributes(itemPath)
//   }

  // FS implementations

  // These methods operate on the data held in a mutable data container class
  // so long as the path lies within the container itself. If the path is
  // longer, and refers to data held by a child, the child will be called
  // to perform the operation after stripping the part of the path
  // relating to the parent. So folderPath is always relative to the
  // current container.
  //

  /**
   * get a list of folders
   *
   * @param  {String}  folderPath path relative to this._containerPath
   * @return {Promise}            list of sub-folder names at folderPath
   */

  // TODO get working for _public and then test/modify so it also works for NfsContainer
  async listFolder (folderPath) {
    debug('%s.listFolder(\'%s\')', this.constructor.name, folderPath)

    // TODO if a rootContainer check cache against sub-paths of folderPath (longest first)
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

//???        if (plainKey[0] !== path.sep) plainKey = path.sep + plainKey
      // For matching we ignore a trailing '/' so remove if present
      let matchKey = (u.isFolder(plainKey, '/') ? plainKey.substring(0, plainKey.length - 1) : plainKey)
        debug('Key            : ', plainKey)
        debug('Match Key      : ', matchKey)
        debug('Folder Match   : ', folderMatch)
        plainValue = enc.decode(new Uint8Array(plainValue))
        if (plainValue !== v.buf.toString())
          debug('Value (encrypted): ', v.buf.toString())

        debug('Value            :', plainValue)

        debug('Version: ', v.version)

        // Check it the folderMatch is at the start of the key, and *shorter*
        if (plainKey.indexOf(folderMatch) === 0 && plainKey.length > folderMatch.length) {
          // Item is the first part of the path after the folder (plus a '/')
          let item = plainKey.substring(folderMatch.length).split('/')[1]
          if (item && item.length && listing.indexOf(item) === -1) {
            debug('listing.push(\'%s\')', item)
            listing.push(item)
          }
        } else if (folderMatch.indexOf(plainKey) === 0) {
          // We've matched the key of a child container, so pass to child
          let matchedChild = await this._getContainerForKey(plainKey)
          let childList = await matchedChild.listFolder(folderMatch.substring(plainKey.length))
          listing.concat(childList)
        }
      }).catch((e) => { debug(e.message) })
    } catch (e) {
      debug(e.message)
    }

    debug('listing: %o', listing)
    return listing
  }

  // TODO track issue and rever to using await when fixed: https://github.com/maidsafe/safe_app_nodejs/issues/278
  async callFunctionOnItem (itemPath, functionName) {
    debug('%s.callFunctionOnItem(%s, %s)', this.constructor.name, itemPath, functionName)

    // TODO if a rootContainer check cache against sub-paths of folderPath (longest first)
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

    let ret
    let result = []
    try {
      // TODO remove debug calls (and comment out the value parts until moved elsewhere)
      let entries = await this._mData.getEntries()
      await entries.forEach(async (k, v) => {
        if (!result.length) {
          let plainValue = v.buf
          try { plainValue = await this._mData.decrypt(v.buf) } catch (e) { debug('Value decryption ERROR: %s', e) }

          let enc = new TextDecoder()
          let plainKey = enc.decode(new Uint8Array(k))
          if (plainKey !== k.toString())
            debug('Key (encrypted): ', k.toString())

  //???        if (plainKey[0] !== path.sep) plainKey = path.sep + plainKey
          // For matching we ignore a trailing '/' so remove if present
          let matchKey = (u.isFolder(plainKey, '/') ? plainKey.substring(0, plainKey.length - 1) : plainKey)
          debug('Key            : ', plainKey)
          debug('Match Key      : ', matchKey)

          plainValue = enc.decode(new Uint8Array(plainValue))
          if (plainValue !== v.buf.toString())
            debug('Value (encrypted): ', v.buf.toString())

          debug('Value            :', plainValue)

          debug('Version: ', v.version)

          // Check it the itemMatch is at the start of the key, and *shorter*
          if (plainKey.indexOf(itemMatch) === 0 && plainKey.length > itemMatch.length) {
            // Item is the first part of the path after the folder (plus a '/')
            let item = plainKey.substring(itemMatch.length + 1).split('/')[1]
            result.push(this[functionName](itemPath))
          } else if (itemMatch.indexOf(plainKey) === 0) {
            // We've matched the key of a child container, so pass to child
            let matchedChild = await this._getContainerForKey(plainKey)
            result.push(matchedChild[functionName](itemMatch.substring(plainKey.length)))
            // debug('loop result: %o', result)
          }
        }
      })
      .then(async _ => Promise.all(result)
      .then(async _ => {
        if (result.length) {
          ret = result[0]
          debug('1-return: %o', ret)
        }
        debug('Iteration finished with return: %o', ret)
      })).catch((e) => { debug(e.message) })
    } catch (e) {
      debug(e.message)
    }

    debug('2-return: %o', ret)
    return ret
  }

  // TODO delete this example code
  async dummy () {
    let result
    let promises = []
    try {
      let entries = await md.getEntries()
      await entries.forEach(async (v, k) => {
        promises.push(someFunction())
      })
      .then(async _ => Promise.all(promises)
      .then(async _ => {
        if (promises.length) {
          result = promises[0]
        }
        debug('Iteration complete')
      })).catch((e) => { debug(e.message) })
    } catch (e) {
      debug(e.message)
    }

    debug('result: %o', result)
  }

  async itemInfo (itemPath) {
    debug('%s.itemInfo(\'%s\')', this.constructor.name, itemPath)
    try {
      if (this.isSelf(itemPath)) {
        return this._safeJs.mutableDataStats(this._mData)
      } else if (this.itemType(itemPath) === containerTypes.fakeContainer) {
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
   * Get the type of the item as one of containerTypes values
   *
   * @param  {String} itemPath A partial or full key within the scope of the container
   * @return {String}          A containerTypes value
   */

  async itemType (itemPath) {
    let type = containerTypes.nfsContainer
    try {
      let value = await this.getEntryValue(itemPath)
      if (value) {  // Exact match with folder or file
        type = (u.isFolder(itemPath, '/') ? containerTypes.nfsContainer : containerTypes.file)
      } else if (this.isSelf(itemPath)) {
        type = containerTypes.rootContainer
      } else {
        // Check for fakeContainer or NFS container
        let itemAsFolder = ( u.isFolder(itemPath, '/') ? itemPath : itemPath + '/')
        let shortestEnclosingKey = await this._getShortestEnclosingKey(itemAsFolder)
        if (shortestEnclosingKey) {
          if (shortestEnclosingKey.length !== itemPath.length) {
            type = containerTypes.fakeContainer
          } else {
            type = containerTypes.nfsContainer
          }
        } else {
          // Attempt to call itemType on a child container
          type = await this.callFunctionOnItem(itemPath, 'itemType')
        }
      }
    } catch (error) {
      type = containerTypes.notValid
      debug('file not found')
      debug(error.message)
    }

    return type
  }

  // Get the shortest key where itemPath is part of the key
  // TODO this is probably horribly inefficient
  async _getShortestEnclosingKey (itemPath) {
    debug('_getShortestEnclosingKey(\'%s\')', itemPath)

    // We add this._subTree to the front of the path
    let itemMatch = this._subTree + itemPath
    debug('Matching path: ', itemMatch)

    let result
    let entries = await this._mData.getEntries()
    await entries.forEach(async (k, v) => {
      let enc = new TextDecoder()
      let plainKey = enc.decode(new Uint8Array(k))
      if (plainKey !== k.toString())
        debug('Key (encrypted): ', k.toString())

      debug('Key            : ', plainKey)
      debug('Matching against: ', itemMatch)

      if (plainKey.indexOf(itemMatch) === 0) {
        if (!result || result.length > plainKey.length) {
          result = plainKey
          debug('MATCHED: ', plainKey)
        }
      }
    }).catch((e) => { debug(e.message) })

    if (!result) debug('NO MATCH')

    return result
  }

  async itemAttributes (itemPath) {
    debug('%s.itemAttributes(\'%s\')', this.constructor.name, itemPath)
    const now = Date.now()
    try {
      if (this.isSelf(itemPath)) {
        debug('%s is type: %s', itemPath, containerTypes.rootContainer)
        await this.updateMetadata()
        return {
          // TODO improve this if SAFE accounts ever have suitable values for size etc:
          modified: now,
          accessed: now,
          created: now,
          size: this.size,
          version: this.version,
          'isFile': false,
          entryType: containerTypes.rootContainer
        }
      }

      let type = await this.itemType(itemPath)
      if (type === containerTypes.file || type === containerTypes.nfsContainer) {
        debug('%s is type: %s', itemPath, containerTypes[type])
        return await this.callFunctionOnItem(itemPath, 'itemAttributes')
      }

      if (type === containerTypes.fakeContainer) {
        // Fake container
        debug('%s is type: %s', itemPath, containerTypes.fakeContainer)
        // Default values (used as is for containerTypes.nfsContainer)
        return {
          modified: now,
          accessed: now,
          created: now,
          size: 0,
          version: -1,
          'isFile': false,
          entryType: type
        }
      }
    } catch (e) {
      debug(e.message)
    }
  }

  // TODO when listFolder is working delete OLD_listFolder
  async OLD_listFolder (folderPath) {
    debug('listFolder(\'%s\')', folderPath)
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
    return new NfsContainer(this._safeJs, key, this, true)
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
// In contrast to the root containers which hold other containers, an
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
   * @param {Object} parent (optional) typically a SafeContainer (ServiceContainer?) but if parent is not defined, nameOrKey must be an XOR address
   * @param {Boolean} isPublic  (defaults to true) used only when creating an MD
   */
  constructor (safeJs, nameOrKey, parent, isPublic) {
    super(safeJs, nameOrKey, nameOrKey, '', parent, nameOrKey)
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
  }

  // TODO see if the SafeContainer listFolder can be made to handle this
  // -> start with just deleting this:
  async listFolder (folderPath) {
      return ['TODO', 'write-nfs-container', 'listfolder']
  }

  async itemInfo (itemPath) {
    debug('%s.itemInfo(\'%s\')', this.constructor.name, itemPath)
    try {
      if (this.isSelf(itemPath)) {
        return this._safeJs.mutableDataStats(this._mData)
      } else if (this.itemType(itemPath) === containerTypes.fakeContainer) {
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

  async itemType (itemPath) {
    if (itemPath === '') return containerTypes.nfsContainer
    return (u.isFolder(itemPath, '/') ? containerTypes.fakeContainer : containerTypes.file)
  }

  async itemAttributes (itemPath) {
    debug('%s.itemAttributes(\'%s\')', this.constructor.name, itemPath)
    const now = Date.now()
    try {
      if (this.isSelf(itemPath)) {
        debug('%s is type: %s', itemPath, containerTypes.nfsContainer)
        await this.updateMetadata()
        let result = {
          // TODO improve this if SAFE accounts ever have suitable values for size etc:
          modified: now,
          accessed: now,
          created: now,
          size: this._metadata.size,
          version: this._metadata.version,
          'isFile': false,
          entryType: containerTypes.nfsContainer
        }
        return result
      }

      if (!u.isFolder(itemPath, '/')) {
        // File
        let file = await this.getEntryAsFile(itemPath)
        return {
          modified: file.modified,
          accessed: now,
          created: file.created,
          size: file.size,
          version: file.version,
          'isFile': true,
          entryType: containerTypes.file
        }
      } else {
        // Fake container
        debug('%s is type: %s', itemPath, containerTypes.fakeContainer)
        // Default values (used as is for containerTypes.nfsContainer)
        return {
          modified: now,
          accessed: now,
          created: now,
          size: 0,
          version: -1,
          'isFile': false,
          entryType: containerTypes.fakeContainer
        }
      }
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
