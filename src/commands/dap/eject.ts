import {spawnSync} from 'node:child_process'
import * as readline from 'node:readline/promises'

import {Flags} from '@oclif/core'
import chalk from 'chalk'

import {DapBaseCommand} from './base.js'

function ejectMount(mountPath: string): void {
  if (process.env.DAP_EJECT_TEST_MODE === 'success') {
    return
  }

  if (process.platform === 'darwin') {
    const result = spawnSync('diskutil', ['eject', mountPath], {stdio: 'inherit'})
    if (result.status !== 0) {
      throw new Error(`diskutil eject failed with exit code ${result.status ?? 'unknown'}.`)
    }

    return
  }

  if (process.platform === 'linux') {
    const result = spawnSync('umount', [mountPath], {stdio: 'inherit'})
    if (result.status !== 0) {
      throw new Error(`umount failed with exit code ${result.status ?? 'unknown'}.`)
    }

    return
  }

  if (process.platform === 'win32') {
    const drive = mountPath.replace(/\\$/, '')
    const psScript = `$drive = New-Object -ComObject Shell.Application; $drive.Namespace(17).ParseName('${drive}').InvokeVerb('Eject')`
    const result = spawnSync('powershell', ['-NoProfile', '-Command', psScript], {stdio: 'inherit'})
    if (result.status !== 0) {
      throw new Error(`PowerShell eject failed with exit code ${result.status ?? 'unknown'}.`)
    }

    return
  }

  throw new Error(`Eject is not implemented for platform "${process.platform}".`)
}

export default class DapEject extends DapBaseCommand {
  static summary = 'Unmount or eject the connected Echo Mini after syncing is finished'

  static description =
    'Use this when you are done syncing and want to safely disconnect the Echo Mini from your computer.\n\nThe command checks that the DAP is connected, shows the mount it is about to eject, asks for confirmation by default, and then runs the platform-specific unmount/eject command.'

  static examples = [
    '$ joeserver-tools dap eject',
    '# Confirm and safely eject the connected Echo Mini',
    '$ joeserver-tools dap eject --confirm',
    '# Eject without prompting',
  ]

  static flags = {
    confirm: Flags.boolean({
      default: false,
      description: 'Eject the connected DAP without an interactive confirmation prompt.',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(DapEject)
    const connection = this.checkDeviceConnection()

    if (!connection.connected || !connection.mountPath) {
      this.error('DAP (ECHO MINI) not found. Please connect your Echo Mini via USB and try again.')
    }

    this.log(chalk.bold('Eject plan:'))
    this.log(`  Mount: ${connection.mountPath}`)
    this.log(`  Library: ${connection.libraryPath}`)
    this.log('')
    this.log(chalk.yellow('Warning: Make sure all copy and sync operations have finished before ejecting.'))

    if (!flags.confirm && (!process.stdin.isTTY || !process.stdout.isTTY)) {
      this.error(
        'Eject requires an interactive terminal for confirmation.\n\nRe-run interactively, or use `--confirm` if you are certain the device is ready to disconnect.',
      )
    }

    if (!flags.confirm) {
      const rl = readline.createInterface({input: process.stdin, output: process.stdout})
      const answer = await rl.question('Eject the connected Echo Mini now? [y/N]: ')
      rl.close()
      if (!/^y(es)?$/i.test(answer.trim())) {
        this.log('Aborted.')
        return
      }
    }

    this.log('')
    this.log(chalk.bold('Ejecting device...'))

    try {
      ejectMount(connection.mountPath)
      this.log(chalk.green('Echo Mini ejected.'))
    } catch (error) {
      this.log(chalk.red('Eject failed.'))
      throw error
    }
  }
}
