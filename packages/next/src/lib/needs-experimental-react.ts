import type { NextConfig } from '../server/config-shared'

export function needsExperimentalReact(config: NextConfig) {
  return Boolean(config.experimental?.serverActions || config.experimental?.ppr)
}
