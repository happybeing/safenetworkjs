/* TODO theWebalyst:
[/] npm link for development of safenetwork-fuse
[x] get simple auth working so safenetwork-fuse auths with mock
  -> CLI, so uses .fromAuthUri() then calls SafenetworkApi.setSafeAppHandle()
[/] First release v0.1.0:
    safe-containers.js wrappers for default containers with simplified JSON
    file system like interface for each:
  [/] SafeContainer
    [/] Testing using Safepress2press Safepress3press:
        - First _public entry is /remotestorage/documents/notes/517F2A9F-5409-49B7-8714-1209B3DE3834
        [/] BUG It trys getattr on _public/documents not _public/remotestorage
        [/] BUG Need to detect pseudo folder /remotestorage etc and handle different from the full entry
            could just have defaults for when I getEntryValue() fails
  [/] put FUSE ops on the above for now, but later:
    [/] if poss. move the FUSE ops back into the safenetwork-fuse
        handlers (RootHander, PublicNamesHandler, ServicesHandler, NfsHandler etc)
  [/]   PublicContainer (_public)
  [/]   PrivateContainer (_music)
  [/]     PublicNamesContainer (_publicNames)
      [/] add listing of _publicNames
  [/]     modify to ignore webidpoc entries
  [/]   ServicesContainer
      [/] add listing of public name services
  [/]   NfsContainer
    [/] wire into Public container (by automount when readdir() on its key?)
    [/] update nodejs version and change use of entries forEach to listEntries
    [/] ensure all uses of listEntries work correctly (e.g. using push(new Promise()))
    [/] first useful release - read only access to _public, including listing file contents:
      [/] add ability to read file content (e.g. cat <somefile>)
        [/] readFileBuf(path)
      [/] implement _publicNames
        [/] listing of public names
        [/] listing of services
        [/] listing of files under a service container
      [/] create new account for more tests - _publicNames for garbage after an upload
          -> a/c 1 has only one public name but two entries, one of which is garbage
          -> a/c 2 has no public names and no entris
          [/] create a/c 3 and upload one public name - check number of entries / garbage?
          I created a/c 3 and using the WHM PoC began adding a public name.
          Before publishing, I listed _publicNames and it contains
          the id 'grouptabs' but also now has a second 'garbage' entry
          like a/c 1. I think a/c 1 used the old WHM (not the PoC).
          [/] add second public name to a/c 3 with files and use
          [/] add task.rsapp
          [/] test more thoroughly
          -> Now have two ''garbage' entries!
          [/] cp -R ~/SAFE/_public/rsapp/root-task ~/src/rs/rsapps/taskrs._public
          [/] diff -r ~/src/rs/rsapps/taskrs ~/src/rs/rsapps/taskrs._public
            Some files weren't uploaded by WHM!!! It did give an error :-)...
              Only in /home/mrh/src/rs/rsapps/taskrs: bower_components
              Only in /home/mrh/src/rs/rsapps/taskrs: build
              Only in /home/mrh/src/rs/rsapps/taskrs._public/css: all.css
              Only in /home/mrh/src/rs/rsapps/taskrs/css: app.less
              Only in /home/mrh/src/rs/rsapps/taskrs: .eslintrc
              Only in /home/mrh/src/rs/rsapps/taskrs._public: fonts
              Only in /home/mrh/src/rs/rsapps/taskrs: .git
              Only in /home/mrh/src/rs/rsapps/taskrs: .gitignore
              Only in /home/mrh/src/rs/rsapps/taskrs._public: index.html
              Only in /home/mrh/src/rs/rsapps/taskrs._public/js: all.js
              Only in /home/mrh/src/rs/rsapps/taskrs/js: app.js
              Only in /home/mrh/src/rs/rsapps/taskrs/js: model.js
              Only in /home/mrh/src/rs/rsapps/taskrs/js: utils.js
              Only in /home/mrh/src/rs/rsapps/taskrs: LICENSE
              Only in /home/mrh/src/rs/rsapps/taskrs: Makefile
              Only in /home/mrh/src/rs/rsapps/taskrs: node_modules
              Only in /home/mrh/src/rs/rsapps/taskrs: npm-debug.log
              Only in /home/mrh/src/rs/rsapps/taskrs: README.md
              Only in /home/mrh/src/rs/rsapps/taskrs: site
              Only in /home/mrh/src/rs/rsapps/taskrs: .travis.yml
          [/] cp -R ~/SAFE/_publicNames/rsapp/task ~/src/rs/rsapps/taskrs._publicNames
          [/] diff -r ~/src/rs/rsapps/taskrs._public ~/src/rs/rsapps/taskrs._publicNames (identical)
          [/] test listing of public names/services on a/c 3
          [/] add webId (safe://webid.happybeing) on a/c 3 (run Peruse PoC and visit safe://webidea.ter)
            [/] re-test listing of public names/services
              -> Now hangs due to these new entries
                safe://_publicNames#happybeing
                safe://_publicNames#it
            [/] put in a general fix so it won't hang!
          [/] sanity check public name entries:
            [/] search WHM for "Public ID must contain only lowercase alphanumeric characters. Should container a min of 3 characters and a max of 62 characters."
            [/] document that requirement in the code and Zim (check if RFC has anything)
            [/] add code to validate a public name against this
            [/] use isValidKey() when returning public name listFolder()
            [/] use isValidKey() when implementing public name mkdir()
          [/] BUG ls ~/SAFE/_public/rsapp/root-www # hangs!
      [/] create SAFE Drive Linux build for testers
      [/] announce SAFE Drive available to test
        See: https://forum.safedev.org/t/safe-fuse-help-with-testing/2019/4?u=happybeing
      [/] update the README.md with instructions for:
        [/] users
        [/] development
        [/] development debugging
        [/] build for Linux
        [/] packaged Linux debugging
      [/] fix bugs and repeat
      [/] then create Linux release:
        [/] build executable (Linux)
        [/] test executable (Linux)
        [/] SafenetworkJs v0.1.0
          [/] tag
          [/] merge to master
          [/] announce
        [/] SAFE Drive v0.1.0
          [/] tag
          [/] merge to master
          [/] announce
[ ] Next Release v0.2.0
== safe-containers.js ==
  [ ] implement simplified file interface for example:
    [/] first consider using file descriptors so that open/read/write/close
        can operate with less redundant calls (e.g. repeated fetch/open in
        each readFileBuf() call). But discuss gains with Maidsafe first if
        no obvious efficiencies in my code.
        See Maidsafe response:
        https://forum.safedev.org/t/what-in-the-api-causes-get/2008/5?u=happybeing
    [ ] On SafenetworkApi:
      [ ] saveFile(path, contents)
      [ ] loadFile(src)
      [ ] copyFile(src, dest)
      [ ] moveFile(from, to)
      [ ] deleteFile(path)
      [ ] fileExists(path)
      [ ] fileInfo(path)
      [ ] listFolder(path)
      [ ] Support for Directories/Folders
    [ ] On SafeContainer / NfsContainer / NfsContainerFiles:
      [/] openFile(path)
      [/] createFile(path)
      [/] readFile(path, fd)
      [/] readFileBuf(path, fd)
      [/] writeFile(path, fd, ...)
      [/] writeFileBuf(path, fd, ...)
      [/] _truncateFile(path, fd, size)
      [/] closeFile(path)
      [/] deleteFile(path)
      [/] moveFile(src, dest) (move)
      [/] copyFile(src, dest) (exists on _NfsContainerFiles)
      [ ] getFileMetadata(path)
      [ ] setFileMetadata(path)
      [ ] Support for Directories/Folders
      [/] speed up: getattr() cache?
        DESIGN
      [/] implement a way for each NFS Container to call FUSE cache invalidation
          functions for each FUSE path at which a path appears. How? Perhaps
          when a SafenetworkJs container is mounted, it is given the cache
          object to be called from relevant functions (ie closeFile, safeFile,
          removeFile etc)
      [ ] makeFolder()
        - Note: SafenetworkJs doesn't need virtual directories because createFile() etc
        accept an arbitrary path and will create a file on any given path.
        - makeFolder() is still useful in some situations, not to create virtual
        directories, but for example to create and add an NFS container to
        one of the default containers such as _public. I think makeFolder()
        should work for any path within _public, but fail for any path that
        strays into an NFS container (as we don't support nesting of NFS
        containers, they are only able to hold files, with folders being
        implied by the paths of those files).
      [ ] I also propose that attempting to save a file (FUSE or SafentworkJs) to
        a path which lies within a default container (e.g. _public) should be
        allowed even though files cannot be stored directly in default
        containers. The effect of trying to create a file in a default
        container would be to create an NFS container at the corresponding
        path, and then save the file into the NFS container.
      [/] FUSE SafeVfs: mkdir()
        - no need to check if the directory exists because FUSE won't call this
          if it does. So just create a virtual directory path entry:
            call vfsCache.addDirectory(itemPath)
      [/] FUSE SafeVfs: rmdir().
          Removes any vfs-cache.js virtual directory, or if that fails because
          there is no virtual directory, returns unsupported operation
          (Fuse.OPNOTSUP). This will happen if the user tries to:
          - remove a directory that doesn't exist (not an ideal error)
          - remove an implied SAFE container directory (the right error)
      [ ] later rmdir() handling can be improved by deferring handling to the
          corresponding container by calling its removeFolder()
      [ ] _public makeFolder()
        - if the path is within _public, creates NFS container there
        - if the path is within an NFS container, it returns an error
      [/] _public listFolder()
        - the above description of _public makeFolder() permits an NFS folder
          to exist at a path that is a parent of another path within a default
          container. For example, the following entries would be permitted
          in _public:
            _public/one/two/three/
            _public/one/
          This results in an NFS container at the end of each of the above paths
          and means that listFolder() for default containers needs to merge
          the results of its keys and the root content of the container where
          one container's root path is part of that for another container, as
          above. In that example listFolder('_public/one') would contain 'two'
          from the _public container, plus all of the files and folders in
          the NFS container who's root path is _public/one.
      [/] Clearing virtual directory paths
        - they are all forgotten at the end of a session = easy
        - on creating a file which resides at the leaf of a virtual directory:
        - clear path and subpaths on successful release() (ie file close).
      [/] Deleting the last file in a directory:
        - should deleting the last file in directory create a virtual
          directory? Ideally yes, because it will be odd for directories
          to disappear if you delete the last file. It might be tricky
          to do, but without it, the current directory will disappear
          and that may be an issue - almost certainly generating errors
          that will confuse the user.
        - this is a harder issue, but in the short term we could just
          call getattr() on the folder at the end of every unlink()
          and see how that works.
  [/] _webMounts of arbitrary public websites
    -> BRANCH dev-mounturi
    [/] fixup old services code
    [/] modify RootHandler to automount URIs give as a filename: _webMounts/service.name
    [/] BUG mount not working for single parts URIs (e.g. safe://heaven, safe://hello)
  [/] get mount of private containers working
    [/] change how I request permissions
        See: https://safenetforum.org/t/apps-and-access-control/26023/66?u=happybeing
             https://safenetforum.org/t/apps-and-access-control/26023/67?u=happybeing
  [ ] feature: SAFE Drive operation without SAFE a/c login for browsing public files
  [ ] cleaner code:
  [ ] is ES6 import etc supported by pkg?
    [ ] is ES6 import etc supported by nexe?
    [ ] trial safe-cli-boilerplate: migrate to ES6 import etc
      -> all on branch: es6-import
      [ ] migrate safe-cli-boilerplate and test with pkg
      [ ] migrate safenetworkjs and test with pkg
      [ ] migrate safenetwork-fuse and test with pkg
  [ ] adopt: import { CONSTANTS as SAFE_CONSTANTS } from '@maidsafe/safe-node-app'
  [/] BUG SERIOUS `touch file` updates time but truncates file size to zero
  [ ] BUG `touch file` updates file modified time but gives Remote I/O error (prob need to implement FUSE utimens()))
  [ ] BUG ls of a public name with one additional character does not generate an error to the user
  [ ] BUG gedit load, edit, save file fails and overwrites leaving empty file (error message: Cannot handle "file:" locations in write mode)
  [ ] BUG when implementing multiple default containers: _getContainerForKey()
          uses 'key' on containerMap. This is not unique enough because could
          have different NFS containers at the same MD key in different parent
          containers  (e.g. one in _public, one in _documents). So this needs
          to be based on the full path including parent container name).

OTHER TO THINK ABOUT
  [/] multiple desktop applications writing to the same file via safenetwork-fuse
    - can I fail open() for read, when open, and block open for write() if open at all?
    -> Thought for now is that this is handled elsewhere, both in the FUSE libs
    which for fuse-bindings are not multi-threaded (hence each op call is blocking)
    and for the SAFE client libs which must handle multi-threading and ensure
    versioned updates in the NFS API
  [/] writes to the Mutable Data by another SAFE application
    - can I detect a change to an NFS MD and fail-safe, while refreshing container and file state?
    File entry update requires version, so I can just fail the FUSE operation
    if that has changed.
  [ ] handle cumulative loss of NFS entries (through file delete and renaming)
    Hold off on the following thougts, pending discussion of a change in NFS
    implementation: https://forum.safedev.org/t/proposal-to-change-implementation-of-safe-nfs/2111?u=happybeing

    This will not extend the capacity of an NFS container, but prevent it
    becoming unusable because over time it fills up with unused entries
    for files which have either been deleted or renamed.
    The good thing about this approach is it can be implemented later, so
    any existing 'full' containers can be brought back into use by
    implementing this feature. Otherwise they would have to be discarded
    by creating a new directory, manually by the user or at the app level.
    Whereas this will do the operation automatically without an app needing
    to handle the case.
    Prerequisites:
      - you must know or be able to find the owner of the NFS container
        in order to update it to point to the new NFS container object.
        So in the case of a services MD, you may know it via the NfsContainer
        wrapper, or could search through the services on the account and
        request access before initiating any changes.
    Once capacity if reached (insert() fails due to no spare entries or MD size):
      - create a new MD
      - copy all active entries into it
      - insert the new entry
      - [optional?] insert a meta entry that points to the old MD
      - update the object (eg services MD) to point to the new NFS container
CONSIDER FOR  V0.2.0
  [/] update for safe_node_app v0.10.3 (tested with SB 0.11.1)
  [ ] refactor any older SafenetworkJs code still using forEach on entries to use listEntries (see listFolder for method)
  [ ] review code for cross platform issues, see: https://shapeshed.com/writing-cross-platform-node/

  == safe-containers.js ==
  [ ] implement empty folders (createFolder(path) / deleteFolder(path))
      - by creating a placeholder file (see: https://github.com/maidsafe/rfcs/issues/227#issuecomment-418447895)
      - PREFERRED: 'ghost' folders held in memory by SafeContainer (wiped on
      destruction or saved only on the client). Might double as a local FS cache?
  [] implement caching in safe-containers.js
    [x] gather some performance/profiling info (even very crude is good)
    [/] review info from Maidsafe on API GET use
        see https://forum.safedev.org/t/what-in-the-api-causes-get/2008/5?u=happybeing
    [ ] re-use of safe-container.js container by searching map by xor address:
      This is necessary for exteral caching (eg by SAFE Drive / safenetwork-fuse)
      so that if a SAFE NFS container is being accessed with different parent
      containers (or stand-alone), so that only a single SafeContainer cache
      exists. Otherwise, if there were multiple NfsContainers for the same
      SAFE container, modifications via one NfsContainer would not be
      reflected in the cache of the other.
      Note: for caching to work, a child container will need a list of
      parents, and SafeContainer _clearResultForPath() will iterate over
      them so everywhere that caches info about an itemPath will be cleared.
  [ ] TODO replace CONSTANTS.MD_METADATA_KEY with SAFE constant when avail (search and replace)
  [ ] figure out how to provide better metrics for container size etc in itemInfo() itemAttributes()
    [ ] SAFE Drive issue is 'ls -l' always shows 'total 0' (It should show total blocks used by files in directory. See info ls)
  [ ] add support for webIds
    [ ] decide on UX:
      - a new type of container?
      - or list them and have a dummy readFile() behaviour, but could...
      - show a file, e.g. happybeing.ttl where readFile() returns the
      profile in Turtle format (could also show multiple files happybeing.jsonld etc)
  [ ] WHEN AVAILABLE AGAIN: add email service on a/c 3
    [ ] re-test listing of public names/services
    example with a/c 3:
      ls ~/SAFE/_publicNames/rsapp    # valid
      ls ~/SAFE/_publicNames/rsappx   # not valid, but fails to error
  [ ] examine WHM PoC code and:
    [ ] figure out what the strange 'garbage' entry is in _publicNames
    -> see topic: https://safenetforum.org/t/latest-whm-behaviour-for-use-with-webid-poc/25315/4?u=happybeing
    [/] add code to handle, or ignore WebID entries

LATER
[ ] issue #1: implement JSDocs or similar across the code
[ ] migrate any remaining features from safenetwork-webapi to new code structure
  - safenetwork-api.js App auth, access to features (SAFE API, NFS, services etc.)
  - safe-containers.js wrappers for default containers with simplified JSON
    file system like interface
  - safe-services.js specialist SAFE and generic RESTful services for web app *and* desktop (both via fetch()
[ ] resume support for LDP, remotestorage etc
  [ ] revive Sevices support
  [ ] add RESTful interface to SafeContainer alongside the FS interface
  [ ] test LDP with Solid Plume
  [ ] test remotestorage with Litewrite
[/] change to generic JSON interface
[ ] Review ipmplementation of PrivateContainer (see TODO in source code)
[ ] move the 'safenetworkjs and safenetwork-web' notes to README.md of both modules
[ ] get SafenetworkJs working for both desktop and web app
  [/] move safe-cli-boilerplate bootstrap() into safenetworkjs
  [ ] write an equivalent for use in web
  [ ] handle different SAFE auth/response in same module
  -> it's looking like one module could be used for both (no build needed)
  [ ] modify my SafenetworkApi authorise methods to select between the two
  [ ] update safe-cli-boilerplate to use SafenetworkJs bootstrap.js (as safenetwork-fuse now does)
*/

