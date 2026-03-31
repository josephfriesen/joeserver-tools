import * as fs from 'node:fs'
import * as path from 'node:path'

import {expect} from 'chai'
import {runCommand} from '@oclif/test'

import {makeTempHome, writeAudioFile} from './helpers.js'

describe('dap sync', () => {
  it('prints a dry run sync plan when requested', async () => {
    const home = makeTempHome('dap-sync-')
    const localRoot = path.join(home, 'Music', 'DAP')
    const mountRoot = path.join(home, 'mount')
    writeAudioFile(localRoot, 'Artist/Album/01 - Song.mp3', 'one')
    fs.mkdirSync(mountRoot, {recursive: true})
    process.env.HOME = home
    process.env.DAP_MOUNT_PATH = mountRoot
    const ctx = await runCommand(['dap', 'sync', '--direction=local-to-device', '--dry-run'])
    expect(ctx.stdout).to.contain('Dry run: yes')
    expect(ctx.stdout).to.contain('Copy/update: 1')
    expect(ctx.stdout).to.contain('Dry run only. No changes applied.')
  })

  it('fails cleanly when device is disconnected', async () => {
    const home = makeTempHome('dap-sync-missing-')
    process.env.HOME = home
    process.env.DAP_MOUNT_PATH = path.join(home, 'definitely-not-mounted')
    const ctx = await runCommand(['dap', 'sync', '--direction=local-to-device'])
    expect(ctx.error?.message).to.contain('DAP (ECHO MINI) not found')
  })

  it('shows a friendly error when direction is omitted', async () => {
    const home = makeTempHome('dap-sync-direction-')
    process.env.HOME = home
    process.env.DAP_MOUNT_PATH = path.join(home, 'definitely-not-mounted')
    const ctx = await runCommand(['dap', 'sync'])
    expect(ctx.error?.message).to.contain('Choose a sync direction')
    expect(ctx.error?.message).to.contain('--direction=local-to-device')
    expect(ctx.error?.message).to.contain('--direction=device-to-local')
  })

  it('prints the plan and asks for interactive confirmation by default', async () => {
    const home = makeTempHome('dap-sync-confirm-')
    const localRoot = path.join(home, 'Music', 'DAP')
    const mountRoot = path.join(home, 'mount')
    writeAudioFile(localRoot, 'Artist/Album/01 - Song.mp3', 'one')
    fs.mkdirSync(mountRoot, {recursive: true})
    process.env.HOME = home
    process.env.DAP_MOUNT_PATH = mountRoot
    const ctx = await runCommand(['dap', 'sync', '--direction=local-to-device'])
    expect(ctx.stdout).to.contain('Dry run: no')
    expect(ctx.stdout).to.contain('Copy/update: 1')
    expect(ctx.error?.message).to.contain('confirmation requires an interactive terminal')
  })
})
