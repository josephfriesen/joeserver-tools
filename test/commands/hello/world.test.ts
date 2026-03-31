import {expect} from 'chai'
import {runCommand} from '@oclif/test'

describe('hello world', () => {
  it('runs hello world cmd', async () => {
    const ctx = await runCommand(['hello', 'world'])
    expect(ctx.stdout).to.contain('hello world!')
  })
})
