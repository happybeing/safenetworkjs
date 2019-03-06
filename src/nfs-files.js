/**
 * Classes to track and access files in a SAFE NFS container
 *
 * Includes a file descriptor based interface to SAFE NFS files.
 *
 * Efficiencies
 * ------------
 * These classes track file state between calls to the
 * SAFE NFS API, so when a client program is calling readFile()
 * for example, it doesn't result in calls to open/read/close
 * on the SAFE API for every readFile() call.
 *
 * It also caches the file state from a fetch() avoiding repeated
 * network GETs for the same information.
 *
 * Caching
 * -------
 * File state is held in two caches (maps):
 * 1) A map of file descriptors to the file state object (class
 *    NfsFileState) is application-wide, implemented by class _AllNfsFiles.
 * 2) A map of itemPath *within* a container to the SAFE NFS API File
 *    objects in use by the container, implemented by class _NfsContainerFiles.
 *
 * Use of File Descriptors is Optional
 * -----------------------------------
 * TODO: update this once finalised (I think everything here now uses file descriptors, and that you have to openFile/do stuff/closeFile at this level)
 *
 * Applcations don't have to use the file descriptor obtained
 * by calling openFile(), and may call the file operations
 * readFile(), writeFile() etc directly, in which case they must
 * pass the file descriptor as 'undefined'.
 *
 * Where the file has not already been opened with the correct permissions
 * readFile(), writeFile() etc will attempt to open it with the minimum
 * permissions they require, and leave it in this state.
 *
 * So file descriptors can be used, and result in slight efficiencies,
 * but it should also be performant to just call readFile(), writeFile()
 * and forget about openFile() and closeFile().
 *
 * Usage by Container Classes
 * --------------------------
 * A higher level class (e.g. NfsContainer) can use a _NfsContainerFiles
 * object to keep track of file paths to their file objects (and descriptors).
 * So that even if a client program doesn't make use of file descriptors,
 * they can be looked up and calls to the SAFE API minimised.
 *
 * Note that file descriptors are not from the SAFE API, but instead are
 * generated here. File descriptors are application-wide rather than per
 * container, but can only be used within the application that obtained them.
 *
 * Interim ref:
 *  What in the SAFE API causes GET?
 *  https://forum.safedev.org/t/what-in-the-api-causes-get/2008/5?u=happybeing
 */

const debug = require('debug')('safenetworkjs:file')  // Web API
const error = require('debug')('safenetworkjs:file E:')

require('fast-text-encoding') // TextEncoder, TextDecoder (for desktop apps)

// TODO remove when missing constants are available on safeApi.CONSTANTS
const C = require('./constants')

const minFileDescriptor = 1

class _AllNfsFiles {
  /**
   * App wide map of file descriptors to open NfsFileState objects
   */
  constructor () {
    this._map = {}  // Use an object map rather than array because we expect fd's
                    // to be sparse and don't want a big, largely empty array
                    // when it should be fast to look up an item in a smallish map
    this._nextFileDescriptor = minFileDescriptor
  }

  newDescriptor (nfsFileState) {
    while (this._map[this._nextFileDescriptor] !== undefined) {
      debug('%s WARNING: file descriptor %s in use, next...', this.constructor._name, this._nextFileDescriptor)
      if (this._nextFileDescriptor < Number.MAX_SAFE_INTEGER) {
        this._nextFileDescriptor++
      } else {
        this._nextFileDescriptor = minFileDescriptor
      }
    }
    this._map[this._nextFileDescriptor] = nfsFileState
    return this._nextFileDescriptor++
  }

  // By deleting descriptors (called by close()) we reduce the chances of ever
  // running out. If app fails to close files, this might still happen eventually
  deleteDescriptor (fd) {
    delete this._map[fd]
  }

  getFileStateFromCache (fd) {
    return this._map[fd]
  }

  restoreFileDescriptorToCache (fd, fileState) {
    this._map[fd] = fileState
  }

  lookupFileStateForPath (itemPath) {
    this._map.forEach((fd) => {
      let fileState = this._map[fd]
      if (fileState._itemPath === itemPath) return fileState
    })
    return undefined
  }
}

/**
 * Manage file state through different file operation sequences
 *
 * The following sequences use a file descriptor returned
 * by openFile() or createFile() to maintain state across the
 * series of operations.
 *
 * TODO: review and update the following which I think is not correct...
 *
 * Alternatively, an application can just make a single call to
 * readFile() or writeFile() which will perform the entire
 * sequence in one call. The same can be achieved with
 * createFile(), by passing data to the call.
 *
 * Existing file read/write:
 * -------------------------
 *    SafenetworkJs FS           SAFE NFS API
 *
 *    openFile()                 fetch(), open()
 *    readFile() | writeFile()   read() | write()
 *        "           "           "        "
 *    closeFile()                close(), update()
 *
 * Or alternatively, if you don't call openFile() first:
 *    readFile()                fetch(), open(), read(), close()
 *
 * And, again not calling openFile() first:
 *    writeFile()                fetch(), open(), write(), close(), update()
 *
 * Create and write a new file:
 * ----------------------------
 *    SafenetworkJs FS           SAFE NFS API
 *
 *    createFile()               open()
 *    writeFile()                write()
 *        "                        "
 *    closeFile()                close(), insert()
 *
 * Or if you pass the data to createFile():
 *    createFile()               open(), write(), close(), insert()
 */
