# Environ

Environ is a focused desktop code editor built with Electron, React, and Monaco. Open a project folder, browse its files, and edit text files in a familiar workspace without leaving the desktop.

![Environ desktop editor](docs/screenshots/environ-desktop.png)

## Features

- Project folder and file explorer, with folders listed before files.
- Monaco-powered editor with syntax highlighting, word wrap, and multiple open tabs.
- Open a project with **Ctrl+O** (Windows/Linux) or **Cmd+O** (macOS); save the active file with **Ctrl+S** or **Cmd+S**.
- Unsaved-change indicators and confirmation prompts before discarding edits.
- Workspace-scoped file access: files outside the selected project cannot be read or saved through the editor.
- Clear errors for binary files and files larger than the 2 MB editor limit.
- Run the desktop app natively or in a Docker-hosted Linux desktop streamed to a local browser.

## Requirements

### Native development

- Node.js 20 or later and npm.
- Windows, macOS, or Linux desktop capable of running Electron.

### Docker desktop

- Docker Desktop (Windows/macOS) or Docker Engine with the Compose plugin (Linux).
- A browser for the local noVNC desktop.

## Quick start: native desktop

From the project directory, install the locked dependencies and start the development app:

```sh
npm ci
npm run dev
```

To type-check, build, and run the production build:

```sh
npm run typecheck
npm run build
npm start
```

`npm run build` writes the Electron main, preload, and renderer bundles to `out/`. `npm start` launches those built bundles; run the build first.

## Build desktop installers

Create an installer for the current computer's platform and architecture:

```sh
npm run build:dist
```

Installers are written to `release/`. Windows builds an NSIS installer, macOS builds a DMG and ZIP, and Linux builds an AppImage and DEB package. These builds are unsigned; macOS may require approval in System Settings before the app can be opened.

## Publish a GitHub release

Push a version tag to build and publish installers for Windows, macOS, and Linux:

```sh
# First set the version in package.json to the version being released.
git tag v0.1.0
git push origin v0.1.0
```

The GitHub Actions release workflow builds each platform, attaches the installers, and generates release notes. Replace `v0.1.0` with the version being released.

## Run in Docker

The Docker image installs the Linux desktop libraries and virtual display, installs the npm dependencies with `npm ci`, and type-checks/builds the application. Compose launches Environ in a virtual desktop and serves it through noVNC.

Start Docker Desktop or Docker Engine, then run from the project directory:

```sh
docker compose up --build -d
```

Open [Environ in your browser](http://localhost:6080/vnc.html?autoconnect=true&resize=scale). The project directory is mounted into the container at `/workspace`, so edits made in Environ are written to the host files.

By default, Compose mounts the current project directory. To work on a different folder from PowerShell:

```powershell
$env:ENVIRON_WORKSPACE = "D:\path\to\your-project"
docker compose up --build -d
```

In a POSIX shell:

```sh
ENVIRON_WORKSPACE=/path/to/your-project docker compose up --build -d
```

The Docker image can also be built without starting the desktop:

```sh
docker build -t environ .
```

Stop and remove the Compose container with:

```sh
docker compose down
```

### Docker security

The noVNC service has no password or encryption. Compose binds port `6080` to `127.0.0.1` so it is available only on the local machine by default. Do not publish this port on a public interface or expose it to an untrusted network.

## Working in Environ

1. Select **Open project folder** (or press **Ctrl/Cmd+O**) and choose a project directory.
2. Browse directories in the **Explorer** pane and select a text file to open it.
3. Edit files in the Monaco editor. Open files appear in tabs; the active tab shows an unsaved-change indicator when edited.
4. Save with **Ctrl/Cmd+S**. Close a tab with its **×** button; Environ asks before discarding unsaved changes.

The editor currently opens regular text files up to 2 MB. Binary files are not supported. Hidden files and folders (names beginning with `.`) are not shown in the Explorer.

## Project structure

```text
.
├── docker/
│   └── start.sh              # Starts the virtual display, window manager, and noVNC
├── docs/
│   └── screenshots/           # README screenshots
├── src/
│   ├── main/                  # Electron main process and workspace file handlers
│   ├── preload/               # Narrow, typed renderer API
│   ├── renderer/              # React UI and Monaco editor
│   └── shared/                # Shared API types
├── .dockerignore
├── .gitignore
├── compose.yaml               # Local Docker desktop service
├── Dockerfile                 # Reproducible Linux build and runtime image
├── electron.vite.config.ts
├── package.json
└── package-lock.json
```

## Useful commands

| Command | Description |
| --- | --- |
| `npm ci` | Install the exact dependency versions from the lockfile |
| `npm run dev` | Start the native development app |
| `npm run typecheck` | Type-check the Electron and renderer TypeScript projects |
| `npm run build` | Build the desktop application into `out/` |
| `npm start` | Launch the built desktop application |
| `docker compose up --build -d` | Build and start the browser-accessible Docker desktop |
| `docker compose down` | Stop and remove the Compose container |

## Troubleshooting

- **The browser cannot connect:** confirm Docker is running, then check the service with `docker compose ps` and its output with `docker compose logs`.
- **The project tree is empty:** confirm the folder is mounted at `/workspace`, or set `ENVIRON_WORKSPACE` to a host project folder before starting Compose.
- **The app does not launch after building:** run `npm run build` before `npm start`.
- **A file will not open:** Environ only edits text files up to 2 MB; binary files and larger files are rejected.
