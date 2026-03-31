import * as fs from 'node:fs'
import * as path from 'node:path'
import * as readline from 'node:readline/promises'
import {pipeline} from 'node:stream/promises'

import {Flags} from '@oclif/core'
import chalk from 'chalk'
// @ts-ignore cli-progress does not ship TypeScript declarations
import {MultiBar, Presets} from 'cli-progress'

import {
  DEVICE_SONG_LIMIT,
  DEVICE_STORAGE_LIMIT_BYTES,
  buildSyncPlan,
  formatBytes,
  inspectLibrary,
  rebuildManifest,
} from '../../dap/library.js'
import {DapBaseCommand} from './base.js'

type Direction = 'device-to-local' | 'local-to-device'
type Mode = 'copy' | 'exact'
const VALID_DIRECTIONS: Direction[] = ['device-to-local', 'local-to-device']

async function copyFileWithProgress(
  srcPath: string,
  destPath: string,
  onProgress: (copiedBytes: number) => void,
): Promise<void> {
  let copiedBytes = 0
  const readStream = fs.createReadStream(srcPath, {highWaterMark: 64 * 1024})
  const writeStream = fs.createWriteStream(destPath)

  readStream.on('data', (chunk: string | Buffer) => {
    copiedBytes += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length
    onProgress(copiedBytes)
  })

  await pipeline(readStream, writeStream)
}

function ensureParent(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), {recursive: true})
}

function shortenMiddle(value: string, maxLength = 48): string {
  if (value.length <= maxLength) return value
  const keep = Math.max(10, Math.floor((maxLength - 3) / 2))
  return `${value.slice(0, keep)}...${value.slice(value.length - keep)}`
}

export default class DapSync extends DapBaseCommand {
  static summary = 'Preview and apply file sync operations between ~/Music/DAP and the device /TUNES library'

  static description =
    'Use this to move managed music between your computer and the Echo Mini.\n\nThe command always scopes device operations to /TUNES, builds and prints a sync plan first, then asks for confirmation before writing unless you pass --confirm. Use --dry-run for a preview-only run. Use copy mode to add/update files without deleting extras, or exact mode to make the destination match the source exactly.'

  static examples = [
    '$ joeserver-tools dap sync --direction=local-to-device',
    '# Build the plan, show it, and prompt before copying to /TUNES',
    '$ joeserver-tools dap sync --direction=local-to-device --dry-run',
    '# Preview the sync plan without applying any changes',
    '$ joeserver-tools dap sync --direction=local-to-device --mode=exact',
    '# Make /TUNES match the local library exactly after confirming the plan',
  ]

