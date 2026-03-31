import {Flags} from '@oclif/core'
import chalk from 'chalk'

import {formatBytes, rebuildManifest} from '../../../dap/library.js'
import {DapBaseCommand} from '../base.js'

type Target = 'both' | 'device' | 'local'

export default class DapStateRebuild extends DapBaseCommand {
  static summary = 'Re-scan the managed DAP library roots and rebuild their portable state files'

  static description =
    'Use this when a manifest is missing, you have changed files outside this CLI, or you want to verify the saved library state against what is really on disk.\n\nThe command scans the managed local library, the device /TUNES library, or both, and rewrites .dap-state.json from the actual files present.'

  static examples = [
    '$ joeserver-tools dap state rebuild --target=local',
    '# Rebuild the manifest for ~/Music/DAP only',
    '$ joeserver-tools dap state rebuild --target=both --hash',
    '# Rebuild both manifests and include full content hashes',
  ]

  static flags = {
    hash: Flags.boolean({
      default: false,
      description: 'Compute content hashes while rebuilding.',
    }),
    target: Flags.string({
      default: 'both',
      description: 'Which managed library root to rebuild.',
      options: ['both', 'device', 'local'],
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(DapStateRebuild)
    const target = flags.target as Target
    const includeHashes = flags.hash

    const targets: Array<{label: string; rootPath: string}> = []

    if (target === 'local' || target === 'both') {
      targets.push({label: 'Local', rootPath: this.localLibraryRoot})
    }

    if (target === 'device' || target === 'both') {
      targets.push({label: 'Device', rootPath: this.requireDeviceConnection()})
    }

    for (const item of targets) {
      const manifest = rebuildManifest(item.rootPath, includeHashes)
      this.log(
        `${chalk.green('✓')} ${item.label}: ${manifest.summary.songCount} songs, ${manifest.summary.albumCount} albums, ${formatBytes(manifest.summary.totalBytes)}`,
      )
    }
  }
}
