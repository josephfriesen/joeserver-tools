import {Args, Command, Flags} from '@oclif/core'
import {NodeSSH, SSHExecCommandResponse} from 'node-ssh'
import {SSH_CONFIG} from '../../constants/ssh.js'
import {config as _config} from 'dotenv'
import yaml from 'js-yaml'
import chalk from 'chalk'

type PortainerRequestParams = [string, {method: string; headers: {'X-API-KEY': string; 'Content-Type': string}}]

export default class ResetDC extends Command {
  PORTAINER_URL: string = ''
  PORTAINER_ACCESS_TOKEN: string | undefined

  constructor(argv: string[], config: any) {
    super(argv, config)
    this.log('constructor')
    _config()
    this.PORTAINER_URL = process.env.PORTAINER_URL ?? ''
    this.PORTAINER_ACCESS_TOKEN = process.env.PORTAINER_ACCESS_TOKEN
  }

  static description =
    'Run docker compose down && docker compose up -d for all docker compose stacks in joeserver Portainer'

  static examples = [`$ joeserver-tools reset-dc`]

  static flags = {
    privateKeyPath: Flags.string({
      char: 'k',
      default: SSH_CONFIG.privateKeyPath,
      description: 'Path to private SSH key for authentiating as root user on joeserver. Defaults to ~/.ssh/id_ed25519',
      required: false,
    }),
    repull: Flags.boolean({
      char: 'p',
      aliases: ['pull'],
      default: false,
      description: 'Repull images before restarting containers',
      required: false,
    }),
    singleStack: Flags.string({
      char: 's',
      aliases: ['stack'],
      default: '',
      description: 'Only reset a specific stack',
      required: false,
    }),
  }

  date(): string {
    return new Date().toLocaleString()
  }

  errors: {[key: string]: string | undefined} = {}

  hasError(id: string): boolean {
    return this.errors[id.toString()] !== undefined
  }

  clearError(id: string): void {
    this.errors[id.toString()] = undefined
  }

  getError(id: string | number): string | undefined {
    return this.errors[id.toString()]
  }

  setError(id: string | number, message: string): void {
    this.errors[id.toString()] = message
  }

  basePortainerRequest = (endpoint: string = '', method: string = 'GET'): PortainerRequestParams => {
    if (this.PORTAINER_URL === '' || this.PORTAINER_ACCESS_TOKEN === undefined) {
      this.error('PORTAINER_URL and PORTAINER_ACCESS_TOKEN must be set in .env')
    }

    return [
      `${this.PORTAINER_URL}/api/${endpoint}`,
      {
        method,
        headers: {
          'X-API-KEY': this.PORTAINER_ACCESS_TOKEN,
          'Content-Type': 'application/json',
        },
      },
    ]
  }

  ssh: NodeSSH = new NodeSSH()

  async getStack(stackId: string): Promise<any> {
    this.log(`   ${chalk.bold(chalk.blue('Getting stack:'))} ${stackId}`)
    const [url, options] = this.basePortainerRequest(`stacks/${stackId}`)
    return fetch(url, options).then(async (res) => {
      if (!res.ok) {
        const errorJson = await res.json()
        this.setError(stackId, errorJson.message)
      }
      this.log(`   ${chalk.bold(chalk.green('Got stack:'))} ${stackId}`)
      return res.json()
    })
  }

  async stopStack(stack: any): Promise<any> {
    this.log(`   ${chalk.bold(chalk.blue('Stopping stack:'))} ${stack.Name}`)
    const [url, options] = this.basePortainerRequest(`stacks/${stack.Id}/stop?endpointId=${stack.EndpointId}`, 'POST')
    return fetch(url, options).then(async (res) => {
      if (!res.ok) {
        const errorJson = await res.json()
        this.setError(stack.Id, errorJson.message)
      } else {
        this.log(`   ${chalk.bold(chalk.green('Stopped stack:'))} ${stack.Name}`)
        return res.json()
      }
    })
  }

