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
 * File state is held in two caches (maps). One maps the file descriptors
 * to the file state object (class NfsFileState) and is application-wide.
 * The second maps itemPath within a container to the file state object's
 * being used by the container. A container object uses an instance of
 * NfsContainerFiles class for this.
 *
 * Use of File Descriptors is Optional
 * -----------------------------------
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
 * A higher level class (e.g. NfsContainer) can use a NfsContainerFiles
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

require('fast-text-encoding') // TextEncoder, TextDecoder (for desktop apps)
const safeApi = require('@maidsafe/safe-node-app')

// const safeJsApi = require('safenetworkjs').SafenetworkApi
// const SafeJs = require('./safenetwork-api').SafenetworkApi
// const SAFE_ERRORS = require('./safenetwork-api').SAFE_ERRORS
const CONSTANTS = require('./constants').CONSTANTS

const minFileDescriptor = 1

class _AllNfsFiles {
  /**
   * App wide map of file descriptors to open NfsFile objects
   */
  constructor () {
    this._map = []
    this._nextFileDescriptor = minFileDescriptor
  }

  newDescriptor (file) {
    while (this._map[this._nextFileDescriptor] !== undefined) {
      debug('%s WARNING: file descriptor %s in use, next...', this.constructor._name, this._nextFileDescriptor)
      if (this._nextFileDescriptor < Number.MAX_SAFE_INTEGER) {
        this._nextFileDescriptor++
      } else {
        this._nextFileDescriptor = minFileDescriptor
      }
    }
    this._map[this._nextFileDescriptor] = file
    return this._nextFileDescriptor++
  }

  // By deleting descriptors (called by close()) we reduce the chances of ever
  // running out. If app fails to close files, this might still happen eventually
  deleteDescriptor (descriptor) {
    this._map[descriptor] = undefined
  }

  getFileState (descriptor) {
    return this._map[descriptor]
  }
}

/**
 * Manage file state through different file operation sequences
 *
 * The following sequences use either the file descriptors returned
 * by openFile() and createFile() to maintain state across the
 * series of operations.
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
  constructor (itemPath, fileFetched, hasKey) {
    this.hasKey = hasKey              // Used to decide whether to insert() or update() the entry
    this._flags = undefined           // When open, set to NFS flags (e.g. NFS_FILE_MODE_READ etc)

    // File identity and state
    this._fileDescriptor = undefined  // Valid only while open
    this._itemPath = itemPath
    this._fileFetched = fileFetched   // NFS File returned by fetch (existing file)
    this._fileOpened = undefined      // NFS File returned by open (new or existing - but lacks size, version etc)
    this._versionOpened = undefined   // Version when opened
    this._newMetaData = undefined     // If set, will be written on closeFile()
  }

  fileDescriptor () { return this._fileDescriptor } // Positive integer unique per open file in this app

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

  isDeletedFile () { return this.hasKey && !this._fileFetched }
  isOpen () { return this._fileDescriptor !== undefined }
  version () { return this._fileFetched ? this._fileFetched.version : undefined }

  isWriteable (flags) {
    if (!flags) flags = this._flags
    return flags === safeApi.CONSTANTS.NFS_FILE_MODE_OVERWRITE ||
           flags === safeApi.CONSTANTS.NFS_FILE_MODE_APPEND
  }

  async create (nfs) {
    try {
      this._fileOpened = await nfs.open()
      if (this._fileOpened) {
        this._fileDescriptor = allNfsFiles.newDescriptor(this)
        this._flags = safeApi.CONSTANTS.NFS_FILE_MODE_OVERWRITE
        this._versionOpened = 0
        return true
      }
    } catch (e) { debug(e) }
    return false
  }

  async open (nfs, nfsFlags) {
    try {
      // this._fileOpened = this.isWriteable(nfsFlags) ? await nfs.open() : await nfs.open(this._fileFetched, nfsFlags)
      let opened
      if (this.isWriteable(nfsFlags)) {
        if (this._fileFetched) {
          opened = await nfs.open(this._fileFetched, nfsFlags)
        } else {
          opened = await nfs.open()
        }
        debug('%s opened for write')
      } else {
        let size
        this.isEmptyOpen = undefined
        try {
          // NFS fails to open zero length files for read, so we must fake it
          size = await this._fileFetched.size()
          this.isEmptyOpen = (size === 0)
        } catch (discard) {}

        if (!this.isEmptyOpen) opened = await nfs.open(this._fileFetched, nfsFlags)
        debug('%s opened for read (size: %s)', size)
      }
      this._fileOpened = opened

      if (this._fileOpened || this.isEmptyOpen) {
        this._fileDescriptor = allNfsFiles.newDescriptor(this)
        this._flags = nfsFlags
        this._versionOpened = this._fileFetched.version
        return true
      }
    } catch (e) { debug(e) }
    return false
  }

  /**
   * Truncate a file to size bytes (only implemented for size equal to zero)
   */
  async _truncate (nfs, size) {
    try {
      if (size !== 0) throw new Error('_truncateFile() not implemented for size other than zero')

      let nfsFlags = safeApi.CONSTANTS.NFS_FILE_MODE_OVERWRITE
      if (this._fileFetched) {
        if (this._fileOpened) await this._fileOpened.close()
        this._fileOpened = await nfs.open(this._fileFetched, nfsFlags)
      }
      debug('%s truncated by re-opening for overwrite')

      if (this._fileOpened || this.isEmptyOpen) {
        this._flags = nfsFlags
        this._versionOpened = this._fileFetched ? this._fileFetched.version : 0
        return true
      }
    } catch (e) { debug(e) }
    return false
  }

  async close (nfs) {
    try {
      this.releaseDescriptor()
      this._flags = undefined
      // TODO should we discard this._fileFetched here (is version, size or other state valid?)
      if (this._fileOpened) await this._fileOpened.close()
    } catch (e) { debug(e) }
  }
}