  static flags = {
    confirm: Flags.boolean({
      default: false,
      description: 'Apply changes without an interactive confirmation prompt.',
    }),
    direction: Flags.string({
      description: 'Sync direction.',
      options: VALID_DIRECTIONS,
    }),
    'dry-run': Flags.boolean({
      allowNo: true,
      default: false,
      description: 'Preview the sync plan without prompting or writing changes.',
    }),
    mode: Flags.string({
      default: 'copy',
      description: 'Whether to copy only or make the destination match exactly.',
      options: ['copy', 'exact'],
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(DapSync)
    const direction = flags.direction as Direction | undefined
    const mode = flags.mode as Mode
    const dryRun = flags['dry-run']

    if (!direction) {
      this.error(
        'Choose a sync direction with `--direction=local-to-device` or `--direction=device-to-local`.\n\nExample:\n  joeserver-tools dap sync --direction=local-to-device',
      )
    }

    const deviceLibraryPath = this.requireDeviceConnection()
    const sourceRoot = direction === 'local-to-device' ? this.localLibraryRoot : deviceLibraryPath
    const destinationRoot = direction === 'local-to-device' ? deviceLibraryPath : this.localLibraryRoot

    const sourceInspection = inspectLibrary(sourceRoot)
    const destinationInspection = inspectLibrary(destinationRoot)
    const plan = buildSyncPlan(sourceInspection.stats, destinationInspection.stats, mode === 'exact')

    this.log(chalk.bold('Sync plan:'))
    this.log(`  Direction: ${direction}`)
    this.log(`  Mode: ${mode}`)
    this.log(`  Dry run: ${dryRun ? 'yes' : 'no'}`)
    this.log(`  Copy/update: ${plan.toCopy.length}`)
    for (const relativePath of plan.toCopy) this.log(`    copy ${relativePath}`)
    this.log(`  Delete: ${plan.toDelete.length}`)
    for (const relativePath of plan.toDelete) this.log(`    delete ${relativePath}`)
    this.log(`  Byte delta: ${plan.bytesDelta >= 0 ? '+' : ''}${formatBytes(plan.bytesDelta)}`)
    this.log(
      `  Destination after sync: ${plan.destinationAfter.songCount} songs, ${plan.destinationAfter.albumCount} albums, ${formatBytes(plan.destinationAfter.totalBytes)}`,
    )

    if (direction === 'local-to-device') {
      if (plan.destinationAfter.songCount > DEVICE_SONG_LIMIT) {
        this.error(`Sync would exceed device song limit of ${DEVICE_SONG_LIMIT}.`)
      }

      if (plan.destinationAfter.totalBytes > DEVICE_STORAGE_LIMIT_BYTES) {
        this.error(`Sync would exceed device capacity of ${formatBytes(DEVICE_STORAGE_LIMIT_BYTES)}.`)
      }
    }

    if (dryRun) {
      this.log('Dry run only. No changes applied.')
      return
    }

    if (!flags.confirm && (!process.stdin.isTTY || !process.stdout.isTTY)) {
      this.error(
        'This sync plan is ready to apply, but confirmation requires an interactive terminal.\n\nRe-run interactively, or use `--confirm` to apply without prompting, or `--dry-run` to preview only.',
      )
    }

    if (!flags.confirm) {
      const rl = readline.createInterface({input: process.stdin, output: process.stdout})
      const answer = await rl.question('Apply these changes? [y/N]: ')
      rl.close()
      if (!/^y(es)?$/i.test(answer.trim())) {
        this.log('Aborted.')
        return
      }
    }

    const totalOperations = plan.toCopy.length + plan.toDelete.length
    const totalCopyBytes = plan.toCopy.reduce(
      (sum, relativePath) => sum + (plan.sourceStats.fileMap.get(relativePath)?.size ?? 0),
      0,
    )
    const useProgressBar = process.stdout.isTTY && totalCopyBytes > 0
    let completedOperations = 0
    let copiedBytes = 0

    this.log('')
    this.log(chalk.bold('Applying sync...'))
    try {
      const progressBar = useProgressBar
        ? new MultiBar(
            {
              clearOnComplete: true,
              format: ' {bar} {percentage}% | {transferred}/{totalFmt} | {ops}/{opsTotal} | {file}',
              hideCursor: true,
              stopOnComplete: true,
            },
            Presets.rect,
          )
        : null

      const overallBar = progressBar?.create(totalCopyBytes || 1, 0, {
        file: 'Preparing...',
        ops: 0,
        opsTotal: totalOperations,
        totalFmt: formatBytes(totalCopyBytes),
        transferred: formatBytes(0),
      })

      for (const relativePath of plan.toCopy) {
        const srcPath = path.join(sourceRoot, relativePath)
        const destPath = path.join(destinationRoot, relativePath)
        const fileSize = plan.sourceStats.fileMap.get(relativePath)?.size ?? 0
        ensureParent(destPath)
        const fileLabel = shortenMiddle(relativePath)

        await copyFileWithProgress(srcPath, destPath, (fileCopiedBytes) => {
          overallBar?.update(copiedBytes + fileCopiedBytes, {
            file: fileLabel,
            ops: completedOperations,
            opsTotal: totalOperations,
            totalFmt: formatBytes(totalCopyBytes),
            transferred: formatBytes(copiedBytes + fileCopiedBytes),
          })
        })

        copiedBytes += fileSize
        completedOperations++
        overallBar?.update(copiedBytes, {
          file: fileLabel,
          ops: completedOperations,
          opsTotal: totalOperations,
          totalFmt: formatBytes(totalCopyBytes),
          transferred: formatBytes(copiedBytes),
        })

        if (!progressBar) {
          this.log(
            `[${completedOperations}/${totalOperations}] Copied ${relativePath} | ${formatBytes(copiedBytes)}/${formatBytes(totalCopyBytes)}`,
          )
        }
      }

      progressBar?.stop()

      for (const relativePath of plan.toDelete) {
        fs.rmSync(path.join(destinationRoot, relativePath), {force: true})
        completedOperations++
        this.log(`[${completedOperations}/${totalOperations}] Deleting ${relativePath}`)
      }

      this.log(`Refreshing manifests... (${totalOperations} planned operations)`)
      rebuildManifest(sourceRoot)
      rebuildManifest(destinationRoot)
      this.log(chalk.green('Sync complete.'))
    } catch (error) {
      this.log(chalk.red('Sync failed.'))
      throw error
    }
  }
}
