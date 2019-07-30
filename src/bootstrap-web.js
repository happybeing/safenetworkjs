/**
 * Authorise app and/or request access to shared Mutable Data
 *
 * This code injects methods into the nodejs SAFE API object
 * including one for app authorisation and one to request
 * access to a shared Mutable Data.
 */

const logApi = require('debug')('safenetworkjs:web')  // Web API
const Safe = window.safe

/**
 * Detect browser environment
 * @return {Boolean} true if running in the browser
 */
Safe.isBrowser = () => {
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
Safe.initUnauthorised = async (appInfo, networkStateCallback, appOptions, argv) =>  {
  // TODO review/update

  let result = null
  try {
    let tmpAppHandle = await Safe.initialiseApp(appInfo, networkStateCallback, appOptions)
    let connUri = await tmpAppHandle.auth.genConnUri()
    logApi('SAFEApp was initialised with a read-only session on the SafeNetwork')
    Safe._safeAuthUri = await Safe.authorise(connUri)
    logApi('SAFEApp was authorised and authUri received: ', Safe._safeAuthUri)

    result = await tmpAppHandle.auth.loginFromUri(Safe._safeAuthUri)
  } catch (err) {
    logApi('WARNING: ', err)
  }

  logApi('returning result: ', result)
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
Safe.initAuthorised = async (appInfo, appContainers, networkStateCallback, authOptions, appOptions, argv) => {
  logApi('Safe.initAuthorised()')
  let safeApp
  let authUri

  try {
    logApi('initialising App...')
    let tmpAppHandle = await Safe.initialiseApp(appInfo, networkStateCallback, appOptions)

    // First try init from saved auth URI
    safeApp = await Safe.initFromSavedUri(appInfo, networkStateCallback, appOptions, tmpAppHandle)

    if (!safeApp) {
      logApi('Authorising to obtain new authUri...')
      let authReqUri = await tmpAppHandle.auth.genAuthUri(appContainers, authOptions)
      authUri = await Safe.authorise(authReqUri)
      safeApp = await tmpAppHandle.auth.loginFromUri(authUri)
      if (safeApp) {
        Safe.saveAuthUri(authUri)
        logApi('SAFEApp was authorised and authUri obtained: ', authUri)
      }
    }
  } catch (err) {
    logApi('WARNING: ', err)
  }

  Safe._safeAuthUri = authUri
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
Safe.initFromSavedUri = async (appInfo, networkStateCallback, appOptions, appHandle) => {
  logApi('Safe.initFromSavedUri()')
  let safeApp
  let authUri

  try {
    logApi('initialising App...')
    if (!appHandle) appHandle = await Safe.initialiseApp(appInfo, networkStateCallback, appOptions)

    // Try using stored auth URI
    authUri = Safe.loadAuthUri()
    if (authUri) {
      logApi('Trying stored authUri: ', authUri)
      safeApp = await appHandle.auth.loginFromUri(authUri)
      if (safeApp) {
        logApi('SAFEApp was authorised using stored authUri: ', authUri)
      } else {
        Safe.clearAuthUri()
      }
    }
  } catch (err) {
    logApi('WARNING: ', err)
  }

  Safe._safeAuthUri = authUri
  return safeApp
}

const storageName = 'safeAuthUri'

Safe.saveAuthUri = (authUri) => {
  try {
    window.localStorage.setItem(storageName, authUri)
  } catch(e) {
    logApi('saveAuthUri() failed to save to browser storage:' + e.message)
  }
}

Safe.loadAuthUri = () => {
  try {
    return window.localStorage.getItem(storageName)
  } catch(e) {
    logApi('loadAuthUri() failed to load from browser storage:' + e.message)
  }
}

Safe.clearAuthUri = () => {
  try {
    window.localStorage.removeItem(storageName)
  } catch(e) {
    logApi('clearAuthUri() failed to clear browser storage:' + e.message)
  }
}

/**
 * Request permissions on a shared MD, return SAFE auth URI
 *
 * @param  {SAFEApp}  app
 * @param  {String}   authReqUri obtained from Safe.genShardMDataUri()
 * @return {Promise}  authUri
 */
Safe.fromUri = async (app, authReqUri) => {
  logApi('fromUri(app, %s)', authReqUri)

	let safeAuthUri = await Safe.authorise(authReqUri)
  await app.auth.loginFromUri(safeAuthUri)
  return safeAuthUri
}

module.exports = Safe
