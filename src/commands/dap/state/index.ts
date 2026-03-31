import {Command} from '@oclif/core'
import chalk from 'chalk'

export default class DapStateIndex extends Command {
  static summary = 'Understand and maintain the portable manifest files used by the DAP commands'

  static description =
    'State commands manage .dap-state.json files for the local DAP library and the device /TUNES library.\n\nAvailable commands:\n  dap state rebuild Re-scan local, device, or both managed libraries and rewrite the manifest files\n\nUse them when manifests are missing, stale, or need to be rebuilt from actual files on disk.'

  static examples = [
    '$ joeserver-tools dap state rebuild --target=local',
    '$ joeserver-tools dap state rebuild --target=both --hash',
  ]

  async run(): Promise<void> {
    await this.parse(DapStateIndex)

    this.log(chalk.bold('DAP state commands'))
    this.log('')
    this.log('State files:')
    this.log('  Local:  ~/Music/DAP/.dap-state.json')
    this.log('  Device: /TUNES/.dap-state.json')
    this.log('')
    this.log('Why this exists:')
    this.log('  The manifest records what files are present, along with counts, sizes, mtimes, and optional hashes.')
    this.log('  It can be rebuilt from disk, so you can move between computers without losing track of the device state.')
    this.log('')
    this.log('Available command:')
    this.log('  dap state rebuild Re-scan local, device, or both managed libraries and rewrite the manifest files')
    this.log('')
    this.log('When to run it:')
    this.log('  After changing files outside this CLI')
    this.log('  When a manifest is missing or reported stale')
    this.log('  When you want a full rebuild before comparing or syncing libraries')
  }
}
