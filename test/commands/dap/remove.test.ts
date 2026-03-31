import * as fs from 'node:fs'
import * as path from 'node:path'

import {expect} from 'chai'
import {runCommand} from '@oclif/test'

import {readManifest, rebuildManifest} from '../../../src/dap/library.js'
import {makeTempHome, writeAudioFile} from './helpers.js'

describe('dap remove', () => {
  it('shows a destructive confirmation error in non-interactive mode by default', async () => {
    const home = makeTempHome('dap-remove-confirm-')
    const localRoot = path.join(home, 'Music', 'DAP')
    writeAudioFile(localRoot, 'Artist/Album/01 - Song.mp3', 'one')
    rebuildManifest(localRoot)
    process.env.HOME = home
    const ctx = await runCommand(['dap', 'remove', path.join(localRoot, 'Artist', 'Album')])
    expect(ctx.stdout).to.contain('Local album removal plan:')
    expect(ctx.error?.message).to.contain('requires an interactive terminal for confirmation')
  })

  it('removes a staged album by managed path with --confirm', async () => {
    const home = makeTempHome('dap-remove-local-')
    const localRoot = path.join(home, 'Music', 'DAP')
    const albumRoot = path.join(localRoot, 'Artist', 'Album')
    writeAudioFile(localRoot, 'Artist/Album/01 - Song.mp3', 'one')
    writeAudioFile(localRoot, 'Artist/Album/02 - Song.mp3', 'two')
    rebuildManifest(localRoot)
    process.env.HOME = home

    const ctx = await runCommand(['dap', 'remove', albumRoot, '--confirm'])

    expect(ctx.stdout).to.contain('Removed Artist / Album.')
    expect(fs.existsSync(albumRoot)).to.equal(false)
    const manifest = readManifest(localRoot)
    expect(manifest?.summary.songCount).to.equal(0)
    expect(manifest?.summary.albumCount).to.equal(0)
  })
})