class NfsFileState {
  constructor (safeJs, itemPath, fileFetched, hasKey) {
    this._safeJs = safeJs             // For safeJs.safeApi.CONSTANTS only
    this.hasKey = hasKey              // Used to decide whether to insert() or update() the entry
    this._flags = undefined           // When open, set to NFS flags (e.g. NFS_FILE_MODE_READ etc)
    this._writePos = undefined        // Tracks file position next write
    this._isModified = false          // Set true when a write is performed

    // File identity and state
    this._fileDescriptor = allNfsFiles.newDescriptor(this)  // Always valid (but file may not be)
    this._itemPath = itemPath
    this._fileFetched = fileFetched   // NFS File returned by fetch (existing file)
    this._fileOpened = undefined      // NFS File returned by open (new or existing - but lacks size, version etc)
    this._versionOpened = undefined   // Version when opened
    this._newMetaData = undefined     // If set, will be written on closeFile()
  }

  fileDescriptor () { return this._fileDescriptor } // Positive integer unique per open file in this app

  setModified () { this._isModified = true }
  isModified () { return this._isModified }
  isDeletedFile () { return this.hasKey && !this._fileFetched }
  isOpen () { return this._fileOpened || this.isEmptyOpen }
  version () { return this._fileFetched ? this._fileFetched.version : undefined }

  isWriteable (flags) {
    if (flags === undefined) flags = this._flags
    return flags & this._safeJs.safeApi.CONSTANTS.NFS_FILE_MODE_OVERWRITE ||
           flags & this._safeJs.safeApi.CONSTANTS.NFS_FILE_MODE_APPEND
  }

  /**
   * Release a file descriptor and forget cached file state
   *
   * Releases the descriptor for this object by deleting cached file state
   * (i.e. this NfsFileState object) from allNfsFiles. This should be
   * called whenever a writeFile() (or any other file operation) fails, to
   * ensure the FileState is refreshed in the case that failure was due to
   * another process/app modifying the file entry.
   */
  releaseDescriptor () {
    if (this._fileDescriptor) {
      allNfsFiles.deleteDescriptor(this._fileDescriptor)
      this._fileDescriptor = undefined
    }
  }

  /**
   * Create NFS file for this object
   *
   * @param  {Emulation}  nfs  emulation of MutableData
   * @return {Promise}    C.SUCCESS or an Error object
   */
  async create (nfs) {
    try {
      this._fileOpened = await nfs.open()
      if (this._fileOpened) {
        this._flags = this._safeJs.safeApi.CONSTANTS.NFS_FILE_MODE_OVERWRITE
        this._isModified = true
        this._versionOpened = 0
        this._writePos = 0
        return C.SUCCESS
      }
    } catch (e) { error(e); return e }

    return new Error('Unknown error creating NFS file')
  }

  /**
   * Open the NFS file of this object
   *
   * @param  {Emulation}  nfs  emulation of MutableData
   * @param  {Number}    nfsFlags for NFS open()
   * @return {Promise}    C.SUCCESS or an Error object
   */
  async open (nfs, nfsFlags) {
    try {
      // this._fileOpened = this.isWriteable(nfsFlags) ? await nfs.open() : await nfs.open(this._fileFetched, nfsFlags)
      let opened
      let size
      this.isEmptyOpen = undefined
      if (this.isWriteable(nfsFlags)) {
        if (this._fileFetched) {
          opened = await nfs.open(this._fileFetched, nfsFlags)
          this._writePos = (nfsFlags === this._safeJs.safeApi.CONSTANTS.NFS_FILE_MODE_APPEND ? await this._fileFetched.size() : 0)
        } else {
          opened = await nfs.open()
          this._writePos = 0  // Writing to new empty file
        }
      } else {
        try {
          // NFS fails to open zero length files for read, so we must fake it
          size = await this._fileFetched.size()
          this.isEmptyOpen = (size === 0)
          debug('size: ', size)
        } catch (discard) {}

        debug('isEmptyOpen: %s', this.isEmtpyOpen)
        if (!this.isEmptyOpen) opened = await nfs.open(this._fileFetched, nfsFlags)
      }
      this._fileOpened = opened

      if (this._fileOpened || this.isEmptyOpen) {
        this._flags = nfsFlags
        this._versionOpened = this._fileOpened ? this._fileFetched.version : 0
        if (this.isWriteable()) {
          debug('opened (%s) for write', this._fileDescriptor)
        } else {
          debug('opened (%s) for read (size: %s)', this._fileDescriptor, size)
        }
        return C.SUCCESS
      }
    } catch (e) { error(e); return e }

    return new Error('Unknown error creating NFS file')
  }

