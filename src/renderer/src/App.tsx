import Editor from "@monaco-editor/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { OpenFile, WorkspaceEntry } from "../../shared/api";

interface EditorTab extends OpenFile {
  savedContent: string;
}

function fileName(path: string): string {
  return path.split(/[\\/]/).at(-1) ?? path;
}

function FileTree({
  directory,
  entries,
  expanded,
  loading,
  onToggle,
  onOpen,
}: {
  directory: WorkspaceEntry;
  entries: Record<string, WorkspaceEntry[]>;
  expanded: Set<string>;
  loading: Set<string>;
  onToggle: (entry: WorkspaceEntry) => void;
  onOpen: (entry: WorkspaceEntry) => void;
}) {
  const isExpanded = expanded.has(directory.path);
  return (
    <div className="tree-group">
      <button className="tree-entry folder-entry" onClick={() => onToggle(directory)}>
        <span className="tree-chevron">{isExpanded ? "⌄" : "›"}</span>
        <span className="tree-icon folder-icon">{isExpanded ? "▾" : "▸"}</span>
        <span className="tree-label">{directory.name}</span>
      </button>
      {isExpanded && (
        <div className="tree-children">
          {loading.has(directory.path) && <div className="tree-message">Loading…</div>}
          {(entries[directory.path] ?? []).map((entry) =>
            entry.kind === "directory" ? (
              <FileTree
                key={entry.path}
                directory={entry}
                entries={entries}
                expanded={expanded}
                loading={loading}
                onToggle={onToggle}
                onOpen={onOpen}
              />
            ) : (
              <button
                key={entry.path}
                className="tree-entry file-entry"
                onClick={() => onOpen(entry)}
                title={entry.path}
              >
                <span className="tree-chevron spacer" />
                <span className="tree-icon file-icon">◇</span>
                <span className="tree-label">{entry.name}</span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [workspace, setWorkspace] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [entries, setEntries] = useState<Record<string, WorkspaceEntry[]>>({});
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.path === activePath) ?? null,
    [activePath, tabs],
  );
  const dirtyCount = tabs.filter((tab) => tab.content !== tab.savedContent).length;
  const modifierKey = navigator.platform.toUpperCase().includes("MAC") ? "⌘" : "Ctrl";

  const loadWorkspace = useCallback(async (selected: string) => {
    const rootEntries = await window.environ.listDirectory(selected);
    setWorkspace(selected);
    setExpanded(new Set([selected]));
    setEntries({ [selected]: rootEntries });
    setTabs([]);
    setActivePath(null);
  }, []);

  useEffect(() => {
    void window.environ.getWorkspace()
      .then((initialWorkspace) => {
        if (initialWorkspace) return loadWorkspace(initialWorkspace);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Could not load the configured workspace.");
      });
  }, [loadWorkspace]);

  const openWorkspace = useCallback(async () => {
    if (dirtyCount > 0 && !window.confirm("Discard unsaved changes and open another project?")) {
      return;
    }
    try {
      setError(null);
      const selected = await window.environ.openWorkspace();
      if (!selected) return;
      await loadWorkspace(selected);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open the project folder.");
    }
  }, [dirtyCount, loadWorkspace]);

  const toggleDirectory = useCallback(
    async (directory: WorkspaceEntry) => {
      if (expanded.has(directory.path)) {
        setExpanded((current) => {
          const next = new Set(current);
          next.delete(directory.path);
          return next;
        });
        return;
      }

      setExpanded((current) => new Set(current).add(directory.path));
      if (entries[directory.path]) return;

      setLoading((current) => new Set(current).add(directory.path));
      try {
        const children = await window.environ.listDirectory(directory.path);
        setEntries((current) => ({ ...current, [directory.path]: children }));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not read this folder.");
      } finally {
        setLoading((current) => {
          const next = new Set(current);
          next.delete(directory.path);
          return next;
        });
      }
    },
    [entries, expanded],
  );

  const openFile = useCallback(async (entry: WorkspaceEntry) => {
    const existing = tabs.find((tab) => tab.path === entry.path);
    if (existing) {
      setActivePath(entry.path);
      return;
    }

    try {
      setError(null);
      const file = await window.environ.readFile(entry.path);
      setTabs((current) => [...current, { ...file, savedContent: file.content }]);
      setActivePath(file.path);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open this file.");
    }
  }, [tabs]);

  const saveActiveFile = useCallback(async () => {
    if (!activeTab || activeTab.content === activeTab.savedContent) return;
    try {
      setError(null);
      await window.environ.saveFile(activeTab.path, activeTab.content);
      setTabs((current) =>
        current.map((tab) =>
          tab.path === activeTab.path ? { ...tab, savedContent: tab.content } : tab,
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this file.");
    }
  }, [activeTab]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveActiveFile();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void openWorkspace();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openWorkspace, saveActiveFile]);

  const closeTab = (path: string) => {
    const closingIndex = tabs.findIndex((tab) => tab.path === path);
    const closingTab = tabs[closingIndex];
    if (
      closingTab &&
      closingTab.content !== closingTab.savedContent &&
      !window.confirm(`Discard unsaved changes to ${fileName(path)}?`)
    ) {
      return;
    }
    const remaining = tabs.filter((tab) => tab.path !== path);
    setTabs(remaining);
    if (activePath === path) {
      setActivePath(remaining[Math.max(0, closingIndex - 1)]?.path ?? remaining[0]?.path ?? null);
    }
  };

  const updateContent = (content: string | undefined) => {
    if (!activePath || content === undefined) return;
    setTabs((current) =>
      current.map((tab) => (tab.path === activePath ? { ...tab, content } : tab)),
    );
  };

  return (
    <main className="app-shell">
      <header className="titlebar">
        <div className="brand-mark">e</div>
        <span className="brand-name">environ</span>
        <span className="title-divider" />
        <span className="title-workspace">{workspace ? fileName(workspace) : "No project open"}</span>
        <div className="title-actions">
          <button className="quiet-button" onClick={() => void openWorkspace()}>
            Open project <kbd>{modifierKey}O</kbd>
          </button>
          <button
            className="save-button"
            onClick={() => void saveActiveFile()}
            disabled={!activeTab || activeTab.content === activeTab.savedContent}
          >
            Save <kbd>{modifierKey}S</kbd>
          </button>
        </div>
      </header>

      <div className="workbench">
        <aside className="sidebar">
          <div className="sidebar-heading">
            <span>EXPLORER</span>
            <button className="icon-button" onClick={() => void openWorkspace()} title="Open project">
              +
            </button>
          </div>
          {workspace ? (
            <div className="file-tree">
              <FileTree
                directory={{ name: fileName(workspace), path: workspace, kind: "directory" }}
                entries={entries}
                expanded={expanded}
                loading={loading}
                onToggle={(entry) => void toggleDirectory(entry)}
                onOpen={(entry) => void openFile(entry)}
              />
            </div>
          ) : (
            <div className="sidebar-empty">
              <span className="empty-folder">▱</span>
              <p>Your project files<br />will appear here.</p>
              <button className="text-button" onClick={() => void openWorkspace()}>Open a folder</button>
            </div>
          )}
          <div className="sidebar-footer">
            <span className="status-dot" />
            <span>{workspace ? "Workspace ready" : "Ready when you are"}</span>
          </div>
        </aside>

        <section className="editor-column">
          {tabs.length > 0 && (
            <div className="tabbar">
              {tabs.map((tab) => (
                <div
                  className={`tab ${activePath === tab.path ? "active" : ""}`}
                  key={tab.path}
                  onClick={() => setActivePath(tab.path)}
                  title={tab.path}
                >
                  <span className="tab-file-icon">◇</span>
                  <span className="tab-name">{fileName(tab.path)}</span>
                  {tab.content !== tab.savedContent && <span className="dirty-indicator" />}
                  <button
                    className="tab-close"
                    aria-label={`Close ${fileName(tab.path)}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      closeTab(tab.path);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {activeTab ? (
            <Editor
              path={activeTab.path}
              value={activeTab.content}
              onChange={updateContent}
              theme="vs-dark"
              options={{
                automaticLayout: true,
                fontFamily: '"Cascadia Code", "SFMono-Regular", Consolas, monospace',
                fontSize: 14,
                lineHeight: 23,
                minimap: { enabled: false },
                padding: { top: 20 },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                tabSize: 2,
                wordWrap: "on",
              }}
            />
          ) : (
            <div className="welcome">
              <div className="welcome-orbit">
                <div className="welcome-logo">e</div>
              </div>
              <div className="welcome-eyebrow">A calmer place to build</div>
              <h1>Make room for good work.</h1>
              <p>Open a project to start exploring your code.</p>
              <button className="primary-button" onClick={() => void openWorkspace()}>
                <span>Open project folder</span>
                <span className="button-arrow">↗</span>
              </button>
              <div className="welcome-shortcut"><kbd>{modifierKey}</kbd> <kbd>O</kbd> <span>to open a project</span></div>
              <div className="welcome-decoration">ENVIRON&nbsp;&nbsp; / &nbsp;&nbsp;BUILT FOR THE FLOW</div>
            </div>
          )}
        </section>
      </div>

      <footer className="statusbar">
        <div className="status-left">
          <span className="status-branch">⌁</span>
          <span>{workspace ? fileName(workspace) : "No workspace"}</span>
        </div>
        <div className="status-right">
          {error && <span className="error-message" title={error}>{error}</span>}
          {activeTab && <span>{dirtyCount > 0 ? "Unsaved changes" : "Saved"}</span>}
          <span>Environ</span>
          <span className="status-version">v0.1</span>
        </div>
      </footer>
    </main>
  );
}
