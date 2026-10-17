import path from 'node:path'
import { fileURLToPath } from 'node:url'

import eslint from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const srcRoot = fileURLToPath(new URL('./src', import.meta.url))

function toPosix(value) {
  return value.split(path.sep).join('/')
}

function classifyPath(absolutePath) {
  const relativePath = toPosix(path.relative(srcRoot, absolutePath))

  if (
    relativePath === '' ||
    relativePath === '..' ||
    relativePath.startsWith('../') ||
    path.isAbsolute(relativePath)
  ) {
    return null
  }

  const [layer, moduleName] = relativePath.split('/')

  if (layer === 'features' || layer === 'domain') {
    return { layer, moduleName, relativePath }
  }

  if (layer === 'app' || layer === 'shared' || layer === 'styles') {
    return { layer, moduleName: null, relativePath }
  }

  return { layer: 'root', moduleName: null, relativePath }
}

function resolveLocalImport(importerPath, specifier) {
  if (specifier === '@') {
    return srcRoot
  }

  if (specifier.startsWith('@/')) {
    return path.resolve(srcRoot, specifier.slice(2))
  }

  if (specifier.startsWith('.')) {
    return path.resolve(path.dirname(importerPath), specifier)
  }

  return null
}

function isPublicEntry(target) {
  if (target.moduleName === null) {
    return false
  }

  const moduleRoot = `${target.layer}/${target.moduleName}`

  return (
    target.relativePath === moduleRoot ||
    target.relativePath === `${moduleRoot}/index` ||
    target.relativePath === `${moduleRoot}/index.ts` ||
    target.relativePath === `${moduleRoot}/index.tsx`
  )
}

const architecturePlugin = {
  rules: {
    boundaries: {
      meta: {
        type: 'problem',
        docs: {
          description: 'Enforce CASMS Web layer direction and public module entries',
        },
        schema: [],
        messages: {
          featureLayer:
            'A feature may not import app code or another feature module ({{importPath}}).',
          domainLayer:
            'A domain module may only import its own module, shared code, or external packages ({{importPath}}).',
          sharedLayer:
            'Shared code may not import app, feature, or domain code ({{importPath}}).',
          deepImport:
            'Import {{importPath}} through the public entry for {{targetLayer}}/{{targetModule}}.',
        },
      },
      create(context) {
        const importerPath = context.filename
        const importer = classifyPath(importerPath)

        if (importer === null) {
          return {}
        }

        function inspectImport(node) {
          const specifier = node.source?.value

          if (typeof specifier !== 'string') {
            return
          }

          const resolvedImport = resolveLocalImport(importerPath, specifier)

          if (resolvedImport === null) {
            return
          }

          const target = classifyPath(resolvedImport)

          if (target === null) {
            return
          }

          const targetsAnotherModule =
            importer.layer !== target.layer || importer.moduleName !== target.moduleName

          if (
            importer.layer === 'features' &&
            (target.layer === 'app' ||
              (target.layer === 'features' && importer.moduleName !== target.moduleName))
          ) {
            context.report({
              node,
              messageId: 'featureLayer',
              data: { importPath: specifier },
            })
            return
          }

          if (
            importer.layer === 'domain' &&
            (target.layer === 'app' ||
              target.layer === 'features' ||
              (target.layer === 'domain' && importer.moduleName !== target.moduleName))
          ) {
            context.report({
              node,
              messageId: 'domainLayer',
              data: { importPath: specifier },
            })
            return
          }

          if (
            importer.layer === 'shared' &&
            (target.layer === 'app' || target.layer === 'features' || target.layer === 'domain')
          ) {
            context.report({
              node,
              messageId: 'sharedLayer',
              data: { importPath: specifier },
            })
            return
          }

          if (
            targetsAnotherModule &&
            (target.layer === 'features' || target.layer === 'domain') &&
            !isPublicEntry(target)
          ) {
            context.report({
              node,
              messageId: 'deepImport',
              data: {
                importPath: specifier,
                targetLayer: target.layer,
                targetModule: target.moduleName,
              },
            })
          }
        }

        return {
          ExportAllDeclaration: inspectImport,
          ExportNamedDeclaration: inspectImport,
          ImportDeclaration: inspectImport,
          ImportExpression: inspectImport,
        }
      },
    },
  },
}

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      architecture: architecturePlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      'architecture/boundaries': 'error',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['eslint.config.js', 'vite.config.ts', '**/*.test.{js,mjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
)
