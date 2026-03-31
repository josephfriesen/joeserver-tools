import * as fs from 'node:fs'
import * as path from 'node:path'

import {expect} from 'chai'
import {runCommand} from '@oclif/test'

import {MANIFEST_FILENAME, readManifest} from '../../../src/dap/library.js'
import {makeTempHome, writeAudioFile} from './helpers.js'

describe('dap clear', () => {
  it('shows a destructive confirmation error in non-interactive mode by default', async () => {
    const home = makeTempHome('dap-clear-confirm-')
    const localRoot = path.join(home, 'Music', 'DAP')
    writeAudioFile(localRoot, 'Artist/Album/01 - Song.mp3', 'one')
    process.env.HOME = home
    const ctx = await runCommand(['dap', 'clear', '--target=local'])
    expect(ctx.stdout).to.contain('Destructive reset plan:')
    expect(ctx.error?.message).to.contain('requires an interactive terminal for confirmation')
  })

  it('clears the local library with --confirm', async () => {
    const home = makeTempHome('dap-clear-local-')
    const localRoot = path.join(home, 'Music', 'DAP')
    writeAudioFile(localRoot, 'Artist/Album/01 - Song.mp3', 'one')
    process.env.HOME = home
    const ctx = await runCommand(['dap', 'clear', '--target=local', '--confirm'])
    expect(ctx.stdout).to.contain('Reset complete.')
    expect(fs.existsSync(path.join(localRoot, 'Artist'))).to.equal(false)
    const manifest = readManifest(localRoot)
    expect(manifest?.summary.songCount).to.equal(0)
    expect(manifest?.summary.albumCount).to.equal(0)
    expect(fs.existsSync(path.join(localRoot, MANIFEST_FILENAME))).to.equal(true)
  })

  it('clears the device library with --confirm', async () => {
    const home = makeTempHome('dap-clear-device-')
    const mountRoot = path.join(home, 'mount')
    const deviceRoot = path.join(mountRoot, 'TUNES')
    writeAudioFile(deviceRoot, 'Artist/Album/01 - Song.mp3', 'one')
    fs.mkdirSync(mountRoot, {recursive: true})
    process.env.HOME = home
    process.env.DAP_MOUNT_PATH = mountRoot
    const ctx = await runCommand(['dap', 'clear', '--target=device', '--confirm'])
    expect(ctx.stdout).to.contain('device /TUNES library')
    const manifest = readManifest(deviceRoot)
    expect(manifest?.summary.songCount).to.equal(0)
  })
})
