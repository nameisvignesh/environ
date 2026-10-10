export interface WorkspaceEntry {
  name: string;
  path: string;
  kind: "directory" | "file";
}

export interface OpenFile {
  path: string;
  content: string;
}

export interface EnvironApi {
  getWorkspace: () => Promise<string | null>;
  openWorkspace: () => Promise<string | null>;
  listDirectory: (path: string) => Promise<WorkspaceEntry[]>;
  readFile: (path: string) => Promise<OpenFile>;
  saveFile: (path: string, content: string) => Promise<boolean>;
}
