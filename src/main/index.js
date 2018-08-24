'use strict'

import Debug from 'debug'
import { app } from 'electron'
import { join } from 'path'

// import settings from 'electron-settings'

import PidManager from './lib/core/PidManager'
import network from './lib/network'
// import wallet from './lib/wallet'

import store from '../store/main'
import windowManager from './lib/windows'
import deeplink from './lib/deeplink'
import clipboard from './lib/clipboard'

import CONFIG from './config'
const debug = Debug('zcoin:main')

/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (process.env.NODE_ENV !== 'development') {
    global.__static = join(__dirname, '/static').replace(/\\/g, '\\\\')
}

// const rootFolder = __static // process.env.NODE_ENV === 'development' ? process.cwd() : __static
const rootFolder = process.env.NODE_ENV === 'development' ? process.cwd() : app.getAppPath()
const unpackedRootFolder = rootFolder.replace('app.asar', 'app.asar.unpacked')
const zcoindPath = join(unpackedRootFolder, '/assets/core/zcoind')
const userDataPath = app.getPath('userData')
const pathToStorePid = userDataPath

debug({
    rootFolder,
    unpackedRootFolder,
    zcoindPath,
    userDataPath,
    pathToStorePid
})

// build settings via electron-settings module

if (!app.isDefaultProtocolClient(CONFIG.app.protocolIdentifier)) {
    debug('registering protocol handler "%s"', CONFIG.app.protocolIdentifier)
    app.setAsDefaultProtocolClient(CONFIG.app.protocolIdentifier)
}

// get core config
const { autoRestart, heartbeatIntervalInSeconds, stopOnQuit } = CONFIG.app.core

store.replaceState(require('../store/initialState'))

// set up the manager
const coreDaemonManager = new PidManager({
    name: 'core',
    path: pathToStorePid,
    autoRestart,
    heartbeatIntervalInSeconds,
    store,
    onStarted: () => {
        console.log('STARTING NETWORK')
        // network.disconnect()
        // network.close()
        network.init({ store })
    }
})

if (stopOnQuit) {
    app.on('will-quit', () => {
        coreDaemonManager.stop()
    })
}

// start it!
debug('zcoindPath', zcoindPath)
coreDaemonManager.start(zcoindPath)

/*
// daemon testing...
let startStop = 0
let started = 0
let stopped = 0
const interval = setInterval(() => {
  startStop++
  // startStop % 0 === 0 ? coreDaemonManager.stop() : coreDaemonManager.start()
  if (startStop % 2 === 0) {
    coreDaemonManager.stop()
    stopped++
  } else {
    coreDaemonManager.start()
    started++
  }

  if (startStop >= 100) {
    clearInterval(interval)
    debug('CORE TESTS DONE! started: %d, stopped: %d', started, stopped)
  }
}, 2000)
*/

// tor proxy
// https://electronjs.org/docs/api/app#appcommandlineappendswitchswitch-value
// https://stackoverflow.com/questions/37393248/how-connect-to-proxy-in-electron-webview?utm_medium=organic&utm_source=google_rich_qa&utm_campaign=google_rich_qa
// app.commandLine.appendSwitch('proxy-server', 'socks5://127.0.0.1:9050')

// coreDaemonManager.on
// console.log('STARTING NETWORK')
// network.init({ store })

// wallet.init({ store, namespace: 'Wallet' })
deeplink.init({ windowManager, store })

windowManager.connectToStore({ store, namespace: 'Window' })
windowManager.registerWindows(CONFIG.windows)
windowManager.setupAppEvents()

clipboard.watch({ store, deeplink })

app.on('ready', () => {
    // store.dispatch('Window/show', 'welcomeGuide')
})

app.on('before-quit', () => {
    console.log('app before quit')
    network.close()
})

app.on('will-quit', () => {
    console.log('app will quit')
    // network.close()
    if (stopOnQuit) {
        coreDaemonManager.stop()
    }
})

/**
 * Auto Updater
 *
 * Uncomment the following code below and install `electron-updater` to
 * support auto updating. Code Signing with a valid certificate is required.
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-electron-builder.html#auto-updating
 */

/*
import { autoUpdater } from 'electron-updater'

autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall()
})

app.on('ready', () => {
  if (process.env.NODE_ENV === 'production') autoUpdater.checkForUpdates()
})
 */
