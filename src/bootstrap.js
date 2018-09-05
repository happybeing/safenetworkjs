/*
MIT License

APPLICABLE TO THIS FILE ONLY: safe-app-cli.js which is adapted from
https://github.com/project-decorum/decorum-lib/src/Safe.ts
commit: 1d08f743e60c7953169290abaa37179de3508862

Copyright (c) 2018 Benno Zeeman

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE. */

const debug = require('debug')('safenetworkjs:cli')
const fs = require('fs')
const ipc = require('node-ipc')
const path = require('path')
const Safe = require('@maidsafe/safe-node-app')

/* console to file
// process.__defineGetter__('stderr', function () { return fs.createWriteStream(path.join(__dirname, '/pid-' + process.pid + '-error.log'), {flags: 'a'}) })
// process.__defineGetter__('stdout', function () { return fs.createWriteStream(path.join(__dirname, '/pid-' + process.pid + '-debug'), {flags: 'a'}) })

// var fs = require('fs')
var util = require('util')
var logFile = fs.createWriteStream(path.join('/home/mrh/src/fuse/safenetwork-fuse/pid-' + process.pid + '-debug'), {flags: 'w'})
var logStdout = process.stdout

debug = function (d) {
  logFile.write(util.format(d) + '\n')
  logStdout.write(util.format(d) + '\n')
}
*/

// No stdout from node-ipc
// ipc.config.silent = true

Safe.bootstrap = async (appInfo, appContainers, containerOpts, argv) => {
  debug('__dirname: ' + String(__dirname))
  debug('\nSafe.bootstrap()\n  with appInfo: ' + JSON.stringify(appInfo) +
    '  argv: ' + JSON.stringify(argv))

  const options = {
    libPath: getLibPath()
  }

  if (argv.pid !== undefined) {
    if (argv.uri === undefined) {
      throw Error('--uri undefined')
    }

    debug('ipcSend(' + argv.pid + ',' + argv.uri + ')')
    await ipcSend(String(argv.pid), argv.uri)

    process.exit()
  }

  let uri
  if (argv.uri !== undefined) {
    uri = argv.uri
  } else {
    await authorise(process.pid, appInfo, appContainers, containerOpts, options)
    debug('ipcReceive(' + process.pid + ')')
    uri = await ipcReceive(String(process.pid))
  }

  return Safe.fromAuthUri(appInfo, uri, null, options)
}

async function authorise (pid, appInfo, appContainers, containerOpts, options) {
  // For development can provide a pre-compiled cmd to receive the auth URL
  // This allows the application to be run and debugged using node
  if (!appInfo.customExecPath) {
    appInfo.customExecPath = [
      process.argv[0], process.argv[1],
      '--pid', String(pid),
      '--uri'
    ]
  }

  const app = await Safe.initialiseApp(appInfo, undefined, options)
  const uri = await app.auth.genAuthUri(appContainers, containerOpts)

  debug('bootstrap.authorise() with appInfo: ' + JSON.stringify(appInfo) +
    'appContainers: ' + JSON.stringify(appContainers))
  await app.auth.openUri(uri.uri)
  debug('wait a mo')
}

async function ipcReceive (id) {
  debug('ipcReceive(' + id + ')')
  return new Promise((resolve) => {
    ipc.config.id = id

    ipc.serve(() => {
      ipc.server.on('auth-uri', (data) => {
        debug('on(auth-uri) handling data.message: ' + data.message)
        resolve(data.message)
        ipc.server.stop()
      })
    })

    ipc.server.start()
  })
}

async function ipcSend (id, data) {
  debug('ipcSend(' + id + ', ' + data + ')')

  return new Promise((resolve) => {
    ipc.config.id = id + '-cli'

    ipc.connectTo(id, () => {
      ipc.of[id].on('connect', () => {
        debug('on(connect)')
        ipc.of[id].emit('auth-uri', { id: ipc.config.id, message: data })

        resolve()
        ipc.disconnect('world')
      })
    })
  })
}

/**
 * @returns
 */
function getLibPath () {
  const roots = [
    path.dirname(process.argv[0]),
    path.dirname(process.argv[1])
  ]

  const locations = [
    'node_modules/@maidsafe/safe-node-app/src/native'
  ]

  for (const root of roots) {
    for (const location of locations) {
      const dir = path.join(root, location)

      if (fs.existsSync(dir)) {
        debug('getLibPath() returning: ', dir)
        return dir
      }
    }
  }

  debug('No library directory found.')
  throw Error('No library directory found.')
}

module.exports = Safe