  /**
   * Truncate an open-for-write file to size bytes (only implemented for size equal to zero)
   *
   * @param  {Emulation}  nfs  emulation of MutableData
   * @param  {Number}    size (must be zero)
   * @return {Promise}    C.SUCCESS or an Error object
   */
  async _truncate (nfs, size) {
    try {
      if (size !== 0) throw new Error(this.constructor.name + '._truncate() not implemented for size other than zero')

      if (this._fileFetched) {
        let nfsFlags = this._safeJs.safeApi.CONSTANTS.NFS_FILE_MODE_OVERWRITE

        // Truncate by opening for overwrite, so if already open, close first
        let leaveClosed = this._fileOpened === undefined
        if (this._fileOpened) await this._fileOpened.close()

        this._fileOpened = await nfs.open(this._fileFetched, nfsFlags)
        this.setModified()
        this._writePos = 0

        if (leaveClosed) {
          // Close without releasing descriptor
          this._flags = undefined
          this._writePos = undefined
          await this._fileOpened.close()
          this._fileOpened = undefined
        } else if (this._fileOpened || this.isEmptyOpen) {
          this._flags = nfsFlags
          this._versionOpened = this._fileOpened ? this._fileOpened.version : 0
        }

        debug('truncated by (re)opening for overwrite')
        return C.SUCCESS
      }
    } catch (e) { error(e); return e }
    return C.SUCCESS
  }

  /**
   * Close the open NFS file of this object
   *
   * @param  {Emulation}  nfs  emulation of MutableData
   * @return {Promise}    C.SUCCESS or an Error object
   */
  async close (nfs) {
    try {
      this.releaseDescriptor()
      this._flags = undefined
      // TODO should we discard this._fileFetched here (is version, size or other state valid?)
      if (this._fileOpened) await this._fileOpened.close()
      return C.SUCCESS
    } catch (e) { error(e); return e }
    return new Error('Unknown error creating NFS file')
  }
}

/**
 * Manage files for a SafeContainer (eg NfsContainer)
 *
 * Keeps a map of paths to SAFE NFS File objects, which have
 * either been fetched or created using the SAFE NFS API.
 *
 */
class _NfsContainerFiles {
  constructor (owner, safeJs, mData, nfs) {
    this._owner = owner
    this._safeJs = safeJs
    this._mData = mData
    this._nfs = nfs
    this._containerNfsFiles = {}  // Map NFS container path to NFS fetched or created NFS File objects
  }

  nfs () { return this._nfs }

  getFileStateForDescriptor (fd) {
    return allNfsFiles.getFileStateFromCache(fd)
  }

  // Clear cache to force subsequent fetch() from network
  clearNfsFileFor (itemPath) {
    delete this._containerNfsFiles[itemPath]
  }

  _newFileState (itemPath, file, hasKey) {
    debug('%s._newFileState(\'%s\', %s, %s)', this.constructor.name, itemPath, file, hasKey)
    try {
      let fileState = new NfsFileState(this._safeJs, itemPath, file, hasKey)
      debug('fileState: %s', fileState)
      return fileState
    } catch (e) { error(e) }
  }

  /**
   * Release any file descriptor
   * @private
   *
   * @param  {FileState} fileState
   *
   * Functions that are passed a file descriptor use that to get the
   * corresponding FileState object, and will call this function if an error
   * occurs during the file operation, which might sometimes be undesirable
   * because it invalidates the file descriptor, which means the client
   * can't retry the operation without first re-opening the file to get
   * a new file descriptor. So..
   *
   * TODO consider accepting a SAFE API error code, and using that to decide
   * whether to invalidate the file descriptor.
   *
   * Note NFS fetched/created File objects remain in this._containerNfsFiles[]
   * and are never deleted. This could accumulate over time so the number of
   * these could be limited, and this would be a good place to purge the
   * cache of excess objects. So..
   *\
   * TODO implement limit on size of this._containerNfsFiles[]
   * based on time since last use. So each cache access must update a last
   * access time, and here we add code to purge the N least used entries
   * needed to bring the size of the cache down to a desired limit. Keeping
   * the cache small makes this relatively fast, while increasing the number
   * of fetch() operations if more than that number of files are open in
   * the current app at any one time.
   */
  _destroyFileState (fileState) {
    fileState.releaseDescriptor()
  }

  /**
   * Fetch NFS File from cache of NFS File objects, or the network
   *
   * @param  {String}  itemPath A path (NFS entry key)
   * @param  {Boolean} fromNetwork if true, get from network and update cache
   * @return {Promise} FileState if MD entry is active or deleted, undefined if there is no entry for itemPath
   */
  async _fetchFileState (itemPath, fromNetwork) {
    debug('%s._fetchFileState(\'%s\', %s)', this.constructor.name, itemPath, fromNetwork)
    let fileState
    try {
      let file
      if (!fromNetwork) file = this._containerNfsFiles[itemPath] // Cached NFS fetch() File objects from fetch()/open()
      if (!file) {
        file = await this.nfs().fetch(itemPath)
        if (file) this._containerNfsFiles[itemPath] = file
      }
      if (file) {
        fileState = this._newFileState(itemPath, file, true /* hasKey */)
        debug('fileState fetched for: %s', itemPath)
        debug('fileState: %o', fileState)
      } else {
        debug('no entry found for: %s', itemPath)
      }
      return fileState
    } catch (e) {
      if (e.code === C.ERROR_CODE.ENCODE_DECODE_ERROR) {
        debug('deleted entry found: %s', itemPath)
        fileState = this._newFileState(itemPath, undefined, true /* hasKey */)
        return fileState       // Deleted entry
      } else if (e.code === C.ERROR_CODE.NFS_FILE_NOT_FOUND) {
        debug('no entry found for: %s', itemPath)
        return undefined
      }
      error(e)
      throw e   // Unexpected error so need to handle it in the above catch
    }
  }

