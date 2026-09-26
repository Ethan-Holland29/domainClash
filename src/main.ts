import { installLogoCursor } from './LogoCursor';
import { CharacterSelect } from "./characters/CharacterSelect";
import { CombatManager } from "./combat/CombatManager";
import { CombatPanel } from "./combat/CombatPanel";
import "./style.css";
import { CameraManager } from "./camera/CameraManager";
import { HandTracker } from "./handTracking/HandTracker";
import { GestureRecognizer, type GestureEvent } from "./handTracking/GestureRecognizer";
import { HandDebugRenderer } from "./rendering/HandDebugRenderer";
import { DebugHUD } from "./ui/DebugHUD";

import { RecognitionInspector } from "./calibration/RecognitionInspector";
import { AbilityInputBus } from "./input/AbilityInput";
import { RecognitionDemo } from "./calibration/RecognitionDemo";
import { PoseLibrary } from "./calibration/PoseLibrary";
import { SignTrainer } from "./calibration/SignTrainer";
import { GESTURE_LABELS } from "./handTracking/GestureTypes";
import { CHARACTERS } from "./characters/Characters";
import { characterGestures } from "./characters/CharacterTypes";
import {MultiplayerSession} from './multiplayer/MultiplayerSession';
import './multiplayer/multiplayer.css';
import {BattleEffects} from './effects/BattleEffects';
import type {HandOrigin} from './effects/MovePalette';

const app = document.querySelector<HTMLDivElement>("#app")!;
let multiplayer:MultiplayerSession|undefined;
let effects:BattleEffects|undefined;
let handOrigin:HandOrigin|null=null;

app.innerHTML = `
  <div id="technique-reveal" aria-live="polite"></div><section id="character-screen" hidden></section>
  <header class="topbar"><strong>DomainClash</strong><a href="#characters">Change fighter</a><label>Character <select id="character"></select></label><details><summary>Character kit</summary><p id="kit"></p></details><a id="settings-link" href="#gesture-settings">Gesture settings</a><a id="back-to-combat" href="#combat" hidden>← Back to combat</a></header>
  <main class="workspace">
    <section class="camera-column">
      <div class="stage"><video id="webcam" autoplay playsinline></video><canvas id="overlay"></canvas></div>
      <div id="live-feedback" aria-label="Live feedback"><div id="passive-popup" class="passive-popup" role="status" aria-live="polite" hidden><span class="passive-owner"></span><strong class="passive-name"></strong></div><p id="combat-status" role="status"></p></div>
      <div id="hud"></div><button id="camera-retry" hidden>Retry camera</button>
      <p id="ability-status" role="status"></p>
    </section>
    <aside class="controls">
      <nav class="mode-tabs" aria-label="Gesture settings" hidden>
        
        <button data-mode="demo" aria-pressed="false">Test signs</button>
        <button data-mode="inspector" aria-pressed="false">Diagnose</button>
        <button data-mode="trainer" aria-pressed="false">Record</button>
        <button data-mode="manual" aria-pressed="false">Manual</button>
      </nav>
      <div class="panel-area">
        <section id="combat"></section>
        <section id="demo" hidden></section>
        <section id="inspector" hidden></section>
        <section id="trainer" hidden></section>
        <section id="manual" hidden><h2>Manual ability test</h2><p>Send ability inputs without camera recognition. These do not count as passing a sign test.</p><div id="manual-inputs" class="actions"></div></section>
      </div>
    </aside>
  </main>
`;
app.dataset.mode = 'combat';
app.dataset.page = 'combat';
for (const button of app.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
  button.onclick = () => {
    const mode = button.dataset.mode!;
    gestures.update([], performance.now());
    trainer.setMoves(characterGestures(selectedCharacter));
    app.dataset.mode = mode;
    for (const panel of app.querySelectorAll<HTMLElement>('.panel-area > section')) panel.hidden = panel.id !== mode;
    for (const tab of app.querySelectorAll<HTMLButtonElement>('[data-mode]')) tab.setAttribute('aria-pressed', String(tab === button));
  };
}

const videoEl = document.querySelector<HTMLVideoElement>("#webcam")!;
const canvasEl = document.querySelector<HTMLCanvasElement>("#overlay")!;
const hudContainer = document.querySelector<HTMLDivElement>("#hud")!;

