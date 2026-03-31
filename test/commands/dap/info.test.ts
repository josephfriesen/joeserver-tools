import * as path from 'node:path'

import {expect} from 'chai'
import {runCommand} from '@oclif/test'

import {rebuildManifest} from '../../../src/dap/library.js'
import {makeTempHome, writeAudioFile} from './helpers.js'

describe('dap info', () => {
  it('reports local stats and warns when device is disconnected', async () => {
    const home = makeTempHome('dap-info-')
    const localRoot = path.join(home, 'Music', 'DAP')
    writeAudioFile(localRoot, 'Artist/Album/01 - Song.mp3', 'one')
    rebuildManifest(localRoot)
    process.env.HOME = home
    process.env.DAP_MOUNT_PATH = path.join(home, 'definitely-not-mounted')
    const ctx = await runCommand(['dap', 'info'])
    expect(ctx.stdout).to.contain('Local library:')
    expect(ctx.stdout).to.contain('Songs: 1')
    expect(ctx.stderr || ctx.stdout).to.contain('Device is not connected')
  })

  it('reports device diffs when connected', async () => {
    const home = makeTempHome('dap-info-device-')
    const localRoot = path.join(home, 'Music', 'DAP')
    const mountRoot = path.join(home, 'mount')
    const deviceRoot = path.join(mountRoot, 'TUNES')
    writeAudioFile(localRoot, 'Artist/Album/01 - Song.mp3', 'one')
    writeAudioFile(deviceRoot, 'Artist/Album/02 - Device Song.mp3', 'two')
    rebuildManifest(localRoot)
    rebuildManifest(deviceRoot)
    process.env.HOME = home
    process.env.DAP_MOUNT_PATH = mountRoot
    const ctx = await runCommand(['dap', 'info'])
    expect(ctx.stdout).to.contain('Device library:')
    expect(ctx.stdout).not.to.contain('Diff:')
    expect(ctx.stdout).not.to.contain('Only on device:')
  })

  it('shows diff output first when --diff is requested', async () => {
    const home = makeTempHome('dap-info-diff-')
    const localRoot = path.join(home, 'Music', 'DAP')
    const mountRoot = path.join(home, 'mount')
    const deviceRoot = path.join(mountRoot, 'TUNES')
    writeAudioFile(localRoot, 'Artist/Album/01 - Song.mp3', 'one')
    writeAudioFile(deviceRoot, 'Artist/Album/02 - Device Song.mp3', 'two')
    rebuildManifest(localRoot)
    rebuildManifest(deviceRoot)
    process.env.HOME = home
    process.env.DAP_MOUNT_PATH = mountRoot
    const ctx = await runCommand(['dap', 'info', '--diff'])
    expect(ctx.stdout).to.contain('Diff:')
    expect(ctx.stdout).to.contain('Only on device: 1')
    expect(ctx.stdout).to.contain('Only in local: 1')
    expect(ctx.stdout).not.to.contain('Different on both sides = same managed path exists in both libraries')
    expect(ctx.stdout).not.to.contain('Different on both sides: 0')
    expect(ctx.stdout.indexOf('Diff:')).to.be.lessThan(ctx.stdout.indexOf('Local library:'))
  })
})
