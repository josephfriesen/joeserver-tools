import {Flags} from '@oclif/core'
import chalk from 'chalk'

import {
  DEVICE_SONG_LIMIT,
  DEVICE_STORAGE_LIMIT_BYTES,
  diffStats,
  formatBytes,
  inspectLibrary,
} from '../../dap/library.js'
import {DapBaseCommand} from './base.js'

function manifestLabel(state: 'fresh' | 'missing' | 'stale'): string {
  if (state === 'fresh') return 'fresh'
  if (state === 'missing') return 'missing'
  return 'stale'
}

function printLibrarySummary(
  command: DapInfo,
  label: string,
  inspection: ReturnType<typeof inspectLibrary>,
  includeLimits = false,
): void {
  const {stats, manifestState, source} = inspection

  command.log(chalk.bold(`${label}:`))
  command.log(`  Source: ${source === 'manifest' ? 'manifest' : 'live scan'}`)
  command.log(`  Manifest: ${manifestLabel(manifestState)}`)
  command.log(`  Songs: ${stats.songCount}`)
  command.log(`  Albums: ${stats.albumCount}`)
  command.log(`  Disk usage: ${formatBytes(stats.totalBytes)}`)

  if (includeLimits) {
    command.log(`  Song limit: ${stats.songCount}/${DEVICE_SONG_LIMIT}`)
    command.log(`  Capacity: ${formatBytes(stats.totalBytes)}/${formatBytes(DEVICE_STORAGE_LIMIT_BYTES)}`)

    if (stats.songCount > DEVICE_SONG_LIMIT) {
      command.warn(`Device exceeds song limit by ${stats.songCount - DEVICE_SONG_LIMIT} tracks.`)
    }

    if (stats.totalBytes > DEVICE_STORAGE_LIMIT_BYTES) {
      command.warn(`Device exceeds storage limit by ${formatBytes(stats.totalBytes - DEVICE_STORAGE_LIMIT_BYTES)}.`)
    }
  }
}

export default class DapInfo extends DapBaseCommand {
  static summary = 'Inspect the local DAP library and, if connected, compare it with the device copy'

  static description =
    'Use this to see what is in ~/Music/DAP, whether the manifest is fresh, and how close the device is to its song/storage limits.\n\nPass --diff when you want the file-level differences between local and device libraries. If the Echo Mini is not connected, the command still reports the local library and warns that device checks were skipped.'

  static examples = [
    '$ joeserver-tools dap info',
    '# Show local totals, manifest freshness, and device totals',
    '$ joeserver-tools dap info --diff',
    '# Show file-level differences first, then keep the local/device summaries at the bottom',
  ]

  static flags = {
    diff: Flags.boolean({
      default: false,
      description: 'Show file-level differences between the local library and the connected device.',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(DapInfo)
    const localInspection = inspectLibrary(this.localLibraryRoot)
    const device = this.checkDeviceConnection()

    if (!device.connected || !device.libraryPath) {
      printLibrarySummary(this, 'Local library', localInspection)
      this.log('')
      this.warn('Device is not connected. Skipping device stats and diff.')
      return
    }

    const deviceInspection = inspectLibrary(device.libraryPath)

    if (flags.diff) {
      const diff = diffStats(localInspection.stats, deviceInspection.stats)
      this.log(chalk.bold('Diff:'))
      this.log(`  Only on device: ${diff.onlyInRight.length}`)
      for (const relativePath of diff.onlyInRight) this.log(`    ${relativePath}`)
      this.log(`  Only in local: ${diff.onlyInLeft.length}`)
      for (const relativePath of diff.onlyInLeft) this.log(`    ${relativePath}`)
      if (diff.changed.length > 0) {
        this.log(
          '  Different on both sides = same managed path exists in both libraries, but size or modified time differs',
        )
        this.log(`  Different on both sides: ${diff.changed.length}`)
        for (const relativePath of diff.changed) this.log(`    ${relativePath}`)
      }
      this.log('')
    }

    printLibrarySummary(this, 'Local library', localInspection)
    this.log('')
    printLibrarySummary(this, 'Device library', deviceInspection, true)
  }
}