/**
* SafenetworkApi - Application API for SAFE Network (base level)
*
* Core and utility features an in Browser SAFE Web App or SAFE NodeJS Desktop App.
*
* SafenetworkApi supports authorisation, public names, services
* SAFE containers, simple file operations, mutable data and immutable data.
*
* Companion classes provide more complex capabilities such as managing SAFE
* NFS Containers, providing custom RESTful services etc.
*
* Access to the underlying SAFE Network APIs is also available if needed.

TODO: these notes were written early in the design so need review and update:
      - some ideas may have changed
      - some things may not yet be implemented

You can use NodeJS modules in your code, targeting web or desktop, and even
using NodeJS you can create stand-alone cross platform apps using the
safe-cli-boilerplate to package them for Windows, Mac OS and Linux.

Provides a wrapper for webFetch() so web services can easily be emulated
for code that expects are RESTful interface (without modifying the RESTful client). These features can be used in desktop or command line applications
as well as web apps.

See also: http://docs.maidsafe.net/safe_app_nodejs/#safeappwebfetch

Architecture
============
TODO review SafenetworkJs class architecture:

The plan is to create a base class (SafenetworkApi) and extend this first
to class SafenetworkFs.

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

const SUCCESS = null

// Local
const containers = require('./safe-containers')
const NfsContainer = containers.NfsContainer
const isCacheableResult = containers.isCacheableResult
// Libs
const safeUtils = require('./safenetwork-utils')

// Decorated console output
const debug = require('debug')('safenetworkjs:api')
const error = require('debug')('safenetworkjs:error')

const logApi = require('debug')('safenetworkjs:web')  // Web API
const logLdp = require('debug')('safenetworkjs:ldp')  // LDP service
const logRest = require('debug')('safenetworkjs:rest')  // REST request/response
const logTest = require('debug')('safenetworkjs:test')  // Test output

let extraDebug = false

/**
 * SafenetworkJs constants, including ones not exposed by safeApi.CONSTANTS
 */

