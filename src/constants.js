/**
 * SafenetworkJs constants
 *
 * Also includes SAFE constants not exposed by safe_app_nodejs.CONSTANTS
 *
 * TODO if SAFE API starts providing error codes, replace this to use them
 * TODO ref: https://github.com/maidsafe/safe-web-hosting-manager-electron/blob/master/app/constants.js#L46
 */

const CONSTANTS = {
  /*
   * What constitutes a valid public name is not specified in the containers
   *  RFC, but the Web Hosting Manager example code specifies:
   *    "Public ID must contain only lowercase alphanumeric characters.
   *    Should container a min of 3 characters and a max of 62 characters."
   *
   * Refs:
   *  https://github.com/maidsafe/rfcs/blob/master/text/0046-new-auth-flow/containers.md
   */
  // TODO ideally these would be SAFE API constants:
  PUBLICNAME_MINCHARS: 3,
  PUBLICNAME_MAXCHARS: 62,
  BADPUBLICNAME_MSG: 'must contain only lowercase alphanumeric characters. Should container a min of 3 characters and a max of 62 characters.',

  ENV: {
    DEV: 'development',
    TEST: 'test',
    PROD: 'production'
  },
  TYPE_TAG: {
    DNS: 15001,
    WWW: 15002
  },
  ERROR_CODE: {
    ENCODE_DECODE_ERROR: -1,
    SYMMETRIC_DECIPHER_FAILURE: -3,
    ACCESS_DENIED: -100,
    DATA_EXISTS: -104,
    NO_SUCH_ENTRY: -106,
    ENTRY_EXISTS: -107,
    TOO_MANY_ENTRIES: -108,
    NO_SUCH_KEY: -109,
    LOW_BALANCE: -113,
    NFS_FILE_NOT_FOUND: -301,
    INVALID_SIGN_KEY_HANDLE: -1011,
    EMPTY_DIR: -1029
  },
  APP_ERR_CODE: {
    INVALID_PUBLIC_NAME: -10001,
    INVALID_AUTH_RESP: -10002,
    INVALID_SHARED_MD_RESP: -10003,
    APP_NOT_INITIALISED: -10004,
    INVALID_SERVICE_PATH: -10005,
    INVALID_SERVICE_META: -10006,
    INVALID_SERVICE_NAME: -10007,
    ENTRY_VALUE_NOT_EMPTY: -10008
  },
  MAX_FILE_SIZE: 20 * 1024 * 1024,
  NETWORK_STATE: {
    INIT: 'Init',
    CONNECTED: 'Connected',
    UNKNOWN: 'Unknown',
    DISCONNECTED: 'Disconnected'
  },
  // FILE_OPEN_MODE: {
  //   OPEN_MODE_READ: 4
  // },
  FILE_READ: {
    FROM_START: 0,
    TILL_END: 0
  },
  SERVICE_TYPE_POSTFIX_DELIM: '@',
  DOWNLOAD_CHUNK_SIZE: 1000000,
  UPLOAD_CHUNK_SIZE: 1000000,
  UI: {
    DEFAULT_SERVICE_CONTAINER_PREFIX: 'root-',
    MSG: {
      CREATING_PUBLIC_NAMES: 'Creating public name',
      FETCH_SERVICE_CONTAINERS: 'Fetching service containers',
      CHECK_PUB_ACCESS: 'Checking public name access',
      CHECK_SERVICE_EXISTS: 'Checking service exists',
      SERVICE_EXISTS: 'Service already exists',
      DELETING_SERVICE: 'Deleting service',
      FETCHING_SERVICE: 'Fetching service',
      MD_AUTH_WAITING: 'Waiting for Mutable Data authorisation',
      GETTING_CONT_INFO: 'Getting container information',
      PUBLISHING_WEB: 'Publishing website',
      DELETING_FILES: 'Deleting file or folder',
      DOWNLOADING_FILE: 'Downloading file',
      REMAPPING_SERVICE: 'Remapping service',
      UPLOADING_TEMPLATE: 'Uploading template'
    },
    ERROR_MSG: {
      LOW_BALANCE: 'Network operation is not possible as there is insufficient account balance',
      NO_SUCH_ENTRY: 'Data not found',
      ENTRY_EXISTS: 'Data already exists',
      NO_SUCH_KEY: 'Unable to fetch data',
      INVALID_PUBLIC_NAME: 'Public ID must contain only lowercase alphanumeric characters. Should contain a min of 3 characters and a max of 62 characters',
      INVALID_SERVICE_NAME: 'Service name must contain only lowercase alphanumeric characters. Should contain a min of 3 characters and a max of 62 characters'
    }
  }
}

module.exports.CONSTANTS = CONSTANTS
