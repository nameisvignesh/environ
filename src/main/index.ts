import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { readdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { WorkspaceEntry } from "../shared/api";

let workspaceRoot: string | null = null;

function isWithinWorkspace(candidate: string, root: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

async function resolveWorkspacePath(candidate: string): Promise<string> {
  if (!workspaceRoot) {
    throw new Error("Open a workspace before accessing files.");
  }

  const resolved = resolve(workspaceRoot, candidate);
  if (!isWithinWorkspace(resolved, workspaceRoot)) {
    throw new Error("The requested path is outside the open workspace.");
  }

  const actual = await realpath(resolved);
  if (!isWithinWorkspace(actual, workspaceRoot)) {
    throw new Error("The requested path resolves outside the open workspace.");
  }

  return actual;
}

function registerWorkspaceHandlers(): void {
  ipcMain.handle("workspace:get", async () => {
    const configuredRoot = process.env.ENVIRON_WORKSPACE;
    if (!configuredRoot) return workspaceRoot;

    const root = await realpath(configuredRoot);
    if (!(await stat(root)).isDirectory()) {
      throw new Error("The configured workspace path is not a folder.");
    }

    workspaceRoot = root;
    return workspaceRoot;
  });

  ipcMain.handle("workspace:open", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Open a project folder",
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    workspaceRoot = await realpath(result.filePaths[0]);
    return workspaceRoot;
  });

  ipcMain.handle("workspace:list", async (_event, candidate: string): Promise<WorkspaceEntry[]> => {
    const directory = await resolveWorkspacePath(candidate);
    if (!(await stat(directory)).isDirectory()) {
      throw new Error("The requested path is not a folder.");
    }

    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => !entry.name.startsWith(".") && (entry.isDirectory() || entry.isFile()))
      .map((entry): WorkspaceEntry => ({
        name: entry.name,
        path: resolve(directory, entry.name),
        kind: entry.isDirectory() ? "directory" : "file",
      }))
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  });

  ipcMain.handle("workspace:read", async (_event, candidate: string) => {
    const file = await resolveWorkspacePath(candidate);
    if (!(await stat(file)).isFile()) {
      throw new Error("The requested path is not a file.");
    }

    const contents = await readFile(file);
    if (contents.length > 2 * 1024 * 1024) {
      throw new Error("This file is larger than Environ's 2 MB editor limit.");
    }
    if (contents.includes(0)) {
      throw new Error("Binary files cannot be opened in the text editor.");
    }

    return { path: file, content: contents.toString("utf8") };
  });

  ipcMain.handle("workspace:save", async (_event, candidate: string, content: string) => {
    const file = await resolveWorkspacePath(candidate);
    if (!(await stat(file)).isFile()) {
      throw new Error("The requested path is not a file.");
    }

    await writeFile(file, content, "utf8");
    return true;
  });
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "Environ",
    backgroundColor: "#111318",
    webPreferences: {
      preload: resolve(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(resolve(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  registerWorkspaceHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
