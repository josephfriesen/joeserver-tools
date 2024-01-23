import {Command, Flags} from '@oclif/core'
import chalk from 'chalk'
import {NodeSSH} from 'node-ssh'

import {SSH_CONFIG} from '../../constants/ssh.js'

export default class AppdataBackup extends Command {
  static APPDATA_PATH = '/mnt/user/appdata'
  static BACKUP_PATH = '/mnt/user/backup/appdata'

  static description = 'Save appdata to backup folder'

  static examples = [
    `$ joeserver-tools appdata-backup
Shutting down containers, please wait...
...`,
  ]

  static flags = {
    privateKeyPath: Flags.string({
      char: 'k',
      default: SSH_CONFIG.privateKeyPath,
      description: 'Path to private SSH key for authentiating as root user on joeserver. Defaults to ~/.ssh/id_ed25519',
    }),
  }

  static PLEX = ['plex', 'Plex-Media-Server']

  ssh: NodeSSH = new NodeSSH()

  get date(): string {
    return new Date().toLocaleDateString()
  }

  async backupContainer(container: string): Promise<void> {
    this.log(' ========================================')
    this.log(`           ${chalk.blue(container)}`)
    const stopRestart = await this.containerIsRunning(container)
    stopRestart && (await this.stopContainer(container))
    await this.rsyncAppdataToBackup(container)
    stopRestart && (await this.startContainer(container))
    this.log(' ========================================')
  }

  async backupPlex(): Promise<void> {
    // plex is special for some reason it gets dirs 'plex' and 'Plex-Media-Server'
    // and also takes 10+ minutes to back up. So we do it separately.
    this.log(' ========================================')
    this.log(`           ${chalk.blue('plex')}`)
    await this.stopContainer('plex')
    await this.rsyncAppdataToBackup('plex')
    await this.rsyncAppdataToBackup('Plex-Media-Server')
    await this.startContainer('plex')
    this.log(' ========================================')
  }

  async containerIsRunning(container: string): Promise<boolean> {
    const inspectCmd = `docker inspect --format='{{.State.Running}}' ${container}`
    const inspect = await this.ssh.execCommand(inspectCmd).then((result) => result.stdout.trim())
    return inspect === 'true'
  }

  async containerIsStopped(container: string): Promise<boolean> {
    const inspectCmd = `docker inspect --format='{{.State.Running}}' ${container}`
    const inspect = await this.ssh.execCommand(inspectCmd).then((result) => result.stdout.trim())
    return inspect === 'false'
  }

  async getContainers(): Promise<string[]> {
    const inspectCmd = "docker inspect --format='{{.Name}}' $(docker ps -aq) | sed 's/\\///g'"
    const inspect = await this.ssh
      .execCommand(inspectCmd)
      .then((result) => result.stdout.split('\n'))
      .then((list) => list.filter((c) => AppdataBackup.PLEX.includes(c) === false))
    return inspect
  }

  async rsyncAppdataToBackup(container: string): Promise<void> {
    this.log(`   ${chalk.blue('=>')} Backing up container`)
    const backupCmd = `rsync -a --delete ${AppdataBackup.APPDATA_PATH}/${container}/ ${AppdataBackup.BACKUP_PATH}/${container}/`
    await this.ssh.execCommand(backupCmd)
  }

  async run(): Promise<void> {
    this.log('========================================\n')
    this.log(`   ${chalk.bold(chalk.blue('Backing up joeserver appdata'))}`)
    this.log(`   ${chalk.bold('Date: ')} ${this.date}`)
    this.log('========================================\n')

    const {flags} = await this.parse(AppdataBackup)

    await this.ssh.connect({
      ...SSH_CONFIG,
      privateKeyPath: flags.privateKeyPath,
    })

    const containers = await this.getContainers()

    for (const container of containers) {
      await this.backupContainer(container) // eslint-disable-line no-await-in-loop
    }

    await this.backupPlex()

    this.exit()
  }

  async startContainer(container: string): Promise<void> {
    this.log(`   ${chalk.blue('=>')} Starting container`)
    const startCmd = `docker start ${container} 1> /dev/null`
    await this.ssh.execCommand(startCmd)
  }

  async stopContainer(container: string): Promise<void> {
    this.log(`   ${chalk.blue('=>')} Stopping container`)
    const stopCmd = `docker stop ${container} 1> /dev/null`
    await this.ssh.execCommand(stopCmd)
  }
}