class NfsContainerFiles {
  constructor (safeJs, mData, nfs) {
    this._safeJs = safeJs
    this._mData = mData
    this._nfs = nfs
    this._containerFilesMap = []  // Map nfs+path to NfsFileState objects
  }

  getCachedFileState (itemPath, fd) {
    let fileState
    if (fd !== undefined) fileState = allNfsFiles.getFileState(fd)
    if (!fileState) fileState = this.getFileStateFromPathCache(itemPath)
    return fileState
  }

  isWriteable (itemPath, fd) {
    let fileState = this.getCachedFileState(itemPath, fd)
    return (fileState && fileState.isWriteable())
  }

  /**
   * get cached state from file descriptor or path
   *
   * This is a way to do NFS fetch() while minimising extra fetch() calls
   * by caching FileState objects.
   *
   * If given a file descriptor, the file state is retrieved from a cache
   * If fd is undefined, the container's cache is checked using the path,
   * but if the state is not yet cached, NFS fetch() is attempted to
   * get the state and add it to the cache.
   *
   * @param  {String}  itemPath [optional] the path relative to a container (ie key)
   * @param  {Number}  fd       [optional] a file descriptor (> 0) obtained from createFile() or openFile()
   * @return {NfsFileState}
   */
  async getOrFetchFileState (itemPath, fd) {
    let fileState
    try {
      fileState = this.getCachedFileState(itemPath, fd)
      if (fileState) return fileState
      return this._fetchFileState(itemPath)  // NFS fetch() and create FileState object
    } catch (e) { debug(e) }
  }

  getFileStateFromPathCache (itemPath) {
    return this._containerFilesMap[itemPath]
  }

  nfs () { return this._nfs }

  _newFileState (itemPath, file, hasKey) {
    debug('%s._newFileState(\'%s\', %s, %s, %s)', this.constructor.name, itemPath, file, hasKey)
    try {
      let fileState = new NfsFileState(itemPath, file, hasKey)
      this._containerFilesMap[itemPath] = fileState
      debug('fileState: %o', fileState)
      return fileState
    } catch (e) { debug(e) }
  }

  /**
   * Fetch file state from the network
   *
   * @param  {String}  itemPath A path (NFS entry key)
   * @return {Promise}          FileState (active or deleted), or undefined (no key entry)
   */
  async _fetchFileState (itemPath) {
    debug('%s._fetchFileState(\'%s\', %s)', this.constructor.name, itemPath)
    let fileState
    try {
      let file = await this.nfs().fetch(itemPath)
      if (file) {
        fileState = this._newFileState(itemPath, file, true)
        debug('fileState fetched for: %s', itemPath)
        debug('fileState: %o', fileState)
      } else {
        debug('no entry found for: %s', itemPath)
      }
      return fileState
    } catch (e) {
      if (e.code === CONSTANTS.ERROR_CODE.ENCODE_DECODE_ERROR) {
        debug('deleted entry found: %s', itemPath)
        fileState = this._newFileState(itemPath, undefined, true)
        return fileState       // Deleted entry
      } else if (e.code === CONSTANTS.ERROR_CODE.NFS_FILE_NOT_FOUND) {
        debug('no entry found for: %s', itemPath)
        return undefined
      }
      debug(e)
      throw e   // Unexpected error so update above to handle it
    }
  }