const hud = new DebugHUD(hudContainer);
const renderer = new HandDebugRenderer(canvasEl);
const camera = new CameraManager(videoEl);
const tracker = new HandTracker();
const library = new PoseLibrary();
const trainer = new SignTrainer(document.querySelector<HTMLElement>('#trainer')!, library);
const inspector = new RecognitionInspector(document.querySelector<HTMLElement>('#inspector')!, library);
const inputs = new AbilityInputBus();
inputs.subscribe(input => {
  if(multiplayer?.active){void multiplayer.attack(input.gesture);return;}
  if (app.dataset.mode === 'combat') {
    if (input.characterId === combat.character.id) combat.attack(input.gesture);
    combatPanel.render();
    return;
  }
  document.querySelector('#ability-status')!.textContent = `${selectedCharacter.name} — ${GESTURE_LABELS[input.gesture]} input received (${input.source === 'button' ? 'manual test' : 'camera'}). Practice input only.`;
  effects?.play(input.gesture,handOrigin??{x:.5,y:.6},false,selectedCharacter.id);
});
let selectedCharacter = CHARACTERS[0];
const combat = new CombatManager(selectedCharacter);
const combatPanel = new CombatPanel(document.querySelector<HTMLElement>('#combat')!, combat, () => {gestures.update([], performance.now());effects?.clear();});
const characterSelect = document.querySelector<HTMLSelectElement>('#character')!;
characterSelect.innerHTML = CHARACTERS.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
const focus=document.createElement('select');focus.id='gesture-target';focus.setAttribute('aria-label','Gesture focus');
const focusLabel=document.createElement('label');focusLabel.textContent='Gesture focus ';focusLabel.append(focus);document.querySelector('.topbar')!.append(focusLabel);
const gestures = new GestureRecognizer(hands => library.evaluate(hands, videoEl.videoWidth / videoEl.videoHeight || 4/3, focus.value ? [focus.value as typeof selectedCharacter.abilities[number]] : characterGestures(selectedCharacter)));
focus.onchange=()=>gestures.update([],performance.now());
function selectCharacter(): void {
  effects?.clear();
  selectedCharacter = CHARACTERS.find(c => c.id === characterSelect.value)!;
  focus.replaceChildren(new Option('Auto (all moves)',''),...characterGestures(selectedCharacter).map(g=>new Option(GESTURE_LABELS[g],g)));
  combat.reset(selectedCharacter);
  combatPanel.setButtons(g => inputs.send(selectedCharacter, g, 'button'));
  gestures.update([], performance.now());
  trainer.setMoves(characterGestures(selectedCharacter));
  inspector.setMoves(characterGestures(selectedCharacter));
  document.querySelector('#manual-inputs')!.replaceChildren(...characterGestures(selectedCharacter).map(gesture => {
    const button = document.createElement('button'); button.textContent = GESTURE_LABELS[gesture];
    button.onclick = () => inputs.send(selectedCharacter, gesture, 'button');
    return button;
  }));
  if(selectedCharacter.id==='gojo'||selectedCharacter.id==='yuji'){
    const preview=document.createElement('button');const purple=selectedCharacter.id==='gojo';
    preview.textContent=purple?'Hollow Purple (VFX preview)':'Black Flash (VFX preview)';
    preview.onclick=()=>effects?.play(purple?'HOLLOW_PURPLE':'BASIC_PUNCH',handOrigin??{x:.5,y:.6},false,selectedCharacter.id,0,!purple);
    document.querySelector('#manual-inputs')!.append(preview);
  }
  document.querySelector('#kit')!.textContent = `Shared attack and abilities${selectedCharacter.abilityGroup ? ` — ${selectedCharacter.abilityGroup}` : ""}: ${selectedCharacter.abilities.map(g => GESTURE_LABELS[g]).join(', ')}. ${selectedCharacter.ultimate?.name ?? 'No active ultimate assigned'}. ${selectedCharacter.plannedKit ? `Planned technique: ${selectedCharacter.plannedKit.technique ?? 'None'}. Planned ultimate: ${selectedCharacter.plannedKit.ultimate ?? 'None for now'}. Combat effects pending. ` : ''}Meter: ${selectedCharacter.meter}.`;
  document.querySelector('#ability-status')!.textContent = 'Select Combat to play or use the other tabs to practice.';
}
characterSelect.onchange = selectCharacter;
selectCharacter();
const demo = new RecognitionDemo(document.querySelector<HTMLElement>('#demo')!, library, locked => {
  characterSelect.disabled = locked;
  for (const tab of app.querySelectorAll<HTMLButtonElement>('[data-mode]')) tab.disabled = locked;
  document.querySelector<HTMLElement>('#manual-inputs')!.inert = locked;
  document.querySelector<HTMLElement>('#trainer')!.inert = locked;
  if (locked) trainer.setMoves(characterGestures(selectedCharacter));
  gestures.update([], performance.now());
});
function applyPage(): void {
  effects?.clear();
  if(multiplayer?.active){if(multiplayer.client.state)multiplayer.update(multiplayer.client.state);return;}
  const selection = !location.hash || location.hash === '#characters';
  document.querySelector<HTMLElement>('#character-screen')!.hidden = !selection;
  document.querySelector<HTMLElement>('.workspace')!.hidden = selection;
  document.querySelector<HTMLElement>('.topbar')!.hidden = selection;
  const settings = location.hash === '#gesture-settings';
  if (demo.active) document.querySelector<HTMLButtonElement>('#demo-stop')!.click();
  gestures.update([], performance.now());
  trainer.setMoves(characterGestures(selectedCharacter));
  app.dataset.page = settings ? 'settings' : 'combat';
  const mode = selection ? 'selection' : settings ? 'demo' : 'combat';
  app.dataset.mode = mode;
  document.querySelector<HTMLElement>('.mode-tabs')!.hidden = !settings;
  document.querySelector<HTMLElement>('#settings-link')!.hidden = settings;
  document.querySelector<HTMLElement>('#back-to-combat')!.hidden = !settings;
  for (const panel of app.querySelectorAll<HTMLElement>('.panel-area > section')) panel.hidden = panel.id !== mode;
  for (const tab of app.querySelectorAll<HTMLButtonElement>('[data-mode]')) tab.setAttribute('aria-pressed', String(tab.dataset.mode === mode));
}
new CharacterSelect(document.querySelector<HTMLElement>('#character-screen')!, id => {
  characterSelect.value = id; selectCharacter(); location.hash = 'combat';
});
multiplayer=new MultiplayerSession(app,combat,combatPanel,videoEl,id=>{characterSelect.value=id;selectCharacter();},()=>bootstrap(),()=>gestures.update([],performance.now()));
effects=new BattleEffects(app.querySelector('.camera-column .stage')!,app.querySelector('.remote-camera-column .stage')!);
combat.onCast=(action,side)=>{if(!multiplayer?.active)effects?.play(action,side==='player'?(handOrigin??{x:.5,y:.6}):{x:.5,y:.3},false,(side==='player'?combat.player:combat.opponent).character.id);};
combat.onBlackFlash=(action,side)=>{if(!multiplayer?.active)effects?.play(action,side==='player'?(handOrigin??{x:.5,y:.6}):{x:.5,y:.3},false,'yuji',0,true);};
multiplayer.onCast=(action,origin,remote,characterId,age,blackFlash)=>effects?.play(action,origin,remote,characterId,age,blackFlash);
effects.debugState=()=>`You: ${combat.player.hp} HP · meter ${combat.player.meter}\nOpponent: ${combat.opponent.hp} HP · meter ${combat.opponent.meter}\nTurn: ${combat.turn} · cooldowns (turns): ${Array.from(combat.player.cooldowns,([id,n])=>`${id} ${Math.max(0,n-combat.player.turns)}`).join(', ')||'none'}`;
multiplayer.onReset=()=>effects?.clear();
window.addEventListener('hashchange', applyPage);
applyPage();
// Move the actual status elements (not copies) beside the camera so live
// feedback never scrolls away with setup controls or accumulated results.
for (const id of ['demo-status', 'inspect-status', 'training-status']) {
  document.querySelector('#live-feedback')!.appendChild(document.getElementById(id)!);
}
let lastVideoTime = -1;
let frameId = 0;
let starting = false;
const retryCamera = document.querySelector<HTMLButtonElement>("#camera-retry")!;
retryCamera.onclick = () => { void bootstrap(); };