const CONSTANTS = require('./constants')

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

// TODO SN_TAGTYPE_LDP is set to SN_TAGTYPE_WWW so that browser fetch() works, and
// TODO apps using window.webFetch() will work as expected w/o this library,
// TODO unless or until Peruse can fetch() an LDP service tagtype (of 80655 = timbl's dob).
const SN_TAGTYPE_LDP = SN_TAGTYPE_WWW // Same tag type needed for all file containers (in _public etc), therefore best to make NFS rather than WWW?
const SN_SERVICEID_LDP = 'www'  // First try 'www' to test compat with other apps (eg Web Hosting Manager)
// TODO then try out 'ldp'

/* eslint-disable no-unused-vars */
const isFolder = safeUtils.isFolder
const docpart = safeUtils.docpart
const itemPathPart = safeUtils.itemPathPart
const hostpart = safeUtils.hostpart
const protocol = safeUtils.protocol
const parentPathNoDot = safeUtils.parentPathNoDot
const addLink = safeUtils.addLink
const addLinks = safeUtils.addLinks
const Metadata = safeUtils.Metadata
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
*  Example application config for SAFE Authenticator UI
*
* const appCfg = {
*   id:     'com.happybeing',
*   name:   'Solid Plume (Testing)',
*   vendor: 'happybeing.'
* }
*
*/

// For connection without authorisation (see initUnauthorised())
const untrustedAppInfo = {
  id: 'Untrusted',
  name: 'Do NOT authorise this app',
  vendor: 'Untrusted'
}

// Default permissions to request. Optional parameter to SafenetworkApi.initAuthorised()
//

const defaultContainerPerms = {
  // The following defaults have been chosen to allow creation of public names
  // and containers, as required for accessing SAFE web services.
  //
  // ref: https://github.com/maidsafe/rfcs/blob/master/text/0046-new-auth-flow/containers.md
  //
  // If your app doesn't need those features it can use a customised list
  // and specify only the permissions it needs when calling SafenetworkApi.initAuthorised()
  //
  // If your app needs extra permissions (e.g. 'ManagePermissions') it must
  // use a custom list.
  _public: ['Read', 'Insert', 'Update', 'Delete'], // TODO maybe reduce defaults later
  _documents: ['Read', 'Insert', 'Update', 'Delete'], // TODO maybe reduce defaults later
  _downloads: ['Read', 'Insert', 'Update', 'Delete'], // TODO maybe reduce defaults later
  _music: ['Read', 'Insert', 'Update', 'Delete'], // TODO maybe reduce defaults later
  _pictures: ['Read', 'Insert', 'Update', 'Delete'], // TODO maybe reduce defaults later
  _videos: ['Read', 'Insert', 'Update', 'Delete'], // TODO maybe reduce defaults later
  _publicNames: ['Read', 'Insert', 'Update', 'Delete'], // TODO maybe reduce defaults later
  NfsContainer: ['Read', 'Insert', 'Update', 'Delete'] // TODO maybe reduce defaults later
}

const fullPermissions = ['Read', 'Insert', 'Update', 'Delete', 'ManagePermissions']

const defaultAppContainers = {
  '_public': defaultContainerPerms['_public']
}

/**
* NodeJS API for SAFEnetwork
* - app initialisation
* - connection and authorisation with SAFE Network
* - public IDs and services
* - simplified file operations
* - mutable data
* - immutable data
*
*
* @Params
*  appHandle - SAFE API app handle or null
*
*/

class SafenetworkApi {

  constructor () {
    logApi('SafenetworkApi()')

    // Access to SAFE API (DOM or NodeJS)
    // Must be set by either:
    // - index.js (nodejs app), or
    // - index-web.js (Browser app)
    debug( 'this.safeApi is %o: ', this.safeApi)

    this.safeUtils = safeUtils  // Access to utilities

    this._availableServices = new Map() // Map of installed services
    this.initialise()
    this.initialiseServices()
  }

  initialise () {
    logApi('%s.initialise()', this.constructor.name)
    // TODO implement delete any active services (and their handles)

    // SAFE Network Services
    this._activeServices = new Map()    // Map of host (profile.public-name) to a service instance

    // SAFE API settings and and authorisation status
    this._safeAuthUri = ''
    this._isConnected = false
    this._isAuthorised = false
    this._authOnAccessDenied = false  // Used by initAuthorised() and fetch()

    // Default callback
    if (typeof this._networkStateCallback !== 'function') {
      this._networkStateCallback = (newState) => {
        logApi('SafeNetwork state changed to: ', newState)
        this._isConnected = newState
      }
    }

    // Cached API Objects
    this._defaultContainers = {}  // Active default container objects (PublicContainer/PrivateContainer/PublicNamesContainer)
    this._nfsContainers = {}      // Active NfsContainer objects

    // Application specific configuration required for authorisation
    this._safeAppInfo = {}
    this._safeAppContainers = {}

    /*
    * Making everything available on the instance removes need to maintain
    * duplicate exports for web and node (in index-web.js and index.js):
    */
    this.SafeContainer = containers.SafeContainer
    this.PublicContainer = containers.PublicContainer
    this.ServicesContainer = containers.ServicesContainer
    this.NfsContainer = containers.NfsContainer
    this.isCacheableResult = containers.isCacheableResult
    this.safeUtils = safeUtils

    // List of default SAFE containers (_public, _music, _publicNames etc)
    this.defaultContainerNames = containers.defaultContainerNames

    this.containerTypeCodes = containers.containerTypeCodes

    this.defaultContainerPerms = defaultContainerPerms
    this.fullPermissions = fullPermissions

    this.isCacheableResult = isCacheableResult
    this.safeUtils = safeUtils
    this.isFolder = safeUtils.isFolder
    this.docpart = safeUtils.docpart
    this.itemPathPart = safeUtils.itemPathPart
    this.hostpart = safeUtils.hostpart
    this.protocol = safeUtils.protocol
    this.parentPathNoDot = safeUtils.parentPathNoDot

    // Constants
    this.ERRORS = SafenetworkJsErrors
    this.SN_TAGTYPE_SERVICES = SN_TAGTYPE_SERVICES
    this.SN_TAGTYPE_NFS = SN_TAGTYPE_NFS
    this.SN_TAGTYPE_LDP = SN_TAGTYPE_LDP
    this.SN_SERVICEID_LDP = SN_SERVICEID_LDP
  }

  enableLowBalanceWarning () {
    this._lowBalanceWarning = true

    // TODO  Highlight in debug ouptput. Good a place to keep a breakpoint
    error('WARNING: LOW BALANCE LOW BALANCE LOW BALANCE LOW BALANCE')
    error('WARNING: LOW BALANCE LOW BALANCE LOW BALANCE LOW BALANCE')
    error('WARNING: LOW BALANCE LOW BALANCE LOW BALANCE LOW BALANCE')
    error('WARNING: LOW BALANCE LOW BALANCE LOW BALANCE LOW BALANCE')
    error('WARNING: LOW BALANCE LOW BALANCE LOW BALANCE LOW BALANCE')
    error('WARNING: LOW BALANCE LOW BALANCE LOW BALANCE LOW BALANCE')
    error('WARNING: LOW BALANCE LOW BALANCE LOW BALANCE LOW BALANCE')
    error('WARNING: LOW BALANCE LOW BALANCE LOW BALANCE LOW BALANCE')
    error('WARNING: LOW BALANCE LOW BALANCE LOW BALANCE LOW BALANCE')
    error('WARNING: LOW BALANCE LOW BALANCE LOW BALANCE LOW BALANCE')
    error('WARNING: LOW BALANCE LOW BALANCE LOW BALANCE LOW BALANCE')
  }

  disableLowBalanceWarning () {
    this._lowBalanceWarning = false
  }

  isLowBalanceActive () { return this._lowBalanceWarning === true }