  async pullLatest(stack: any): Promise<any> {
    this.log(`   ${chalk.bold(chalk.blue('Pulling latest image for stack:'))} ${stack.Name}`)

    const composePath = `${stack.ProjectPath.replace('/data/', '/mnt/user/appdata/portainer/')}`

    const pullCmd = await this.ssh.execCommand(`cd ${composePath} && docker compose pull`)

    this.log(`   ${pullCmd.stdout}`)
  }

  async startStack(stack: any): Promise<any> {
    this.log(`   ${chalk.bold(chalk.blue('Starting stack:'))} ${stack.Name}`)
    const [url, options] = this.basePortainerRequest(`stacks/${stack.Id}/start?endpointId=${stack.EndpointId}`, 'POST')
    return fetch(url, options).then(async (res) => {
      if (!res.ok) {
        const errorJson = await res.json()
        this.setError(stack.Id, errorJson.message)
      } else {
        this.log(`   ${chalk.bold(chalk.green('Started stack:'))} ${stack.Name}`)
        return res.json()
      }
    })
  }

  async resetStack(stackId: number, stackName: string): Promise<any> {
    const {flags} = await this.parse(ResetDC)
    const repull: boolean = flags.repull

    const showError = (id: string): void => {
      this.log(`     ${chalk.bold(chalk.red('Error: '))} ${chalk.red(this.getError(id))}`)
    }

    const printSeparator = (): void => {
      this.log(`\n=============================\n`)
    }

    printSeparator()

    const id = stackId.toString()
    this.log(`  ${chalk.bold(chalk.blue(stackName))}, ID: ${chalk.bold(id)}, ${this.date()}`)

    const stack = await this.getStack(id)

    if (this.hasError(id)) {
      showError(id)
      printSeparator()
      return null
    }

    await this.stopStack(stack)

    if (this.hasError(id)) {
      showError(id)
      if (this.getError(id)?.includes('is already inactive')) {
        this.clearError(id)
      } else {
        // continue to next stack unless stack is already inactive (docker compose is already stopped, we still want to start it)
        printSeparator()
        return null
      }
    }

    if (repull) {
      await this.pullLatest(stack)

      if (this.hasError(id)) {
        showError(id)
        printSeparator()
        return null
      }
    }

    await this.startStack(stack)

    if (this.hasError(id)) {
      showError(id)
      printSeparator()
      return null
    }

    this.log(`     ${chalk.bold(chalk.green('Done: '))} ${chalk.green(stackName)}`)

    printSeparator()
  }

  async run(): Promise<void> {
    if (this.PORTAINER_URL === '' || this.PORTAINER_ACCESS_TOKEN === undefined) {
      this.error('PORTAINER_URL and PORTAINER_ACCESS_TOKEN must be set in .env')
    }
    const {flags} = await this.parse(ResetDC)
    const {privateKeyPath, repull, singleStack} = flags

    const entryMessage = singleStack
      ? `Resetting docker compose stack ${singleStack} in joeserver Portainer`
      : 'Resetting all docker compose stacks in joeserver Portainer'
    this.log(`
=====================
|
| ${chalk.bold(entryMessage)}
| ${this.date()}
|
=====================\n`)

    if (privateKeyPath && repull) {
      await this.ssh.connect({
        ...SSH_CONFIG,
        privateKeyPath,
      })
    } else if (repull && !privateKeyPath) {
      this.error('--repull requires --privateKeyPath')
    }

    const [url, options] = this.basePortainerRequest('stacks', 'GET')
    const stacks = await fetch(url, options).then((res) => res.json())

    if (singleStack) {
      const stack = stacks.find((stack: any) => stack.Name === singleStack)

      if (!stack) {
        this.error(`Stack ${singleStack} not found`)
      }

      await this.resetStack(stack.Id, stack.Name)
    } else {
      for (const stack of stacks) {
        await this.resetStack(stack.Id, stack.Name)
      }
    }

    this.exit()
  }
}
