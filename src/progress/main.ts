import { installLogoCursor } from './LogoCursor';
import { installUISounds } from './ui/UISounds';
import { CharacterSelect } from "./characters/CharacterSelect";
import { CombatManager } from "./combat/CombatManager";
import { CombatPanel } from "./combat/CombatPanel";
import "./style.css";
import './integration.css';
import './multiplayer.css';
import { OnlineArena } from './OnlineArena';
import { MoveById } from '../combat/MoveCatalog';
import { GestureDatasetManager } from '../signs/data/GestureDatasetManager';
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

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <div id="technique-reveal" aria-live="polite"></div><section id="character-screen" hidden></section><section id="multiplayer-screen" hidden></section>
  <section id="match-result" role="status" aria-live="assertive" hidden><div class="result-card"><p class="result-player"></p><h2></h2><p class="result-reason"></p></div></section>
  <header class="topbar"><strong>DomainClash</strong><a href="#characters">Change fighter</a><label>Character <select id="character"></select></label><details><summary>Character kit</summary><p id="kit"></p></details><a id="settings-link" href="#gesture-settings">Gesture settings</a><a id="back-to-combat" href="#combat" hidden>← Back to combat</a><a id="online-link" href="#online">Online 1v1</a><button id="camera-toggle">Enable camera</button></header>
  <main class="workspace">
    <section class="camera-column">
      <p id="local-camera-label" class="camera-player-label" hidden>P1 · YOU</p><div class="stage"><video id="webcam" autoplay playsinline muted></video><canvas id="overlay"></canvas></div>
      <div id="live-feedback" aria-label="Live feedback"><div id="passive-popup" class="passive-popup" role="status" aria-live="polite" hidden><span class="passive-owner"></span><strong class="passive-name"></strong></div><p id="combat-status" role="status"></p></div>
      <div id="hud"></div><p id="camera-status" role="status">Enable camera to use hand signs. Buttons work without a camera.</p><button id="camera-retry" hidden>Retry camera</button>
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
        <section id="online" hidden></section>
        <section id="demo" hidden></section>
        <section id="inspector" hidden></section>
        <section id="trainer" hidden></section>
        <section id="manual" hidden><h2>Manual ability test</h2><p>Send ability inputs without camera recognition. These do not count as passing a sign test.</p><div id="manual-inputs" class="actions"></div></section>
      </div>
    </aside>
    <section id="opponent-camera" class="camera-column" hidden><p id="remote-camera-label" class="camera-player-label">P2 · OPPONENT</p><div class="remote-preview stage"><span>OPPONENT CAMERA</span></div><div id="remote-stats" class="debug-hud">Hands detected: — · FPS: — · Waiting for opponent</div><p class="camera-help">Camera preview is shared only with your room opponent.</p></section>
  </main>