  unknownErrorIn (functionName) {
    let unknownError = new Error('Unknown error in ' + functionName)
    unknownError.code = CONSTANTS.ERROR_CODE.UNKNOWN_ERROR
    return unknownError
  }

  /**
   * Return a suitable HTTP response object for a SAFE nodejs API error
   * @param  {String} method http method
   * @param  {Error}  err    error thrown by SAFE API
   * @return {Response}
   */
  // References:
  // https://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html
  // https://en.wikipedia.org/wiki/List_of_HTTP_status_codes
  _httpResponseError (method, err) {
    let r
    switch(err.code) {
      case CONSTANTS.ERROR_CODE.ACCESS_DENIED:
        // TODO should include a response header
        r = new Response(null, {status: 401, statusText: 'Unauthorised (' + err + ')'})
      break;
      case CONSTANTS.ERROR_CODE.NO_SUCH_ENTRY:
      case CONSTANTS.ERROR_CODE.NFS_FILE_NOT_FOUND:
        // TODO when appendable data, could/should this re-direct to old version?
        r = new Response(null, {status: 404, statusText: 'Not found (' + err + ')'})
      break;
      case CONSTANTS.ERROR_CODE.LOW_BALANCE:
        r = new Response(null, {status: 402, statusText: 'Insuffcient PUT balance (' + err + ')'})
        this.enableLowBalanceWarning()
      break;
      default:
        r = new Response(null, {status: 500, statusText: '500 Internal Server Error (' + err + ')'})
    }
    return r
  }

  /**
   * Enable the SAFE Services API
   *
   * There is a default service setup for 'www' so that apps can
   * access SAFE web services (ie websites) via a ServiceInterface
   * object.
   *
   * An app can install additional services as needed. In addition
   * the ServiceInterface object, a service can provide handlers for
   * web operations (such as GET, PUT, POST) which will be routed
   * to handler methods on the corresponding ServiceInterface implementation.
   *
   * An example is included in the form of a Linked Data Platform (LDP)
   * service (see SafeServiceLDP).
   *
   * This is a powerful way of offering standard web services to
   * applications that use browser fetch().
   *
   * So just by using SafenetworkJs, a web application written to access
   * an LDP server using fetch() will 'just work' with a SAFE website
   * that has an LDP service setup (for example as 'safe://ldp.happybeing').
   *
   * Custom services can be added by implementing your own ServiceInterface
   * and these will also 'just work' with apps that are designed to access
   * them via browser fetch(). Note also that is is easy to convert apps
   * which use XmlHttpRequest and so on to use fetch() instead.
   *
   */
  initialiseServices () {
    // Enable the standard SAFE www service API
    // Need to implement NOT IMPLEMENTED functions on SafeServiceWww before enabling this (see implementations on SafeServicesLDP)
    // this.setServiceImplementation(new SafeServiceWww(this))

    // This is currently using 'www' instead of 'LDP' due to issue in WHM (possibly fixed)
    this.setServiceImplementation(new SafeServiceLDP(this))
  }
  /**
   * Simplified file API (modeled loosely on CRUD)
   *
   */

   /**
    * Save the content as an immutable file at a given URI.
    *
    * The user must have granted, or be able to grant suitable access rights
    * if prompted by SAFE Browser.
    *
    * @param  {String} fileUri
    * @param  {Object} contents
    * @return {Promise}
    */
   async saveFile (fileUri, contents) {
     debug('%s.safeFile(\'%s\', contents) - NOT IMPLEMENTED', this.constructor.name, fileUri)
     throw new Error('TODO: function not implemented yet')
   }

   /**
    * Load the content from an immutable file at a given URI.
    *
    * The user must have granted, or be able to grant suitable access rights
    * if prompted by SAFE Browser.
    *
    * @param  {String} fileUri
    * @return {Promise} the data read from the file
    */
   loadFile (fileUri) {
     debug('%s.loadFile(\'%s\') - NOT IMPLEMENTED', this.constructor.name, fileUri)
     throw new Error('TODO: function not implemented yet')
   }

   /**
    * Test if a given file exists.
    *
    * @param  {String} fileUri
    * @return {Promise} true if the file exists
    */
   fileExists (fileUri) {
     debug('%s.fileExists(\'%s\') - NOT IMPLEMENTED', this.constructor.name, fileUri)
     throw new Error('TODO: function not implemented yet')
   }

   /**
    * Get metadata and status about a file. Can be used to test if file exists.
    *
    * @param  {String} fileUri
    * @return {Promise} an object containing metadata about the file
    */
   fileInfo (fileUri) {
     debug('%s.fileInfo(\'%s\') - NOT IMPLEMENTED', this.constructor.name, fileUri)
     throw new Error('TODO: function not implemented yet')
   }

   /**
    * Delete the file at a URI.
    *
    * The user must have granted, or be able to grant suitable access rights
    * if prompted by SAFE Browser.
    *
    * @param  {String} fileUri
    * @return {Promise} an object indicating the success or reason for failure
    */
   deleteFile (fileUri) {
     debug('%s.deleteFile(\'%s\') - NOT IMPLEMENTED', this.constructor.name, fileUri)
     throw new Error('TODO: function not implemented yet')
   }

   /**
    * Copy a file.
    *
    * If both URIs refer to the same container, only the container entries
    * are updated (ie the immutable data object is re-used)
    *
    * The user must have granted, or be able to grant suitable access rights
    * if prompted by SAFE Browser.
    *
    * @param  {String} fromUri
    * @param  {String} toUri
    * @return {Promise} an object indicating the success or reason for failure
    */
   copyFile (fromUri, toUri) {
     debug('%s.copyFile(\'%s\', \'%s\') - NOT IMPLEMENTED', this.constructor.name, fromUri, toUri)
     throw new Error('TODO: function not implemented yet')
   }

   /**
    * Rename/move a file.
    *
    * If both URIs refer to the same container, only the container entries
    * are updated (ie the immutable data object is re-used)
    *
    * The user must have granted, or be able to grant suitable access rights
    * if prompted by SAFE Browser.
    *
    * @param  {String} fileUri
    * @return {Promise} an object indicating the success or reason for failure
    */
   moveFile  (fileUri) {
     debug('%s.moveFile(\'%s\') - NOT IMPLEMENTED', this.constructor.name, fileUri)
     throw new Error('TODO: function not implemented yet')
   }

   /**
    * List the content of a folder at a URI ending with a '/'
    *
    * The user must have granted, or be able to grant suitable access rights
    * if prompted by SAFE Browser.
    *
    * @param  {String} folderUri (must end with '/')
    * @return {Promise} An list of files and sub-folders, (folders end with a '/') or null if the directory does not exist.
    */
   listFolder  (folderUri) {
     debug('%s.listFolder(\'%s\') - NOT IMPLEMENTED', this.constructor.name, folderUri)
     throw new Error('TODO: function not implemented yet')
   }

  /**
  * Local helpers
  */

  /**
   * Get the NFS container path after the public name from a URI
   *
   * @param  {String} docUri SAFE URI of a document or file
   * @return {String} full document path (without a leading '/')
   */
  nfsPathPart (docUri) {
    let pathPart = this.itemPathPart(docUri)
    if (pathPart[0] === '/') {
      pathPart = pathPart.slice(1)  // safeNfs entries don't allow a leading '/'
    }
    return pathPart
  }

  /*
  * Application API - authorisation with SAFE network
  */

  /**
   * Set SAFE API application handle (needed if you init with SAFE API directly)
   *
   * Note: if the application calls safeApp.initialiseApp() directly it MUST
   * pass the SAFEApp handle to SafenetworkJS by calling setSafeAppHandle().
   *
   * @param {SAFEApp} appHandle  from SAFE API see this.safeApi.initialiseApp()
   */

  setSafeAppHandle (appHandle) {
    this.initialise()             // Clears active services (so DOM API handles will be discarded)
    this._appHandle = appHandle   // SAFE API application handle

    if (appHandle) {
      // SAFE API Interfaces
      this.safeApp = this._appHandle
      this.auth = this._appHandle.auth
      this.crypto = this._appHandle.crypto
      this.cypherOpt = this._appHandle.cypterOpt
      this.immutableData = this._appHandle.immutableData
      this.mutableData = this._appHandle.mutableData
      this.webFetch = this._appHandle.webFetch
      try { this.initTests() } catch (e) { debug(e) }
    }
  }

  // Intended mainly for mock, create a container to mess with
  async initTests () {
    let testKey = '_public/tests/data1'

    if (process.env.SAFENETWORKJS_TESTS === 'testing') {
      try {
        let publicMd = await this.auth.getContainer('_public')
        if (publicMd && !await this.getMutableDataValueVersion(publicMd, testKey)) {
          let md = await this.mutableData.newRandomPublic(SN_TAGTYPE_NFS)
          if (md) {
            await md.quickSetup({}, 'Test container', 'For SafenetworkJs tests on mock network')
            let nameAndTag = await md.getNameAndTag()
            this.setMutableDataValue(publicMd, testKey, nameAndTag.name.buffer, true)
          }
        }
      } catch (e) { debug(e.message) }
    }
  }

  // TODO add documentation for more functions...

  // For access to SAFE API:
  appHandle () { return this._appHandle }
  getAuthUri () { return this._safeAuthUri } // TODO ensure auth URI comes from bootstrap
  isConnected () { return this._isConnected }
  isAuthorised () { return this._isAuthorised }
  services () { return this._availableServices }  // Note: these are ServiceInterface rather than ServiceContainer

