"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // ============================================
  // File Dialogs
  // ============================================
  openFileDialog: () => electron.ipcRenderer.invoke("dialog:openFile"),
  openFolderDialog: () => electron.ipcRenderer.invoke("dialog:openFolder"),
  // ============================================
  // File System
  // ============================================
  pathExists: (path) => electron.ipcRenderer.invoke("fs:exists", path),
  openPath: (path) => electron.ipcRenderer.invoke("shell:openPath", path),
  // ============================================
  // Game Discovery
  // ============================================
  scanSteamLibrary: () => electron.ipcRenderer.invoke("games:scanSteam"),
  checkSteamInstalled: () => electron.ipcRenderer.invoke("games:checkSteam"),
  // ============================================
  // PE Analysis
  // ============================================
  analyzeExecutable: (path) => electron.ipcRenderer.invoke("pe:analyze", path),
  findExecutables: (gamePath) => electron.ipcRenderer.invoke("pe:findExecutables", gamePath),
  // ============================================
  // DXVK Engines
  // ============================================
  getAvailableEngines: (fork) => electron.ipcRenderer.invoke("engines:getAvailable", fork),
  getCachedVersions: (fork) => electron.ipcRenderer.invoke("engines:getCached", fork),
  isEngineCached: (fork, version) => electron.ipcRenderer.invoke("engines:isCached", fork, version),
  downloadEngine: (fork, version, url) => electron.ipcRenderer.invoke("engines:download", fork, version, url),
  // Listen for download progress
  onDownloadProgress: (callback) => {
    electron.ipcRenderer.on("engines:downloadProgress", (_, progress) => callback(progress));
  },
  removeDownloadProgressListener: () => {
    electron.ipcRenderer.removeAllListeners("engines:downloadProgress");
  },
  // ============================================
  // DXVK Deployment
  // ============================================
  installDxvk: (gamePath, gameId, fork, version, architecture) => electron.ipcRenderer.invoke("dxvk:install", gamePath, gameId, fork, version, architecture),
  uninstallDxvk: (gamePath) => electron.ipcRenderer.invoke("dxvk:uninstall", gamePath),
  checkDxvkStatus: (gamePath) => electron.ipcRenderer.invoke("dxvk:checkStatus", gamePath),
  // ============================================
  // Configuration
  // ============================================
  saveConfig: (gamePath, config) => electron.ipcRenderer.invoke("config:save", gamePath, config),
  // ============================================
  // Anti-Cheat Detection
  // ============================================
  detectAntiCheat: (gamePath) => electron.ipcRenderer.invoke("anticheat:detect", gamePath),
  getAntiCheatSummary: (gamePath) => electron.ipcRenderer.invoke("anticheat:summary", gamePath)
});
