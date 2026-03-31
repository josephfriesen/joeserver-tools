import {expect} from 'chai'
import {runCommand} from '@oclif/test'

describe('rclone', () => {
  it('loads the command module', async () => {
    const ctx = await runCommand(['help', 'rclone'])
    expect(ctx.stdout).to.contain('rclone')
  })
})