  /**
   * authorise with SAFE Network - for desktop apps (non-browser)
   * DEPRACATED
   * @param  {object}  appInfo     See SAFE API docs
   * @param  {object}  appContainers See SAFE API docs
   * @param  {object}  containerOpts See SAFE API docs
   * @param  {object}  argv          TODO ???
   * @return {Promise}
   */
   async DEPRACATEDauthoriseWithSafeBrowser (appInfo, appContainers, containerOpts, argv) {
    // bootstrap is for auth from nodeJs and CLI
    this.safeApi.bootstrap(appInfo, appContainers, containerOpts, argv).then((safeApp) => {
      this.setSafeAppHandle(safeApp)
      this._safeAppInfo = appInfo
      this._safeAppContainers = appContainers
      this._safeContainerOpts = containerOpts
      this._safeAuthUri = ''  // TODO refactor to get this from safeApi.bootstrap()
    }).catch((e) => debug('%s constructor - error calling bootstrap() to authorise with SAFE Network'))
  }

/**
 * Save initial app settings
 *
 * @param  {Object} appInfo       information about your app (see SAFE API)
 * @param  {Object} appContainers [optional] desired container permissions
 * @param  {appOptions} appOptions [optional] SAFEApp options
 * @param  {Boolean} [optional] enableAutoAuth if true, attempt to authorise after access denied
 *
 * See SAFEApp.initialiseApp()
 */
  _initialAppSettings (appInfo, appContainers, appOptions, enableAutoAuth) {
    this._authOnAccessDenied = (enableAutoAuth ? enableAutoAuth : false)
    this._safeAppInfo = appInfo
    this._safeAppContainers = (appContainers !== undefined ? appContainers : defaultAppContainers)
    this._safeAppOptions = appOptions
  }

  /**
   * Initialise SafenetworkApi and read-only connection to SAFE Network
   *
   * Before you can use the SafenetworkApi methods, you must init and connect
   * with SAFE network. This function provides *read-only* init and connect, but
   * you can authorise subsequently using initAuthorised(), or directly with the
   * SAFE API.
   *
   *  - if using this method you don't need to do anything with the returned SAFEAppHandle
   *  - if authorising using another method you MUST call SafenetworkApi.setSafeAppHandle()
   *    with a valid SAFEAppHandle
   *
   * @param  {Object} [appInfo=untrustedAppInfo] information about app for auth UI, if ommitted generic 'untrusted' will appear.
   * @param  {appOptions} appOptions [optional] SAFEApp options
   * @param  {Object}  argv [optional] required only for command lin authorisation
   * @return {Promise}  SAFEAppHandle.
   *
   * Note: see SAFE API initialiseApp()
   */
  async initUnauthorised (appInfo, appOptions, argv) {
    logApi('%s.initUnauthorised(%O)...', this.constructor.name, appInfo)
    this._initialAppSettings(appInfo ? appInfo : untrustedAppInfo, undefined, appOptions)
    return this.setSafeAppHandle(await this.safeApi.initUnauthorised(appInfo, appOptions, this._networkStateCallback, argv))
  }

  // TODO - DEPRECATED
  async initReadOnly (appInfo = untrustedAppInfo) {
    // TODO review/update
    logApi('%s.initReadOnly(%O) is DEPRECATED, use initUnauthorised() instead', this.constructor.name, appInfo)

    let tmpAppHandle
    try {
      tmpAppHandle = await this.safeApi.initialiseApp(appInfo, (newState) => {
        // Callback for network state changes
        logApi('SafeNetwork state changed to: ', newState)
        this._isConnected = newState // TODO bugchase
      })

      logApi('SAFEApp instance initialised and appHandle returned: ', tmpAppHandle)
      this.setSafeAppHandle(tmpAppHandle)
      this._safeAppInfo = appInfo
      this._safeAppContainers = undefined
      if (window) {
        let connUri = await this.auth.genConnUri()
        logApi('SAFEApp was initialise with a read-only session on the SafeNetwork')

        this._safeAuthUri = await this.safeApi.authorise(connUri)
        logApi('SAFEApp was authorised and authUri received: ', this._safeAuthUri)

        await this.auth.loginFromUri(this._safeAuthUri)
        this._isConnected = true // TODO to remove (see https://github.com/maidsafe/beaker-plugin-safe-app/issues/123)
      } else {
        logApi('SAFEApp was initialise with a read-only session on the SafeNetwork')
        this._isConnected = true // TODO to remove (see https://github.com/maidsafe/beaker-plugin-safe-app/issues/123)
      }
      return this._appHandle
    } catch (err) {
      logApi('WARNING: ', err)
      this.setSafeAppHandle(null)
      throw (err)
    }
  }

  /**
   * Initialise SafenetworkApi and authorised connection to SAFE Network
   *
   * This function provides simplified, one step authorisation. As an
   * alternative you can authorise separately using the SAFE API to
   * obtain a valid SAFEApp handle. If so you MUST then pass this
   * to SafenetworkApi by calling setSafeAppHandle()
   *
   * @param  {Object}  appInfo       information about your app (see SAFE API)
   * @param  {Object}  appContainers [optional] permissions to request on containers
   * @param  {Boolean} ownContainer [optional] true to create/access app 'own_container'. See SAFEApp.genAuthUri()
   * @param  {InitOptions} appOptions [optional] override default SAFEApp options
   * @param  {Object}  argv [optional] required only for command lin authorisation
   * @return {Promise}
   */
  async initAuthorised  (appInfo, appContainers, ownContainer, appOptions, argv) {
    logApi('%s.initAuthorised(%O, %O, %s, %O, %O)...', this.constructor.name, appInfo, appContainers, ownContainer, appOptions, argv)
    this._initialAppSettings(appInfo, appContainers, appOptions, true /*enableAutoAuth*/)
    let authOptions = (ownContainer ? { own_container: true } : undefined)

    return this.setSafeAppHandle(await this.safeApi.initAuthorised(appInfo, appContainers, this._networkStateCallback, authOptions, appOptions, argv))
  }

  // TODO - DEPRECATED
  async simpleAuthorise (appInfo, appContainers) {
    logApi('%s.simpleAuthorise(%O,%O) is DEPRECATED, use initAuthorised() instead', this.constructor.name, appInfo, appContainers)

    // TODO ??? not sure what I'm thinking here...
    // TODO probably best to have initialise called once at start so can
    // TODO access the API with or without authorisation. So: remove the
    // TODO initialise call to a separate point and only call it once on
    // TODO load. Need to change freeSafeAPI() or not call it above.
    //
    // TODO I think once I have this._safeAuthUri I should be able
    // TODO to just try auth.loginFromUri() with that to skip the UI prompts

    this._authOnAccessDenied = true // Enable auth inside SafenetworkApi.fetch() on 401

    let tmpAppHandle
    try {
      tmpAppHandle = await this.safeApi.initialiseApp(appInfo, (newState) => {
        // Callback for network state changes
        logApi('SafeNetwork state changed to: ', newState)
        this._isConnected = newState // TODO bugchase
      })

      logApi('SAFEApp instance initialised and appHandle returned: ', tmpAppHandle)
      this.setSafeAppHandle(tmpAppHandle)
      this._isConnected = true // TODO to remove (see https://github.com/maidsafe/beaker-plugin-safe-app/issues/123)
      this._safeAppInfo = appInfo
      this._safeAppContainers = (appContainers !== undefined ? appContainers : defaultAppContainers)

      // await this.testsNoAuth();  // TODO remove (for test only)
      let authReqUri = await this.auth.genAuthUri(this._safeAppContainers, this._safeAppInfo.options)
      this._safeAuthUri = await this.safeApi.authorise(authReqUri)
      logApi('SAFEApp was authorised and authUri received: ', this._safeAuthUri)

      await this.auth.loginFromUri(this._safeAuthUri)
      logApi('SAFEApp was authorised & a session was created with the SafeNetwork')
      await this.testsAfterAuth()  // TODO remove (for test only)
      this._isAuthorised = true
      return this._appHandle
    } catch (err) {
      logApi('WARNING: ', err)
      this.setSafeAppHandle(null)
      throw (err)
    }
  }

  /* --------------------------
   * Mutable Data Helpers
   * --------------------------
   */

  /**
    * Insert, update, or delete (clear) an entry in a Mutable Data
    * Doesn't handle lack of permissions
    *
    * @param  {MutableData}  mData     [description]
    * @param  {String}  operation 'insert', 'update' or 'delete'
    * @param  {String}  key
    * @param  {String}  value
    * @return {Promise}
    */
  async mdRawMutate (mData, operation, key, value) {
    throw new Error('TODO: implement %s.mdRawMutate()', this.constructor.name)
  }

 /**
  * Insert, update, delete a Mutable Data. May auto request permissions
  * @param  {MutableData}  mData     [description]
  * @param  {String}  operation 'insert', 'update' or 'delete'
  * @param  {String}  key
  * @param  {String}  value
  * @param  {Array}   permissions List of required permssions
  * @return {Promise}
  */
  async mdMutate (mData, operation, key, value, permissions) {
    throw new Error('TODO: implement %s.mdArpMutate()', this.constructor.name)
  }