`;
app.dataset.mode = 'combat';
app.dataset.page = 'combat';
for (const button of app.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
  button.onclick = () => {
    const mode = button.dataset.mode!;
    gestures.suspend();
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
hud.update({handsDetected:0,handedness:[],fps:0});
const renderer = new HandDebugRenderer(canvasEl);
const camera = new CameraManager(videoEl);
const tracker = new HandTracker();
const library = new PoseLibrary();
const trainer = new SignTrainer(document.querySelector<HTMLElement>('#trainer')!, library);
const inspector = new RecognitionInspector(document.querySelector<HTMLElement>('#inspector')!, library);
const inputs = new AbilityInputBus();
inputs.subscribe(input => {
  if (app.dataset.mode === 'combat' && !online.visible) {
    if (input.characterId === combat.character.id) combat.attack(input.gesture);
    combatPanel.render();
    return;
  }
  document.querySelector('#ability-status')!.textContent = `${selectedCharacter.name} — ${GESTURE_LABELS[input.gesture]} input received (${input.source === 'button' ? 'manual test' : 'camera'}). Practice input only.`;
});
let selectedCharacter = CHARACTERS[0];
const combat = new CombatManager(selectedCharacter);
const combatPanel = new CombatPanel(document.querySelector<HTMLElement>('#combat')!, combat, () => gestures.suspend());
const online = new OnlineArena(document.querySelector<HTMLElement>('#online')!,videoEl,document.querySelector<HTMLElement>('.remote-preview')!,document.querySelector<HTMLElement>('#multiplayer-screen')!);
let onlineLocked=false;
const characterSelect = document.querySelector<HTMLSelectElement>('#character')!;
characterSelect.innerHTML = CHARACTERS.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
const gestures = new GestureRecognizer(() => ({moves:characterGestures(selectedCharacter),aspect:videoEl.videoWidth / videoEl.videoHeight}));
function selectCharacter(): void {
  selectedCharacter = CHARACTERS.find(c => c.id === characterSelect.value)!;
  combat.reset(selectedCharacter);
  online.setCharacter(selectedCharacter.id);
  combatPanel.setButtons(g => inputs.send(selectedCharacter, g, 'button'));
  gestures.suspend();
  trainer.setMoves(characterGestures(selectedCharacter));
  inspector.setMoves(characterGestures(selectedCharacter));
  document.querySelector('#manual-inputs')!.replaceChildren(...characterGestures(selectedCharacter).map(gesture => {
    const button = document.createElement('button'); button.textContent = GESTURE_LABELS[gesture];
    button.onclick = () => inputs.send(selectedCharacter, gesture, 'button');
    return button;
  }));
  document.querySelector('#kit')!.textContent = `Shared attack and abilities${selectedCharacter.abilityGroup ? ` — ${selectedCharacter.abilityGroup}` : ""}: ${selectedCharacter.abilities.map(g => GESTURE_LABELS[g]).join(', ')}. ${selectedCharacter.ultimate?.name ?? 'No active ultimate assigned'}. ${selectedCharacter.plannedKit ? `Planned technique: ${selectedCharacter.plannedKit.technique ?? 'None'}. Planned ultimate: ${selectedCharacter.plannedKit.ultimate ?? 'None for now'}. Combat effects pending. ` : ''}Meter: ${selectedCharacter.meter}.`;
  document.querySelector('#ability-status')!.textContent = 'Select Combat to play or use the other tabs to practice.';
}
characterSelect.onchange = selectCharacter;
selectCharacter();
const demo = new RecognitionDemo(document.querySelector<HTMLElement>('#demo')!, library, locked => {
  characterSelect.disabled = locked || onlineLocked;
  for (const tab of app.querySelectorAll<HTMLButtonElement>('[data-mode]')) tab.disabled = locked;
  document.querySelector<HTMLElement>('#manual-inputs')!.inert = locked;
  document.querySelector<HTMLElement>('#trainer')!.inert = locked;
  if (locked) trainer.setMoves(characterGestures(selectedCharacter));
  gestures.suspend();
});
online.onLock=locked=>{
  if(onlineLocked===locked)return;
  onlineLocked=locked;characterSelect.disabled=locked;
  for(const link of app.querySelectorAll<HTMLAnchorElement>('.topbar a:not(#online-link)'))link.setAttribute('aria-disabled',String(locked));
};
function applyPage(): void {
  if(onlineLocked&&location.hash!=='#online'){location.hash='online';return;}
  const selection = !location.hash || location.hash === '#characters';
  online.visible=location.hash==='#online';
  const onlineMenu=online.visible&&online.screen!=='fight';
  const onlineFight=online.visible&&!onlineMenu;
  document.querySelector<HTMLElement>('#multiplayer-screen')!.hidden=!onlineMenu;
  document.querySelector<HTMLElement>('#character-screen')!.hidden = !selection;
  document.querySelector<HTMLElement>('.workspace')!.hidden = selection||onlineMenu;
  document.querySelector<HTMLElement>('.topbar')!.hidden = selection||onlineMenu;
  const settings = location.hash === '#gesture-settings';
  if (demo.active) document.querySelector<HTMLButtonElement>('#demo-stop')!.click();
  gestures.suspend();online.suspend();
  trainer.setMoves(characterGestures(selectedCharacter));
  app.dataset.page = settings ? 'settings' : 'combat';
  const mode = selection||onlineMenu ? 'selection' : settings ? 'demo' : 'combat';
  if(online.visible){document.querySelector('#combat-status')!.textContent=document.querySelector('#online-message')!.textContent;document.querySelector<HTMLElement>('#passive-popup')!.hidden=true;}
  app.classList.toggle('online-fight',onlineFight);
  document.querySelector<HTMLElement>('#opponent-camera')!.hidden=!onlineFight;
  document.querySelector<HTMLElement>('#local-camera-label')!.hidden=!onlineFight;
  app.dataset.mode = mode;
  document.querySelector<HTMLElement>('.mode-tabs')!.hidden = !settings;
  document.querySelector<HTMLElement>('#settings-link')!.hidden = settings;
  document.querySelector<HTMLElement>('#back-to-combat')!.hidden = !settings&&!online.visible;
  for (const panel of app.querySelectorAll<HTMLElement>('.panel-area > section')) panel.hidden = panel.id !== (online.visible?'online':mode);
  for (const tab of app.querySelectorAll<HTMLButtonElement>('[data-mode]')) tab.setAttribute('aria-pressed', String(tab.dataset.mode === mode));
}
online.onScreen=applyPage;
online.onFighter=id=>{characterSelect.value=id;selectCharacter();};
new CharacterSelect(document.querySelector<HTMLElement>('#character-screen')!, (id,opponent) => {
  characterSelect.value = id; selectCharacter();
  combat.reset(selectedCharacter,CHARACTERS.find(c=>c.id===opponent)!);
  document.querySelector<HTMLSelectElement>('#fight-opponent')!.value=opponent;combatPanel.render();location.hash = 'combat';
},()=>{location.hash='online';});
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
let cameraGeneration=0;
let disposed=false;
const retryCamera = document.querySelector<HTMLButtonElement>("#camera-retry")!;
retryCamera.onclick = () => { void bootstrap(); };
document.querySelector<HTMLButtonElement>('#camera-toggle')!.onclick=()=>{if(starting||camera.isActive)stopCamera();else void bootstrap();};
function cameraStatus(text:string):void {document.querySelector('#camera-status')!.textContent=text;}
function stopCamera():void {
  cameraGeneration++;starting=false;cancelAnimationFrame(frameId);camera.stop();tracker.dispose();
  gestures.suspend();online.cameraStopped();trainer.setMoves(characterGestures(selectedCharacter));
  if(demo.active)document.querySelector<HTMLButtonElement>('#demo-stop')!.click();
  trainer.cameraStopped();demo.cameraStopped();
  renderer.render({hands:[],timestampMs:performance.now()});
  document.querySelector<HTMLButtonElement>('#camera-toggle')!.textContent='Enable camera';
  hud.setMessage('Camera off. Buttons remain available.');cameraStatus('Camera off.');
}

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

function detectionLoop(): void {
  if(disposed||!camera.isActive||!tracker.isReady)return;
  if (videoEl.currentTime === lastVideoTime) {
    if(performance.now()-lastFrameTime>350){gestures.suspend();online.suspend();}
    frameId = requestAnimationFrame(detectionLoop); return;
  }
  lastVideoTime = videoEl.currentTime;
  const now = performance.now();
  updateFps(now);

  let result;
  try{result=tracker.detectForVideo(videoEl,now);}catch{stopCamera();cameraStatus('Hand tracking stopped. Enable camera to retry.');return;}
  renderer.render(result);
  if(online.visible&&online.screen==='fight'){
    const state=online.update(result.hands,now,videoEl.videoWidth/videoEl.videoHeight,fps);
    hud.update({handsDetected:result.hands.length,handedness:result.hands.map(h=>h.handedness),fps,candidateGesture:state.candidate?MoveById[state.candidate].name:null,confirmedGesture:state.confirmed?MoveById[state.confirmed].name:null,holdProgress:state.holdProgress});
    frameId=requestAnimationFrame(detectionLoop);return;
  }
  if(app.dataset.mode==='selection'){gestures.suspend();frameId=requestAnimationFrame(detectionLoop);return;}
  if (app.dataset.mode==='inspector' && !demo.active && !trainer.active) inspector.update(result.hands, videoEl.videoWidth / videoEl.videoHeight, characterGestures(selectedCharacter), now);

  if (!demo.active && app.dataset.mode==='trainer') trainer.update(result.hands, now, videoEl.videoWidth / videoEl.videoHeight);
  const gestureState = demo.update(result.hands, now, videoEl.videoWidth / videoEl.videoHeight) ?? gestures.update(
    trainer.active ? [] : result.hands,
    now,
  );

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
  if (starting||disposed) return;
  starting = true;
  const generation=++cameraGeneration;
  document.querySelector<HTMLButtonElement>('#camera-toggle')!.textContent='Cancel camera';
  retryCamera.hidden = true;
  hud.setMessage("Loading hand-tracking model…");

  try {
    if (!tracker.isReady) await tracker.initialize();
    if(generation!==cameraGeneration||disposed)return;
  } catch (err) {
    if(generation!==cameraGeneration||disposed)return;
    console.error("Failed to load HandLandmarker model:", err);
    hud.setMessage("Hand-tracking model failed to load. Try again.");
    starting = false;
    retryCamera.hidden = false;
    document.querySelector<HTMLButtonElement>('#camera-toggle')!.textContent='Enable camera';
    return;
  }

  hud.setMessage("Requesting camera access…");

  try {
    await camera.start();
    if(generation!==cameraGeneration||disposed)return;
  } catch (err) {
    if(generation!==cameraGeneration||disposed)return;
    console.error("Failed to start camera:", err);
    starting = false;
    retryCamera.hidden = false;
    document.querySelector<HTMLButtonElement>('#camera-toggle')!.textContent='Enable camera';
    cameraStatus('Camera unavailable. Check permissions and retry; buttons still work.');

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
  document.querySelector<HTMLButtonElement>('#camera-toggle')!.textContent='Stop camera';
  cameraStatus('Camera ready. Hold your sign steadily, then release before repeating.');
  lastVideoTime = -1;
  trainer.ready();
  demo.ready();
  const { videoWidth, videoHeight } = videoEl;
  videoEl.parentElement!.style.aspectRatio = `${videoWidth} / ${videoHeight}`;
  renderer.resize(videoWidth, videoHeight);
  canvasEl.width = videoWidth;
  canvasEl.height = videoHeight;

  cancelAnimationFrame(frameId);frameId = requestAnimationFrame(detectionLoop);
}

// Restore main-format datasets from the prior merged version on this same origin.
void GestureDatasetManager.create().then(async({manager})=>{
  if(!disposed)await library.connectDataset(manager);
}).catch(()=>{cameraStatus('Built-in signs work. Browser storage is unavailable for main-format recordings.');});
function onKey(event:KeyboardEvent):void{online.key(event);}
window.addEventListener('keydown',onKey);
function onVisibility():void{if(document.hidden){gestures.suspend();online.suspend();}}
document.addEventListener('visibilitychange',onVisibility);



let lastCombatTime = performance.now();
const combatTimer = window.setInterval(() => {
  const now = performance.now();
  if (app.dataset.mode === 'combat' && !online.visible && !document.hidden) combat.tick(Math.min(now - lastCombatTime, 250));
  lastCombatTime = now;
  if(!online.visible)combatPanel.render();
}, 100);
const removeLogoCursor = installLogoCursor();
const removeUISounds = installUISounds(app);
function cleanup(): void {
  disposed=true;cameraGeneration++;
  online.dispose();
  window.removeEventListener('keydown',onKey);
  document.removeEventListener('visibilitychange',onVisibility);
  removeLogoCursor();
  removeUISounds();
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
