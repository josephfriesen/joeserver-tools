import * as fs from 'node:fs'
import * as path from 'node:path'

import {expect} from 'chai'
import {runCommand} from '@oclif/test'

import {makeTempHome} from './helpers.js'

describe('dap eject', () => {
  it('fails cleanly when device is disconnected', async () => {
    const home = makeTempHome('dap-eject-missing-')
    process.env.HOME = home
    process.env.DAP_MOUNT_PATH = path.join(home, 'definitely-not-mounted')
    const ctx = await runCommand(['dap', 'eject'])
    expect(ctx.error?.message).to.contain('DAP (ECHO MINI) not found')
  })

  it('requires confirmation in non-interactive mode by default', async () => {
    const home = makeTempHome('dap-eject-confirm-')
    const mountRoot = path.join(home, 'mount')
    fs.mkdirSync(mountRoot, {recursive: true})
    process.env.HOME = home
    process.env.DAP_MOUNT_PATH = mountRoot
    const ctx = await runCommand(['dap', 'eject'])
    expect(ctx.stdout).to.contain('Eject plan:')
    expect(ctx.error?.message).to.contain('interactive terminal for confirmation')
  })

  it('ejects in test mode with --confirm', async () => {
    const home = makeTempHome('dap-eject-ok-')
    const mountRoot = path.join(home, 'mount')
    fs.mkdirSync(mountRoot, {recursive: true})
    process.env.HOME = home
    process.env.DAP_MOUNT_PATH = mountRoot
    process.env.DAP_EJECT_TEST_MODE = 'success'
    const ctx = await runCommand(['dap', 'eject', '--confirm'])
    expect(ctx.stdout).to.contain('Echo Mini ejected.')
    delete process.env.DAP_EJECT_TEST_MODE
  })
})
