# joeserver-tools

Personal CLI utilities built with oclif. The main actively maintained feature set in this repo is the `dap` command group for managing music on an Echo Mini DAP audio player.

## What `dap` does

The DAP workflow manages two libraries:

- Local staged library: `~/Music/DAP`
- Device library: `/TUNES` on the mounted Echo Mini

The goal is to prepare albums locally, inspect library state, compare local vs device contents, sync changes safely, and keep a rebuildable manifest of what exists in each managed library.

Safety rules:

- Device writes and deletions are scoped to `/TUNES`
- Destructive commands require confirmation by default
- `dap format` never modifies the source album folder

## Requirements

- Node.js `>=18`
- A desktop OS supported by Node.js
- For device operations, the Echo Mini mounted and visible to the system

## Install

Install dependencies:

```bash
npm install
```

Build the CLI:

```bash
npm run build
```

Run tests:

```bash
npm test
```

## Development usage

From the repo root, run commands directly from source with:

```bash
./bin/dev.js dap
```

or:

```bash
npm run js-dev -- dap
```

If you want the CLI name available directly in your shell during development:

```bash
npm link
joeserver-tools dap
```

## DAP workflow

Typical usage looks like:

1. Format an album into the managed local library.
2. Inspect local and device state.
3. Preview a sync plan.
4. Apply the sync after confirmation.
5. Eject the device when finished.

Example:

```bash
./bin/dev.js dap format /path/to/album
./bin/dev.js dap info
./bin/dev.js dap sync --direction=local-to-device --dry-run
./bin/dev.js dap sync --direction=local-to-device
./bin/dev.js dap eject
```

## DAP commands

### `dap`

Show the DAP workflow overview and the available subcommands.

```bash
./bin/dev.js dap
./bin/dev.js dap --help
```

### `dap format [sourceDir]`

Copy a single album into `~/Music/DAP/{Artist}/{Album}` with normalized filenames, rewritten album-level metadata, and embedded album art when available. The source folder is left untouched.

```bash
./bin/dev.js dap format /path/to/album
./bin/dev.js dap format
```

### `dap remove [targetPath]`

Remove one staged album from the managed local library. You can point it at either the staged album path inside `~/Music/DAP` or the original source album folder. The command shows the resolved album, song count, and disk usage before deleting it and rebuilding local state.

```bash
./bin/dev.js dap remove /path/to/album
./bin/dev.js dap remove ~/Music/DAP/Artist/Album
./bin/dev.js dap remove
```

### `dap info [--diff]`

Show local and device library totals, manifest freshness, song/capacity limits, and optionally file-level differences.

```bash
./bin/dev.js dap info
./bin/dev.js dap info --diff
```

### `dap sync --direction=local-to-device|device-to-local [--mode=copy|exact] [--dry-run] [--confirm]`

Build and print a sync plan between `~/Music/DAP` and `/TUNES`.

Modes:

- `copy`: copy/update files, never delete destination-only files
- `exact`: make the destination match the source exactly within the managed library root

Behavior:

- prints the sync plan first
- uses `--dry-run` for preview only
- asks for confirmation before applying unless `--confirm` is passed

```bash
./bin/dev.js dap sync --direction=local-to-device --dry-run
./bin/dev.js dap sync --direction=local-to-device
./bin/dev.js dap sync --direction=local-to-device --mode=exact
./bin/dev.js dap sync --direction=device-to-local --confirm
```

### `dap clear --target=local|device`

Destructively reset the local managed library or the device `/TUNES` library back to zero files and rebuild an empty manifest.

```bash
./bin/dev.js dap clear --target=local
./bin/dev.js dap clear --target=device
```

### `dap eject`

Safely unmount/eject the connected Echo Mini after transfers are complete.

```bash
./bin/dev.js dap eject
./bin/dev.js dap eject --confirm
```

### `dap state`

Show information about the portable manifest files used by the DAP commands.

```bash
./bin/dev.js dap state
```

### `dap state rebuild --target=local|device|both [--hash]`

Rebuild `.dap-state.json` from the actual files on disk. Use this when state is missing, stale, or you intentionally changed files out of band.

```bash
./bin/dev.js dap state rebuild --target=local
./bin/dev.js dap state rebuild --target=device
./bin/dev.js dap state rebuild --target=both --hash
```

## Manifest files

Each managed library root stores a portable JSON manifest:

- Local: `~/Music/DAP/.dap-state.json`
- Device: `/TUNES/.dap-state.json`

These manifests are snapshots of the current library contents, not per-computer sync history. They can always be rebuilt from the files on disk.

## Notes

- On macOS, filesystem sidecar files such as `._*` are ignored by the DAP library scanner.
- Device playback quirks can depend on metadata as well as filenames, so `dap format` rewrites tags intentionally for DAP-friendly ordering.
- This repo still contains some older non-DAP commands from the initial scaffold, but the DAP workflow is the primary area being developed.
