import {expect} from 'chai'
import {runCommand} from '@oclif/test'

describe('dap index', () => {
  it('shows the workflow-oriented dap landing page', async () => {
    const ctx = await runCommand(['dap'])
    expect(ctx.stdout).to.contain('Echo Mini DAP workflow')
    expect(ctx.stdout).to.contain('Local library: ~/Music/DAP')
    expect(ctx.stdout).to.contain('dap format')
    expect(ctx.stdout).to.contain('dap sync --direction=local-to-device')
  })

  it('shows the command list in help output', async () => {
    const ctx = await runCommand(['dap', '--help'])
    expect(ctx.stdout).to.contain('Available commands:')
    expect(ctx.stdout).to.contain('dap clear')
    expect(ctx.stdout).to.contain('dap eject')
    expect(ctx.stdout).to.contain('dap format')
    expect(ctx.stdout).to.contain('dap info')
    expect(ctx.stdout).to.contain('dap remove')
    expect(ctx.stdout).to.contain('dap sync')
    expect(ctx.stdout).to.contain('dap state rebuild')
  })
})
