import {createHash} from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'

export const AUDIO_EXTENSIONS = new Set(['.flac', '.mp3', '.wav', '.m4a', '.ogg', '.ape'])
export const MANIFEST_FILENAME = '.dap-state.json'
export const DEVICE_SONG_LIMIT = 8192
export const DEVICE_STORAGE_LIMIT_BYTES = 256 * 1024 * 1024 * 1024
export const MANIFEST_VERSION = 1

export type FileRecord = {
  album: string
  artist: string
  hash?: string
  mtimeMs: number
  relativePath: string
  size: number
}

export type LibraryManifest = {
  generatedAt: string
  rootPath: string
  summary: {
    albumCount: number
    songCount: number
    totalBytes: number
  }
  version: number
  files: Record<string, FileRecord>
}

export type LibraryStats = {
  albumCount: number
  fileMap: Map<string, FileRecord>
  files: FileRecord[]
  manifestPath: string
  rootPath: string
  songCount: number
  totalBytes: number
}

export type ManifestState = 'fresh' | 'missing' | 'stale'

export type InspectionSource = 'live-scan' | 'manifest'

export type LibraryInspection = {
  manifest: LibraryManifest | null
  manifestState: ManifestState
  source: InspectionSource
  stats: LibraryStats
}

export type DiffResult = {
  onlyInLeft: string[]
  onlyInRight: string[]
  changed: string[]
}

export type SyncPlan = {
  bytesDelta: number
  changed: string[]
  destinationAfter: {
    albumCount: number
    songCount: number
    totalBytes: number
  }
  sourceStats: LibraryStats
  destinationStats: LibraryStats
  toCopy: string[]
  toDelete: string[]
}

export type ClearProgress = {
  completed: number
  current: string
  total: number
}

function normalizeRelativePath(value: string): string {
  return value.split(path.sep).join('/')
}

function getArtistAlbum(relativePath: string): {album: string; artist: string} {
  const parts = normalizeRelativePath(relativePath).split('/')
  return {
    artist: parts[0] ?? 'Unknown Artist',
    album: parts[1] ?? 'Unknown Album',
  }
}

function isAudioFile(filePath: string): boolean {
  if (path.basename(filePath).startsWith('._')) return false
  return AUDIO_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

function buildStats(rootPath: string, files: FileRecord[]): LibraryStats {
  const fileMap = new Map<string, FileRecord>()
  const albumSet = new Set<string>()
  let totalBytes = 0

  for (const file of files) {
    fileMap.set(file.relativePath, file)
    totalBytes += file.size
    albumSet.add(`${file.artist}/${file.album}`)
  }

  return {
    albumCount: albumSet.size,
    fileMap,
    files,
    manifestPath: path.join(rootPath, MANIFEST_FILENAME),
    rootPath,
    songCount: files.length,
    totalBytes,
  }
}

function recordFromStat(rootPath: string, absolutePath: string, stat: fs.Stats, hash?: string): FileRecord {
  const relativePath = normalizeRelativePath(path.relative(rootPath, absolutePath))
  const {artist, album} = getArtistAlbum(relativePath)
  return {
    album,
    artist,
    hash,
    mtimeMs: stat.mtimeMs,
    relativePath,
    size: stat.size,
  }
}

function walkAudioFiles(rootPath: string): FileRecord[] {
  if (!fs.existsSync(rootPath)) {
    return []
  }

  const results: FileRecord[] = []
  const stack = [rootPath]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue

    for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
      const absolutePath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(absolutePath)
        continue
      }

      if (!entry.isFile()) continue
      if (entry.name === MANIFEST_FILENAME) continue
      if (!isAudioFile(entry.name)) continue

      const stat = fs.statSync(absolutePath)
      results.push(recordFromStat(rootPath, absolutePath, stat))
    }
  }

  return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
}

export function ensureLibraryRoot(rootPath: string): void {
  fs.mkdirSync(rootPath, {recursive: true})
}

export function buildManifest(rootPath: string, files: FileRecord[]): LibraryManifest {
  const stats = buildStats(rootPath, files)
  return {
    files: Object.fromEntries(files.map((file) => [file.relativePath, file])),
    generatedAt: new Date().toISOString(),
    rootPath,
    summary: {
      albumCount: stats.albumCount,
      songCount: stats.songCount,
      totalBytes: stats.totalBytes,
    },
    version: MANIFEST_VERSION,
  }
}

export function readManifest(rootPath: string): LibraryManifest | null {
  const manifestPath = path.join(rootPath, MANIFEST_FILENAME)
  if (!fs.existsSync(manifestPath)) return null

  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as LibraryManifest
  if (parsed.version !== MANIFEST_VERSION) return null
  return parsed
}

export function statsFromManifest(manifest: LibraryManifest): LibraryStats {
  const files = Object.values(manifest.files).sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  return buildStats(manifest.rootPath, files)
}

export function scanLibrary(rootPath: string, includeHashes = false): LibraryStats {
  const files = walkAudioFiles(rootPath).map((file) => {
    if (!includeHashes) return file
    const absolutePath = path.join(rootPath, file.relativePath)
    return {...file, hash: hashFile(absolutePath)}
  })
  return buildStats(rootPath, files)
}

