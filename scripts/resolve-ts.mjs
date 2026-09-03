// src/ imports are extensionless (bundler resolution); node's ESM loader wants
// the extension. Retry any relative specifier as ".ts" so the verify scripts
// can import application modules directly.
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      try {
        return next(`${specifier}.ts`, context)
      } catch {
        // fall through to the original specifier's own error
      }
    }
    return next(specifier, context)
  },
})
