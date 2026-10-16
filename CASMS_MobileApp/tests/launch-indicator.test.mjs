import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Load pure geometry through the same TypeScript source without changing Metro's
// extensionless import convention or introducing a native test runtime.
const require = createRequire(import.meta.url);
function loadSource(name, dependencies = {}) {
  const source = readFileSync(new URL(`../src/features/launch/${name}.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const module = { exports: {} };
  runInNewContext(outputText, { module, exports: module.exports, require: name => dependencies[name] ?? require(name) });
  return module.exports;
}
const geometry = loadSource('material-shapes');
const { indicatorPath, LOOP_STEPS } = loadSource('indicator-motion', { './material-shapes': geometry });

test('loading morph produces finite closed paths at start, each shape transition and loop boundary', () => {
  const shapes = geometry.getShapes();
  assert.equal(shapes.length, geometry.SHAPE_COUNT);
  for (const phase of [0, .5, 1, 6.999, 7, LOOP_STEPS - .001, LOOP_STEPS]) {
    const path = indicatorPath(shapes, phase);
    assert.match(path, /^M.+Z$/);
    assert.doesNotMatch(path, /NaN|Infinity|undefined/);
  }
});
test('mount/resume clock values keep the initial shape valid instead of crashing', () => {
  const shapes = geometry.getShapes();
  const initial = indicatorPath(shapes, 0);
  for (const value of [NaN, Infinity, -Infinity, -1]) assert.equal(indicatorPath(shapes, value), initial);
  assert.equal(indicatorPath([], 0), '');
});