  /**
   * Release any file descriptor and remove this state object from cache
   * @param  {FileState} fileState
   */
  _purgeFileState (fileState) {
    fileState.releaseDescriptor()
    if (fileState._itemPath.length > 0) {
      this._containerFilesMap[fileState._itemPath] = undefined
    }
  }

  /**
   * Copy an immutable file (re-using existing immutable data)
   *
   * Supports copying a file within a single NFS container (not between
   * containers).
   * @param  {String}  sourcePath
   * @param  {String}  destinationPath
   * @param  {Boolean} copyMetadata    [optional] if true, copies all file metadata (so like 'move')
   * @return {Promise}                 [description]
   */
  async copyFile (sourcePath, destinationPath, copyMetadata) {
    debug('%s.copyFile(\'%s\', \'%s\')', this.constructor.name, sourcePath, destinationPath, copyMetadata)
    try {
      let srcFileState = await this.getOrFetchFileState(sourcePath)
      if (!srcFileState) throw new Error('copyFile error - source file not found:', sourcePath)

      if (!copyMetadata) {
        // TODO need to clear and reset metadata in srcFileState._fileFetched before
        // Have asked for advice on how to do this: https://forum.safedev.org/t/implementing-nfs-api-rename/2109/5?u=happybeing
      }
      let perms // If auth needed, request default permissions
      let destFileState = await this.getOrFetchFileState(destinationPath)
      if (!destFileState) {
        // Destination is a new file, so insert
        await this._safeJs.nfsMutate(this.nfs(), perms, 'insert', destinationPath, srcFileState._fileFetched)
      } else {
        // Destination exists, so update
        await this._safeJs.nfsMutate(this.nfs(), perms, 'update', destinationPath, srcFileState._fileFetched, destFileState.version() + 1)
        await this._purgeFileState(destFileState) // New file so purge the cache
      }
      // After using the fetched file to update another entry, it takes on the version of the other, so needs refreshing
      await this._purgeFileState(srcFileState)
    } catch (e) {
      debug(e)
      throw e
    }
  }

  /**
   * Move a file to a new name or path in the same container
   *
   * @param  {String}  sourcePath
   * @param  {String}  destinationPath
   * @return {Promise}
   */
  async moveFile (sourcePath, destinationPath) {
    debug('%s.moveFile(\'%s\', \'%s\')', this.constructor.name, sourcePath, destinationPath)
    try {
      await this.copyFile(sourcePath, destinationPath, true)
      await this.deleteFile(sourcePath)
    } catch (e) {
      debug(e)
      throw e
    }
  }

  async openFile (itemPath, nfsFlags) {
    debug('%s.openFile(\'%s\', %s)', this.constructor.name, itemPath, nfsFlags)
    let fileState
    try {
      fileState = this.getFileStateFromPathCache(itemPath)
      if (fileState && fileState.isOpen()) await this.closeFile(itemPath)  // If already open make sure it is closed
      if (fileState) debug('fileState: %o', fileState)

      if (!fileState) fileState = await this._fetchFileState(itemPath)
      if (fileState && await fileState.open(this.nfs(), nfsFlags)) {
        // The File object returned by open lacks .version / .size of File object returned by fetch()
        // This should be fixed or documented, so try again with v0.9.1
        // Also the error is odd: currently when file open() for write, _fileOpened.size() gives strange error: '-1016: Invalid file mode (e.g. trying to write when file is opened for reading only)')
        debug('file (%s) opened, size: ', fileState.fileDescriptor(), await fileState._fileFetched.size())
        debug('fileState: %o', fileState)
        return fileState.fileDescriptor()
      } else {
        throw new Error('openFile() failed')
      }
    } catch (e) {
      if (fileState) fileState.releaseDescriptor() // open() failed
      debug(e.message)
      throw e
    }
  }

  async createFile (itemPath) {
    debug('%s.createFile(\'%s\')', this.constructor.name, itemPath)
    let fileState
    try {
      fileState = await this.getOrFetchFileState(itemPath)
      if (fileState) {
        if (fileState._fileFetched) throw new Error('createFile() failed - file exists')
      }

      if (!fileState) fileState = await this._newFileState(itemPath, undefined, false)
      if (fileState && await fileState.create(this.nfs())) {
        debug('file (%s) created: ', fileState.fileDescriptor())
        debug('fileState: %o', fileState)
        return fileState.fileDescriptor()
      } else {
        throw new Error('createFile() failed')
      }
    } catch (e) {
      if (fileState) this._purgeFileState(fileState)
      debug(e)
      throw e
    }
  }

