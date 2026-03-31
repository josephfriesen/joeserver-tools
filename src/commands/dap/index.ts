import {Command} from '@oclif/core'
import chalk from 'chalk'

export default class DapIndex extends Command {
  static summary = 'Prepare, inspect, and sync the managed music library for the Echo Mini DAP'

  static description =
    'DAP commands manage a local staging library at ~/Music/DAP and, when connected, a device library at /TUNES.\n\nAvailable commands:\n  dap format        Copy one album into ~/Music/DAP with normalized filenames, tags, and album art\n  dap remove        Remove one staged album from ~/Music/DAP and refresh local state\n  dap info          Show library totals and manifest status; add --diff for file-level differences\n  dap sync          Preview or apply sync operations between ~/Music/DAP and /TUNES\n  dap clear         Destructively reset the local or device managed library back to 0 files\n  dap eject         Safely unmount/eject the connected Echo Mini\n  dap state rebuild Rebuild .dap-state.json from the actual files on disk\n\nUse this command as the starting point to understand the workflow and choose the next subcommand.'

  static examples = [
    '$ joeserver-tools dap format /path/to/album',
    '$ joeserver-tools dap remove /path/to/album',
    '$ joeserver-tools dap info',
    '$ joeserver-tools dap info --diff',
    '$ joeserver-tools dap sync --direction=local-to-device',
    '$ joeserver-tools dap clear --target=local',
    '$ joeserver-tools dap eject',
    '$ joeserver-tools dap state rebuild --target=local',
  ]

  async run(): Promise<void> {
    await this.parse(DapIndex)

    this.log(chalk.bold('Echo Mini DAP workflow'))
    this.log('')
    this.log('Managed paths:')
    this.log('  Local library: ~/Music/DAP')
    this.log('  Device library: /TUNES on the mounted Echo Mini')
    this.log('')
    this.log('What these commands do:')
    this.log('  dap format        Copy one album into ~/Music/DAP with normalized filenames, tags, and album art')
    this.log('  dap remove        Remove one staged album from ~/Music/DAP and refresh local state')
    this.log('  dap info          Show local/device totals, manifest freshness, and file differences')
    this.log('  dap sync          Preview and apply sync operations between ~/Music/DAP and /TUNES')
    this.log('  dap clear         Destructively reset the local or device managed library back to 0 files')
    this.log('  dap eject         Safely unmount/eject the connected Echo Mini')
    this.log('  dap state rebuild Rebuild portable manifest files from what is actually on disk')
    this.log('')
    this.log('Recommended workflow:')
    this.log('  1. Run `dap format <album-folder>` for each album you want to stage locally.')
    this.log('  2. Run `dap remove <album-folder>` if you need to delete a staged album from the local library.')
    this.log('  3. Run `dap info` to inspect the local library and compare it with the device.')
    this.log('  4. Run `dap sync --direction=local-to-device` to preview the changes.')
    this.log('  5. Re-run with `--no-dry-run` when the sync plan looks correct.')
    this.log('')
    this.log('Safety rules:')
    this.log('  Device writes and deletions are limited to /TUNES.')
    this.log('  `dap sync` prints a plan first and asks for confirmation before writing.')
    this.log('  `dap clear` is destructive and resets the selected managed library to 0 files.')
    this.log('  `dap eject` should be run only after transfers are finished.')
    this.log('  `dap format` never changes the source album folder.')
  }
}
