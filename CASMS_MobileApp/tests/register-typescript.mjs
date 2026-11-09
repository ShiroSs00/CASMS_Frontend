import { registerHooks } from 'node:module';

// Match Metro's extension resolution for pure TypeScript modules under Node.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
    try { return nextResolve(`${specifier}.ts`, context); }
    catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
  }
  return nextResolve(specifier, context);
} });