  /**
   * Copy an immutable file (re-using existing immutable data)
   *
   * Supports copying a file within a single NFS container (not between
   * containers).
   *
   * @param  {String}  sourcePath
   * @param  {String}  destinationPath
   * @param  {Boolean} copyMetadata    [optional] if true, copies all file metadata (so like 'move')
   * @param  {Boolean} ignoreVersion   [optional] if true, overwrites destination even if last fetched version has changed
   *
   * @return {Promise} C.SUCCESS or an Error object
  */
  async copyFile (sourcePath, destinationPath, copyMetadata, ignoreVersion) {
    debug('%s.copyFile(\'%s\', \'%s\')', this.constructor.name, sourcePath, destinationPath, copyMetadata)
    let result
    try {
      let srcFileState = await this._fetchFileState(sourcePath)
      let srcNfsFile = (srcFileState ? srcFileState._fileFetched : undefined)
      if (!srcNfsFile) {
        let err = new Error('copyFile() source file not found:', sourcePath)
        err.code = C.ERROR_CODE.NO_SUCH_ENTRY
        throw err
      }
      if (!copyMetadata) {
        // TODO need to clear and reset metadata in srcFileState._fileFetched before
        // Have asked for advice on how to do this: https://forum.safedev.org/t/implementing-nfs-api-rename/2109/5?u=happybeing
      }
      let perms // undefined means: if auth is needed, request default permissions
      let destFileState = await this._fetchFileState(destinationPath)
      if (!destFileState) {
        // Destination is a new file, so insert
        result = await this._safeJs.nfsMutate(this.nfs(), perms, 'insert', destinationPath, srcNfsFile)
        this._owner._handleCacheForCreateFileOrOpenWrite(destinationPath)
      } else {
        // Destination exists, so update
        let nfsIgnoreVersionConstant = 0 // TODO use NFS API constant when available
        let nfsVersion = (ignoreVersion ? destFileState.version() + 1 : nfsIgnoreVersionConstant)
        result = await this._safeJs.nfsMutate(this.nfs(), perms, 'update', destinationPath, srcNfsFile, nfsVersion)
        this._destroyFileState(destFileState) // New file so purge the cache
        this.clearNfsFileFor(destinationPath)                  // Flush cached NFS File object
        this._owner._handleCacheForChangedAttributes(destinationPath)
      }

      // After using the fetched file to update another entry, it takes on the version of the other, so needs refreshing
      this._destroyFileState(srcFileState)
    } catch (e) { error(e); return e }

    return result
  }

  /**
   * Rename/move a file (within the same container)
   *
   * Note: SafenetworkApi.renameFile() supports rename/move between containers
   *
   * @param  {String}  sourcePath
   * @param  {String}  destinationPath
   *
   * @return {Promise} Object { status: C.SUCCESS or an Error object
   *                            wasLastItem: true if itemPath folder left emtpy }
   */
  async renameFile (sourcePath, destinationPath) {
    debug('%s.renameFile(\'%s\', \'%s\')', this.constructor.name, sourcePath, destinationPath)
    let status = C.SUCCESS
    let deleteResult
    try {
      if (await this.copyFile(sourcePath, destinationPath, true) === C.SUCCESS) {
        deleteResult = await this.deleteFile(sourcePath)
        if (deleteResult.status === C.SUCCESS) {
          debug('renameFile() succeeded')
        }
      }
      return deleteResult
    } catch (e) {
      error(e)
      status = e
    }

    return { status: status, wasLastItem: (deleteResult ? deleteResult.wasLastItem : undefined) }
  }