  async deleteFile (itemPath) {
    debug('%s.deleteFile(\'%s\')', this.constructor.name, itemPath)
    let fileState
    try {
      fileState = await this.getOrFetchFileState(itemPath)

      if (fileState) {
        // POSIX unlink() decrements the file link count and removes
        // the file when it reaches zero unless the file is open, in
        // which case removal is delayed until close.
        // But we ignore the state which means for an open file the
        // file descriptor will become invalid, and any subsequent
        // operations on it will fail.

        let permissions // use defaults
        await this._safeJs.nfsMutate(this.nfs(), permissions, 'delete',
          itemPath, undefined, fileState.version() + 1)
        this._purgeFileState(fileState) // File no longer exists so purge cache
        debug('file deleted: ', itemPath)
      } else {
        throw new Error('file not found: ', itemPath)
      }
    } catch (e) {
      if (fileState) this._purgeFileState(fileState) // Invalidate cached state
      debug(e.message)
      throw new Error('deleteFile() failed on: ' + itemPath)
    }
  }

  /**
   * Get user metadata for a file (file does not need to be open)
   * @param  {String} itemPath
   * @param  {Number} fd       [optional] file descriptor obtained from openFile() or createFile()
   * @return {Promise}         A buffer containing any metadata as previously set
   */
  async getFileMetadata (itemPath, fd) {
    let fileState
    try {
      fileState = await this.getOrFetchFileState(itemPath, fd)
      if (fileState && fileState._fileFetched) return fileState._fileFetched.userMetadata
    } catch (e) { debug(e) }
  }

