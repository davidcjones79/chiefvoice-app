const { app, BrowserWindow, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');

// Keep references to prevent garbage collection
let mainWindow = null;
let tray = null;

const isDev = process.env.NODE_ENV === 'development';

// URLs for different modes
const DEV_URL = 'http://localhost:3000';
// Production: connect to your hosted Chief server (same as iOS app)
const PROD_URL = process.env.CHIEF_URL || 'https://davids-mac-mini-1.bunny-bleak.ts.net:8443';

console.log('[Chief] NODE_ENV:', process.env.NODE_ENV);
console.log('[Chief] isDev:', isDev);
console.log('[Chief] Will load:', isDev ? DEV_URL : PROD_URL);

function createWindow() {
  // Set dock icon on macOS (for non-packaged runs)
  if (process.platform === 'darwin') {
    const iconPath = path.join(__dirname, 'icon.png');
    try {
      const dockIcon = nativeImage.createFromPath(iconPath);
      if (!dockIcon.isEmpty()) {
        app.dock.setIcon(dockIcon);
      }
    } catch (e) {
      console.log('[Chief] Could not set dock icon:', e.message);
    }
  }

  mainWindow = new BrowserWindow({
    width: 420,
    height: 700,
    minWidth: 380,
    minHeight: 500,
    frame: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#faf7f2',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Enable WebRTC
      webSecurity: true,
    },
    show: false, // Don't show until ready
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL(DEV_URL);
    // Open DevTools in development
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // In production, connect to the hosted Chief server
    // (Same server that iOS app uses - requires network)
    mainWindow.loadURL(PROD_URL);
    console.log('[Chief] Loading production URL:', PROD_URL);
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Handle window close - hide instead of quit (for tray)
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  // Create tray icon (use a template image for macOS)
  const iconPath = path.join(__dirname, 'trayIconTemplate.png');
  let trayIcon;

  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    trayIcon = trayIcon.resize({ width: 18, height: 18 });
    trayIcon.setTemplateImage(true);
  } catch (e) {
    // Fallback: create a simple icon
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Chief');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Chief',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Start Voice Call',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          // Send message to renderer to start call
          mainWindow.webContents.send('start-call');
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Chief',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Click on tray icon shows/hides window
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// Request microphone permission on macOS
async function requestMicrophonePermission() {
  if (process.platform === 'darwin') {
    const { systemPreferences } = require('electron');
    const micStatus = systemPreferences.getMediaAccessStatus('microphone');

    if (micStatus !== 'granted') {
      const granted = await systemPreferences.askForMediaAccess('microphone');
      console.log('Microphone permission:', granted ? 'granted' : 'denied');
      return granted;
    }
    return true;
  }
  return true;
}

// App lifecycle
app.whenReady().then(async () => {
  // Request microphone permission
  await requestMicrophonePermission();

  createWindow();
  createTray();

  app.on('activate', () => {
    // macOS: re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, keep app running in tray
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

// Handle certificate errors for development (self-signed certs)
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (isDev && url.startsWith('https://localhost')) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});