  /**
   * Open a file for read or write
   *
   * @param  {String}  itemPath
   * @param  {Number}  nfsFlags SAFE NFS API open() flags
   *
   * @return {Promise} Object { status: C.SUCCESS or an Error object
   *                            fileDescriptor: an integar >0 on success }
   */
  async openFile (itemPath, nfsFlags) {
    debug('%s.openFile(\'%s\', %s)', this.constructor.name, itemPath, nfsFlags)
    let fileState
    let unknownError = this._safeJs.unknownErrorIn('openFile('+itemPath+')')
    try {
      if (itemPath.indexOf('/pack/tmp_pack_') !== -1) {
        debug('opening temp pack file!')
      }

      let result = unknownError
      fileState = await this._fetchFileState(itemPath)
      if (fileState) {
        debug('fileState: %o', fileState)
        result = await fileState.open(this.nfs(), nfsFlags)
      }
      if (result === C.SUCCESS) {
        // The File object returned by open lacks .version / .size of File object returned by fetch()
        // This should be fixed or documented, so try again with v0.9.1 and above (was 0.8.?)
        // Also the error is odd: currently when file open() for write, _fileOpened.size() gives strange error: '-1016: Invalid file mode (e.g. trying to write when file is opened for reading only)')
        debug('(%s) opened, size: ', fileState.fileDescriptor(), await fileState._fileFetched.size())
        debug('fileState: %o', fileState)
        if (fileState.isWriteable()) this._owner._handleCacheForCreateFileOrOpenWrite(itemPath)
        return { status: C.SUCCESS, 'fileDescriptor': fileState.fileDescriptor() }
      } else {
        // Handle failure to open a file
        // Assume this is because it has been created but not yet closed (so doesn't exist on network)

        // At this point we have a new partialliy initialised FileState
        // rather than one which was opened for write
        if (fileState) {
          let lastFd = fileState.fileDescriptor()
          fileState.releaseDescriptor()  // Discard partially initialised state
          // Its likely the preceding fd is what we want so see if it matches
          fileState = allNfsFiles.getFileStateFromCache(lastFd - 1)
          if (fileState && fileState._itemPath !== itemPath) fileState = undefined
        }

        // See if there is a FileState for itemPath as a new file...
        if (!fileState) fileState = allNfsFiles.lookupFileStateForPath(itemPath)

        if (fileState && fileState._fileOpened && fileState.isWriteable()) {
          debug('failed to open file. Assume because file is new, so closing before re-open')
          // Close to commit the file, then re-open for read and open for write
          let fdToReopen = fileState.fileDescriptor()
          result = await this._closeFile(itemPath, fdToReopen, true /* preserveFileState */)
          fileState._fileOpened = undefined
          if (result !== C.SUCCESS) {
            debug('openFile() failed (trying to close() the new file for re-open)')
            throw result
          }

          let file = await this.nfs().fetch(itemPath)
          this._containerNfsFiles[itemPath] = file
          if (file) {
            // (re)open for write/append on existing FileState to maintain fd for write
            fileState._fileFetched = file
            fileState._fileDescriptor = fdToReopen
            fileState._isModified = false
            fileState._fileOpened = undefined
            fileState._versionOpened = undefined
            result = await fileState.open(this.nfs(), this._safeJs.safeApi.CONSTANTS.NFS_FILE_MODE_APPEND)
            if (result === C.SUCCESS) {
              allNfsFiles.restoreFileDescriptorToCache(fdToReopen, fileState)
            } else {
              debug('openFile() failed to re-open new file, closed to allow read')
              throw result
            }

            let readFileState
            try {
              // open for read and return new fd
              readFileState = this._newFileState(itemPath, file, true /* hasKey */)
              result = unknownError
              if (readFileState) result = await readFileState.open(this.nfs(), nfsFlags)
              if (result === C.SUCCESS) {
                return { status: C.SUCCESS, 'fileDescriptor': readFileState.fileDescriptor() }
              }
              throw result
            } catch (e) {
              if (readFileState) readFileState.releaseDescriptor() // open() failed
              debug('openFile() failed trying to open new file for read (using readFileState)')
              throw e
            }
          }
        }

        throw unknownError
      }
    } catch (e) {
      if (fileState) fileState.releaseDescriptor() // open() failed
      debug(e)
      return e
    }
  }

  /**
   * Create a file.
   *
   * @param  {String}  itemPath
   *
   * @return {Promise} Object { status: C.SUCCESS or an Error object
   *                            fileDescriptor: an integar >0 on success }
   */
  async createFile (itemPath) {
    debug('%s.createFile(\'%s\')', this.constructor.name, itemPath)
    let fileState
    try {
      fileState = await this._fetchFileState(itemPath, /* fromNetwork: */ true)
      if (fileState && fileState._fileFetched) {
        let err = new Error('createFile() failed - file exists')
        err.code = C.ERROR_CODE.DATA_EXISTS
        throw err
      }
      if (!fileState) fileState = this._newFileState(itemPath, undefined, /* hasKey */ false)

      if (fileState && (await fileState.create(this.nfs())) === C.SUCCESS) {
        debug('(%s) created: ', fileState.fileDescriptor(), itemPath)
        debug('fileState: %o', fileState)
        this._containerNfsFiles[itemPath] = fileState._fileOpened
        this._owner._handleCacheForCreateFileOrOpenWrite(itemPath)
        return { status: C.SUCCESS, 'fileDescriptor': fileState.fileDescriptor() }
      } else {
        throw this._safeJs.unknownErrorIn('createFile('+itemPath+')')
      }
    } catch (e) {
      if (fileState) {
        this._destroyFileState(fileState)
        this.clearNfsFileFor(itemPath)                  // Flush cached NFS File object
      }
      error(e)
      return { status: e }
    }
  }