 /**
  * Insert, update, delete on NFS MD. Doesn't handle lack of permissions
  *
  * @param  {MutableData}  mData     [description]
  * @param  {String}  operation 'insert', 'update' or 'delete'
  * @param  {String}  key
  * @param  {String}  value
  * @return {Promise} Object { result: null on success, or an Error object }
  *
  * Note: throws an error for ERROR_CODE.ACCESS_DENIED but all other errors
  *       are passed by in the returned object
  */
  async nfsRawMutate (nfs, operation, fileName, file, version, newMetadata) {
    try {
      if (operation === 'update') {
        await nfs.update(fileName, file, version, newMetadata)
      } else if (operation === 'insert') {
        await nfs.insert(fileName, file, newMetadata)
      } else if (operation === 'delete') {
        await nfs.delete(fileName, version)
      } else {
        let msg = 'nfsRawMutate() - unknown NFS operation: ' + operation
        error(msg)
        return this.unknownError(msg)
      }
      return SUCCESS
    } catch (e) {
      debug(e)
      if (e.code === CONSTANTS.ERROR_CODE.LOW_BALANCE) {
        this.enableLowBalanceWarning()
      } else if (e.code === CONSTANTS.ERROR_CODE.ACCESS_DENIED) {
        throw e // Throw so that nfsMutate() can catch to request permission
      }
      return e
    }
  }

