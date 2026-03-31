#!/usr/bin/env -S node --loader ts-node/esm --no-warnings=ExperimentalWarning

// eslint-disable-next-line node/shebang
async function main() {
  const {execute} = await import('@oclif/core')
  const {handle} = await import('@oclif/core/handle')

  try {
    await execute({development: true, dir: import.meta.url})
  } catch (error) {
    await handle(error)
  }
}

await main()
