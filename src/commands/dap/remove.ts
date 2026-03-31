import * as fs from 'node:fs'
import * as path from 'node:path'
import * as readline from 'node:readline/promises'

import {Args, Flags} from '@oclif/core'
import chalk from 'chalk'
import {File as TagFile} from 'node-taglib-sharp'

import {AUDIO_EXTENSIONS, formatBytes, rebuildManifest} from '../../dap/library.js'
import {DapBaseCommand} from './base.js'

type AlbumIdentity = {
  album: string
  artist: string
  resolvedFrom: string
  rootPath: string
}

type AlbumStats = {
  songCount: number
  totalBytes: number
}

function sanitizePathSegment(value: string): string {
  return value.replaceAll(/[/\\:*?"<>|]/g, '_').trim()
}

function isAudioFile(name: string): boolean {
  if (name.startsWith('._')) return false
  return AUDIO_EXTENSIONS.has(path.extname(name).toLowerCase())
}

function collectAudioFiles(rootPath: string): string[] {
  if (!fs.existsSync(rootPath) || !fs.statSync(rootPath).isDirectory()) return []

  const files: string[] = []
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

      if (entry.isFile() && isAudioFile(entry.name)) {
        files.push(absolutePath)
      }
    }
  }

  return files.sort()
}

function inferFromTags(filePath: string): {album: string; artist: string} | null {
  try {
    const tagFile = TagFile.createFromPath(filePath)
    const {tag} = tagFile
    const artist = tag.albumArtists?.[0] ?? tag.performers?.[0] ?? ''
    const album = tag.album ?? ''
    tagFile.dispose()
    if (artist && album) return {album, artist}
  } catch {
    // fall back to path-based inference
  }

  return null
}

function getAlbumStats(albumRoot: string): AlbumStats {
  const audioFiles = collectAudioFiles(albumRoot)
  let totalBytes = 0

  for (const filePath of audioFiles) {
    totalBytes += fs.statSync(filePath).size
  }

  return {
    songCount: audioFiles.length,
    totalBytes,
  }
}

export default class DapRemove extends DapBaseCommand {
  static summary = 'Remove one staged album from the managed local DAP library and refresh local state'

  static args = {
    targetPath: Args.string({
      description:
        'Album directory to resolve. Defaults to current working directory. Can be the staged album path or the original source album path.',
      required: false,
    }),
  }

  static flags = {
    confirm: Flags.boolean({
      default: false,
      description: 'Apply the removal without an interactive confirmation prompt.',
    }),
  }

  static description =
    'Use this when you want to remove a single staged album from ~/Music/DAP.\n\nThe command resolves the target album from the given directory, shows which managed album folder will be deleted along with its song count and disk usage, asks for confirmation, removes that album directory, and rebuilds the local DAP manifest.'

  static examples = [
    '$ joeserver-tools dap remove /Volumes/Music/Some Artist/Some Album',
    '# Resolve the staged album from a source folder, confirm, then remove it from ~/Music/DAP',
    '$ joeserver-tools dap remove ~/Music/DAP/Some Artist/Some Album',
    '# Remove a staged album directly by its managed path',
    '$ joeserver-tools dap remove',
    '# Run from an album directory and remove its staged copy after confirmation',
  ]

  private resolveAlbumIdentity(targetPath: string): AlbumIdentity {
    const resolvedPath = path.resolve(targetPath)
    const relativeToLocal = path.relative(this.localLibraryRoot, resolvedPath)

    if (!relativeToLocal.startsWith('..') && !path.isAbsolute(relativeToLocal)) {
      const parts = relativeToLocal.split(path.sep).filter(Boolean)
      if (parts.length < 2) {
        this.error(
          `Path is inside ~/Music/DAP but does not point to an album directory: ${resolvedPath}\n\nPlease pass a path inside ~/Music/DAP/{Artist}/{Album} or a source album directory.`,
        )
      }

      const artist = parts[0]
      const album = parts[1]
      return {
        album,
        artist,
        resolvedFrom: 'managed path',
        rootPath: path.join(this.localLibraryRoot, artist, album),
      }
    }

    const audioFiles = collectAudioFiles(resolvedPath)
    if (audioFiles.length === 0) {
      this.error(`No audio files found in ${resolvedPath}\n\nPass a staged album path or a source album directory.`)
    }

    const taggedIdentity = inferFromTags(audioFiles[0])
    const artist = sanitizePathSegment(taggedIdentity?.artist || path.basename(path.dirname(resolvedPath)) || 'Unknown Artist')
    const album = sanitizePathSegment(taggedIdentity?.album || path.basename(resolvedPath) || 'Unknown Album')

    return {
      album,
      artist,
      resolvedFrom: taggedIdentity ? 'audio metadata' : 'directory name',
      rootPath: path.join(this.localLibraryRoot, artist, album),
    }
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(DapRemove)
    const targetPath = args.targetPath ?? process.cwd()
    const albumIdentity = this.resolveAlbumIdentity(targetPath)

    if (!fs.existsSync(albumIdentity.rootPath) || !fs.statSync(albumIdentity.rootPath).isDirectory()) {
      this.error(
        `Managed album not found in ~/Music/DAP.\n\nResolved album:\n  Artist: ${albumIdentity.artist}\n  Album: ${albumIdentity.album}\n  Expected path: ${albumIdentity.rootPath}`,
      )
    }

    const stats = getAlbumStats(albumIdentity.rootPath)
    if (stats.songCount === 0) {
      this.error(`Resolved album path exists but contains no audio files: ${albumIdentity.rootPath}`)
    }

    this.log(chalk.bold('Local album removal plan:'))
    this.log(`  Resolved from: ${albumIdentity.resolvedFrom}`)
    this.log(`  Artist: ${albumIdentity.artist}`)
    this.log(`  Album: ${albumIdentity.album}`)
    this.log(`  Root: ${albumIdentity.rootPath}`)
    this.log(`  Songs: ${stats.songCount}`)
    this.log(`  Disk usage: ${formatBytes(stats.totalBytes)}`)
    this.log('')
    this.log(chalk.yellow('Warning: This will permanently delete the staged local album and refresh local DAP state.'))

    if (!flags.confirm && (!process.stdin.isTTY || !process.stdout.isTTY)) {
      this.error(
        'This removal is destructive and requires an interactive terminal for confirmation.\n\nRe-run interactively from the album directory you want to remove, or use `--confirm` only if you are certain.',
      )
    }

    if (!flags.confirm) {
      const rl = readline.createInterface({input: process.stdin, output: process.stdout})
      const answer = await rl.question('Type REMOVE to continue: ')
      rl.close()

      if (answer.trim() !== 'REMOVE') {
        this.log('Aborted.')
        return
      }
    }

    fs.rmSync(albumIdentity.rootPath, {force: true, recursive: true})

    const artistRoot = path.dirname(albumIdentity.rootPath)
    if (fs.existsSync(artistRoot) && fs.statSync(artistRoot).isDirectory() && fs.readdirSync(artistRoot).length === 0) {
      fs.rmdirSync(artistRoot)
    }

    const manifest = rebuildManifest(this.localLibraryRoot)
    this.log(
      `Removed ${albumIdentity.artist} / ${albumIdentity.album}. Local library now has ${manifest.summary.songCount} songs, ${manifest.summary.albumCount} albums, ${formatBytes(manifest.summary.totalBytes)}.`,
    )
  }
}
