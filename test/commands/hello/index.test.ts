import {expect} from 'chai'
import {runCommand} from '@oclif/test'

describe('hello', () => {
  it('runs hello cmd', async () => {
    const ctx = await runCommand(['hello', 'friend', '--from=oclif'])
    expect(ctx.stdout).to.contain('hello friend from oclif!')
  })
})
