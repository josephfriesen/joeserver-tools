import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as readline from 'node:readline/promises'

import {Args, Command} from '@oclif/core'
import chalk from 'chalk'
import {File as TagFile, Picture, PictureType} from 'node-taglib-sharp'

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

export default class DapFormat extends Command {
  static args = {
    sourceDir: Args.string({
      description: 'Album directory to format and copy. Defaults to current working directory.',
      required: false,
    }),
  }

  static description =
    'Copy and format an album directory to ~/Music/{Artist}/{Album}, renaming files to {disc}-{track} - {title}.{ext} and writing updated metadata'

  static examples = [
    `$ joeserver-tools dap-format /Volumes/Music/Some\\ Artist/Some\\ Album
? Artist [Some Artist]:
? Album [Some Album]:
? Genre [Rock]:
Album art: cover.jpg
Copying 12 files to /Users/you/Music/Some Artist/Some Album...
  ✓ 1-01 - Opening Track.flac
  ...`,
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

    // Read tag defaults from the first file
    const defaults = getTagDefaults(audioFiles[0].absolutePath)

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
    const destDir = path.join(os.homedir(), 'Music', sanitizePathSegment(artist), sanitizePathSegment(album))
    fs.mkdirSync(destDir, {recursive: true})

    this.log(`\nCopying ${audioFiles.length} files to ${chalk.blue(destDir)}\n`)

    for (const {absolutePath: srcPath} of audioFiles) {
      const ext = path.extname(srcPath).toLowerCase()

      let disc = 1
      let track = 0
      let title = path.basename(srcPath, ext)

      try {
        const tagFile = TagFile.createFromPath(srcPath)
        const {tag} = tagFile
        disc = tag.disc || 1
        track = tag.track || 0
        title = tag.title || title
        tagFile.dispose()
      } catch {
        // fall back to defaults already set
      }

      const destFilename = buildFilename(disc, track, title, ext)
      const destPath = path.join(destDir, destFilename)

      fs.copyFileSync(srcPath, destPath)

      try {
        const tagFile = TagFile.createFromPath(destPath)
        const {tag} = tagFile
        tag.albumArtists = [artist]
        tag.performers = [artist]
        tag.album = album
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

    this.log(`\n${chalk.green('Done.')}`)
  }
}
