import {Command, Flags, Interfaces} from '@oclif/core'
import chalk from 'chalk'
import {NodeSSH} from 'node-ssh'

import {SSH_CONFIG} from './constants/ssh.js'

enum LogLevel {
  debug = 'debug',
  error = 'error',
  info = 'info',
  warn = 'warn',
}

export type Flags<T extends typeof Command> = Interfaces.InferredFlags<(typeof BaseCommand)['baseFlags'] & T['flags']>
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>

export abstract class BaseCommand<T extends typeof Command> extends Command {
  // add the --json flag
  static enableJsonFlag = true

  // define flags that can be inherited by any command that extends BaseCommand
  static baseFlags = {
    'log-level': Flags.custom<LogLevel>({
      summary: 'Specify level for logging.',
      options: Object.values(LogLevel),
      helpGroup: 'GLOBAL',
    })(),
    privateKeyPath: Flags.string({
      char: 'k',
      default: SSH_CONFIG.privateKeyPath,
      description: 'Path to private SSH key for authentiating as root user on joeserver. Defaults to ~/.ssh/id_ed25519',
    }),
  }

  protected flags!: Flags<T>
  protected args!: Args<T>
  protected ssh!: NodeSSH

  public async init(): Promise<void> {
    await super.init()
    const {args, flags} = await this.parse({
      baseFlags: (super.ctor as typeof BaseCommand).baseFlags,
      flags: this.ctor.flags,
      args: this.ctor.args,
      enableJsonFlag: this.ctor.enableJsonFlag,
      strict: this.ctor.strict,
    })
    this.flags = flags as Flags<T>
    this.args = args as Args<T>

    this.ssh = new NodeSSH()

    // for (const [key, value] of Object.entries(flags)) {
    //   this.log(`  ${key}: ${value}`)
    // }

    await this.ssh.connect({
      ...SSH_CONFIG,
      privateKeyPath: flags.privateKeyPath,
    })

    this.log(`\n ${chalk.green('==== SSH connection to joeserver established ====')} \n\n`)
  }

  protected async catch(err: Error & {exitCode?: number}): Promise<any> {
    // add any custom logic to handle errors from the command
    // or simply return the parent class error handling
    return super.catch(err)
  }

  protected async finally(_: Error | undefined): Promise<any> {
    // called after run and catch regardless of whether or not the command errored
    return super.finally(_)
  }

  get date(): string {
    return new Date().toLocaleString()
  }
}
