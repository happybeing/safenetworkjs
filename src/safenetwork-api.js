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
const { parse: parseUrl } = require('url');

const SUCCESS = null

// Local
const Services = require('./services')
const SafeServiceLDPNFS = Services.SafeServiceLDPNFS
const SafeServiceLDPFleming = Services.SafeServiceLDPFleming

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

// Default appInfo when connecting without authorisation (see initUnauthorised())
const untrustedAppInfo = {
  id: 'Unidentified app',
  name: 'WARNING: do not click Accept unless you trust this app',
  vendor: 'Unkown vendor'
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

  constructor (safeApi) {
    logApi('SafenetworkApi(%o)', safeApi)
    this.safeApi = safeApi

    // Access to SAFE API (DOM or NodeJS)
    // Must be set by either:
    // - index.js (nodejs app), or
    // - index-web.js (Browser app)
    if (!safeApi) debug( 'WARNING: safeApi is not valid')

    /*
    * Access to helpers and constants via the object (useful when <script> including this JS)
    */
    this.safeUtils = safeUtils  // Access to all utilities
    this.isCacheableResult = isCacheableResult
    this.isFolder = isFolder
    this.docpart = docpart
    this.itemPathPart = itemPathPart
    this.hostpart = hostpart
    this.protocol = protocol
    this.parentPathNoDot = parentPathNoDot
    this.untrustedAppInfo = untrustedAppInfo

    this._availableServices = new Map() // Map of installed services

    // _isConnected must be initialised here or setSafeAppHandle() will
    // reset it after _networkStateCallback has set it 'true' during
    // initAuthorised() / initUnauthorised()
    this._isConnected = undefined
    this.initialise()
    this.initialiseServices()
  }

  // Init SAFE App object, and try auth from saved auth URI
  //
  // IMPORTANT:
  // Apps should normally negate the need for this by using
  // initAuthorised(). This is only provided as a fallback
  // option for apps which don't know about the SAFE API,
  // such as Solid apps which use solid-auth-client (SAFE fork)
  async _initSafeApp () {
    logApi('_initSafeApp()...')
    if (!this.safeApi) {
      logApi('FAILED because this.safeApi is ', this.safeApi)
      return
    }

    // TODO: remove early Fleming hack to save clicking Solid File Manager Login() during testing:
    if (!this._appHandle) {
      await this.safeApi.initAuthorised({
        id: 'https://github.com/otto-aa/solid-filemanager',
        name: 'solid-filemanager',
        vendor: 'A_A'
      })
      this._appHandle = true          // Dummy for early Fleming
      this._isConnected = 'Connected' // Force connection for early Fleming
    }

    if (!this._appHandle) {
        this.setSafeAppHandle(await this.safeApi.initFromSavedUri(this.untrustedAppInfo, this._networkStateCallback), true)
    }

    if (!this._appHandle) {
        await this.initUnauthorised()
    }
  }

  initialise () {
    logApi('%s.initialise()', this.constructor.name)
    // TODO implement delete any active services (and their handles)

    // SAFE Network Services
    this._activeServices = new Map()    // Map of host (profile.public-name) to a service instance

    // SAFE API settings and and authorisation status
    this._safeAuthUri = ''
    this._isAuthorised = false
    this._authOnAccessDenied = false  // Used by initAuthorised() and fetch()

    // Default callback
    if (typeof this._networkStateCallback !== 'function') {
      this._networkStateCallback = (newState) => {
        todoLogApi('SafeNetwork state changed to: ', newState)
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

    // Constants
    this.CONSTANTS = CONSTANTS
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
   * service (see SafeServiceLDPNFS).
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
    // Need to implement NOT IMPLEMENTED functions on SafeServiceWww before enabling this (see implementations on SafeServiceLDPFleming)
    // this.setServiceImplementation(new SafeServiceWww(this))

    // This is currently using 'www' instead of 'LDP' due to issue in WHM (possibly fixed)
    this.setServiceImplementation(new SafeServiceLDPFleming(this))
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
    let pathPart = itemPathPart(docUri)
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
   * @param {SAFEApp} isAuthorised [optional] true indicates successful SAFE API initAuthorised()
   */

  setSafeAppHandle (appHandle, isAuthorised) {
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

      this._isAuthorised = isAuthorised ? true : false

      // Can't do this unless I make setSafeAppHandle() async
      // try { await this.initTests() } catch (e) { debug(e) }
    }
  }

  // Intended mainly for mock, create a container to mess with
  // App should call safeJs.initTests() after safeJs.initAuthorised()
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
  isConnected () { return this._isConnected === 'Connected' } // See issue https://github.com/maidsafe/safe_app_nodejs/issues/373
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
   * @param  {Object} [appInfo=this.untrustedAppInfo] information about app for auth UI, if ommitted generic 'untrusted' will appear.
   * @param  {appOptions} appOptions [optional] SAFEApp options
   * @param  {Object}  argv [optional] required only for command lin authorisation
   * @return {Promise}  SAFEAppHandle.
   *
   * Note: see SAFE API initialiseApp()
   */
  async initUnauthorised (appInfo, appOptions, argv) {
    todoLogApi('%s.initUnauthorised(%O)...', this.constructor.name, appInfo)
    this._initialAppSettings(appInfo ? appInfo : this.untrustedAppInfo, undefined, appOptions)
    this.setSafeAppHandle(await this.safeApi.initUnauthorised(this._safeAppInfo, this._safeAppOptions, this._networkStateCallback, argv))
this._isConnected = 'Connected' // TODO this is a hack as the callback is not setting this

    // try { // Report on support for Promise.finally()
    //   this.auth.getContainer('_public').then((md) = {
    //   }).catch((r) => {
    //   }).fi
    // nally(() => {
    //     console.log('FINALLY!!! Promise.finally() is supported')
    //   })
    // } catch (e) {
    //   console.error('WARNING: Promise.finally() IS NOT YET SUPPORTED IN SAFE BROWSER (issue #807)')
    // }
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
  async initAuthorised (appInfo, appContainers, ownContainer, appOptions, argv) {
    logApi('%s.initAuthorised(%O, %O, %s, %O, %O)...', this.constructor.name, appInfo, appContainers, ownContainer, appOptions, argv)
    this._initialAppSettings(appInfo, appContainers, appOptions, true /*enableAutoAuth*/)
    let authOptions = (ownContainer ? { own_container: true } : undefined)
logApi('Calling this.safeApi.initAuthorised()')
    const appHandle = await this.safeApi.initAuthorised(appInfo, appContainers, this._networkStateCallback, authOptions, appOptions, argv)
logApi('appHandle returned: %o', appHandle)
    return this.setSafeAppHandle(appHandle, true)
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
        debug('%s.nfsMutate() - %s() failed on NFS object', this.constructor.name, operation)
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
        container._subTree = itemPathPart(safeUri)  // Optionally mounts a subdirectory of the NFS container
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
    todoLogApi('getMutableDataValueVersion(%s,%s)...', mData, key)
    let valueVersion
    try {
      let useKey = await mData.encryptKey(key)
      valueVersion = await mData.get(useKey)
      if (!valueVersion) {
        const e = new Error('MutableData.get() returned undefined')
        e.code = CONSTANTS.ERROR_CODE.NO_SUCH_ENTRY
        throw e
      }
      valueVersion.buf = await mData.decrypt(valueVersion.buf)
      return valueVersion
    } catch (err) {
      todoLogApi(err)
      todoLogApi("getMutableDataValueVersion() WARNING: no entry found for key '%s'", key)
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

    todoLogApi('setMutableDataValue(%s,%s,%s,%s)...', mData, key, value, mustNotExist)
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
      todoLogApi('Mutable Data Entry %s', (mustNotExist ? 'inserted' : 'updated'))
      return true
    } catch (err) {
      todoLogApi('WARNING: unable to set mutable data value: ', err)
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
    todoLogApi('getPublicNameEntry(%s)...', publicName)
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
      todoLogApi('getPublicNameEntry() WARNING: no _publicNames entry found for: %s', publicName)
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
    todoLogApi('createPublicNameAndSetupService(%s,%s,%s)...', publicName, hostProfile, serviceId)
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
    todoLogApi('createPublicName(%s)...', publicName)
    try {
      return this._createPublicName(publicName)
    } catch (err) {
      todoLogApi('Unable to create public name \'' + publicName + '\': ', err)
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
    todoLogApi('createNfsContainerMd(%s,%s,%s,%s,%s)...', defaultContainer, publicName, containerName, mdTagType, isPrivate)
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
      todoLogApi('unable to create public container: ', err)
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
    todoLogApi('setupServiceServiceOnHost(%s,%s)...', host, serviceId)
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
        name.match(/^[a-z0-9\-]*$/)) {
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
    todoLogApi('_createPublicName(%s)...', publicName)
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
      todoLogApi('created services MD with servicesMdName: %s', enc.decode(new Uint8Array(servicesMdName)))

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
      todoLogApi('servicesMd created with tag: ', r.typeTag, ' and name: ', r.name, ' (%s)', enc.decode(new Uint8Array(r.name)))

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
      /* todoLogApi('DEBUG new servicesMd created with tag: ', r.typeTag, ' and name: ', r.name)
      todoLogApi('DEBUG _publicNames entry created for %s', publicName)
      todoLogApi('DEBUG servicesMd for public name \'%s\' contains...', publicName)
      await this.listMd(servicesMd, publicName + ' servicesMd')
      todoLogApi('DEBUG _publicNames MD contains...')
      await this.listMd(publicNamesMd, '_publicNames MD')
      */

      return {
        key: entryKey,
        value: servicesMdName,
        'servicesMd': servicesMd
      }
    } catch (err) {
      todoLogApi('_createPublicName() failed: ', err)
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
      todoLogApi('mutableDataExists(%o) TRUE', md)
      return true
    } catch (err) {
      todoLogApi(err)
      todoLogApi('mutableDataExists(%o) FALSE', md)
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
    todoLogApi('%s.getServicesMdFor(%s)', this.constructor.name, host)
    let publicName = host.split('.')[1]
    try {
      if (publicName === undefined) {
        publicName = host
      }

      todoLogApi("host '%s' has publicName '%s'", host, publicName)
      let servicesName = await this.makeServicesMdName(publicName)
      let md = await this.mutableData.newPublic(servicesName, SN_TAGTYPE_SERVICES)
      if (await this.mutableDataExists(md)) {
        var enc = new TextDecoder()
        todoLogApi('Look up SUCCESS for MD XOR name: ' + enc.decode(new Uint8Array(servicesName)))
        return md
      }
      throw new Error("services Mutable Data not found for public name '" + publicName + "'")
    } catch (err) {
      var enc = new TextDecoder()
      todoLogApi('Look up FAILED for MD XOR name: ' + enc.decode(new Uint8Array(await this.makeServicesMdName(publicName))))
      todoLogApi('getServicesMdFor ERROR: ', err)
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
    todoLogApi('getServicesMdFromContainers(%s)', host)
    try {
      let publicName = host.split('.')[1]
      if (publicName === undefined) {
        publicName = host
      }
      todoLogApi("host '%s' has publicName '%s'", host, publicName)

      let nameKey = this.makePublicNamesEntryKey(publicName)
      let md = await this.auth.getContainer('_publicNames')
      todoLogApi('_publicNames ----------- start ----------------')
      let entries = await md.getEntries()
      let entriesList = await entries.listEntries()
      await entriesList.forEach((k, v) => {
        todoLogApi('Key: ', entry.key.toString())
        todoLogApi('Value: ', entry.value.buf.toString())
        todoLogApi('Version: ', entry.value.version)
        if (k === nameKey) {
          todoLogApi('Key: ' + nameKey + '- found')
          return entry.value.buf
        }
      })
      todoLogApi('Key: ' + nameKey + '- NOT found')
      todoLogApi("getServicesMdFromContainers() - WARNING: No _publicNames entry for '%s'", publicName)
      return null
    } catch (err) {
      todoLogApi('getServicesMdFromContainers() ERROR: ', err)
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

  /**
   * Get the service enabled for a URI
   * Maintains a cache of handlers for each host, so once a service has
   * been assigned to a host address the service implementation is already
   * known for any URI with that host. If the appropriate service for a
   * host changes, it would be necessary to clear its cached service by
   * setting _activeServices.delete(<host>) to null, and the next call
   * would allocate a service from scratch.
   *
   * Notes:
   *  - normally the browser handles www, so a service is not usually set up
   *    for www
   *  - it is desirable for a given URI to have more than one service
   *    available so that a basic/default service can be used for most
   *    clients, while more capable clients can handle enhanced or alternative
   *    service protocols on the same URI. One way that the SAFE API could
   *    support this is to allow multiple services to be specified for
   *    a URI and leave the client to decide which to setup and use. This
   *    ability is not yet supported in SAFE API (existing or experimental),
   *    but has been requested:
   *       Issue #377: Support for multiple service types on a given safe URI
   *       https://github.com/maidsafe/safe_app_nodejs/issues/377
   *  - TODO depending on support (see safe_app_nodejs issue #377):
   *    it is valid for both a www service and up to one additional service
   *    to be set up on a given URI. In this case, the non-www service will
   *    be set up, and if it does not have its own serviceValue, it will be
   *    set up using that from the corresponding www service. This is useful
   *    for services that are compatible with www storage, so that clients
   *    which don't support the additional service will fall back to browser
   *    fetch(). For example, Solid apps can use an LDP to read and write data
   *    and non-Solid apps can access the same storage using www.
   *
   * @param  {String}  uri a valid safe:// style URI
   * @return {Promise} a ServiceInterface which supports fetch(). or undefined
   */
  async getServiceForUri (uri) {
    todoLogApi('getServiceForUri(%s)...', uri)

    // Temp solution that supports SAFE experimental API and
    // supports Solid apps by providing LDP service on everything!
    return this.exGetServiceForUri(uri)

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
      todoLogApi("URI has profile '%s' and publicName '%s'", uriProfile, publicName)

      // Get the services MD for publicName
      let servicesMd = await this.getServicesMdFor(publicName)
      let listingQ = []
      let matchedServiceValue  // Used when setting up default service on www container

      let entries = await servicesMd.getEntries()
      todoLogApi("checking servicesMd entries for host '%s'", host)
      this.hostedService = null
      let entriesList = await entries.listEntries()
      await entriesList.forEach(async (entry) => {
        listingQ.push(new Promise(async (resolve, reject) => {
          todoLogApi('Key: ', entry.key.toString())
          todoLogApi('Value: ', entry.value.buf.toString())
          todoLogApi('Version: ', entry.value.version)
          let serviceKey = entry.key.toString()
          if (serviceKey === CONSTANTS.MD_METADATA_KEY) {
            todoLogApi('Skipping metadata entry: ', serviceKey)
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
          todoLogApi("checking: serviceProfile '%s' has serviceId '%s'", serviceProfile, serviceId)
          if (serviceProfile === uriProfile && !newHostedService) {
            let serviceFound = this._availableServices.get(serviceId)
            if (serviceFound) {
              // Use the installed service to enable the service on this host
              let newHostedService = await serviceFound.makeServiceInstance(host, serviceValue)
              this.setActiveService(host, newHostedService) // Cache the instance for subsequent uses
              todoLogApi('Service activated - %s (serviceName: %s, serviceId: %s)', newHostedService.getDescription(), newHostedService.getName(), newHostedService.getIdString())
              this.hostedService = newHostedService
            } else {
              // Save www container if the uriProfile is for a www service
              if (serviceId === 'www' ) matchedServiceValue = serviceValue

              todoLogApi("WARNING: service '" + serviceId + "' is setup on '" + host + "' but no implementation is available")
            }
          }
          resolve() // Done
        }))
      })
      await Promise.all(listingQ).catch((e) => error(e))  // Wait until all entries processed

// TODO delete this and refs above to matchedServiceId and matchedServiceValue:
      // // We setup 'ldp' if we matched a 'www' service and nothing else
      // // This is a hack for now which means that any web service can be
      // // accessed by an LDP client without an LDP service being indicated
      // // in the services container.
      // if (!this.hostedService && matchedServiceId === 'www' && matchedServiceValue !== undefined) {
      //   let serviceFound = this._availableServices.get(serviceId)
      //   if (serviceFound) {
      //     // Use the installed service to enable the service on this host
      //     let newHostedService = await serviceFound.makeServiceInstance(host, matchedServiceValue)
      //     this.setActiveService(host, newHostedService) // Cache the instance for subsequent uses
      //     todoLogApi('Service activated - %s (serviceName: %s, serviceId: %s)', newHostedService.getDescription(), newHostedService.getName(), newHostedService.getIdString())
      //     this.hostedService = newHostedService
      //   }
      // }

      if (!this.hostedService) {
        todoLogApi("WARNING: no service setup for host '" + host + "'")
      }
      return this.hostedService
    } catch (err) {
      todoLogApi('getServiceForUri(%s) FAILED: %s', uri, err)
      return null
    } finally {
      // TODO implement memory freeing stuff using 'finally' throughout the code!
    }
  }

  // Version for use with SAFE Browser 0.15 (early Fleming)
  // Returns Fleming LDP service regardless
  async getFlemingLDPService (uri) {
    logApi('getFlemingLDPService(%s)...', uri)
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

      let serviceId = SN_SERVICEID_FLEMINGLDP
      let ldpService = this._availableServices.get(serviceId)
      if (ldpService) {
        let serviceValue = undefined
        // Use the installed service to enable the service on this host
        let newHostedService = await ldpService.makeServiceInstance(host, serviceValue) // serviceValue is undefined so we hack... this.setActiveService(host, newHostedService) // Cache the instance for subsequent uses
// TODO: ??? adapt for FlemingLDP
        newHostedService._storageMd = undefined // TODO: ???
        logApi('Service activated - %s (serviceName: %s, serviceId: %s)', newHostedService.getDescription(), newHostedService.getName(), newHostedService.getIdString())
        return newHostedService
      } else {
        logApi("WARNING: service '" + serviceId + "' is setup on '" + host + "' but no implementation is available")
      }
    } catch (err) {
      logApi('getFlemingLDPService(%s) FAILED: %s', uri, err)
      return null
    }
  }

  // Version for use with experimental RDF API (subNamesContainer using RDF)
  // (experimental SAFE API used by WebID Manager PoC)
  async exGetServiceForUri (uri) {
    todoLogApi('exGetServiceForUri(%s)...', uri)
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
      todoLogApi("URI has profile '%s' and publicName '%s'", uriProfile, publicName)

      // TODO support multiple service types per service URI (see safe_app_nodejs issue #377)
      //
      // Until multiple service types are supported by RDF subNamesContainer:
      // - assume we have a www service / NFS container
      // - set up LDP service so anything using SafenetworkJS fetch() has LDP
      // -> this allows Solid apps to work on SAFE, and allows other clients
      //    including SAFE Browser to serve the same content over SAFE www
      //
      let serviceValue
      let serviceContainer = await this.exGetContainerFromPublicId(publicName, uriProfile)
      if (serviceContainer.type === CONSTANTS.DATA_TYPE_RDF) {
        // TODO support RDF containers (requires all of SafenetworkJS to support them!)
        todoLogApi("WARNING: RDF based services not yet supported - no service available.")
        return undefined // Skip RDF containers
      } else if (serviceContainer.type === CONSTANTS.DATA_TYPE_NFS) {
        let serviceId = SN_SERVICEID_LDP
        let ldpService = this._availableServices.get(serviceId)
        if (ldpService) {
          // Use the installed service to enable the service on this host
          let newHostedService = await ldpService.makeServiceInstance(host, serviceValue) // serviceValue is undefined so we hack...
          this.setActiveService(host, newHostedService) // Cache the instance for subsequent uses
          newHostedService._storageMd = serviceContainer // Hack to set container MD
          todoLogApi('Service activated - %s (serviceName: %s, serviceId: %s)', newHostedService.getDescription(), newHostedService.getName(), newHostedService.getIdString())
          return newHostedService
        } else {
          todoLogApi("WARNING: service '" + serviceId + "' is setup on '" + host + "' but no implementation is available")
        }
      }
      // todoLogApi('Unknown container type for: %o', serviceContainer)
      throw Error('rdfGetServiceForUri() ERROR - Unknown container type: ', serviceContainer.type)

      // Get the services MD for publicName
      let servicesMd = await this.getServicesMdFor(publicName)
      let listingQ = []
      let entries = await servicesMd.getEntries()
      todoLogApi("checking servicesMd entries for host '%s'", host)
      this.hostedService = null
      let entriesList = await entries.listEntries()
      await entriesList.forEach(async (entry) => {
        listingQ.push(new Promise(async (resolve, reject) => {
          todoLogApi('Key: ', entry.key.toString())
          todoLogApi('Value: ', entry.value.buf.toString())
          todoLogApi('Version: ', entry.value.version)
          let serviceKey = entry.key.toString()
          if (serviceKey === CONSTANTS.MD_METADATA_KEY) {
            todoLogApi('Skipping metadata entry: ', serviceKey)
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
          todoLogApi("checking: serviceProfile '%s' has serviceId '%s'", serviceProfile, serviceId)
          if (serviceProfile === uriProfile) {
            let serviceFound = this._availableServices.get(serviceId)
            if (serviceFound) {
              // Use the installed service to enable the service on this host
              let newHostedService = await serviceFound.makeServiceInstance(host, serviceValue)
              this.setActiveService(host, newHostedService) // Cache the instance for subsequent uses
              todoLogApi('Service activated - %s (serviceName: %s, serviceId: %s)', newHostedService.getDescription(), newHostedService.getName(), newHostedService.getIdString())
              this.hostedService = newHostedService
            } else {
              todoLogApi("WARNING: service '" + serviceId + "' is setup on '" + host + "' but no implementation is available")
            }
          }
          resolve() // Done
        }))
      })
      await Promise.all(listingQ).catch((e) => error(e))  // Wait until all entries processed

      if (!this.hostedService) {
        todoLogApi("WARNING: no service setup for host '" + host + "'")
      }
      return this.hostedService
    } catch (err) {
      todoLogApi('getServiceForUri(%s) FAILED: %s', uri, err)
      return null
    } finally {
      // TODO implement memory freeing stuff using 'finally' throughout the code!
    }
  }

  async NEW_getServiceForUri (uri) {
    todoLogApi('getServiceForUri(%s)...', uri)
    try {
      let host = hostpart(uri)
      let service = await this._activeServices.get(host)
      if (service) {
        return service
      } // Already initialised

      const serviceEntries = await this.getMatchingServices(host)

      let defaultServiceValue
      // If we have two services one must be 'www', and we might need its container
      if (serviceEntries.length === 2) {
        defaultServiceValue = serviceEntries['www']
        serviceEntries.splice(serviceEntries.indexOf('www'),1)
      }
      // Note: we assume serviceEntries.length is now 1. If there are more matching
      // services at this point only the first will be set up.
      let newHostedService
      let serviceId = serviceEntries.keys()[0]
      if (serviceId && serviceId.length >= 0) {
        let serviceValue = serviceEntries[serviceId]
        if (serviceValue && serviceValue.length >= 0) serviceValue = defaultServiceValue

        let serviceFound = this._availableServices.get(serviceId)
        if (serviceFound) {
          // Use the installed service to enable the service on this host
          newHostedService = await serviceFound.makeServiceInstance(host, serviceValue)
          this.setActiveService(host, newHostedService) // Cache the instance for subsequent uses
          todoLogApi('Service activated - %s (serviceName: %s, serviceId: %s)', newHostedService.getDescription(), newHostedService.getName(), newHostedService.getIdString())
        } else {
          todoLogApi("WARNING: service '" + serviceId + "' is setup on '" + host + "' but no implementation is available")
        }
      }

      if (!newHostedService) {
        todoLogApi("WARNING: no service setup for host '" + host + "'")
      }
      return newHostedService
    } catch (err) {
      todoLogApi('getServiceForUri(%s) FAILED: %s', uri, err)
      return null
    }
  }

  /**
   * Get a map of service name to service value, for each service matching 'host'
   *
   * Typically there will only be one matching service, but we return a map
   * in case more than one service has been created for the given host subName.
   *
   * @param  {String}  host (ie the [subName.]publicName part of a safe URI)
   * @return {Promise}      map of service names to service value, on the subName
   */
  async getMatchingServices (host) {
    todoLogApi('getMatchingServices(%s)...', host)
    // Look up the service on this host: profile.public-name
    let uriProfile = host.split('.')[0]
    let publicName = host.split('.')[1]
    if (publicName === undefined) {
      publicName = host
      uriProfile = 'www'
    }
    todoLogApi("URI has profile '%s' and publicName '%s'", uriProfile, publicName)

    // Get the services MD for publicName
    let servicesMd = await this.getServicesMdFor(publicName)
    let listingQ = []
    let servicesMap = []
    let entries = await servicesMd.getEntries()
    todoLogApi("checking servicesMd entries for host '%s'", host)
    let entriesList = await entries.listEntries()
    await entriesList.forEach(async (entry) => {
      listingQ.push(new Promise(async (resolve, reject) => {
        todoLogApi('Key: ', entry.key.toString())
        todoLogApi('Value: ', entry.value.buf.toString())
        todoLogApi('Version: ', entry.value.version)
        let serviceKey = entry.key.toString()
        if (serviceKey === CONSTANTS.MD_METADATA_KEY) {
          todoLogApi('Skipping metadata entry: ', serviceKey)
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
        todoLogApi("checking: serviceProfile '%s' has serviceId '%s'", serviceProfile, serviceId)
        if (serviceProfile === uriProfile) {
          servicesMap.push({ serviceId: serviceValue })
        }
        resolve() // Done
      }))
    })
    await Promise.all(listingQ).catch((e) => error(e))  // Wait until all entries processed

    todoLogApi('servicesMap: %O', servicesMap)
    return servicesMap
  }

  /**
   * Get a map of service name to service value for each service matching subName
   *
   * Typically there will only be one matching service, but we return a map
   * in case more than one service has been created for the given host subName.
   *
   * @param  {MutableData}  servicesMd
   * @param  {String}       subName
   * @return {Promise}      map of service names to service value, on the subName
   */
  async getMatchingServicesFromMd (servicesMd, subName) {
    todoLogApi('getMatchingServicesFromMd(%o)...', servicesMd)
    let listingQ = []
    let servicesMap = []
    let entries = await servicesMd.getEntries()
    todoLogApi("checking servicesMd entries for host '%s'", host)
    let entriesList = await entries.listEntries()
    await entriesList.forEach(async (entry) => {
      listingQ.push(new Promise(async (resolve, reject) => {
        todoLogApi('Key: ', entry.key.toString())
        todoLogApi('Value: ', entry.value.buf.toString())
        todoLogApi('Version: ', entry.value.version)
        let serviceKey = entry.key.toString()
        if (serviceKey === CONSTANTS.MD_METADATA_KEY) {
          todoLogApi('Skipping metadata entry: ', serviceKey)
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
        todoLogApi("checking: serviceProfile '%s' has serviceId '%s'", serviceProfile, serviceId)
        if (serviceProfile === subName) {
          servicesMap.push({ serviceId: serviceValue })
        }
        resolve() // Done
      }))
    })
    await Promise.all(listingQ).catch((e) => error(e))  // Wait until all entries processed

    todoLogApi('servicesMap: %O', servicesMap)
    return servicesMap
  }

  /** Experimental RDF support:
   */

  /**
   * version of getMatchingServices() that understands SAFE experimental RDF
   *
   * @param  {String}  host part of URI: [subName.]publicName
   * @return {Promise}      map of service names to service value, on the subName
   */
  async rdfGetMatchingServices (host) {
    todoLogApi('rdfGetMatchingServices(%s)...', host)
    let parsedUrl = parseUrl(uri);
    if (!parsedUrl.protocol) parsedUrl = parseUrl('safe://' + host)
    const hostParts = parsedUrl.hostname.split('.')
    let publicName = hostParts.pop()     // last one is 'publicName'
    let subName = hostParts.join('.')    // all others are 'subNames'
    if (subName === undefined) subName = 'www'

    // Look up the service on this host: subName.public-name
    todoLogApi("URI has subName '%s' and publicName '%s'", subName, publicName)

    let subNamesContainer = await this.getServicesMdFor(publicName)

// ??? modify this to access RDF emulation of serviceMd - see exReadPublicIdAsRdf() below
// The current subNamesContainer RDF does not allow more than one service
// entry per subName. I.e. safe://me.pubname can only map to one service.
// I've made a safe_app_nodejs feature request (issue #377) to
// support multiple service types on a given safe URI.

    let serviceMd;
    let servicesMap = []
    let servicesMap2 = []
    let xorName
    try {
      const graphId = `safe://${subName}.${publicName}`;
      const rdfEmulation = await subNamesContainer.emulateAs('rdf');
      await rdfEmulation.nowOrWhenFetched([graphId]);
      const SAFETERMS = rdfEmulation.namespace('http://safenetwork.org/safevocab/');
      let match = rdfEmulation.statementsMatching(rdfEmulation.sym(graphId), SAFETERMS('xorName'), undefined);
      xorName = match[0].object.value.split(',');
      match = rdfEmulation.statementsMatching(rdfEmulation.sym(graphId), SAFETERMS('typeTag'), undefined);
      const typeTag = match[0].object.value;
      serviceMd = await this.mutableData.newPublic(xorName, parseInt(typeTag, 10));
    } catch (err) {
      // there is no matching subName name
      throw makeError(errConst.ERR_SERVICE_NOT_FOUND.code, errConst.ERR_SERVICE_NOT_FOUND.msg);
    }
    servicesMap.push({ $subName: xorName })

    return servicesMap


    let listingQ = []
    let entries = await servicesMd.getEntries()
    todoLogApi("checking servicesMd entries for host '%s'", host)
    let entriesList = await entries.listEntries()
    await entriesList.forEach(async (entry) => {
      listingQ.push(new Promise(async (resolve, reject) => {
        todoLogApi('Key: ', entry.key.toString())
        todoLogApi('Value: ', entry.value.buf.toString())
        todoLogApi('Version: ', entry.value.version)
        let serviceKey = entry.key.toString()
        if (serviceKey === CONSTANTS.MD_METADATA_KEY) {
          todoLogApi('Skipping metadata entry: ', serviceKey)
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
        todoLogApi("checking: serviceProfile '%s' has serviceId '%s'", serviceProfile, serviceId)
        if (serviceProfile === uriProfile) {
          servicesMap.push({ serviceId: serviceValue })
        }
        resolve() // Done
      }))
    })
    await Promise.all(listingQ).catch((e) => error(e))  // Wait until all entries processed

    todoLogApi('servicesMap: %O', servicesMap)
    return servicesMap
  }

  // /**
  //  * Get a map of service name to service value for subName (RDF version)
  //  *
  //  * Typically there will only be one matching service, but we return a map
  //  * in case more than one service has been created for the given host subName.
  //  *
  //  * @param  {MutableData}  servicesMd
  //  * @param  {String}       subName
  //  * @return {Promise}      map of service names to service valut, on the subName
  //  */
  // async rdfGetMatchingServicesFromMd (servicesMd, subName) {
  //
  //   ??? modify this to access RDF emulation of serviceMd - see exReadPublicIdAsRdf() below
  //
  //   todoLogApi('getMatchingServicesFromMd(%o)...', servicesMd)
  //   let listingQ = []
  //   let servicesMap = []
  //   let entries = await servicesMd.getEntries()
  //   todoLogApi("checking servicesMd entries for host '%s'", host)
  //   let entriesList = await entries.listEntries()
  //   await entriesList.forEach(async (entry) => {
  //     listingQ.push(new Promise(async (resolve, reject) => {
  //       todoLogApi('Key: ', entry.key.toString())
  //       todoLogApi('Value: ', entry.value.buf.toString())
  //       todoLogApi('Version: ', entry.value.version)
  //       let serviceKey = entry.key.toString()
  //       if (serviceKey === CONSTANTS.MD_METADATA_KEY) {
  //         todoLogApi('Skipping metadata entry: ', serviceKey)
  //         resolve()
  //         return  // Skip
  //       }
  //
  //       // Defaults:
  //       let serviceProfile = ''
  //       let serviceId = 'www'
  //
  //       if (serviceKey.indexOf('@' === -1)) {
  //         serviceProfile = serviceKey
  //       } else {
  //         serviceProfile = serviceKey.split('@')[0]
  //         serviceId = serviceKey.split('@')[1]
  //         if (!serviceId || serviceId === '') serviceId = 'www'
  //       }
  //
  //       let serviceValue = entry.value
  //       todoLogApi("checking: serviceProfile '%s' has serviceId '%s'", serviceProfile, serviceId)
  //       if (serviceProfile === subName) {
  //         servicesMap.push({ serviceId: serviceValue })
  //       }
  //       resolve() // Done
  //     }))
  //   })
  //   await Promise.all(listingQ).catch((e) => error(e))  // Wait until all entries processed
  //
  //   todoLogApi('servicesMap: %O', servicesMap)
  //   return servicesMap
  // }

  /*---------------------------------------------------------------------------
   * Start of code borrowed from safe_app_nodejs/src/web_fetch.js
   * for SAFE experimental RDF implementation.
   */
  makeError(code, message) {
    let e = new Error(message)
    e.code = code
    return e
  }

  /**
   * Get services container for public name (RDF version)
   *
   * @param  {MutableData} subNamesContainer [description]
   * @param  {String} pubName           [description]
   * @param  {String} subName           [description]
   * @return {MutableData, String}  Promise {servicesMd, DATA_TYPE_RDF}
   */
  async exReadPublicIdAsRdf(subNamesContainer, pubName, subName) {
    todoLogApi('exReadPublicIdAsRdf(%o, %s, %s)', subNamesContainer, pubName, subName)
    let serviceMd;
    try {
      const graphId = `safe://${subName}.${pubName}`;
      const rdfEmulation = await subNamesContainer.emulateAs('rdf');
      await rdfEmulation.nowOrWhenFetched([graphId]);
      const SAFETERMS = rdfEmulation.namespace('http://safenetwork.org/safevocab/');
      let match = rdfEmulation.statementsMatching(rdfEmulation.sym(graphId), SAFETERMS('xorName'), undefined);
      const xorName = match[0].object.value.split(',');
      match = rdfEmulation.statementsMatching(rdfEmulation.sym(graphId), SAFETERMS('typeTag'), undefined);
      const typeTag = match[0].object.value;
      serviceMd = await this.mutableData.newPublic(xorName, parseInt(typeTag, 10));
    } catch (err) {
      // there is no matching subName name
      throw this.makeError(errConst.ERR_SERVICE_NOT_FOUND.code, errConst.ERR_SERVICE_NOT_FOUND.msg);
    }

    serviceMd.type = CONSTANTS.DATA_TYPE_RDF
    return serviceMd
  }

  /**
   * Get services container

   * @param  {String} pubName
   * @param  {String} subName
   * @return {MutableData, String}  Promise {servicesMd, DATA_TYPE_NFS|DATA_TYPE_RDF}
   */
  async exGetContainerFromPublicId(pubName, subName) {
    todoLogApi('exGetContainerFromPublicId(%s, %s)', pubName, subName)
    let serviceInfo;
    let subNamesContainer;
    try {
      const address = await this.crypto.sha3Hash(pubName);
      subNamesContainer = await this.safeApp.mutableData.newPublic(address, consts.TAG_TYPE_DNS);
      todoLogApi('subNamesContainer: %o', subNamesContainer)
      serviceInfo = await subNamesContainer.get(subName || 'www'); // default it to www
    } catch (err) {
      switch (err.code) {
        case errConst.ERR_NO_SUCH_DATA.code:
          // there is no container stored at the location
          throw this.makeError(errConst.ERR_CONTENT_NOT_FOUND.code, errConst.ERR_CONTENT_NOT_FOUND.msg);
        case errConst.ERR_NO_SUCH_ENTRY.code:
          // Let's then try to read it as an RDF container
          return this.exReadPublicIdAsRdf.call(this, subNamesContainer, pubName, subName);
        default:
          throw err;
      }
    }

    if (serviceInfo.buf.length === 0) {
      // the matching service name was soft-deleted
      throw this.makeError(errConst.ERR_SERVICE_NOT_FOUND.code, errConst.ERR_SERVICE_NOT_FOUND.msg);
    }

    let serviceMd;
    try {
      serviceMd = await this.mutableData.fromSerial(serviceInfo.buf);
    } catch (e) {
      serviceMd = await this.mutableData.newPublic(serviceInfo.buf, consts.TAG_TYPE_WWW);
    }

    serviceMd.type = CONSTANTS.DATA_TYPE_NFS
    return serviceMd
  }

  /* End of code borrowed from safe_app_nodejs experimental RDF implementation.
   ---------------------------------------------------------------------------*/

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
    todoLogApi('getMdFromHash(%s,%s)...', hash, tagType)
    try {
      return this.mutableData.newPublic(hash, tagType)
    } catch (err) {
      todoLogApi('getMdFromHash() ERROR: %s', err)
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
    todoLogApi('makeServicesMdName(%s)', publicName)
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
  // Note that web services use a different key structure to other services.
  //
  // A web service uses the subName as the key, or 'www' if the subName is
  // omitted or an empty string. All other services use a key with
  // the form subName@serviceId (e.g. storage@ldp)
  //
  // For reference, see:
  // - safe_app_nodejs/src/web_fetch.js / getContainerFromPublicId()
  //
  // @param hostProfile prefix of a host address, which is [profile.]public-name
  // @param serviceId
  //
  // @returns the key as a string, corresponding to a service entry in a servicesMD
  //
  // TODO ensure hostProfile is valid before attempting (eg lowercase, no illegal chars such as '@')
  //
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
    await this._initSafeApp()  // Ensure SAFE App is initialised

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
      // TODO: replace early Fleming hack
      // let service = await this.getServiceForUri(docUri)
      let service = await this.getFlemingLDPService(docUri)

      if (service) {
        if (!options.method) {
          options.method = 'GET'
        }
        if (typeof(options.body) === 'object') {
          // If body is a Blob convert it to ArrayBuffer for SAFE APIs
          options.body = await new Response(options.body).arrayBuffer()
        }

        logRest('%s %s %s', service.getIdString(), options.method, docUri)
        let handler = service.getHandler(options.method)
        response = await handler.call(service, docUri, options)
        logRest('    response: %s %s', response.status, response.statusText)
      }
    } catch (err) {
      logApi('%s._fetch() error: %s', this.constructor.name, err)
    }

    // Since SAFE webFetch() doesn't work in mock, we first try window.fetch()
    if (!response && this.safeApp.appIsMock() && docUri.indexOf('safe://') !== 0) {
      logApi('%s._fetch() - no service available, try window.fetch()...', this.constructor.name)

      try {
        response = await window.fetch(docUri, options)
      } catch (err) {
        logApi('%s._fetch() error: %s (%o)', this.constructor.name, err, err)
        response = new Response(null, {status: 500, statusText: 'Unknown error'})
      }
    }

    if (!response) {
      logApi('%s._fetch() - no service available, defaulting to webFetch()...', this.constructor.name)

      try {
        response = this._convertWebFetchResponse(await this.safeApp.webFetch(docUri, options))
      } catch (err) {
        logApi('%s._fetch() error: %s (%o)', this.constructor.name, err, err)
        response = new Response(null, {status: 500, statusText: 'Unknown error'})
      }
    }

    logApi('response: %o', response)
    return response
  }

  // Make webFetch() response suitable for rdflib.js Fetcher
  _convertWebFetchResponse(wfr) {
      const response = new Response(wfr.body, {
        status: wfr.status,
        statusText: wfr.statusText,
        headers: new Headers(wfr.headers)
      })
      todoLogApi('webFetch response: %o', wfr)
      todoLogApi('webFetch converted response: %o', response)
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
    let serviceId = SN_SERVICEID_LDP
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
    let createResult = await this.createPublicNameAndSetupService(publicName, hostProfile, SN_SERVICEID_LDP)
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

// Usage: create the web API and install the built in services
// let safeJs = new SafenetworkApi()

module.exports.SafenetworkApi = SafenetworkApi
module.exports.safeUtils = safeUtils
