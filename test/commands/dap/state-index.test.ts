import {expect} from 'chai'
import {runCommand} from '@oclif/test'

describe('dap state index', () => {
  it('shows the manifest-oriented dap state landing page', async () => {
    const ctx = await runCommand(['dap', 'state'])
    expect(ctx.stdout).to.contain('DAP state commands')
    expect(ctx.stdout).to.contain('.dap-state.json')
    expect(ctx.stdout).to.contain('dap state rebuild')
  })

  it('shows the state command list in help output', async () => {
    const ctx = await runCommand(['dap', 'state', '--help'])
    expect(ctx.stdout).to.contain('Available commands:')
    expect(ctx.stdout).to.contain('dap state rebuild')
  })
})
