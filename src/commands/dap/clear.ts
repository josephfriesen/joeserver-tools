import * as readline from 'node:readline/promises'

import {Flags} from '@oclif/core'
import chalk from 'chalk'
import ora from 'ora'

import {clearLibrary, formatBytes, inspectLibrary} from '../../dap/library.js'
import {DapBaseCommand} from './base.js'

type Target = 'device' | 'local'

export default class DapClear extends DapBaseCommand {
  static summary = 'Destructively clear the managed local library or the device /TUNES library'

  static description =
    'Use this when you intentionally want to reset the managed local DAP library or the device /TUNES library back to zero files.\n\nThis is destructive. It deletes all managed music files in the selected target, rebuilds an empty manifest, and leaves that library at 0 songs and 0 albums.'

  static examples = [
    '$ joeserver-tools dap clear --target=local',
    '# Delete everything under ~/Music/DAP after confirmation and rebuild an empty manifest',
    '$ joeserver-tools dap clear --target=device',
    '# Delete everything under /TUNES on the connected device after confirmation',
  ]

  static flags = {
    confirm: Flags.boolean({
      default: false,
      description: 'Apply the destructive reset without an interactive confirmation prompt.',
    }),
    target: Flags.string({
      description: 'Which managed library to clear.',
      options: ['device', 'local'],
      required: true,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(DapClear)
    const target = flags.target as Target
    const rootPath = target === 'device' ? this.requireDeviceConnection() : this.localLibraryRoot
    const label = target === 'device' ? 'device /TUNES library' : 'local ~/Music/DAP library'
    const inspection = inspectLibrary(rootPath)

    this.log(chalk.bold('Destructive reset plan:'))
    this.log(`  Target: ${label}`)
    this.log(`  Root: ${rootPath}`)
    this.log(`  Current songs: ${inspection.stats.songCount}`)
    this.log(`  Current albums: ${inspection.stats.albumCount}`)
    this.log(`  Current disk usage: ${formatBytes(inspection.stats.totalBytes)}`)
    this.log('  Result after reset: 0 songs, 0 albums, 0 B')
    this.log('')
    this.log(chalk.yellow('Warning: This will permanently delete all managed files in the selected library.'))

    if (!flags.confirm && (!process.stdin.isTTY || !process.stdout.isTTY)) {
      this.error(
        'This reset is destructive and requires an interactive terminal for confirmation.\n\nRe-run interactively, or use `--confirm` only if you are certain you want to clear the selected library.',
      )
    }

    if (!flags.confirm) {
      const rl = readline.createInterface({input: process.stdin, output: process.stdout})
      const answer = await rl.question('Type RESET to continue: ')
      rl.close()

      if (answer.trim() !== 'RESET') {
        this.log('Aborted.')
        return
      }
    }

    this.log('')
    this.log(chalk.bold(`Clearing ${label}...`))
    const useSpinner = process.stdout.isTTY
    const spinner = ora({isEnabled: useSpinner, text: 'Starting reset...'}).start()

    try {
      const manifest = clearLibrary(rootPath, ({completed, current, total}) => {
        const message = `[${completed}/${total}] Deleting ${current}`
        if (useSpinner) {
          spinner.text = message
          spinner.render()
        }
      })
      if (useSpinner) {
        spinner.text = 'Refreshing manifest...'
        spinner.render()
      }
      const successMessage = `Reset complete. ${label} now has ${manifest.summary.songCount} songs, ${manifest.summary.albumCount} albums, ${formatBytes(manifest.summary.totalBytes)}.`
      if (useSpinner) spinner.succeed(successMessage)
      else this.log(successMessage)
    } catch (error) {
      if (useSpinner) spinner.fail('Reset failed.')
      throw error
    }
  }
}
