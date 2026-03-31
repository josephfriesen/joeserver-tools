import * as fs from 'node:fs'
import * as path from 'node:path'

import {expect} from 'chai'
import {runCommand} from '@oclif/test'

import {MANIFEST_FILENAME} from '../../../src/dap/library.js'
import {makeTempHome, writeAudioFile} from './helpers.js'

describe('dap state rebuild', () => {
  it('rebuilds local manifest', async () => {
    const home = makeTempHome('dap-rebuild-')
    const localRoot = path.join(home, 'Music', 'DAP')
    writeAudioFile(localRoot, 'Artist/Album/01 - Song.mp3')
    process.env.HOME = home
    delete process.env.DAP_MOUNT_PATH
    const ctx = await runCommand(['dap', 'state', 'rebuild', '--target=local'])
    expect(ctx.stdout).to.contain('Local: 1 songs')
    expect(fs.existsSync(path.join(process.env.HOME!, 'Music', 'DAP', MANIFEST_FILENAME))).to.equal(true)
  })
})