 /**
  * Insert, update, delete on NFS MD. May auto request permissions
  * @param  {MutableData}  mData
  * @param  {NFS}     nfs         NFS emulation interface
  * @param  {String}  operation 'insert', 'update' or 'delete'
  * @param  {String}  fileName
  * @param  {File}    file        NFS File (use undefined for 'delete')
  * @param  {File}    version     new version of entry (use undefined for 'insert')
  * @param  {String}  newMetadata metadata to be set (use undefined for 'delete')
   * @return {Promise} Object { result: null on success, or an Error object }
  */
  async nfsMutate (nfs, permissions, operation, fileName, file, version, newMetadata) {
    let perms = permissions !== undefined ? permissions : defaultContainerPerms['NfsContainer']
    let result
    try {
      result = await this.nfsRawMutate(nfs, operation, fileName, file, version, newMetadata)
    } catch (e) {
      if (e.code === CONSTANTS.ERROR_CODE.ACCESS_DENIED) {
        try {
          const nat = await nfs.mData.getNameAndTag()
          const mdPermissions = [{
            typeTag: nat.typeTag,
            name: nat.name,
            'perms': perms
          }]
          // Request permissionsand retry
          const uri = await this.auth.genShareMDataUri(mdPermissions)
          this._safeAuthUri = await this.safeApi.fromUri(this.safeApp, uri)
          result = await this.nfsRawMutate(nfs, operation, fileName, file, version, newMetadata)
        } catch (e) { error(e); return e }
      } else {
        debug('%s.nfsArpMutate() - %s() failed on NFS object', this.constructor.name, operation)
        error(e)
        return e
      }
    }
    if (result === SUCCESS) return SUCCESS

    return new Error('Unknown error creating NFS file')
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
   * In addition to the default containers, ServicesContainer simplifies
   * creation and management of SAFE services Mutable Data (but not yet
   * implemented). Note that there is a separate ServicesInterface class
   * which allows an application to access custom SAFE services with
   * a web style interface (e.g. RESTful using fetch()).
   */

  /**
   * Get an initialised default container instance
   *
   * @param {Object}  containerRef { safePath: | safeUri: }
   *                                  safePath: mounted path (either '/' or one of '_publicNames', '_public' etc)
   *                                  safeUri: full or partial safe uri, [safe://][serviceName.]publicName
   *                                  Examples for safeUri:
   *                                    safe://blog.happybeing
   *                                    safe://happbeing/documents
   *                                    email.happybeing
   *                                    happybeing
   * @return {Object}               initialised instance of a SafeContainer based class
   */
  async getSafeContainer (containerRef) {
    debug('%s.getSafeContainer(\'%o\')', this.constructor.name, containerRef)
    let containerName = containerRef.safePath
    let safeUri = containerRef.safeUri

    if (safeUri) return this.getSafeContainerFromUri(safeUri)

    let container = this._defaultContainers[containerName]
    if (!container) {
      let ContainerClass = containers.containerClasses[containerName]
      if (ContainerClass) {
        let containerPath = '/' + containerName   // Its path for container FS interface
        let subTree = containerName               // Default is for path to start with container name
        container = new ContainerClass(this, containerName, containerPath, subTree)
        container.initialise().then((result) => {
          this._defaultContainers[containerName] = container
        }).catch((e) => { debug(e.message); throw e })
      }
    }

    return container
  }

  /**
   * Get an initialised services container instance for a SAFE URI
   *
   * @param  {String}  safeUri  full or partial safe uri, [safe://][serviceName.]publicName
   *                             Examples for safeUri:
   *                                    safe://blog.happybeing
   *                                    safe://happbeing/documents
   *                                    email.happybeing
   *                                    happybeing
   *
   * @return {Promise} an initialised object (subclass of SafeContainer)
   */
  async getSafeContainerFromUri (safeUri) {
    debug('%s.getSafeContainerFromUri(%s)', this.constructor.name, safeUri)
    try {
      let container
      let service = await this.getServiceForUri(safeUri)
      if (service) {
        // TODO add a ServiceInterface method to get the appropriate
        //  SafeContainer based class. For now only allow NfsContainer
        let containerPath = ''  // URI based NFS container has no SAFE path
        let parent              // URI based NFS container has no parent
        container = new NfsContainer(this, service.getServiceValue(), containerPath, parent, false)
        await container.initialise()
        container._subTree = safeUtils.itemPathPart(safeUri)  // Optionally mounts a subdirectory of the NFS container
      } else {
        throw new Error('failed to get ServiceInterface for %s', safeUri)
      }
      return container
    } catch (e) { debug(e) }
  }

  /**
   * Get an initialised ServicesContainer instance for the publicName
   *
   * @param  {String} publicName
   * @param  {boolean}  createNew access (false) or create (true) services MutableData
   * @return {Object}            initialised instance of ServicesContainer
   */
  // TODO might be better for people to use "new NfsContainer" so comment out for now
  // async getServicesContainer (publicName, createNew) {
  //   let container = this._servicesContainers[publicName]
  //   if (!container) {
  //     container = new ServicesContainer(this, publicName)
  //     container.intitialise(createNew).then(() => {
  //       this._servicesContainers[publicName] = container
  //     }).catch((e) => { debug(e.message); throw e })
  //   }
  //
  //   return container
  // }

  /**
   * Get an initialised NfsContainer instance
   *
   * @param {String} nameOrKey  Either the path (starting with a public container) or the XOR address
   * @param  {Boolean}  createNew (optional) true if you want to create a new NFS MutableData
   * @param  {Boolean}  isPublic (optional) if createNew, specify true to make it shareable (eg in _public)
   * @param {Object} parent (optional) typically a SafeContainer (ServiceContainer?) but if parent is not defined, nameOrKey must be an XOR address
   * @return {Object}               initialised instance of NfsContainer
   */
  // TODO might be better for people to use "new NfsContainer" so comment out for now
  // async getNfsContainer (nameOrKey, createNew, isPublic, parent) {
  //   let container = this._nfsContainers[nameOrKey]
  //   if (!container) {
  //     if (!createNew) createNew = false
  //     container = new NfsContainer(this, nameOrKey, parent)
  //     if (createNew) {
  //       if (!isPublic) isPublic = false // Defaut to private
  //       let ownerName = ''  // Not known (typically a public name so this is just omitted)
  //       container.createNew(ownerName, isPublic).then(() => {
  //         this._nfsContainers[nameOrKey] = container
  //       }).catch((e) => { debug(e.message) })
  //     } else {
  //       container.initialiseExisting().then(() => {
  //         this._nfsContainers[nameOrKey] = container
  //       }).catch((e) => { debug(e.message); throw e })
  //     }
  //   }
  //
  //   return container
  // }

  /* --------------------------
  * Simplified MutableData API
  * --------------------------
  */

  // Get the ValueVersion of an entry from a mutable data object
  //
  // Encryption is handled automatically by the DOM APIs
  // - if the MD is public, they do nothing
  // - if the MD is private, they encrypt/decrypt using the MD private key
  //
  // @param mData a mutable data, with permission to 'Read'
  // @param key   the key to read
  //
  // @returns [ValueVersion] for the entry or undefined if entry not present
  async getMutableDataValueVersion (mData, key) {
    logApi('getMutableDataValueVersion(%s,%s)...', mData, key)
    let valueVersion
    try {
      let useKey = await mData.encryptKey(key)
      valueVersion = await mData.get(useKey)
      valueVersion.buf = await mData.decrypt(valueVersion.buf)
      return valueVersion
    } catch (err) {
      logApi(err)
      logApi("getMutableDataValueVersion() WARNING no entry found for key '%s'", key)
      if (err.code !== CONSTANTS.ERROR_CODE.NO_SUCH_ENTRY) throw err
    }
  }

  /**
   * Set (ie insert or update) an entry in a mutable data object
   *
   * User must be logged in
   * App must have 'Insert'/'Update' permissions as appropriate
   *
   * Encryption is handled automatically by the DOM APIs
   *   - if the MD is public, they do nothing
   *   - if the MD is private, they encrypt/decrypt using the MD private key

  @param mustNotExist
  @param value

  @returns a Promise which resolves true if successful
   * [setMutableDataValue description]
   * @param  {MutableData}  mData   See SAFE API
   * @param  {String}  key
   * @param  {Object}  value
   * @param  {[type]}  mustNotExist [defaults to false] if true, will fail if the key exists in the MD object
   * @return {Promise}
   */
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

  /**
   * Get the key/value of a public name's entry in the _publicNames container
   *
   * User must:
   * - be logged into the account owning the public name for this to succeed.
   * - authorise the app to 'Read' _publicNames on this account.
   *
   * @param  {String}  publicName
   *
   * @returns a Promise which resolves to an object containing the key and ValueVersion
   *    The returned object is null on failure, or contains:
   *    - a 'key' of the format: '_publicNames/<public-name>'
   *    - a 'ValueVersion', the value part will be the XOR name of the services entry MD for the public name
   */
  async getPublicNameEntry (publicName) {
    logApi('getPublicNameEntry(%s)...', publicName)
    try {
      // TODO wrap access to some MDs (eg for _publicNames container) in a getter that is passed permissions
      // TODO checks those permissions, gets the MD, and caches the value, or returns it immediately if not null
      let publicNamesMd = await this.auth.getContainer('_publicNames')
      let entries = await publicNamesMd.getEntries()
      let entryKey = this.makePublicNamesEntryKey(publicName)
      let encryptedKey = await publicNamesMd.encryptKey(entryKey)
      let valueVersion = await entries.get(encryptedKey)
      valueVersion.buf = await publicNamesMd.decrypt(valueVersion.buf)
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
      return this._createPublicName(publicName)
    } catch (err) {
      logApi('Unable to create public name \'' + publicName + '\': ', err)
      throw err
    }
  }

  // Create a new random MutableData for NFS storage, inserts into a default container MD if specified
  //
  // @param {String} defaultContainer an empty string, or name of a top level public container (e.g. '_public', '_documents' etc)
  // @param {String} publicName    the public name which owns the container (or '' if none)
  // @param {String} containerName an arbitrary name which may be specified by the user, such as 'root-photos'
  // @param {Number} mdTagType     tag_type for new Mutable Data (currently can only be SN_TAGTYPE_WWW)
  // @param {Boolean} isPrivate    (optional) defaults to false
  //
  // @returns   Promise<NameAndTag>: the name and tag values of the newly created MD
  async createNfsContainerMd (defaultContainer, publicName, containerName, mdTagType, isPrivate) {
    logApi('createNfsContainerMd(%s,%s,%s,%s,%s)...', defaultContainer, publicName, containerName, mdTagType, isPrivate)
    try {
      let ownerPart = (publicName !== '' ? '/' + publicName : '') // Usually a folder is associated with a service on a public name
      let key = defaultContainer + ownerPart + '/' + containerName

      let defaultMd
      if (defaultContainer !== '') {
        // Check the container does not yet exist
        defaultMd = await this.auth.getContainer(defaultContainer)

        // Check the public container doesn't already exist
        let existingValue = null
        try {
          existingValue = await this.getMutableDataValue(defaultMd, key)
        } catch (err) {
        } // Ok, key doesn't exist yet
        if (existingValue) {
          throw new Error("default container '" + defaultContainer + "' already has entry with key: '" + key + "'")
        }
      }

      // Create the new container
      let md = await this.mutableData.newRandomPublic(mdTagType)
      let entriesHandle = await this.mutableData.newEntries(this.safeApp)
      // TODO review this with Web Hosting Manager (where it creates a new root-www container)
      // TODO clarify what setting these permissions does - and if it means user can modify with another app (e.g. try with WHM)
      let pmSet = ['Read', 'Update', 'Insert', 'Delete', 'ManagePermissions']
      let pubKey = await this.crypto.getAppPubSignKey(this.safeApp)
      let permissions = await this.mutableData.newPermissions(this.safeApp)
      await permissions.insertPermissionSet(pubKey, pmSet)
      await md.put(permissions, entriesHandle)
      let nameAndTag = await md.getNameAndTag()

      if (defaultMd) {
        // Create an entry in defaultContainer (fails if key exists for this container)
        await this.setMutableDataValue(defaultMd, key, nameAndTag.name.buffer)
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
    } catch (err) {
      throw new Error('Failed to set up service \'' + serviceId + '\' - Error: ' + err)
    }

    return serviceValue
  }

  /**
   * Check if the string is suitable for use as a public name
   *
   * @param  {String}  name
   * @return {Boolean}      true if the length and characters suitable
   */
  isValidPublicName (name) {
    // From the WHM code (not specified in the containers RFC)
    if (name &&
        name.length >= CONSTANTS.PUBLICNAME_MINCHARS &&
        name.length <= CONSTANTS.PUBLICNAME_MAXCHARS &&
        name.match(/^[a-z0-9]*$/)) {
      return true
    }
    return false
  }

  // Internal version returns a handle which must be freed by the caller
  //
  // @param {String} publicName
  //
  // @returns a Promise which resolves to an object containing the new entry's key, value and handle:
  //  - key:        of the format: '_publicNames/<public-name>'
  //  - value:      the XOR name of the services entry MD for the public name
  //  - servicesMd: the handle of the newly created services MD
  async _createPublicName (publicName) {
    logApi('_createPublicName(%s)...', publicName)
    try {
      if (!this.isValidPublicName(publicName)) throw new Error('A public name ' + CONSTANTS.BADPUBLICNAME_MSG)

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
      let servicesMd = await this.mutableData.newPublic(servicesMdName, SN_TAGTYPE_SERVICES)

      var enc = new TextDecoder()
      logApi('created services MD with servicesMdName: %s', enc.decode(new Uint8Array(servicesMdName)))

      let servicesEntries = await this.mutableData.newEntries(this.safeApp)

      // TODO review this with Web Hosting Manager (separate into a make or init servicesMd function)
      // TODO clarify what setting these permissions does - and if it means user can modify with another app (e.g. try with WHM)
      let pmSet = ['Read', 'Update', 'Insert', 'Delete', 'ManagePermissions']
      let pubKey = await this.crypto.getAppPubSignKey(this.safeApp)
      let permissions = await this.mutableData.newPermissions(this.safeApp)
      await permissions.insertPermissionSet(pubKey, pmSet)
      await servicesMd.put(permissions, servicesEntries)

      // TODO do I also need to set metadata?
      // TODO - see: http://docs.maidsafe.net/beaker-plugin-safe-app/#windowsafemutabledatasetmetadata

      // TODO remove (test only):
      let r = await servicesMd.getNameAndTag()
      logApi('servicesMd created with tag: ', r.typeTag, ' and name: ', r.name, ' (%s)', enc.decode(new Uint8Array(r.name)))

      let publicNamesMd = await this.auth.getContainer('_publicNames')
      let entryKey = this.makePublicNamesEntryKey(publicName)
      let entries = await publicNamesMd.getEntries()
      let namesMutation = await entries.mutate()
      let encryptedKey = await publicNamesMd.encryptKey(entryKey)
      let encryptedValue = await publicNamesMd.encryptValue(servicesMdName)
      await namesMutation.insert(encryptedKey, encryptedValue)
      await publicNamesMd.applyEntriesMutation(namesMutation)

      // TODO remove (test only):
      r = await servicesMd.getNameAndTag()
      /* logApi('DEBUG new servicesMd created with tag: ', r.typeTag, ' and name: ', r.name)
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
  // @param md the handle of a Mutable Data object
  //
  // @returns a promise which resolves true if the Mutable Data exists
  async mutableDataExists (md) {
    try {
      await md.getVersion(md)
      logApi('mutableDataExists(%o) TRUE', md)
      return true
    } catch (err) {
      logApi(err)
      logApi('mutableDataExists(%o) FALSE', md)
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
  async getServicesMdFor (host) {
    logApi('%s.getServicesMdFor(%s)', this.constructor.name, host)
    let publicName = host.split('.')[1]
    try {
      if (publicName === undefined) {
        publicName = host
      }

      logApi("host '%s' has publicName '%s'", host, publicName)
      let servicesName = await this.makeServicesMdName(publicName)
      let md = await this.mutableData.newPublic(servicesName, SN_TAGTYPE_SERVICES)
      if (await this.mutableDataExists(md)) {
        var enc = new TextDecoder()
        logApi('Look up SUCCESS for MD XOR name: ' + enc.decode(new Uint8Array(servicesName)))
        return md
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
  async getServicesMdFromContainers (host) {
    logApi('getServicesMdFromContainers(%s)', host)
    try {
      let publicName = host.split('.')[1]
      if (publicName === undefined) {
        publicName = host
      }
      logApi("host '%s' has publicName '%s'", host, publicName)

      let nameKey = this.makePublicNamesEntryKey(publicName)
      let md = await this.auth.getContainer('_publicNames')
      logApi('_publicNames ----------- start ----------------')
      let entries = await md.getEntries()
      let entriesList = await entries.listEntries()
      await entriesList.forEach((k, v) => {
        logApi('Key: ', entry.key.toString())
        logApi('Value: ', entry.value.buf.toString())
        logApi('Version: ', entry.value.version)
        if (k === nameKey) {
          logApi('Key: ' + nameKey + '- found')
          return entry.value.buf
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
        uriProfile = 'www'
      }
      logApi("URI has profile '%s' and publicName '%s'", uriProfile, publicName)

      // Get the services MD for publicName
      let servicesMd = await this.getServicesMdFor(publicName)
      let listingQ = []
      let entries = await servicesMd.getEntries()
      logApi("checking servicesMd entries for host '%s'", host)
      this.hostedService = null
      let entriesList = await entries.listEntries()
      await entriesList.forEach(async (entry) => {
        listingQ.push(new Promise(async (resolve, reject) => {
          logApi('Key: ', entry.key.toString())
          logApi('Value: ', entry.value.buf.toString())
          logApi('Version: ', entry.value.version)
          let serviceKey = entry.key.toString()
          if (serviceKey === CONSTANTS.MD_METADATA_KEY) {
            logApi('Skipping metadata entry: ', serviceKey)
            resolve()
            return  // Skip
          }

          // Defaults:
          let serviceProfile = ''
          let serviceId = 'www'

          if (serviceKey.indexOf('@' === -1)) {
            serviceProfile = serviceKey
          } else {
            serviceProfile = serviceKey.split('@')[0]
            serviceId = serviceKey.split('@')[1]
            if (!serviceId || serviceId === '') serviceId = 'www'
          }

          let serviceValue = entry.value
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
              logApi("WARNING service '" + serviceId + "' is setup on '" + host + "' but no implementation is available")
            }
          }
          resolve() // Done
        }))
      })
      await Promise.all(listingQ).catch((e) => error(e))  // Wait until all entries processed

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
   * Test if a standard SAFE default container name is public
   * @param  {String}  name  the name of a default container ('_public', '_documents' etc)
   * @return {Boolean}       true if the name is a recognised as a public default container
   */
  isPublicContainer (containerName) {
    // Currently there is only _public
    return containerName === '_public'
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
      return this.mutableData.newPublic(hash, tagType)
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
    return this.crypto.sha3Hash(publicName)
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

  // Return an object with hostProfile and serviceId based on the serviceKey
  decodeServiceKey (serviceKey) {
    let result = { hostProfile: serviceKey, serviceId: 'www' }
    if (serviceKey.indexOf('@') !== -1) {
      result.hostProfile = serviceKey.split('@')[0]
      result.serviceId = serviceKey.split('@')[1]
    }
    return result
  }

  // Use same check as for public names
  isValidSubdomain (name) { return this.isValidPublicName(name) }
  isValidServiceId (name) { return this.isValidPublicName(name) }

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
          await this.initAuthorised(this._safeAppInfo, this._safeAppContainers)
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
        response = await this.safeApp.webFetch(docUri, options)
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
    let md = await this.auth.getContainer(containerName)
    await this.listMd(md, containerName)
    logTest(containerName + '------------ end -----------------')
  }

  async listMd (md, name) {
    logTest('list md: %s', md)
    let enc = new TextDecoder()
    let entries = await md.getEntries()

    let entriesList = await entries.listEntries()
    await entriesList.forEach(async (entry) => {
      let decodedEntry = entry
      let plainKey = entry.key
      try { plainKey = await md.decrypt(plainKey) } catch (e) { debug('Key decryption ERROR: %s', e) }
      plainKey = enc.decode(new Uint8Array(plainKey))
      if (plainKey !== entry.key.toString())
        logTest('Key (encrypted): ', entry.key.toString())
      logTest('Key            : ', plainKey)
      decodedEntry.plainKey = plainKey

      let plainValue = entry.value.buf
      try { plainValue = await md.decrypt(plainValue) } catch (e) { debug('Value decryption ERROR: %s', e) }
      plainValue = enc.decode(new Uint8Array(plainValue))
      if (plainValue !== entry.value.buf.toString())
        logTest('Value (encrypted): ', entry.value.buf.toString())
      logTest('Value            :', plainValue)

      logTest('Version: ', entry.value.version)
      decodedEntry.plainValue = plainValue
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
    logApi('%s.setupServiceForHost(%s,%o) - NOT YET IMPLEMENTED', this.constructor.name, host, servicesMd)
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
    logApi('%s._fetch() - NOT YET IMPLEMENTED', this.constructor.name)
    throw new Error('ServiceInterface._fetch() not implemented for ' + this.getName() + ' service')
  }
};

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
    logApi('%s.setupServiceForHost(%s,%o) - NOT YET IMPLEMENTED', this.constructor.name, host, servicesMd)
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
    logApi('%s._fetch(%o) calling this.safeApp.webFetch()', this.constructor.name, arguments)
    return this.safeApp.webFetch.apply(null, arguments)
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

const mime = require('mime-types')
const $rdf = require('rdflib')
const ns = require('solid-namespace')($rdf)

// TODO update to use SafeNfsContainer instead of calling SAFE NFS APIs

class SafeServiceLDP extends ServiceInterface {
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
    const putDone = async (docUri, opotions, response) => {
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
    let docPath = this.safeJs.nfsPathPart(docUri)

    try {
      let fileInfo = await this._getFileInfo(itemPathPart(docUri))
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
        let perms // if auth is needed, request default permissions
        await safeJs.nfsMutate(await this.storageNfs(), perms, 'delete', docPath, undefined, fileInfo.version + 1)
//        await (await this.storageNfs()).delete(docPath, fileInfo.version + 1)
        this._fileInfoCache.delete(docUri)
        return new Response(null, {status: 204, statusText: '204 No Content'})
      }
    } catch (err) {
      logLdp('%s.delete() failed: %s', this.constructor.name, err)
      this._fileInfoCache.delete(docUri)
      return this.safeJs._httpResponseError('DELETE', err)
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
        return new Response(null, {status: 412, statusText: '412 Precondition Failed', revision: etagWithoutQuotes})
      }

      // Only act on files (directories are inferred so no need to create)
      if (isFolder(docUri)) {
        // Strictly we shouldn't get here as the caller should test, but in case we do
        logLdp('WARNING: attempt to update a folder')
      } else {
        // Store content as new immutable data (pointed to by nfsFile)
        let nfsFile = await (await this.storageNfs()).create(body)

        // Add file to directory (by inserting nfsFile into container)
        nfsFile = await (await this.storageNfs()).update(docPath, nfsFile, fileInfo.containerVersion + 1)
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
    let docPath = this.safeJs.nfsPathPart(docUri)

    try {
      this.safeJs.listContainer('_publicNames') // TODO remove this debug

      // logLdp('DEBUG:  this.storageNfs().create()...')
      let nfsFile = await (await this.storageNfs()).create(body)
      // mrhTODOx set file metadata (contentType) - how?

      // Add file to directory (by inserting nfsFile into container)
      // logLdp('DEBUG:  this.storageNfs().insert(nfsFile,%s)...',docPath)
      nfsFile = await (await this.storageNfs()).insert(docPath, nfsFile)

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
        return new Response(null, {status: 404, statusText: '404 File not found'})
      }
      fileInfo.openHandle = await (await this.storageNfs()).open(nfsFile, this.safeJs.safeApi.CONSTANTS.NFS_FILE_MODE_READ)
      logLdp('safeNfs.open() returns handle: %o', fileInfo.openHandle)

      var etagWithoutQuotes = fileInfo.ETag
      // Request is for changed file, so if eTag matches return "304 Not Modified"
      if (options && options.ifNoneMatch && etagWithoutQuotes && (etagWithoutQuotes === options.ifNoneMatch)) {
        return new Response(null, {status: 304, statusText: '304 Not Modified'})
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
      debug('safe:TMP 1')
      // Create listing by enumerating container keys beginning with docPath
      const directoryEntries = []
      let entries = await (await this.storageMd()).getEntries()
      let entriesList = await entries.listEntries()
      debug('safe:TMP 2')
      entriesList.forEach(async (entry) => {
        directoryEntries.push(new Promise(async (resolve, reject) => {

          debug('safe:TMP 3')
          // Skip deleted entries
          if (entry.value.buf.length === 0) {
            // TODO try without this...
            debug('safe:TMP 4')
            resolve()
            return  // Next
          }
          logLdp('Key: ', entry.key.toString())
          logLdp('Value: ', entry.value.buf.toString('base64'))
          logLdp('entryVersion: ', entry.value.version)

          var dirPath = docPath
          if (dirPath.slice(-1) !== '/') { dirPath += '/' } // Ensure a trailing slash

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
      return new Response(null, {status: 404, statusText: '404 Resource Not Found'})
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
      return new Response(null, {status: 404, statusText: '404 Resource Not Found'})
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
          isFolder(docUri)
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
    ns.stat('size'),
    fileInfo.size)

    // resourceGraph.add(resourceGraph.sym(reqUri),
    // ns.stat('mtime'),
    // fileInfo.modified)

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
      let containerVersion = await smd.getVersion()
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
        nfsFile = await (await this.storageNfs()).fetch(nfsPath)
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
// let safeJs = new SafenetworkApi()

module.exports.SafenetworkApi = SafenetworkApi

/*
 *  Override window.fetch() in order to support safe:// URIs
 */

// Protocol handlers for fetch()
const httpFetch = require('isomorphic-fetch')
const protoFetch = require('proto-fetch')

// map protocols to fetch()
const fetch = protoFetch({
  http: httpFetch,
  https: httpFetch
//  safe: safeJs.fetch.bind(safeJs)
//  https: Safenetwork.fetch.bind(Safenetwork), // Debugging with SAFE mock browser
})

module.exports.protoFetch = fetch
