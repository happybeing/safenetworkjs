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
  constructor (itemPath, file) {
    this._isNewFile = undefined
    this._flags = undefined           // When open, set to NFS flags (e.g. NFS_FILE_MODE_READ etc)

    // File identity and state
    this._fileDescriptor = undefined  // Valid only while open
    this._itemPath = itemPath
    this._file = file                 // Defined after successful fetch (existing file) or open (new file)
    this._version = undefined         // Version when opened
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

  isOpen () { return this._fileDescriptor !== undefined }
  isNew () { return this._isNewFile }
  version () { return this._file ? this._file._version : undefined }

  isWriteable () {
    return this._flags === safeApi.CONSTANTS.NFS_FILE_MODE_OVERWRITE ||
           this._flags === safeApi.CONSTANTS.NFS_FILE_MODE_APPEND
  }

  async create (nfs) {
    try {
      this._file = await nfs.open()
      if (this._file) {
        this._fileDescriptor = allNfsFiles.newDescriptor(this)
        this._isNewFile = true
        this._flags = safeApi.CONSTANTS.NFS_FILE_MODE_OVERWRITE
        this._version = 0
        return true
      }
    } catch (e) { debug(e) }
    return false
  }

  async open (nfs, nfsFlags) {
    try {
      this._file = await nfs.open(this._file, nfsFlags)
      if (this._file) {
        this._fileDescriptor = allNfsFiles.newDescriptor(this)
        this._flags = nfsFlags
        this._version = this._file.version
        return true
      }
    } catch (e) { debug(e) }
    return false
  }

  async close (nfs) {
    try {
      this.releaseDescriptor()
      this._flags = undefined
      if (this._file) this._file.close()
    } catch (e) { debug(e) }
  }
}

class NfsContainerFiles {
  constructor (nfs) {
    this._nfs = nfs
    this._containerFilesMap = []  // Map nfs+path to NfsFileState objects
  }

  getCachedFileState (itemPath, fd) {
    let fileState
    if (fd !== undefined) fileState = allNfsFiles.getFileState(fd)
    if (!fileState) fileState = this.getFileStateFromPath(itemPath)
    return fileState
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
    let nfsFileState
    try {
      nfsFileState = this.getCachedFileState(itemPath, fd)
      if (nfsFileState) return nfsFileState
      return this._fetchFileState(itemPath)  // NFS fetch() and create FileState object
    } catch (e) { debug(e) }
  }

  getFileStateFromPath (itemPath) {
    return this._containerFilesMap[itemPath]
  }

  nfs () { return this._nfs }

  async _newFileState (itemPath) {
    debug('%s._newFileState(\'%s\', %s)', this.constructor.name, itemPath)
    try {
      let fileState = new NfsFileState(itemPath)
      this._containerFilesMap[itemPath] = fileState
      return fileState
    } catch (e) { debug(e) }
  }