export function rebuildManifest(rootPath: string, includeHashes = false): LibraryManifest {
  ensureLibraryRoot(rootPath)
  const stats = scanLibrary(rootPath, includeHashes)
  const manifest = buildManifest(rootPath, stats.files)
  fs.writeFileSync(path.join(rootPath, MANIFEST_FILENAME), JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  return manifest
}

export function clearLibrary(
  rootPath: string,
  onProgress?: (progress: ClearProgress) => void,
): LibraryManifest {
  ensureLibraryRoot(rootPath)

  const entries = fs.readdirSync(rootPath, {withFileTypes: true})
  const total = entries.length

  for (const [index, entry] of entries.entries()) {
    onProgress?.({completed: index + 1, current: entry.name, total})
    fs.rmSync(path.join(rootPath, entry.name), {force: true, recursive: true})
  }

  return rebuildManifest(rootPath)
}

export function isManifestFresh(rootPath: string, manifest: LibraryManifest): boolean {
  const liveStats = scanLibrary(rootPath)
  if (liveStats.songCount !== manifest.summary.songCount) return false
  if (liveStats.totalBytes !== manifest.summary.totalBytes) return false

  for (const file of liveStats.files) {
    const manifestFile = manifest.files[file.relativePath]
    if (!manifestFile) return false
    if (manifestFile.size !== file.size || manifestFile.mtimeMs !== file.mtimeMs) return false
  }

  return Object.keys(manifest.files).length === liveStats.files.length
}

export function inspectLibrary(rootPath: string): LibraryInspection {
  const manifest = readManifest(rootPath)
  if (!manifest) {
    return {
      manifest: null,
      manifestState: 'missing',
      source: 'live-scan',
      stats: scanLibrary(rootPath),
    }
  }

  if (!isManifestFresh(rootPath, manifest)) {
    return {
      manifest,
      manifestState: 'stale',
      source: 'live-scan',
      stats: scanLibrary(rootPath),
    }
  }

  return {
    manifest,
    manifestState: 'fresh',
    source: 'manifest',
    stats: statsFromManifest(manifest),
  }
}

export function diffStats(left: LibraryStats, right: LibraryStats): DiffResult {
  const onlyInLeft: string[] = []
  const onlyInRight: string[] = []
  const changed: string[] = []

  for (const [relativePath, leftFile] of left.fileMap.entries()) {
    const rightFile = right.fileMap.get(relativePath)
    if (!rightFile) {
      onlyInLeft.push(relativePath)
      continue
    }

    // Cross-library diffs should not treat copied files as changed just because
    // their modification times differ between source and destination filesystems.
    if (leftFile.size !== rightFile.size) {
      changed.push(relativePath)
    }
  }

  for (const relativePath of right.fileMap.keys()) {
    if (!left.fileMap.has(relativePath)) {
      onlyInRight.push(relativePath)
    }
  }

  return {
    changed: changed.sort(),
    onlyInLeft: onlyInLeft.sort(),
    onlyInRight: onlyInRight.sort(),
  }
}

export function buildSyncPlan(sourceStats: LibraryStats, destinationStats: LibraryStats, exact = false): SyncPlan {
  const diff = diffStats(sourceStats, destinationStats)
  const toCopy = [...diff.onlyInLeft, ...diff.changed].sort()
  const toDelete = exact ? diff.onlyInRight : []

  let destinationBytes = destinationStats.totalBytes
  for (const relativePath of toCopy) {
    const sourceFile = sourceStats.fileMap.get(relativePath)
    const destinationFile = destinationStats.fileMap.get(relativePath)
    if (!sourceFile) continue
    destinationBytes += sourceFile.size - (destinationFile?.size ?? 0)
  }

  for (const relativePath of toDelete) {
    const destinationFile = destinationStats.fileMap.get(relativePath)
    if (!destinationFile) continue
    destinationBytes -= destinationFile.size
  }

  const destinationMap = new Map(destinationStats.fileMap)
  for (const relativePath of toCopy) {
    const sourceFile = sourceStats.fileMap.get(relativePath)
    if (sourceFile) destinationMap.set(relativePath, sourceFile)
  }

  for (const relativePath of toDelete) {
    destinationMap.delete(relativePath)
  }

  const destinationAfterFiles = [...destinationMap.values()]
  const destinationAfterStats = buildStats(destinationStats.rootPath, destinationAfterFiles)

  return {
    bytesDelta: destinationBytes - destinationStats.totalBytes,
    changed: diff.changed,
    destinationAfter: {
      albumCount: destinationAfterStats.albumCount,
      songCount: destinationAfterStats.songCount,
      totalBytes: destinationAfterStats.totalBytes,
    },
    destinationStats,
    sourceStats,
    toCopy,
    toDelete,
  }
}

export function hashFile(filePath: string): string {
  const hash = createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('hex')
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const sign = bytes < 0 ? '-' : ''
  let value = Math.abs(bytes)
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index++
  }

  return `${sign}${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}
