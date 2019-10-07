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

// TODO: this is here in case I need it before there's an API
// safe.isConnected = async () =>  {
//   let data = safe.fetch('safe://dweb/')
//   return (data && data.FilesContainer)
// }

/**
 * TODO: DEPRECATED may be re-instated when Fleming APIs add support
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
    safe._appCredentials = await safe.authorise(connUri)
    todoLogApi('SAFEApp was authorised and authUri received: ', safe._appCredentials)

    result = await tmpAppHandle.auth.loginFromUri(safe._appCredentials)
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
 * @param  {Object}  appInfo       App name, vendor, id
 * @param  {Object}  appContainers [optional] permissions to request on containers
 * @param  {function (newState)} networkStateCallback callback
 * @param  {Object} authOptions for app 'own_container' prop. See SAFEApp.genAuthUri()
 * @param  {InitOptions} appOptions [optional] override default SAFEApp options
 * @param  {Object}  argv [optional] required only for command lin authorisation
 * @return {Promise} true if authorised and connected
 */
// TODO: update parameters for Fleming API
safe.initAuthorised = async (appInfo, appContainers, networkStateCallback, authOptions, appOptions, argv) => {
  logApi('safe.initAuthorised()')
  let result
  let authUri
  try {
    // Try init from saved auth URI
    // If not successful, authorise and connect
    if (await safe.initFromSavedUri(appInfo)) {
      result = true
    } else {
      logApi('requesting auth of App...')
      authUri = safe.auth_app(appInfo.id, appInfo.name, appInfo.vendor)
      logApi('...authUri obtained: ', authUri)
      logApi("connecting to SAFE Network...")
      // TODO check params to safe.connect()
      safe.connect("net.maidsafe.safe_nodejs", authUri)
      logApi('...connected SUCCESS')
      result = true
      safe._appCredentials = authUri
      safe.saveAuthUri(appInfo.id, authUri)
    }
  } catch (err) {
    logApi('WARNING: ', err)
    safe.clearAuthUri(appInfo.id)
  }

  return result
}

/**
 * Attempt authoristation using URI saved in browser storage
 *
 * TODO review security implications of storing authUri in browser
 *
 * @param  {AppInfo} name, id, vendor
 * @return {Promise} SAFEApp on success
 */
safe.initFromSavedUri = async (appInfo) => {
  logApi('safe.initFromSavedUri()')
  let result
  let authUri

  try {
    // Try using stored auth URI
    authUri = safe.loadAuthUri(appInfo.id)
    if (authUri) {
      logApi('Trying stored authUri: ', authUri)
      safe.connect(authUri)
      logApi('...connected SUCCESS', authUri)
      result = true
    }
  } catch (err) {
    logApi('WARNING: ', err)
    safe.clearAuthUri(appInfo.id)
  }

  safe._appCredentials = authUri

  logApi('returning: ', result)
  return result
}

const storageName = 'safeAuthUri'

function authUriKey(appId) {return storageName + '-' + appId}

safe.saveAuthUri = (appId, authUri) => {
  try {
    window.localStorage.setItem(authUriKey(appId), authUri)
  } catch(e) {
    logApi('saveAuthUri() failed to save to browser storage:' + e.message)
  }
}

safe.loadAuthUri = (appId) => {
  try {
    return window.localStorage.getItem(authUriKey(appId))
  } catch(e) {
    logApi('loadAuthUri() failed to load from browser storage:' + e.message)
  }
}

safe.clearAuthUri = (appId) => {
  try {
    window.localStorage.removeItem(authUriKey(appId))
  } catch(e) {
    logApi('clearAuthUri() failed to clear browser storage:' + e.message)
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
