import * as fs from 'node:fs'
import * as path from 'node:path'

import {expect} from 'chai'

import {
  buildSyncPlan,
  inspectLibrary,
  isManifestFresh,
  rebuildManifest,
  scanLibrary,
} from '../../../src/dap/library.js'
import {makeTempHome, writeAudioFile} from './helpers.js'

describe('dap manifest helpers', () => {
  it('rebuilds and detects stale manifests from size changes', () => {
    const home = makeTempHome('dap-manifest-')
    const rootPath = path.join(home, 'Music', 'DAP')
    writeAudioFile(rootPath, 'Artist/Album/01 - Song.mp3', 'one')

    const manifest = rebuildManifest(rootPath)
    expect(isManifestFresh(rootPath, manifest)).to.equal(true)

    fs.writeFileSync(path.join(rootPath, 'Artist/Album/01 - Song.mp3'), 'updated audio payload')
    expect(isManifestFresh(rootPath, manifest)).to.equal(false)
    expect(inspectLibrary(rootPath).manifestState).to.equal('stale')
  })

  it('plans copy and exact sync operations', () => {
    const home = makeTempHome('dap-plan-')
    const sourceRoot = path.join(home, 'source')
    const destinationRoot = path.join(home, 'dest')
    writeAudioFile(sourceRoot, 'Artist/Album/01 - Song.mp3', 'one')
    writeAudioFile(destinationRoot, 'Artist/Album/02 - Extra.mp3', 'two')

    const copyPlan = buildSyncPlan(scanLibrary(sourceRoot), scanLibrary(destinationRoot), false)
    expect(copyPlan.toCopy).to.deep.equal(['Artist/Album/01 - Song.mp3'])
    expect(copyPlan.toDelete).to.deep.equal([])

    const exactPlan = buildSyncPlan(scanLibrary(sourceRoot), scanLibrary(destinationRoot), true)
    expect(exactPlan.toDelete).to.deep.equal(['Artist/Album/02 - Extra.mp3'])
  })
})
