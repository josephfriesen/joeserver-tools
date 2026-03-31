#!/usr/bin/env node

async function main() {
  const {execute} = await import('@oclif/core')
  const {handle} = await import('@oclif/core/handle')

  try {
    await execute({dir: import.meta.url})
  } catch (error) {
    await handle(error)
  }
}

await main()
