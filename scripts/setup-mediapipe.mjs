// Copies MediaPipe WASM runtime files into public/ and downloads the
// hand landmarker model so both are served locally by Vite.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const wasmDest = join(root, 'public', 'mediapipe', 'wasm');
const modelDest = join(root, 'public', 'mediapipe', 'models', 'hand_landmarker.task');
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

if (!existsSync(wasmSrc)) {
  console.error('[setup-mediapipe] @mediapipe/tasks-vision is not installed. Run npm install first.');
  process.exit(1);
}

mkdirSync(wasmDest, { recursive: true });
cpSync(wasmSrc, wasmDest, { recursive: true });
console.log('[setup-mediapipe] Copied WASM files to public/mediapipe/wasm');

if (existsSync(modelDest)) {
  console.log('[setup-mediapipe] Model already present');
} else {
  mkdirSync(dirname(modelDest), { recursive: true });
  const res = await fetch(MODEL_URL);
  if (!res.ok) {
    console.error(`[setup-mediapipe] Model download failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  writeFileSync(modelDest, Buffer.from(await res.arrayBuffer()));
  console.log('[setup-mediapipe] Downloaded hand_landmarker.task');
}
