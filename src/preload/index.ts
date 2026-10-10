import { contextBridge, ipcRenderer } from "electron";
import type { EnvironApi, OpenFile, WorkspaceEntry } from "../shared/api";

const environ: EnvironApi = {
  getWorkspace: (): Promise<string | null> => ipcRenderer.invoke("workspace:get"),
  openWorkspace: (): Promise<string | null> => ipcRenderer.invoke("workspace:open"),
  listDirectory: (path: string): Promise<WorkspaceEntry[]> =>
    ipcRenderer.invoke("workspace:list", path),
  readFile: (path: string): Promise<OpenFile> => ipcRenderer.invoke("workspace:read", path),
  saveFile: (path: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke("workspace:save", path, content),
};

contextBridge.exposeInMainWorld("environ", environ);