  async _fetchFileState (itemPath) {
    debug('%s._fetchFileState(\'%s\', %s)', this.constructor.name, itemPath)
    try {
      let fileState
      let file = await this.nfs().fetch(itemPath)
      if (file) {
        fileState = new NfsFileState(itemPath, file)
        this._containerFilesMap[itemPath] = fileState
      }

      return fileState
    } catch (e) { debug(e) }
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

  async openFile (itemPath, nfsFlags) {
    debug('%s.openFile(\'%s\', %s)', this.constructor.name, itemPath, nfsFlags)
    let fileState
    try {
      fileState = this.getFileStateFromPath(itemPath)
      if (fileState && fileState.isOpen()) this.closeFile(itemPath)  // If already open make sure it is closed

      if (!fileState) fileState = await this._fetchFileState(itemPath)
      if (fileState && await fileState.open(this.nfs(), nfsFlags)) {
        debug('file (%s) opened, size: ', fileState.fileDescriptor(), await fileState._file.size())
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
      fileState = this.getFileStateFromPath(itemPath)
      if (fileState) {
        if (fileState.isOpen()) this.closeFile(itemPath)  // Leave the file closed
        throw new Error('createFile() failed - file exists')
      }

      if (!fileState) fileState = await this._newFileState(itemPath)
      if (fileState && await fileState.create(this.nfs())) {
        debug('file (%s) created: ', fileState.fileDescriptor())
        return fileState.fileDescriptor()
      } else {
        throw new Error('createFile() failed')
      }
    } catch (e) {
      if (fileState) fileState.releaseDescriptor() // File is not open
      debug(e.message)
      throw e
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
      if (fileState && fileState._file) return fileState._file.userMetadata
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
          debug('file (%s) opened, size: ', fileState.fileDescriptor(), await fileState._file.size())
        } else {
          throw new Error('failed to open file')
        }
      }
      let size = await fileState._file.size()
      if (pos + len > size) len = size - pos
      let content = await fileState._file.read(pos, len)
      debug('%s bytes read from file.', content.byteLength)

      let decoder = new TextDecoder()
      return decoder.decode(content)
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
          debug('file (%s) opened, size: ', fileState.fileDescriptor(), await fileState._file.size())
        } else {
          throw new Error('failed to open file')
        }
      }
      let size = await fileState._file.size()
      if (pos + len > size) len = size - pos
      let readBuf = await fileState._file.read(pos, len)
      debug('%s bytes read from file.', readBuf.byteLength)
      buf.set(readBuf)
      return readBuf.byteLength
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
    debug('%s.writeFile(\'%s\', %s, ...)', this.constructor.name, itemPath, fd)
    let fileState
    try {
      fileState = await this.getOrFetchFileState(itemPath, fd)
      if (!fileState.isOpen()) {
        if (await fileState.open(this.nfs(), safeApi.CONSTANTS.NFS_FILE_MODE_OVERWRITE)) {
          debug('file (%s) opened, size: ', fileState.fileDescriptor(), await fileState._file.size())
        } else {
          throw new Error('failed to open file')
        }
      }
      let bytes = content.length
      await fileState._file.write(content)
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
    debug('%s.writeFileBuf(\'%s\', %s, %s, \'%s\')', this.constructor.name, itemPath, fd, buf, len)
    let fileState
    try {
      fileState = await this.getOrFetchFileState(itemPath, fd)
      if (!fileState.isOpen()) {
        if (await fileState.open(this.nfs(), safeApi.CONSTANTS.NFS_FILE_MODE_OVERWRITE)) {
          debug('file (%s) opened, size: ', fileState.fileDescriptor(), await fileState._file.size())
        } else {
          throw new Error('failed to open file')
        }
      }
      await fileState._file.write(buf.slice(0, len))
      debug('%s bytes written to file.', len)
      return len
    } catch (e) {
      if (fileState) this._purgeFileState(fileState)
      debug(e.message)
      throw e
    }
  }

  // TODO review error returns, maybe based on
  async closeFile (itemPath, fd) {
    debug('%s.closeFile(\'%s\', %s)', this.constructor.name, itemPath, fd)
    let fileState
    try {
      if (fd !== undefined) {
        fileState = allNfsFiles.getFileState(fd)
      }
      if (!fileState) fileState = this.getFileStateFromPath(itemPath)

      if (fileState && fileState.isOpen()) {
        let isWriteable = fileState.isWriteable()
        fileState.close(this.nfs())
        if (isWriteable) {
          let mutationHandle = await window.safeMutableData.newMutation(this.appHandle())

          // TODO use/adapt this back to encrypt if the MD is private
          // let useKey = await window.safeMutableData.encryptKey(mdHandle, key)
          // let useValue = await window.safeMutableData.encryptValue(mdHandle, value)

          if (fileState.isNew()) {
            this.nfs().insert(fileState._itemPath, fileState._file, fileState._newMetadata)
          } else {
            this.nfs().update(fileState._itemPath, fileState._file, fileState.version() + 1, fileState._newMetadata)
          }
        }
      }

      return 0  // Success
    } catch (e) {
      // close/insert/update failed so invalidate cached state
      if (fileState) this._purgeFilesState(fileState)
      debug(e)
    }
  }
}

const allNfsFiles = new _AllNfsFiles()

module.exports.allNfsFiles = allNfsFiles
module.exports.NfsFileState = NfsFileState
module.exports.NfsContainerFiles = NfsContainerFiles
