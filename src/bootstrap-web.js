/**
 * Authorise app and/or request access to shared Mutable Data
 *
 * This code injects methods into the nodejs SAFE API object
 * including one for app authorisation and one to request
 * access to a shared Mutable Data.
 */

const logApi = console.log //require('debug')('safenetworkjs:web')
todoLogApi = (msg) => {
  throw Error('TODO: migrate to Fleming APIs (log msg: ' + msg + ')')
}

// Web API
const safe = new window.Safe

/**
 * Detect browser environment
 * @return {Boolean} true if running in the browser
 */
safe.isBrowser = () => {
  return window && (this === window)
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
 * @param  {Object} appInfo information about app for auth UI
 * @param  {function (newState)} networkStateCallback callback
 * @param  {appOptions} appOptions [optional] SAFEApp options
 * @param  {Object}  argv [optional] required only for command line authorisation
 * @return {Promise}  SAFEAppHandle.
 *
 * Note: see SAFE API initialiseApp()
 */
safe.initUnauthorised = async (appInfo, networkStateCallback, appOptions, argv) =>  {
  // TODO review/update

  let result = null
  try {
    let tmpAppHandle = await safe.initialiseApp(appInfo, networkStateCallback, appOptions)
    let connUri = await tmpAppHandle.auth.genConnUri()
    todoLogApi('SAFEApp was initialised with a read-only session on the SafeNetwork')
    safe._safeAuthUri = await safe.authorise(connUri)
    todoLogApi('SAFEApp was authorised and authUri received: ', safe._safeAuthUri)

    result = await tmpAppHandle.auth.loginFromUri(safe._safeAuthUri)
  } catch (err) {
    todoLogApi('WARNING: ', err)
  }

  todoLogApi('returning result: ', result)
  return result
}

/**
 * Initialise an authorised connection to SAFE Network
 *
 * This function provides simplified, one step authorisation. As an
 * alternative you can authorise separately using the SAFE API to
 * obtain a valid SAFEApp handle.
 *
 * @param  {Object}  appInfo       information about your app (see SAFE API)
 * @param  {Object}  appContainers [optional] permissions to request on containers
 * @param  {function (newState)} networkStateCallback callback
 * @param  {Object} authOptions for app 'own_container' prop. See SAFEApp.genAuthUri()
 * @param  {InitOptions} appOptions [optional] override default SAFEApp options
 * @param  {Object}  argv [optional] required only for command lin authorisation
 * @return {Promise} resolves to SAFEApp if successful
 */
// TODO: update parameters for Fleming API
safe.initAuthorised = async (appInfo, appContainers, networkStateCallback, authOptions, appOptions, argv) => {
  logApi('safe.initAuthorised()')
  let safeApp
  let authUri

  let auth_credentials
  try {
    // TODO: First try init from saved credentials
    // safeApp = await safe.initFromSavedCredentials(appInfo, networkStateCallback, appOptions, tmpAppHandle)

    logApi('initialising App...')
    auth_credentials = safe.auth_app(appInfo.id, appInfo.name, appInfo.vendor);

    logApi("connecting to the Network...");
    let result = safe.connect("net.maidsafe.safe_nodejs", auth_credentials);
  } catch (err) {
    logApi('WARNING: ', err)
  }

  safe._safeCredentials = auth_credentials
  logApi('returning safe API: ', safe)
  return safe
}

safe.OLD_initAuthorised = async (appInfo, appContainers, networkStateCallback, authOptions, appOptions, argv) => {
  todoLogApi('safe.OLD_initAuthorised()')
  let safeApp
  let authUri

  try {
    todoLogApi('initialising App...')
    let tmpAppHandle = await safe.initialiseApp(appInfo, networkStateCallback, appOptions)

    // First try init from saved auth URI
    safeApp = await safe.initFromSavedUri(appInfo, networkStateCallback, appOptions, tmpAppHandle)

    if (!safeApp) {
      todoLogApi('Authorising to obtain new authUri...')
      let authReqUri = await tmpAppHandle.auth.genAuthUri(appContainers, authOptions)
      authUri = await safe.authorise(authReqUri)
      safeApp = await tmpAppHandle.auth.loginFromUri(authUri)
      if (safeApp) {
        safe.saveAuthUri(appInfo.id, authUri)
        todoLogApi('SAFEApp was authorised and authUri obtained: ', authUri)
      }
    }
  } catch (err) {
    todoLogApi('WARNING: ', err)
  }

  safe._safeAuthUri = authUri
  todoLogApi('returning app: ', safeApp)
  return safeApp
}

// Try using authUri from browser storage
// TODO review security implications of storing authUri in browser storage

/**
 * Attempt authoristation using URI saved in browser storage
 *
 * @param  {Object}  SAFE AppInfo
 * @param  {[type]}  [optional] networkStateCallback
 * @param  {[type]}  [optional] appOptions
 * @param  {[type]}  [optional] appHandle
 * @return {Promise} SAFEApp on success
 */
safe.initFromSavedUri = async (appInfo, networkStateCallback, appOptions, appHandle) => {
  todoLogApi('safe.initFromSavedUri()')
  let safeApp
  let authUri

  try {
    todoLogApi('initialising App...')
    if (!appHandle) appHandle = await safe.initialiseApp(appInfo, networkStateCallback, appOptions)

    // Try using stored auth URI
    authUri = safe.loadAuthUri(appInfo.id)
    if (authUri) {
      todoLogApi('Trying stored authUri: ', authUri)
      safeApp = await appHandle.auth.loginFromUri(authUri)
      if (safeApp) {
        todoLogApi('SAFEApp was authorised using stored authUri: ', authUri)
      } else {
        safe.clearAuthUri(appInfo.id)
      }
    }
  } catch (err) {
    todoLogApi('WARNING: ', err)
  }

  safe._safeAuthUri = authUri

  todoLogApi('returning: ', safeApp)
  return safeApp
}

const storageName = 'safeAuthUri'

function authUriKey(appId) {return storageName + '-' + appId}

safe.saveAuthUri = (appId, authUri) => {
  try {
    window.localStorage.setItem(authUriKey(appId), authUri)
  } catch(e) {
    todoLogApi('saveAuthUri() failed to save to browser storage:' + e.message)
  }
}

safe.loadAuthUri = (appId) => {
  try {
    return window.localStorage.getItem(authUriKey(appId))
  } catch(e) {
    todoLogApi('loadAuthUri() failed to load from browser storage:' + e.message)
  }
}

safe.clearAuthUri = (appId) => {
  try {
    window.localStorage.removeItem(authUriKey(appId))
  } catch(e) {
    todoLogApi('clearAuthUri() failed to clear browser storage:' + e.message)
  }
}

/**
 * Request permissions on a shared MD, return SAFE auth URI
 *
 * @param  {SAFEApp}  app
 * @param  {String}   authReqUri obtained from safe.genShardMDataUri()
 * @return {Promise}  authUri
 */
safe.fromUri = async (app, authReqUri) => {
  todoLogApi('fromUri(app, %s)', authReqUri)

	let safeAuthUri = await safe.authorise(authReqUri)
  await app.auth.loginFromUri(safeAuthUri)
  return safeAuthUri
}

module.exports = safe
