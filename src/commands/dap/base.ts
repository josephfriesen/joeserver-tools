import {execSync} from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import {Command} from '@oclif/core'

const DAP_VOLUME_NAME = 'ECHO MINI'
const LOCAL_DAP_SUBDIR = path.join('Music', 'DAP')
const DEVICE_DAP_SUBDIR_NAME = 'TUNES'
export const DEVICE_DAP_SUBDIR = DEVICE_DAP_SUBDIR_NAME

function getOverrideMount(): string | null {
  const mount = process.env.DAP_MOUNT_PATH?.trim()
  if (!mount) return null
  return mount
}

function findDapMount(): string | null {
  const overrideMount = getOverrideMount()
  if (overrideMount) {
    return fs.existsSync(overrideMount) ? overrideMount : null
  }

  const platform = os.platform()

  if (platform === 'darwin') {
    const candidate = path.join('/Volumes', DAP_VOLUME_NAME)
    return fs.existsSync(candidate) ? candidate : null
  }

  if (platform === 'linux') {
    const username = os.userInfo().username
    const candidates = [
      path.join('/media', username, DAP_VOLUME_NAME),
      path.join('/run/media', username, DAP_VOLUME_NAME),
    ]
    return candidates.find((p) => fs.existsSync(p)) ?? null
  }

  if (platform === 'win32') {
    const psCommand =
      "Get-Volume | Where-Object { $_.FileSystemLabel -eq 'ECHO MINI' } | Select-Object -ExpandProperty DriveLetter"

    try {
      // Query drive labels via wmic and find the matching drive letter
      const output = execSync('wmic logicaldisk get DeviceID,VolumeName', {encoding: 'utf8'})
      for (const line of output.split('\n')) {
        const parts = line.trim().split(/\s{2,}/)
        if (parts.length >= 2 && parts[1].trim() === DAP_VOLUME_NAME) {
          const driveLetter = parts[0].trim()
          return driveLetter ? `${driveLetter}\\` : null
        }
      }
    } catch {
      // wmic unavailable or failed
    }

    try {
      const output = execSync(`powershell -NoProfile -Command "${psCommand}"`, {encoding: 'utf8'}).trim()
      if (output) {
        return `${output}:\\`
      }
    } catch {
      // powershell unavailable or failed
    }

    return null
  }

  return null
}

export function getLocalLibraryRoot(): string {
  return path.join(os.homedir(), LOCAL_DAP_SUBDIR)
}

export function getDeviceLibraryPath(mountPath: string): string {
  return path.join(mountPath, DEVICE_DAP_SUBDIR)
}

export type DeviceConnection = {
  connected: boolean
  libraryPath: string | null
  mountPath: string | null
}

export abstract class DapBaseCommand extends Command {
  static hidden = true

  protected dapMount: string | null = null
  protected localLibraryRoot = getLocalLibraryRoot()

  public async init(): Promise<void> {
    await super.init()
    this.dapMount = findDapMount()
  }

  protected checkDeviceConnection(): DeviceConnection {
    if (!this.dapMount) {
      return {connected: false, libraryPath: null, mountPath: null}
    }

    return {
      connected: true,
      libraryPath: getDeviceLibraryPath(this.dapMount),
      mountPath: this.dapMount,
    }
  }

  protected requireDeviceConnection(): string {
    const connection = this.checkDeviceConnection()
    if (!connection.connected || !connection.libraryPath) {
      this.error(`DAP (${DAP_VOLUME_NAME}) not found. Please connect your Echo Mini via USB and try again.`, {
        exit: 1,
      })
    }

    return connection.libraryPath
  }
}