gestures.onEvent((event: GestureEvent) => {
  if (event.type === 'confirmed') {
    inputs.send(selectedCharacter, event.gesture, 'camera');
  }
  // Combat can later consume the selected character and this gesture event.
  console.log(`[gesture] ${event.type}: ${event.gesture}`);
});

// Simple rolling FPS estimate for the debug HUD.
let lastFrameTime = performance.now();
let fps = 0;

function updateFps(now: number): void {
  const delta = now - lastFrameTime;
  lastFrameTime = now;
  if (delta > 0) {
    const instantaneous = 1000 / delta;
    fps = fps === 0 ? instantaneous : fps * 0.9 + instantaneous * 0.1;
  }
}

async function detectionLoop(): Promise<void> {
  if(document.hidden||app.dataset.mode==='selection'){
    multiplayer?.telemetry(0,0,camera.isActive);
    frameId=requestAnimationFrame(detectionLoop);return;
  }
  if (videoEl.currentTime === lastVideoTime) { frameId = requestAnimationFrame(detectionLoop); return; }
  lastVideoTime = videoEl.currentTime;
  const now = performance.now();
  updateFps(now);

  let result;
  try{result=await tracker.detectForVideo(videoEl,now);}catch(error){if(disposed)return;console.warn('Tracking interrupted',error);hud.setMessage('Hand tracking interrupted. Click Retry camera to restart it.');retryCamera.hidden=false;return;}
  if(!tracker.isReady)return;
  const palm=result.hands.flatMap(h=>[0,5,8,9,12,17].map(i=>h.landmarks[i]));
  handOrigin=palm.length?{x:palm.reduce((n,p)=>n+p.x,0)/palm.length,y:palm.reduce((n,p)=>n+p.y,0)/palm.length}:null;
  if(multiplayer)multiplayer.handOrigin=handOrigin;
  multiplayer?.telemetry(result.hands.length,fps,true);
  renderer.render(result);
  if (!demo.active && !trainer.active) inspector.update(result.hands, videoEl.videoWidth / videoEl.videoHeight, characterGestures(selectedCharacter), now);

  if (!demo.active) trainer.update(result.hands, now, videoEl.videoWidth / videoEl.videoHeight);
  const gestureState = demo.update(result.hands, now, videoEl.videoWidth / videoEl.videoHeight) ?? gestures.update(
    trainer.active ? [] : result.hands,
    now,
  );

  effects?.charge(!trainer.active&&!demo.active&&!gestureState.confirmedGesture?gestureState.candidateGesture:null,handOrigin,gestureState.holdProgress,selectedCharacter.id);
  hud.update({
    handsDetected: result.hands.length,
    handedness: result.hands.map((h) => `${h.handedness} (${(h.handednessScore * 100).toFixed(0)}%)`),
    fps,
    candidateGesture: gestureState.candidateGesture ? GESTURE_LABELS[gestureState.candidateGesture] : null,
    confirmedGesture: gestureState.confirmedGesture ? GESTURE_LABELS[gestureState.confirmedGesture] : null,
    holdProgress: gestureState.holdProgress,
  });

  frameId = requestAnimationFrame(detectionLoop);
}