  /**
   * Delete file
   * @param  {String}  itemPath
   *
   * @return {Promise} Object { status: C.SUCCESS or an Error object,
   *                            wasLastItem: true if itemPath folder left emtpy }
   */
  async deleteFile (itemPath) {
    debug('%s.deleteFile(\'%s\')', this.constructor.name, itemPath)
    let fileState
    let result
    let wasLastItem = false
    try {
      fileState = await this._fetchFileState(itemPath, /* fromNetwork: */ true)

      if (fileState) {
        // POSIX unlink() decrements the file link count and removes
        // the file when it reaches zero unless the file is open, in
        // which case removal is delayed until close.
        // But we ignore the state which means for an open file the
        // file descriptor will become invalid, and any subsequent
        // operations on it will fail.

        let permissions // use defaults
        result = await this._safeJs.nfsMutate(this.nfs(), permissions, 'delete',
          itemPath, undefined, fileState.version() + 1)
        if (result === C.SUCCESS) {
          debug('deleted: ', itemPath)
          this._destroyFileState(fileState) // Purge from cache
          this.clearNfsFileFor(itemPath)          // Flush cached NFS File object
          wasLastItem = await this._owner._handleCacheForDelete(itemPath)
        } else {
          throw result
        }
      } else {
        result = new Error('%s.deleteFile() - file not found: ', this.constructor.name, itemPath)
        result.code = C.ERROR_CODE.NO_SUCH_ENTRY
      }
    } catch (e) {
      if (fileState) this._destroyFileState(fileState) // Invalidate cached state
      debug(e)
      debug('deleteFile() failed on: ' + itemPath)
      result = e
    }
    return { status: result, 'wasLastItem': wasLastItem }
  }

  /**
   * Get user metadata for a file (file does not need to be open)
   *
   * @param  {Number} fd       [optional] file descriptor obtained from openFile() or createFile()
   *
   *
   * @return {Promise} Object { status: C.SUCCESS or an Error object
   *                            metadata: a buffer containing any metadata as previously set }
   */
  async getFileMetadata (fd) {
    let result
    let fileState
    try {
      fileState = this.getFileStateForDescriptor(fd)
      if (fileState && fileState._fileFetched) {
        return { status: C.SUCCESS, 'metadata': fileState._fileFetched.userMetadata }
      }
    } catch (e) { error(e); result = e}

    return { status: this._safeJs.unknowErrorIn('getFileMetadata()'), 'metadata': fileState._fileFetched.userMetadata }
  }

  /**
   * Set metadata to be written when on closeFile() (for a file opened for write)
   *
   * Note: must only be called after succesful createFile() or openFile() for write
   * @param  {String}  itemPath
   * @param  {Number}  fd       [optional] file descriptor
   * @param  {Buffer}  metadata Metadata that will be written on closeFile()
   *
   * @return {Promise} C.SUCCESS or an Error object
  */
  setFileMetadata (itemPath, fd, metadata) {
    let result
    try {
      let fileState = this.getFileStateForDescriptor(fd)
      if (fileState) fileState._newMetadata = metadata
      this._owner._handleCacheForChangedAttributes(itemPath)
      return C.SUCCESS
    } catch (e) { error(e); return e }
  }

  /**
   * Read up to len bytes starting from pos
   *
   * This function can be used in one of two ways:
   * - simple: just call readFile() and it will read data, and if the
   *   file is not open yet, it will do that first
   * - you can call openFile() before, to open in a specific mode using flags
   *
   * Note: if this function fails, the cached file state is purged and any file
   *       descriptor will be invalidated
   *
   * @param  {String}  itemPath path (key) of the file (in container which owns this _NfsContainerFiles)
   * @param  {Number}  fd       [optional] file descriptor obtained from openFile()
   * @param  {Number}  pos      (Number | C.NFS_FILE_START)
   * @param  {Number}  len      (Number | C.NFS_FILE_END)
   *
   * @return {Promise} Object { status: C.SUCCESS or an Error object,
   *                            content: String containing the bytes read }
   */
  async readFile (itemPath, fd, pos, len) {
    debug('%s.readFile(\'%s\', %s, %s, %s)', this.constructor.name, itemPath, fd, pos, len)
    if (pos === undefined) pos = this._safeJs.safeApi.CONSTANTS.NFS_FILE_START
    if (len === undefined) len = this._safeJs.safeApi.CONSTANTS.NFS_FILE_END

    let fileState
    try {
      fileState = this.getFileStateForDescriptor(fd)
      if (!fileState) {
        let err = new Error('(' + fd + ') readFile() ERROR - invalid file descriptor')
        err.code = C.ERROR_CODE.INVALID_FILE_DESCRIPTOR
        throw err
      }

      let content = ''
      let size = await fileState._fileFetched.size()
      if (pos + len > size) len = size - pos
      if (len > 0 && fileState._fileOpened) {
        content = await fileState._fileOpened.read(pos, len)
        let decoder = new TextDecoder()
        content = decoder.decode(content)
      }
      debug('(%s) %s bytes read', fd, content.length)

      return { status: C.SUCCESS, 'content': content }
    } catch (e) {
      if (fileState) this._destroyFileState(fileState) // read() failed
      debug(e)
      return { status: e }
    }
  }

