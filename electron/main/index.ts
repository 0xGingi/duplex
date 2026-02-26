import { app, BrowserWindow } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { registerIpcHandlers } from './ipc-handlers.ts'
import { killAll } from './pty-manager.ts'
import store from './store.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Resolve the renderer dist directory — works in dev and packaged builds
const RENDERER_DIST = path.join(__dirname, '../../dist')

let mainWindow: BrowserWindow | null = null

// X11 systems can render a blank window with GPU compositing enabled.
if (process.platform === 'linux') {
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('disable-gpu')
  app.commandLine.appendSwitch('disable-gpu-compositing')
}

function createWindow() {
  const bounds = store.get('windowBounds') as { x: number; y: number; width: number; height: number } | undefined

  mainWindow = new BrowserWindow({
    width: bounds?.width ?? 1400,
    height: bounds?.height ?? 900,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0a0a0f',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  registerIpcHandlers(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Save window bounds on move/resize
  const saveBounds = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      store.set('windowBounds', mainWindow.getBounds())
    }
  }
  mainWindow.on('resize', saveBounds)
  mainWindow.on('move', saveBounds)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('Failed to load:', code, desc)
  })

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('Renderer process exited:', details.reason, details.exitCode)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  killAll()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
