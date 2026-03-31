import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as readline from 'node:readline/promises'

import {Args} from '@oclif/core'
import chalk from 'chalk'
import {File as TagFile, Picture, PictureType} from 'node-taglib-sharp'

import {ensureLibraryRoot, rebuildManifest} from '../../dap/library.js'
import {DapBaseCommand} from './base.js'

const AUDIO_EXTENSIONS = new Set(['.flac', '.mp3', '.wav', '.m4a', '.ogg', '.ape'])
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'])

// Directories that are obviously too broad to run from
const BLOCKLISTED_DIRS = new Set([
  os.homedir(),
  '/',
  '/usr',
  '/etc',
  '/var',
  '/tmp',
  '/Library',
  path.join(os.homedir(), 'Music'),
  path.join(os.homedir(), 'Documents'),
  path.join(os.homedir(), 'Downloads'),
  path.join(os.homedir(), 'Desktop'),
  path.join(os.homedir(), 'Pictures'),
  path.join(os.homedir(), 'Movies'),
  path.join(os.homedir(), 'Videos'),
])

// Subdirectory names that look like disc folders in a multi-disc album
const DISC_DIR_RE = /^(disc|disk|cd|side)\s*\d+$/i

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function sanitizePathSegment(s: string): string {
  return s.replaceAll(/[/\\:*?"<>|]/g, '_').trim()
}

function buildFilename(disc: number, track: number, title: string, ext: string): string {
  const d = disc || 1
  const t = pad(track || 0)
  const safeTitle = sanitizePathSegment(title || 'Unknown')
  return `${d}-${t} - ${safeTitle}${ext}`
}

function findAlbumArt(dir: string): string | null {
  const files = fs.readdirSync(dir)
  const preferred = ['cover', 'folder', 'front', 'album', 'albumart']
  for (const name of preferred) {
    for (const ext of IMAGE_EXTENSIONS) {
      const match = files.find((f) => f.toLowerCase() === name + ext)
      if (match) return path.join(dir, match)
    }
  }

  const anyImage = files.find((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
  return anyImage ? path.join(dir, anyImage) : null
}

function getTagDefaults(filePath: string): {albumArtist: string; album: string; genre: string} {
  let albumArtist = ''
  let album = ''
  let genre = ''
  try {
    const tagFile = TagFile.createFromPath(filePath)
    const {tag} = tagFile
    albumArtist = tag.albumArtists?.[0] ?? tag.performers?.[0] ?? ''
    album = tag.album ?? ''
    genre = tag.genres?.[0] ?? ''
    tagFile.dispose()
  } catch {
    // ignore read errors — defaults stay empty
  }

  return {albumArtist, album, genre}
}

type AudioFile = {relativePath: string; absolutePath: string}
type PreparedAudioFile = {
  absolutePath: string
  disc: number
  relativePath: string
  title: string
  track: number
}

/**
 * Collect audio files from sourceDir. Scans one level of subdirectories only.
 * If subdirectories contain audio files, they must look like disc folders
 * (e.g. "Disc 1", "CD 2") — otherwise we refuse, as it looks like an artist
 * or library folder rather than a single album.
 *
 * Returns audio files sorted by their relative path so disc subdirs sort naturally.
 */
function collectAudioFiles(sourceDir: string): AudioFile[] {
  const entries = fs.readdirSync(sourceDir, {withFileTypes: true})

  const directFiles: AudioFile[] = entries
    .filter((e) => e.isFile() && AUDIO_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
    .map((e) => ({relativePath: e.name, absolutePath: path.join(sourceDir, e.name)}))

  const subdirs = entries.filter((e) => e.isDirectory())

  const discDirs: string[] = []
  const nonDiscDirsWithAudio: string[] = []

  for (const subdir of subdirs) {
    const subdirPath = path.join(sourceDir, subdir.name)
    const children = fs.readdirSync(subdirPath)
    const hasAudio = children.some((c) => AUDIO_EXTENSIONS.has(path.extname(c).toLowerCase()))
    if (!hasAudio) continue

    if (DISC_DIR_RE.test(subdir.name)) {
      discDirs.push(subdir.name)
    } else {
      nonDiscDirsWithAudio.push(subdir.name)
    }
  }

  if (nonDiscDirsWithAudio.length > 0) {
    const listed = nonDiscDirsWithAudio.map((d) => `  "${d}"`).join('\n')
    throw new Error(
      `Found subdirectories with audio files that don't look like disc folders:\n${listed}\n\nThis looks like an artist or library folder. Please run from a single album directory.`,
    )
  }

  const discFiles: AudioFile[] = []
  for (const discDir of discDirs.sort()) {
    const discPath = path.join(sourceDir, discDir)
    const children = fs.readdirSync(discPath)
    for (const child of children.sort()) {
      if (AUDIO_EXTENSIONS.has(path.extname(child).toLowerCase())) {
        discFiles.push({
          relativePath: path.join(discDir, child),
          absolutePath: path.join(discPath, child),
        })
      }
    }
  }

  return [...directFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath)), ...discFiles]
}

function getSourceTrackInfo(filePath: string): {disc: number; title: string; track: number} {
  const ext = path.extname(filePath).toLowerCase()
  let disc = 1
  let track = 0
  let title = path.basename(filePath, ext)

  try {
    const tagFile = TagFile.createFromPath(filePath)
    const {tag} = tagFile
    disc = tag.disc || 1
    track = tag.track || 0
    title = tag.title || title
    tagFile.dispose()
  } catch {
    // fall back to filename-derived defaults
  }

  return {disc, title, track}
}

export default class DapFormat extends DapBaseCommand {
  static summary = 'Copy one album into the managed local DAP library with normalized filenames and tags'

  static args = {
    sourceDir: Args.string({
      description: 'Album directory to format and copy. Defaults to current working directory.',
      required: false,
    }),
  }

  static description =
    'Use this when you have a single album folder on disk that needs to be prepared for your Echo Mini library.\n\nThe command leaves the source folder untouched, copies the audio files into ~/Music/DAP/{Artist}/{Album}, renames them into a consistent {disc}-{track} - {title}.{ext} format, writes album-level metadata, embeds album art when available, and refreshes the local DAP manifest.'

  static examples = [
    `$ joeserver-tools dap format /Volumes/Music/Some\\ Artist/Some\\ Album
? Artist [Some Artist]:
? Album [Some Album]:
? Genre [Rock]:
Album art: cover.jpg
Copying 12 files to /Users/you/Music/DAP/Some Artist/Some Album...
  ✓ 1-01 - Opening Track.flac
  ...`,
    `$ joeserver-tools dap format
# Run from the current album directory and build/update the local DAP library copy`,
  ]

  async run(): Promise<void> {
    const {args} = await this.parse(DapFormat)

    const sourceDir = path.resolve(args.sourceDir ?? process.cwd())

    if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
      this.error(`Source directory not found: ${sourceDir}`)
    }

    if (BLOCKLISTED_DIRS.has(sourceDir)) {
      this.error(`Refusing to run from "${sourceDir}" — too broad. Please specify an album directory.`)
    }

    let audioFiles: AudioFile[]
    try {
      audioFiles = collectAudioFiles(sourceDir)
    } catch (err) {
      this.error((err as Error).message)
    }

    if (audioFiles.length === 0) {
      this.error(`No audio files found in ${sourceDir}`)
    }

    const preparedFiles: PreparedAudioFile[] = audioFiles
      .map(({absolutePath, relativePath}) => {
        const {disc, track, title} = getSourceTrackInfo(absolutePath)
        return {absolutePath, disc, relativePath, title, track}
      })
      .sort((a, b) => {
        if (a.disc !== b.disc) return a.disc - b.disc
        if (a.track !== b.track) return a.track - b.track
        return a.relativePath.localeCompare(b.relativePath)
      })

    // Read tag defaults from the first file
    const defaults = getTagDefaults(preparedFiles[0].absolutePath)

    // Interactive prompts
    const rl = readline.createInterface({input: process.stdin, output: process.stdout})

    const artistInput = await rl.question(
      chalk.cyan('? Artist') + (defaults.albumArtist ? chalk.dim(` [${defaults.albumArtist}]`) : '') + ': ',
    )
    const albumInput = await rl.question(
      chalk.cyan('? Album') + (defaults.album ? chalk.dim(` [${defaults.album}]`) : '') + ': ',
    )
    const genreInput = await rl.question(
      chalk.cyan('? Genre') + (defaults.genre ? chalk.dim(` [${defaults.genre}]`) : '') + ': ',
    )

    rl.close()

    const artist = artistInput.trim() || defaults.albumArtist || 'Unknown Artist'
    const album = albumInput.trim() || defaults.album || 'Unknown Album'
    const genre = genreInput.trim() || defaults.genre || ''

    // Find album art in source directory (check root and any disc subdirs)
    const albumArtPath = findAlbumArt(sourceDir)
    if (albumArtPath) {
      this.log(chalk.dim(`Album art: ${path.basename(albumArtPath)}`))
    } else {
      this.warn('No album art image found in source directory — skipping cover embed')
    }

    // Build destination directory
    const destDir = path.join(this.localLibraryRoot, sanitizePathSegment(artist), sanitizePathSegment(album))
    ensureLibraryRoot(this.localLibraryRoot)
    fs.mkdirSync(destDir, {recursive: true})

    this.log(`\nCopying ${preparedFiles.length} files to ${chalk.blue(destDir)}\n`)

    for (const [index, {absolutePath: srcPath, disc, title, track}] of preparedFiles.entries()) {
      const ext = path.extname(srcPath).toLowerCase()

      const destFilename = buildFilename(disc, track, title, ext)
      const destPath = path.join(destDir, destFilename)

      fs.copyFileSync(srcPath, destPath)

      try {
        const tagFile = TagFile.createFromPath(destPath)
        const {tag} = tagFile
        // Some DAPs appear to sort album tracks by `track` and ignore `disc`,
        // so normalize copied-file metadata to one album-wide track sequence.
        tag.albumArtists = [artist]
        tag.performers = [artist]
        tag.album = album
        tag.disc = 1
        tag.track = index + 1
        if (genre) tag.genres = [genre]
        if (albumArtPath) {
          const pic = Picture.fromPath(albumArtPath)
          pic.type = PictureType.FrontCover
          tag.pictures = [pic]
        }

        tagFile.save()
        tagFile.dispose()
      } catch (err) {
        this.warn(`Could not write tags to ${destFilename}: ${(err as Error).message}`)
      }

      this.log(`  ${chalk.green('✓')} ${destFilename}`)
    }

    rebuildManifest(this.localLibraryRoot)
    this.log(`\n${chalk.green('Done.')}`)
  }
}
