import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
function compile(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const source = path.join(dir, entry.name);
    if (entry.isDirectory()) { compile(source); continue; }
    if (!source.endsWith('.ts')) continue;
    const target = source.replace(/^src/, '.test-build').replace(/\.ts$/, '.js');
    const output = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
    }).outputText.replace(/(from\s+["'])(\.[^"']+)(["'])/g, (_all,a,b,c)=>a+b+(/\.(json|mjs)$/.test(b)?'':'.js')+c)
      // Vite-only: import.meta.glob (optional bundled files) does not exist in Node; treat it as "no files".
      .replace(/import\.meta\.glob(<[^>]*>)?\(/g, '((..._args) => ({}))(');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, output);
  }
}
compile('src');
// core.test.mjs covers the retired pre-progress combat and recognition APIs;
// the progress-combat and progress-signs suites exercise the running game.
const result = spawnSync(process.execPath, ['--test', 'tests/multiplayer.test.mjs', 'tests/merge.test.mjs', 'tests/progress-combat.test.mjs', 'tests/progress-signs.test.mjs', 'tests/selection.test.mjs', 'tests/effects.test.mjs', 'tests/posture-recorder.test.mjs', 'tests/record-dataset.test.mjs', 'tests/technique-art.test.mjs', 'tests/battle.test.mjs', 'tests/playlist-player.test.mjs', 'tests/voice-audio.test.mjs'], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
