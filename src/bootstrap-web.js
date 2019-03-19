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

  try {
    let tmpAppHandle = await Safe.initialiseApp(appInfo, networkStateCallback, appOptions)
    let connUri = await tmpAppHandle.auth.genConnUri()
    logApi('SAFEApp was initialise with a read-only session on the SafeNetwork')

    Safe._safeAuthUri = await Safe.authorise(connUri)
    logApi('SAFEApp was authorised and authUri received: ', Safe._safeAuthUri)

    return await tmpAppHandle.auth.loginFromUri(Safe._safeAuthUri)
  } catch (err) {
    logApi('WARNING: ', err)
  }
  return null
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

  try {
    let tmpAppHandle = await Safe.initialiseApp(appInfo, networkStateCallback, appOptions)
    let authReqUri = await tmpAppHandle.auth.genAuthUri(appContainers, authOptions)
    Safe._safeAuthUri = await Safe.authorise(authReqUri)
    logApi('SAFEApp was authorised and authUri received: ', Safe._safeAuthUri)

    return await tmpAppHandle.auth.loginFromUri(Safe._safeAuthUri)
  } catch (err) {
    logApi('WARNING: ', err)
  }
  return null
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
