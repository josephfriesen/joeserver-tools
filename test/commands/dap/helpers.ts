import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import {MANIFEST_FILENAME} from '../../../src/dap/library.js'

export function makeTempHome(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  fs.mkdirSync(path.join(root, 'Music'), {recursive: true})
  return root
}

export function writeAudioFile(rootPath: string, relativePath: string, contents = 'audio'): string {
  const absolutePath = path.join(rootPath, relativePath)
  fs.mkdirSync(path.dirname(absolutePath), {recursive: true})
  fs.writeFileSync(absolutePath, contents)
  return absolutePath
}

export function writeManifest(rootPath: string): void {
  fs.mkdirSync(rootPath, {recursive: true})
  fs.writeFileSync(path.join(rootPath, MANIFEST_FILENAME), '{}')
}
