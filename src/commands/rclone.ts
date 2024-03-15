import {Args, Command, Flags} from '@oclif/core'
import chalk from 'chalk'

import {BaseCommand} from '../baseCommand.js'

export default class Rclone extends BaseCommand<typeof Rclone> {
  static args = {}

  static description = 'Using rclone, copy files from joeserver to either backblaze b2 bucket or to PC local drive'
  static examples = [`$ joeserver-tools rclone `]

  static flags = {}

  async run(): Promise<void> {
    const {flags} = await this.parse(Rclone)

    this.log(' ========================================')
    this.log(`       ${chalk.bold(chalk.blue('rclone'))}`)
    this.log(' ========================================\n')

    await this.ssh
      .execCommand('pwd')
      .then((res) => this.log(`   ${chalk.blue('=>')} ${res.stdout}`))
      .catch((error) => this.error(error))

    this.exit()
  }
}
