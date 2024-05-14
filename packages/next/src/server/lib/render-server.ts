import type { NextServer, RequestHandler } from '../next'

import next from '../next'
import { PropagateToWorkersField } from './router-utils/types'

const result: Record<
  string,
  | undefined
  | {
      requestHandler: ReturnType<
        InstanceType<typeof NextServer>['getRequestHandler']
      >
      upgradeHandler: ReturnType<
        InstanceType<typeof NextServer>['getUpgradeHandler']
      >
    }
> = {}

let apps: Record<string, ReturnType<typeof next> | undefined> = {}

let sandboxContext: undefined | typeof import('../web/sandbox/context')
let requireCacheHotReloader:
  | undefined
  | typeof import('../../build/webpack/plugins/nextjs-require-cache-hot-reloader')

if (process.env.NODE_ENV !== 'production') {
  sandboxContext = require('../web/sandbox/context')
  requireCacheHotReloader = require('../../build/webpack/plugins/nextjs-require-cache-hot-reloader')
}

export function clearModuleContext(target: string) {
  return sandboxContext?.clearModuleContext(target)
}

export function deleteAppClientCache() {
  return requireCacheHotReloader?.deleteAppClientCache()
}

export function deleteCache(filePaths: string[]) {
  for (const filePath of filePaths) {
    requireCacheHotReloader?.deleteCache(filePath)
  }
}

export async function propagateServerField(
  dir: string,
  field: PropagateToWorkersField,
  value: any
) {
  const app = apps[dir]
  if (!app) {
    throw new Error('Invariant cant propagate server field, no app initialized')
  }
  let appField = (app as any).server

  if (appField) {
    if (typeof appField[field] === 'function') {
      await appField[field].apply(
        (app as any).server,
        Array.isArray(value) ? value : []
      )
    } else {
      appField[field] = value
    }
  }
}

export async function initialize(opts: {
  dir: string
  port: number
  dev: boolean
  minimalMode?: boolean
  hostname?: string
  isNodeDebugging: boolean
  keepAliveTimeout?: number
  serverFields?: any
  server?: any
  experimentalTestProxy: boolean
  experimentalHttpsServer: boolean
  _ipcPort?: string
  _ipcKey?: string
}) {
  // if we already setup the server return as we only need to do
  // this on first worker boot
  if (result[opts.dir]) {
    return result[opts.dir]
  }

  const type = process.env.__NEXT_PRIVATE_RENDER_WORKER
  if (type) {
    process.title = 'next-render-worker-' + type
  }

  let requestHandler: RequestHandler
  let upgradeHandler: any

  const app = next({
    ...opts,
    hostname: opts.hostname || 'localhost',
    customServer: false,
    httpServer: opts.server,
    port: opts.port,
    isNodeDebugging: opts.isNodeDebugging,
  })
  apps[opts.dir] = app
  requestHandler = app.getRequestHandler()
  upgradeHandler = app.getUpgradeHandler()

  await app.prepare(opts.serverFields)

  result[opts.dir] = {
    requestHandler,
    upgradeHandler,
  }
  return result[opts.dir]
}
