"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const tar = require("tar");
const crypto = require("crypto");
const STEAM_PATHS = [
  "C:\\Program Files (x86)\\Steam",
  "C:\\Program Files\\Steam",
  path.join(os.homedir(), "Steam"),
  "D:\\Steam",
  "E:\\Steam",
  "D:\\SteamLibrary",
  "E:\\SteamLibrary"
];
function findSteamPath() {
  for (const path$1 of STEAM_PATHS) {
    if (fs.existsSync(path.join(path$1, "steamapps", "libraryfolders.vdf"))) {
      return path$1;
    }
  }
  return null;
}
function parseVdf(content) {
  const result = {};
  const lines = content.split("\n");
  const stack = [result];
  let currentKey = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) continue;
    if (trimmed === "{") {
      const newObj = {};
      stack[stack.length - 1][currentKey] = newObj;
      stack.push(newObj);
      continue;
    }
    if (trimmed === "}") {
      stack.pop();
      continue;
    }
    const match = trimmed.match(/^"([^"]+)"\s*"([^"]*)"$/);
    if (match) {
      const [, key, value] = match;
      stack[stack.length - 1][key] = value;
      continue;
    }
    const keyMatch = trimmed.match(/^"([^"]+)"$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
    }
  }
  return result;
}
function getSteamLibraryPaths(steamPath) {
  const vdfPath = path.join(steamPath, "steamapps", "libraryfolders.vdf");
  if (!fs.existsSync(vdfPath)) {
    return [steamPath];
  }
  try {
    const content = fs.readFileSync(vdfPath, "utf-8");
    const parsed = parseVdf(content);
    const libraryFolders = parsed["libraryfolders"];
    if (!libraryFolders) {
      return [steamPath];
    }
    const paths = [];
    for (const key of Object.keys(libraryFolders)) {
      if (/^\d+$/.test(key)) {
        const entry = libraryFolders[key];
        if (entry && typeof entry.path === "string") {
          paths.push(entry.path);
        }
      }
    }
    return paths.length > 0 ? paths : [steamPath];
  } catch (error) {
    console.error("Failed to parse libraryfolders.vdf:", error);
    return [steamPath];
  }
}
function parseAppManifest(manifestPath) {
  try {
    const content = fs.readFileSync(manifestPath, "utf-8");
    const parsed = parseVdf(content);
    const appState = parsed["AppState"];
    if (!appState) return null;
    const appId = appState["appid"];
    const name = appState["name"];
    const installDir = appState["installdir"];
    if (!appId || !name || !installDir) return null;
    const libraryPath = path.dirname(path.dirname(manifestPath));
    const fullPath = path.join(libraryPath, "steamapps", "common", installDir);
    return {
      appId,
      name,
      installDir,
      fullPath
    };
  } catch (error) {
    console.error(`Failed to parse manifest ${manifestPath}:`, error);
    return null;
  }
}
function scanSteamLibrary(libraryPath) {
  const steamappsPath = path.join(libraryPath, "steamapps");
  if (!fs.existsSync(steamappsPath)) {
    return [];
  }
  const apps = [];
  try {
    const files = fs.readdirSync(steamappsPath);
    for (const file of files) {
      if (file.startsWith("appmanifest_") && file.endsWith(".acf")) {
        const manifestPath = path.join(steamappsPath, file);
        const app = parseAppManifest(manifestPath);
        if (app && fs.existsSync(app.fullPath)) {
          apps.push(app);
        }
      }
    }
  } catch (error) {
    console.error(`Failed to scan library ${libraryPath}:`, error);
  }
  return apps;
}
function scanAllSteamLibraries() {
  const steamPath = findSteamPath();
  if (!steamPath) {
    console.warn("Steam installation not found");
    return [];
  }
  const libraryPaths = getSteamLibraryPaths(steamPath);
  const libraries = [];
  for (const path2 of libraryPaths) {
    const apps = scanSteamLibrary(path2);
    libraries.push({ path: path2, apps });
  }
  return libraries;
}
function getAllSteamGames() {
  const libraries = scanAllSteamLibraries();
  return libraries.flatMap((lib) => lib.apps);
}
const PE_MACHINE_I386 = 332;
const PE_MACHINE_AMD64 = 34404;
const ANTI_CHEAT_SIGNATURES = [
  {
    name: "EasyAntiCheat",
    files: ["EasyAntiCheat.exe", "EasyAntiCheat_x64.dll", "EasyAntiCheat_x86.dll"],
    riskLevel: "high",
    description: "Kernel-level anti-cheat. DXVK may trigger a ban."
  },
  {
    name: "BattlEye",
    files: ["BEService.exe", "BEClient_x64.dll", "BEClient.dll"],
    riskLevel: "high",
    description: "Kernel-level anti-cheat. DXVK may trigger a ban."
  },
  {
    name: "Vanguard",
    files: ["vgc.exe", "vgk.sys"],
    riskLevel: "high",
    description: "Riot Vanguard. Do not use DXVK with Valorant."
  },
  {
    name: "PunkBuster",
    files: ["pbsvc.exe", "PnkBstrA.exe", "PnkBstrB.exe"],
    riskLevel: "medium",
    description: "Legacy anti-cheat. May or may not detect DXVK."
  }
];
function readBytesAt(fd, offset, length) {
  const buffer = Buffer.alloc(length);
  fs.readSync(fd, buffer, 0, length, offset);
  return buffer;
}
function analyzeExecutable(exePath) {
  let fd = null;
  try {
    fd = fs.openSync(exePath, "r");
    const dosHeader = readBytesAt(fd, 0, 2);
    if (dosHeader.toString("ascii") !== "MZ") {
      return {
        architecture: "unknown",
        machineType: 0,
        isValid: false,
        error: "Not a valid PE file (missing MZ signature)"
      };
    }
    const lfanewBuffer = readBytesAt(fd, 60, 4);
    const peOffset = lfanewBuffer.readUInt32LE(0);
    if (peOffset < 64 || peOffset > 1024) {
      return {
        architecture: "unknown",
        machineType: 0,
        isValid: false,
        error: "Invalid PE header offset"
      };
    }
    const peSignature = readBytesAt(fd, peOffset, 4);
    if (peSignature.toString("ascii") !== "PE\0\0") {
      return {
        architecture: "unknown",
        machineType: 0,
        isValid: false,
        error: "Invalid PE signature"
      };
    }
    const machineBuffer = readBytesAt(fd, peOffset + 4, 2);
    const machineType = machineBuffer.readUInt16LE(0);
    let architecture = "unknown";
    if (machineType === PE_MACHINE_I386) {
      architecture = "32";
    } else if (machineType === PE_MACHINE_AMD64) {
      architecture = "64";
    }
    return {
      architecture,
      machineType,
      isValid: true
    };
  } catch (error) {
    return {
      architecture: "unknown",
      machineType: 0,
      isValid: false,
      error: error instanceof Error ? error.message : "Unknown error reading file"
    };
  } finally {
    if (fd !== null) {
      fs.closeSync(fd);
    }
  }
}
function findGameExecutables(gamePath) {
  const { readdirSync, statSync } = require("fs");
  const { join, extname } = require("path");
  const executables = [];
  try {
    const entries = readdirSync(gamePath);
    for (const entry of entries) {
      const fullPath = join(gamePath, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isFile() && extname(entry).toLowerCase() === ".exe") {
          const lowerName = entry.toLowerCase();
          if (!lowerName.includes("unins") && !lowerName.includes("redist") && !lowerName.includes("vcredist") && !lowerName.includes("dxsetup") && !lowerName.includes("directx") && !lowerName.includes("crash") && !lowerName.includes("report") && !lowerName.includes("launcher") || lowerName === "launcher.exe") {
            executables.push(entry);
          }
        }
      } catch {
      }
    }
  } catch (error) {
    console.error(`Failed to scan directory ${gamePath}:`, error);
  }
  return executables;
}
const GITHUB_REPOS = {
  official: "doitsujin/dxvk",
  gplasync: "Ph42oN/dxvk-gplasync",
  nvapi: "jp7677/dxvk-nvapi"
};
function getEnginesPath() {
  var _a, _b;
  const userDataPath = ((_b = (_a = electron.app) == null ? void 0 : _a.getPath) == null ? void 0 : _b.call(_a, "userData")) ?? path.join(process.env.APPDATA || "", "dxvk-studio");
  const enginesPath = path.join(userDataPath, "engines");
  if (!fs.existsSync(enginesPath)) {
    fs.mkdirSync(enginesPath, { recursive: true });
  }
  return enginesPath;
}
function getVersionPath(fork, version) {
  return path.join(getEnginesPath(), fork, version);
}
function isVersionCached(fork, version) {
  const versionPath = getVersionPath(fork, version);
  return fs.existsSync(path.join(versionPath, "x64", "dxgi.dll")) || fs.existsSync(path.join(versionPath, "x32", "d3d9.dll"));
}
function getCachedVersions(fork) {
  const forkPath = path.join(getEnginesPath(), fork);
  if (!fs.existsSync(forkPath)) {
    return [];
  }
  try {
    return fs.readdirSync(forkPath, { withFileTypes: true }).filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);
  } catch {
    return [];
  }
}
function getDirectorySize(dirPath) {
  let size = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isFile()) {
        const { statSync } = require("fs");
        size += statSync(fullPath).size;
      } else if (entry.isDirectory()) {
        size += getDirectorySize(fullPath);
      }
    }
  } catch {
  }
  return size;
}
function getAllCachedEngines() {
  const engines = [];
  const forks = ["official", "gplasync", "nvapi"];
  for (const fork of forks) {
    const versions = getCachedVersions(fork);
    for (const version of versions) {
      const versionPath = getVersionPath(fork, version);
      const sizeBytes = getDirectorySize(versionPath);
      engines.push({
        fork,
        version,
        path: versionPath,
        sizeBytes
      });
    }
  }
  return engines;
}
async function fetchReleases(fork, limit = 10) {
  const repo = GITHUB_REPOS[fork];
  const url = `https://api.github.com/repos/${repo}/releases?per_page=${limit}`;
  try {
    const response = await fetch(url, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "DXVK-Studio"
      }
    });
    if (response.status === 403) {
      console.warn("GitHub API rate limited - using fallback versions");
      return getFallbackReleases(fork);
    }
    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch releases for ${fork}:`, error);
    return getFallbackReleases(fork);
  }
}
function getFallbackReleases(fork) {
  const fallbackData = {
    official: {
      versions: ["2.5.3", "2.5.1", "2.5", "2.4.1", "2.4", "2.3.1"],
      assetPrefix: "dxvk"
    },
    gplasync: {
      // GPL Async fork - check if these versions exist
      versions: ["2.4", "2.3.1", "2.3", "2.2", "2.1"],
      assetPrefix: "dxvk-async"
    },
    nvapi: {
      versions: ["0.7.1", "0.7.0", "0.6.9", "0.6.8", "0.6.7"],
      assetPrefix: "dxvk-nvapi"
    }
  };
  const repo = GITHUB_REPOS[fork];
  const data = fallbackData[fork];
  return data.versions.map((version) => ({
    tag_name: `v${version}`,
    name: `DXVK ${version}`,
    published_at: (/* @__PURE__ */ new Date()).toISOString(),
    body: "Fallback version (API rate limited)",
    assets: [{
      name: `${data.assetPrefix}-${version}.tar.gz`,
      browser_download_url: `https://github.com/${repo}/releases/download/v${version}/${data.assetPrefix}-${version}.tar.gz`
    }]
  }));
}
function releaseToEngine(release, fork) {
  const asset = release.assets.find(
    (a) => a.name.endsWith(".zip") || a.name.endsWith(".tar.gz") || a.name.endsWith(".tar.xz")
  );
  if (!asset) {
    console.warn(`No downloadable asset found for release ${release.tag_name}`);
    return null;
  }
  const version = release.tag_name.replace(/^v/, "");
  return {
    id: `${fork}-${version}`,
    version,
    fork,
    releaseDate: release.published_at,
    downloadUrl: asset.browser_download_url,
    localPath: getVersionPath(fork, version),
    cached: isVersionCached(fork, version),
    changelog: release.body
  };
}
async function getAvailableEngines(fork) {
  const releases = await fetchReleases(fork);
  const engines = releases.map((r) => releaseToEngine(r, fork)).filter((e) => e !== null);
  for (const engine of engines) {
    engine.cached = isVersionCached(fork, engine.version);
    if (engine.cached) {
      engine.localPath = getVersionPath(fork, engine.version);
    }
  }
  return engines;
}
async function downloadEngine(fork, version, downloadUrl, onProgress) {
  var _a;
  const versionPath = getVersionPath(fork, version);
  const tempPath = path.join(getEnginesPath(), `temp-${fork}-${version}.tar.gz`);
  fs.mkdirSync(versionPath, { recursive: true });
  try {
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }
    const contentLength = parseInt(response.headers.get("content-length") || "0");
    let downloadedBytes = 0;
    const fileStream = fs.createWriteStream(tempPath);
    const reader = (_a = response.body) == null ? void 0 : _a.getReader();
    if (!reader) {
      throw new Error("No response body");
    }
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fileStream.write(value);
      downloadedBytes += value.length;
      if (onProgress && contentLength > 0) {
        onProgress(Math.round(downloadedBytes / contentLength * 100));
      }
    }
    await new Promise((resolve, reject) => {
      fileStream.end((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    await tar.extract({
      file: tempPath,
      cwd: versionPath,
      strip: 1
      // Remove the top-level directory from the archive
    });
    fs.rmSync(tempPath, { force: true });
    return versionPath;
  } catch (error) {
    fs.rmSync(tempPath, { force: true });
    fs.rmSync(versionPath, { recursive: true, force: true });
    throw error;
  }
}
function deleteEngine(fork, version) {
  const versionPath = getVersionPath(fork, version);
  if (fs.existsSync(versionPath)) {
    fs.rmSync(versionPath, { recursive: true, force: true });
  }
}
function getEngineDlls(fork, version, architecture) {
  const versionPath = getVersionPath(fork, version);
  const archFolder = architecture === "32" ? "x32" : "x64";
  const dllPath = path.join(versionPath, archFolder);
  if (!fs.existsSync(dllPath)) {
    return [];
  }
  try {
    return fs.readdirSync(dllPath).filter((f) => f.endsWith(".dll")).map((f) => path.join(dllPath, f));
  } catch {
    return [];
  }
}
function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}
function getManifestPath(gamePath) {
  return path.join(gamePath, "dxvk_studio_manifest.json");
}
function readManifest(gamePath) {
  const manifestPath = getManifestPath(gamePath);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(manifestPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
function writeManifest(gamePath, manifest) {
  const manifestPath = getManifestPath(gamePath);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}
function isDxvkInstalled(gamePath) {
  return readManifest(gamePath) !== null;
}
function getInstalledVersion(gamePath) {
  const manifest = readManifest(gamePath);
  if (!manifest) {
    return null;
  }
  return {
    version: manifest.engineVersion,
    fork: manifest.engineFork
  };
}
function checkIntegrity(gamePath) {
  const manifest = readManifest(gamePath);
  if (!manifest) {
    return "not_installed";
  }
  for (const dll of manifest.dlls) {
    const dllPath = path.join(gamePath, dll.name);
    if (!fs.existsSync(dllPath)) {
      return "missing";
    }
    const currentHash = hashFile(dllPath);
    if (currentHash !== dll.hash) {
      return "corrupt";
    }
  }
  return "ok";
}
function installDxvk(gamePath, gameId, fork, version, architecture) {
  if (architecture === "unknown") {
    throw new Error("Cannot install DXVK: unknown architecture");
  }
  const sourceDlls = getEngineDlls(fork, version, architecture);
  if (sourceDlls.length === 0) {
    throw new Error(`No DLLs found for ${fork} ${version} (${architecture}-bit)`);
  }
  const deployedDlls = [];
  for (const sourceDll of sourceDlls) {
    const dllName = path.basename(sourceDll);
    const targetPath = path.join(gamePath, dllName);
    const backupPath = path.join(gamePath, `${dllName}.bak_dxvk_studio`);
    if (fs.existsSync(targetPath)) {
      const manifest2 = readManifest(gamePath);
      const isOurDll = manifest2 == null ? void 0 : manifest2.dlls.some((d) => d.name === dllName);
      if (!isOurDll) {
        fs.renameSync(targetPath, backupPath);
      }
    }
    fs.copyFileSync(sourceDll, targetPath);
    deployedDlls.push({
      name: dllName,
      hash: hashFile(targetPath),
      backupPath: fs.existsSync(backupPath) ? backupPath : void 0
    });
  }
  const manifest = {
    gameId,
    engineVersion: version,
    engineFork: fork,
    architecture,
    installedAt: (/* @__PURE__ */ new Date()).toISOString(),
    dlls: deployedDlls
  };
  writeManifest(gamePath, manifest);
  return manifest;
}
function uninstallDxvk(gamePath) {
  const manifest = readManifest(gamePath);
  if (!manifest) {
    return false;
  }
  for (const dll of manifest.dlls) {
    const dllPath = path.join(gamePath, dll.name);
    const backupPath = dll.backupPath;
    if (fs.existsSync(dllPath)) {
      fs.rmSync(dllPath);
    }
    if (backupPath && fs.existsSync(backupPath)) {
      fs.renameSync(backupPath, dllPath);
    }
  }
  const confPath = path.join(gamePath, "dxvk.conf");
  if (fs.existsSync(confPath) && manifest.configPath === confPath) {
    fs.rmSync(confPath);
  }
  fs.rmSync(getManifestPath(gamePath));
  return true;
}
function generateConfigFile(config) {
  const lines = [
    "# DXVK Configuration",
    "# Generated by DXVK Studio",
    ""
  ];
  if (config.enableAsync !== void 0) {
    lines.push(`dxvk.enableAsync = ${config.enableAsync}`);
  }
  if (config.numCompilerThreads !== void 0) {
    lines.push(`dxvk.numCompilerThreads = ${config.numCompilerThreads}`);
  }
  if (config.maxFrameLatency !== void 0) {
    lines.push(`dxgi.maxFrameLatency = ${config.maxFrameLatency}`);
  }
  if (config.syncInterval !== void 0) {
    lines.push(`dxgi.syncInterval = ${config.syncInterval}`);
  }
  if (config.maxFrameRate !== void 0) {
    lines.push(`dxgi.maxFrameRate = ${config.maxFrameRate}`);
  }
  if (config.maxDeviceMemory !== void 0) {
    lines.push(`dxgi.maxDeviceMemory = ${config.maxDeviceMemory}`);
  }
  if (config.customVendorId) {
    lines.push(`dxgi.customVendorId = ${config.customVendorId}`);
  }
  if (config.customDeviceId) {
    lines.push(`dxgi.customDeviceId = ${config.customDeviceId}`);
  }
  if (config.enableHDR !== void 0) {
    lines.push(`dxgi.enableHDR = ${config.enableHDR}`);
  }
  if (config.hud && config.hud.length > 0) {
    lines.push(`DXVK_HUD = ${config.hud.join(",")}`);
  }
  if (config.logLevel) {
    lines.push(`DXVK_LOG_LEVEL = ${config.logLevel}`);
  }
  return lines.join("\n");
}
function writeConfig(gamePath, config) {
  const confPath = path.join(gamePath, "dxvk.conf");
  const content = generateConfigFile(config);
  fs.writeFileSync(confPath, content);
  const manifest = readManifest(gamePath);
  if (manifest) {
    manifest.configPath = confPath;
    writeManifest(gamePath, manifest);
  }
}
function findFilesRecursive(dir, targetFiles, maxDepth = 3, currentDepth = 0) {
  if (currentDepth > maxDepth) return [];
  const foundFiles = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile()) {
        const lowerName = entry.name.toLowerCase();
        if (targetFiles.some((target) => lowerName === target.toLowerCase())) {
          foundFiles.push(fullPath);
        }
      } else if (entry.isDirectory()) {
        const skipDirs = ["node_modules", ".git", "__pycache__", "logs", "saves"];
        if (!skipDirs.includes(entry.name.toLowerCase())) {
          foundFiles.push(...findFilesRecursive(fullPath, targetFiles, maxDepth, currentDepth + 1));
        }
      }
    }
  } catch {
  }
  return foundFiles;
}
function detectAntiCheat(gamePath) {
  if (!fs.existsSync(gamePath)) {
    return [];
  }
  const detected = [];
  for (const signature of ANTI_CHEAT_SIGNATURES) {
    const foundFiles = findFilesRecursive(gamePath, signature.files);
    if (foundFiles.length > 0) {
      detected.push({
        ...signature,
        foundFiles
      });
    }
  }
  return detected;
}
function getAntiCheatSummary(gamePath) {
  const detected = detectAntiCheat(gamePath);
  return {
    hasAntiCheat: detected.length > 0,
    highRisk: detected.some((ac) => ac.riskLevel === "high"),
    detected: detected.map((ac) => ac.name)
  };
}
process.env.DIST = path.join(__dirname, "../dist");
process.env.VITE_PUBLIC = electron.app.isPackaged ? process.env.DIST : path.join(process.env.DIST, "../public");
let mainWindow = null;
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    icon: path.join(process.env.VITE_PUBLIC, "icon.png"),
    backgroundColor: "#0a0a0b",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow == null ? void 0 : mainWindow.show();
  });
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(process.env.DIST, "index.html"));
  }
}
electron.app.whenReady().then(() => {
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
    mainWindow = null;
  }
});
electron.ipcMain.handle("dialog:openFile", async () => {
  const result = await electron.dialog.showOpenDialog(mainWindow, {
    title: "Select Game Executable",
    filters: [{ name: "Executables", extensions: ["exe"] }],
    properties: ["openFile"]
  });
  return result.canceled ? null : result.filePaths[0];
});
electron.ipcMain.handle("dialog:openFolder", async () => {
  const result = await electron.dialog.showOpenDialog(mainWindow, {
    title: "Select Game Folder",
    properties: ["openDirectory"]
  });
  return result.canceled ? null : result.filePaths[0];
});
electron.ipcMain.handle("fs:exists", async (_, path2) => {
  return fs.existsSync(path2);
});
electron.ipcMain.handle("shell:openPath", async (_, path2) => {
  return electron.shell.openPath(path2);
});
electron.ipcMain.handle("games:scanSteam", async () => {
  try {
    const steamApps = getAllSteamGames();
    const games = await Promise.all(
      steamApps.map(async (app2) => {
        const executables = findGameExecutables(app2.fullPath);
        const mainExe = executables[0] || "";
        const exePath = mainExe ? path.join(app2.fullPath, mainExe) : "";
        let architecture = "unknown";
        if (exePath && fs.existsSync(exePath)) {
          const analysis = analyzeExecutable(exePath);
          architecture = analysis.architecture;
        }
        let dxvkStatus = "inactive";
        let dxvkVersion;
        let dxvkFork;
        if (isDxvkInstalled(app2.fullPath)) {
          const installed = getInstalledVersion(app2.fullPath);
          const integrity = checkIntegrity(app2.fullPath);
          if (installed) {
            dxvkVersion = installed.version;
            dxvkFork = installed.fork;
          }
          dxvkStatus = integrity === "ok" ? "active" : integrity;
        }
        return {
          id: `steam-${app2.appId}`,
          name: app2.name,
          path: app2.fullPath,
          executable: mainExe,
          architecture,
          platform: "steam",
          steamAppId: app2.appId,
          dxvkStatus,
          dxvkVersion,
          dxvkFork
        };
      })
    );
    return games;
  } catch (error) {
    console.error("Failed to scan Steam library:", error);
    return [];
  }
});
electron.ipcMain.handle("games:checkSteam", async () => {
  return findSteamPath() !== null;
});
electron.ipcMain.handle("pe:analyze", async (_, exePath) => {
  return analyzeExecutable(exePath);
});
electron.ipcMain.handle("pe:findExecutables", async (_, gamePath) => {
  return findGameExecutables(gamePath);
});
electron.ipcMain.handle("engines:getAvailable", async (_, fork) => {
  return getAvailableEngines(fork);
});
electron.ipcMain.handle("engines:getCached", async (_, fork) => {
  return getCachedVersions(fork);
});
electron.ipcMain.handle("engines:isCached", async (_, fork, version) => {
  return isVersionCached(fork, version);
});
electron.ipcMain.handle("engines:download", async (_, fork, version, url) => {
  try {
    const path2 = await downloadEngine(fork, version, url, (percent) => {
      mainWindow == null ? void 0 : mainWindow.webContents.send("engines:downloadProgress", { fork, version, percent });
    });
    return { success: true, path: path2 };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
electron.ipcMain.handle("engines:getAllCached", async () => {
  return getAllCachedEngines();
});
electron.ipcMain.handle("engines:delete", async (_, fork, version) => {
  try {
    deleteEngine(fork, version);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
electron.ipcMain.handle("dxvk:install", async (_, gamePath, gameId, fork, version, architecture) => {
  try {
    const manifest = installDxvk(gamePath, gameId, fork, version, architecture);
    return { success: true, manifest };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
electron.ipcMain.handle("dxvk:uninstall", async (_, gamePath) => {
  try {
    const result = uninstallDxvk(gamePath);
    return { success: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
electron.ipcMain.handle("dxvk:checkStatus", async (_, gamePath) => {
  const installed = isDxvkInstalled(gamePath);
  if (!installed) {
    return { installed: false };
  }
  const version = getInstalledVersion(gamePath);
  const integrity = checkIntegrity(gamePath);
  return {
    installed: true,
    version: version == null ? void 0 : version.version,
    fork: version == null ? void 0 : version.fork,
    integrity
  };
});
electron.ipcMain.handle("config:save", async (_, gamePath, config) => {
  try {
    writeConfig(gamePath, config);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
electron.ipcMain.handle("anticheat:detect", async (_, gamePath) => {
  return detectAntiCheat(gamePath);
});
electron.ipcMain.handle("anticheat:summary", async (_, gamePath) => {
  return getAntiCheatSummary(gamePath);
});