  /**
   * Read up to len bytes into buf (Uint8Array), starting at pos
   *
   * This function can be used in one of two ways:
   * - simple: just call readFileBuf() and it will read data, and if the
   *   file is not open yet, it will do that first
   * - you can call openFile() before, to open in a specific mode using flags
   *
   * Note: if this function fails, the cached file state is purged and any file
   *       descriptor will be invalidated
   *
   * @param  {String}  itemPath path (key) of the file (in container which owns this _NfsContainerFiles)
   * @param  {Number}  fd       [optional] file descriptor obtained from openFile()
   * @param  {Uint8Array}  buf      [description]
   * @param  {Number}  pos      (Number | CONSTANTS.NFS_FILE_START)
   * @param  {Number}  len      (Number | CONSTANTS.NFS_FILE_END)
   * @return {Promise} Object { status: C.SUCCESS or an Error object,
   *                            bytes: Integer number of bytes read }
   */
  async readFileBuf (itemPath, fd, buf, pos, len) {
    debug('%s.readFileBuf(\'%s\', %s, buf, %s, %s)', this.constructor.name, itemPath, fd, pos, len)
    if (pos === undefined) pos = this._safeJs.safeApi.CONSTANTS.NFS_FILE_START
    if (len === undefined) len = this._safeJs.safeApi.CONSTANTS.NFS_FILE_END

    let fileState
    try {
      fileState = this.getFileStateForDescriptor(fd)
      if (!fileState) throw new Error('(' + fd + ') readFileBuf() ERROR - invalid file descriptor')

      // Attempt to read a file that has just been created will give size 0:
      let size = fileState._fileFetched ? await fileState._fileFetched.size() : 0
      if (pos + len > size) len = size - pos
      if (len > 0 && fileState._fileOpened) {
        let readBuf = await fileState._fileOpened.read(pos, len)
        size = readBuf.byteLength
        buf.set(readBuf)
      } else {
        size = 0
      }

      debug('%s bytes read from file.', size)
      return { status: C.SUCCESS, 'bytes': size }
    } catch (e) {
      if (fileState) this._destroyFileState(fileState) // read() failed
      debug(e)
      return { status: e }
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
   * @param  {String}  itemPath path (key) of the file (in container which owns this _NfsContainerFiles)
   * @param  {Number}  fd       [optional] file descriptor obtained from openFile()
   * @param  {Buffer|String}  content      (Number | CONSTANTS.NFS_FILE_END)
   *
   * @return {Promise} Object { status: C.SUCCESS or an Error object,
   *                            bytes: Integer number of bytes written }
   */
  async writeFile (itemPath, fd, content) {
    debug('%s.writeFile(\'%s\', %s, \'%s\')', this.constructor.name, itemPath, fd, content)
    let fileState
    try {
      fileState = this.getFileStateForDescriptor(fd)
      if (!fileState) throw new Error('(' + fd + ') writeFile() ERROR - invalid file descriptor')

      let bytes = content.length
      await fileState._fileOpened.write(content)
      fileState.setModified()
      fileState._writePos += bytes
      debug('%s bytes written to file.', bytes)
      return { status: C.SUCCESS, 'bytes': size }
    } catch (e) {
      if (fileState) this._destroyFileState(fileState)
      debug(e)
      return { status: e }
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
   * @param  {String}  itemPath path (key) of the file (in container which owns this _NfsContainerFiles)
   * @param  {Number}  fd       [optional] file descriptor obtained from openFile()
   * @param  {Uint8Array}  buf      [description]
   * @param  {Number}  len
   * @param  {Number}  pos  [optional] position of file to write (must not be less than end of last write)
   *
   * @return {Promise} Object { status: C.SUCCESS or an Error object,
   *                            bytes: Integer number of bytes written }
   */
  async writeFileBuf (itemPath, fd, buf, len, pos) {
    debug('%s.writeFileBuf(\'%s\', %s, buf, %s, %s)', this.constructor.name, itemPath, fd, len, pos)
    let fileState
    try {
      fileState = this.getFileStateForDescriptor(fd)
      if (!fileState) throw new Error('(' + fd + ') writeFileBuf() ERROR invalid file descriptor')

      if (fd === 55) {
        debug('fd: ', fd)
      }

      if (pos && pos !== fileState._writePos) {
        debug('MISMATCHED POS: %s WRITE POS: %s', pos, fileState._writePos)
        // TODO insert code to write nulls to fill gap if pos < writePos
        let padlen = fileState._writePos - pos
        if (padlen > 0) {
          let padbuf = Buffer.alloc(padlen) // Inits with zeros
          await fileState._fileOpened.write(padbuf)
          fileState._writePos += padlen
        }
      }

      await fileState._fileOpened.write(buf.slice(0, len))
      fileState._writePos += len
      fileState.setModified()
      debug('%s bytes written to file.', len)
      return { status: C.SUCCESS, 'bytes': len }
    } catch (e) {
      if (fileState) this._destroyFileState(fileState)
      debug(e)
      return { status: e }
    }
  }

  /**
   * Truncate a file to size bytes (only implements size === 0)
   *
   * @private This function is implemented purely to allow FUSE to open a
   * file for append, but overwrite it by first truncating its size to zero.
   * This is needed because POSIX open() only has flags for write, not for
   * append. But since SAFE NFS lacks file truncate, we can only truncate
   * to zero which we do be creating a new file with NFS open().
   *
    * When opening a SAFE NFS file for write we must 'append', otherwise FUSE
   * would have now way to append (since it can only open() for write, not
   * write with append). In turn, the ony way to allow FUSE to be able to open
   * and overwrite an existing NFS file is to implement truncate at size zero.
   *
   * @param  {String}  itemPath
   * @param  {Number}  fd [optional] if omitted, truncates based on itemPath
   * @param  {Number}  size
   *
   * @return {Promise} C.SUCCESS or an Error object
   */
  async _truncateFile (itemPath, fd, size) {
    debug('%s._truncateFile(\'%s\', %s, %s)', this.constructor.name, itemPath, fd, size)
    let fileState
    try {
      if (size !== 0) throw new Error(this.constructor.name + '.truncateFile() not implemented for size other than zero')
      if (fd !== undefined) {
        fileState = this.getFileStateForDescriptor(fd)
        if (fileState) {
          // Get state before it is invalidated by fileState.close()
          await fileState._truncate(this.nfs(), size)
          this._owner._handleCacheForChangedAttributes(itemPath)
          this.clearNfsFileFor(itemPath) // Flush cached NFS File object
          return C.SUCCESS
        }
      } else {
        // When a file is truncated without specifying an open descriptor
        // we truncate any open-for-write NFS Files for this path
        await this.__truncateOpenFiles(itemPath, size)
        this._owner._handleCacheForChangedAttributes(itemPath)
        this.clearNfsFileFor(itemPath) // Flush cached NFS File object
        return C.SUCCESS
      }
    } catch (e) {
      // close/insert/update failed so invalidate cached state
      if (fileState) this._destroyFileState(fileState)
      this._owner._handleCacheForChangedAttributes(itemPath)
      error(e)
      return e
    }
  }

  /**
   * Truncate all open-for-write NFS fetchedFile objects for itemPath
   *
   * @param  {String}  itemPath
   * @param  {Number}  size (must be zero)
   *
   * @return {Promise} C.SUCCESS or an Error object
   */
  async __truncateOpenFiles (itemPath, size) {
    debug('%s.__truncateOpenFiles(\'%s\', %s)', this.constructor.name, itemPath, size)
    try {
      let keys = Object.keys(allNfsFiles._map)
      for (let i = 0, len = keys.length; i < len; i++) {
        let fileState = allNfsFiles._map[keys[i]]
        if (fileState._itemPath === itemPath) {
          let result = await fileState._truncate(this.nfs(), size)
          if (result !== C.SUCCESS) throw result
        }
      }
      return C.SUCCESS
    } catch (e) {
      error(e)
      return e
    }
  }

  /**
   * Close file and save to network
   * @param  {String}  itemPath
   * @param  {Number}  fd
   *
   * @return {Promise} Object { status: C.SUCCESS or an Error object }
   */
  async closeFile (itemPath, fd) {
    debug('%s.closeFile(\'%s\', %s)', this.constructor.name, itemPath, fd)
    return this._closeFile(itemPath, fd, false)
  }

  /**
   * @Private
   * Close file and save to network
   * @param  {String}  itemPath
   * @param  {Number}  fd
   * @param  {boolean} preserveFileState (unless close fails)
   *
   * @return {Promise} Object { status: C.SUCCESS or an Error object }
   */
  async _closeFile (itemPath, fd, preserveFileState) {
    debug('%s._closeFile(\'%s\', %s)', this.constructor.name, itemPath, fd)
    let fileState
    let result = C.SUCCESS
    try {
      if (fd !== undefined) {
        fileState = this.getFileStateForDescriptor(fd)
      }

      if (fileState && fileState.isOpen()) {
        // Get state before it is invalidated by fileState.close()
        let isModified = fileState.isModified()
        let version = fileState.version()
        await fileState.close(this.nfs())
        if (isModified) {
          this.clearNfsFileFor(itemPath) // Flush cached NFS File object
          this._owner._handleCacheForChangedAttributes(itemPath)
          let permissions // use defaults
          debug('doing %s(\'%s\')', fileState.hasKey ? 'update' : 'insert', itemPath)
          result = await this._safeJs.nfsMutate(this.nfs(), permissions, (fileState.hasKey ? 'update' : 'insert'),
            fileState._itemPath, fileState._fileOpened, version + 1, fileState._newMetadata)
        }
        if (!preserveFileState) this._destroyFileState(fileState) // Invalidate cached state after closeFile()
      }
      if (result !== C.SUCCESS) throw this._safeJs.unknownErrorIn('_closeFile('+itemPath+')')

      return result
    } catch (e) {
      // close/insert/update failed so invalidate cached state
      if (fileState) this._destroyFileState(fileState)
      error(e)
      if (e.code === C.ERROR_CODE.LOW_BALANCE) {
        this._safeJs.enableLowBalanceWarning()
      }
      return e
    }
  }
}

const allNfsFiles = new _AllNfsFiles()

module.exports.allNfsFiles = allNfsFiles
module.exports.NfsFileState = NfsFileState
module.exports._NfsContainerFiles = _NfsContainerFiles