async function bootstrap() {
  if(tracker.isReady&&(videoEl.srcObject as MediaStream|null)?.getVideoTracks().some(t=>t.readyState==='live'))return;
  if (starting) return;
  starting = true;
  retryCamera.hidden = true;
  hud.setMessage("Loading hand-tracking model…");

  try {
    if (!tracker.isReady) await tracker.initialize();
  } catch (err) {
    console.error("Failed to load HandLandmarker model:", err);
    hud.setMessage("Hand-tracking model failed to load. Try again.");
    starting = false;
    retryCamera.hidden = false;
    return;
  }

  hud.setMessage("Requesting camera access…");

  try {
    if(!camera.isActive)await camera.start();
  } catch (err) {
    console.error("Failed to start camera:", err);
    starting = false;
    retryCamera.hidden = false;

    if (err instanceof DOMException && err.name === "NotAllowedError") {
      hud.setMessage("Camera permission denied. Allow camera access and reload the page.");
    } else if (err instanceof DOMException && err.name === "NotFoundError") {
      hud.setMessage("No camera found. Connect a webcam and reload the page.");
    } else if (err instanceof DOMException && err.name === "NotReadableError") {
      hud.setMessage("Camera could not start. Close other camera apps or tabs, check your camera connection, then click Retry camera. (NotReadableError)");
    } else if (err instanceof DOMException && err.name === "AbortError") {
      hud.setMessage("Camera startup was interrupted. Click Retry camera. (AbortError)");
    } else {
      hud.setMessage(`Camera could not start: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. Click Retry camera.`);
    }
    return;
  }

  starting = false;
  lastVideoTime = -1;
  trainer.ready();
  demo.ready();
  const { videoWidth, videoHeight } = videoEl;
  videoEl.parentElement!.style.aspectRatio = `${videoWidth} / ${videoHeight}`;
  renderer.resize(videoWidth, videoHeight);
  canvasEl.width = videoWidth;
  canvasEl.height = videoHeight;

  frameId = requestAnimationFrame(detectionLoop);
}

bootstrap();



let lastCombatTime = performance.now();
const combatTimer = window.setInterval(() => {
  const now = performance.now();
  if (!multiplayer?.active && app.dataset.mode === 'combat' && !document.hidden) combat.tick(Math.min(now - lastCombatTime, 250));
  lastCombatTime = now;
  if(!multiplayer?.active)combatPanel.render();
}, 100);
const removeLogoCursor = installLogoCursor();
let disposed=false;
function cleanup(): void {
  disposed=true;
  effects?.dispose();
  multiplayer?.dispose();
  removeLogoCursor();
  clearInterval(combatTimer);
  window.removeEventListener('hashchange', applyPage);
  cancelAnimationFrame(frameId);
  camera.stop();
  tracker.dispose();
}
window.addEventListener("pagehide", cleanup);
if (import.meta.hot) import.meta.hot.dispose(() => {
  window.removeEventListener("pagehide", cleanup);
  cleanup();
});