  /**
   * Set metadata to be written when on closeFile() (for a file opened for write)
   *
   * Note: must only be called after succesful createFile() or openFile() for write
   * @param  {String}  itemPath
   * @param  {Number}  fd       [optional] file descriptor
   * @param  {Buffer}  metadata Metadata that will be written on closeFile()
   */
  setFileMetadata (itemPath, fd, metadata) {
    try {
      let fileState = this.getCachedFileState(itemPath, fd)
      if (fileState) fileState._newMetadata = metadata
    } catch (e) { debug(e) }
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
   * @param  {String}  itemPath path (key) of the file (in container which owns this NfsContainerFiles)
   * @param  {Number}  fd       [optional] file descriptor obtained from openFile()
   * @param  {Number}  pos      (Number | CONSTANTS.NFS_FILE_START)
   * @param  {Number}  len      (Number | CONSTANTS.NFS_FILE_END)
   * @return {Promise}          String container bytes read
   */
  async readFile (itemPath, fd, pos, len) {
    debug('%s.readFile(\'%s\', %s, %s, %s)', this.constructor.name, itemPath, fd, pos, len)
    if (pos === undefined) pos = safeApi.CONSTANTS.NFS_FILE_START
    if (len === undefined) len = safeApi.CONSTANTS.NFS_FILE_END

    let fileState
    try {
      if (!fileState.isOpen()) {
        if (await fileState.open(this.nfs(), safeApi.CONSTANTS.NFS_FILE_MODE_READ)) {
          debug('file (%s) opened, size: ', fileState.fileDescriptor(), await fileState._fileFetched.size())
        } else {
          throw new Error('failed to open file')
        }
      }
      let content = ''
      let size = await fileState._fileFetched.size()
      if (pos + len > size) len = size - pos
      if (len > 0 && fileState._fileOpened) {
        content = await fileState._fileOpened.read(pos, len)
        let decoder = new TextDecoder()
        content = decoder.decode(content)
      }
      debug('%s bytes read from file.', content.length)

      return content
    } catch (e) {
      if (fileState) this._purgeFileState(fileState) // read() failed
      debug(e.message)
      throw e
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
   * @param  {String}  itemPath path (key) of the file (in container which owns this NfsContainerFiles)
   * @param  {Number}  fd       [optional] file descriptor obtained from openFile()
   * @param  {Uint8Array}  buf      [description]
   * @param  {Number}  pos      (Number | CONSTANTS.NFS_FILE_START)
   * @param  {Number}  len      (Number | CONSTANTS.NFS_FILE_END)
   * @return {Promise}          Number of bytes read into buf
   */
  async readFileBuf (itemPath, fd, buf, pos, len) {
    debug('%s.readFileBuf(\'%s\', %s, buf, %s, %s)', this.constructor.name, itemPath, fd, pos, len)
    if (pos === undefined) pos = safeApi.CONSTANTS.NFS_FILE_START
    if (len === undefined) len = safeApi.CONSTANTS.NFS_FILE_END

    let fileState
    try {
      fileState = await this.getOrFetchFileState(itemPath, fd)
      if (!fileState.isOpen()) {
        if (await fileState.open(this.nfs(), safeApi.CONSTANTS.NFS_FILE_MODE_READ)) {
          debug('file (%s) opened, size: ', fileState.fileDescriptor(), await fileState._fileFetched.size())
        } else {
          throw new Error('failed to open file')
        }
      }

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
      return size
    } catch (e) {
      if (fileState) this._purgeFileState(fileState) // read() failed
      debug(e.message)
      throw e
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
    debug('%s.writeFile(\'%s\', %s, \'%s\')', this.constructor.name, itemPath, fd, content)
    let fileState
    try {
      fileState = await this.getOrFetchFileState(itemPath, fd)
      if (!fileState.isOpen()) {
        if (await fileState.open(this.nfs(), safeApi.CONSTANTS.NFS_FILE_MODE_OVERWRITE)) {
          debug('file (%s) opened, size: ', fileState.fileDescriptor(), await fileState._fileFetched.size())
        } else {
          throw new Error('failed to open file')
        }
      }
      let bytes = content.length
      await fileState._fileOpened.write(content)
      debug('%s bytes written to file.', bytes)
      return bytes
    } catch (e) {
      if (fileState) this._purgeFileState(fileState)
      debug(e.message)
      throw e
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
    debug('%s.writeFileBuf(\'%s\', %s, buf, %s)', this.constructor.name, itemPath, fd, len)
    let fileState
    try {
      fileState = await this.getOrFetchFileState(itemPath, fd)
      if (!fileState.isOpen()) {
        if (await fileState.open(this.nfs(), safeApi.CONSTANTS.NFS_FILE_MODE_OVERWRITE)) {
          debug('file (%s) opened, size: ', fileState.fileDescriptor(), await fileState._fileFetched.size())
        } else {
          throw new Error('failed to open file')
        }
      }
      await fileState._fileOpened.write(buf.slice(0, len))
      debug('%s bytes written to file.', len)
      return len
    } catch (e) {
      if (fileState) this._purgeFileState(fileState)
      debug(e.message)
      throw e
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
   * @param  {Number}  fd
   * @param  {Number}  size
   * @return {Promise}
   */
  async _truncateFile (itemPath, fd, size) {
    debug('%s._truncateFile(\'%s\', %s, %s)', this.constructor.name, itemPath, fd, size)
    let fileState
    try {
      if (size !== 0) throw new Error('truncateFile() not implemented for size other than zero')
      if (fd !== undefined) {
        fileState = allNfsFiles.getFileState(fd)
      }
      if (!fileState) fileState = this.getFileStateFromPathCache(itemPath)

      if (fileState && fileState.isOpen() && fileState.isWriteable()) {
        // Get state before it is invalidated by fileState.close()
        await fileState._truncate(this.nfs(), size)
        return 0  // Success
      }
    } catch (e) {
      // close/insert/update failed so invalidate cached state
      if (fileState) this._purgeFileState(fileState)
      debug(e)
    }
  }

  // TODO review error returns
  async closeFile (itemPath, fd) {
    debug('%s.closeFile(\'%s\', %s)', this.constructor.name, itemPath, fd)
    let fileState
    try {
      if (fd !== undefined) {
        fileState = allNfsFiles.getFileState(fd)
      }
      if (!fileState) fileState = this.getFileStateFromPathCache(itemPath)

      if (fileState && fileState.isOpen()) {
        let isWriteable = fileState.isWriteable()
        // Get state before it is invalidated by fileState.close()
        let version = fileState.version()
        await fileState.close(this.nfs())
        if (isWriteable) {
          let permissions // use defaults
          debug('doing %s(\'%s\')', fileState.hasKey ? 'update' : 'insert', itemPath)
          await this._safeJs.nfsMutate(this.nfs(), permissions, (fileState.hasKey ? 'update' : 'insert'),
            fileState._itemPath, fileState._fileOpened, version + 1, fileState._newMetadata)
        }
        this._purgeFileState(fileState) // Invalidate cached state after closeFile()
      }

      return 0  // Success
    } catch (e) {
      // close/insert/update failed so invalidate cached state
      if (fileState) this._purgeFileState(fileState)
      debug(e)
    }
  }
}

const allNfsFiles = new _AllNfsFiles()

module.exports.allNfsFiles = allNfsFiles
module.exports.NfsFileState = NfsFileState
module.exports.NfsContainerFiles = NfsContainerFiles
