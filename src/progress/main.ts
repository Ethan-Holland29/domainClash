import { installLogoCursor } from './LogoCursor';
import { CharacterSelect } from "./characters/CharacterSelect";
import { CombatManager } from "./combat/CombatManager";
import { CombatPanel } from "./combat/CombatPanel";
import "./style.css";
import './integration.css';
import './multiplayer.css';
import './audio/music-player.css';
import { OnlineArena } from './OnlineArena';
import { GestureDatasetManager } from '../signs/data/GestureDatasetManager';
import { CameraManager } from "./camera/CameraManager";
import { HandTracker } from "./handTracking/HandTracker";
import { GestureRecognizer, type GestureEvent } from "./handTracking/GestureRecognizer";
import { HandDebugRenderer } from '../signs/rendering/HandDebugRenderer';
import { DebugHUD as OriginalDebugHUD } from '../signs/ui/DebugHUD';
import { GestureDebugPanel } from '../signs/ui/GestureDebugPanel';
import { GestureRecorder } from '../signs/data/GestureRecorder';
import { BatchedSaver } from '../signs/data/BatchedSaver';
import { DatasetPanel, type LabelGroup } from '../signs/ui/DatasetPanel';
import { GESTURE_DEFINITIONS } from '../signs/handTracking/GestureDefinitions';
import { mainFrame, signDefinition } from './handTracking/MainSigns';
import type { HandFrame } from '../signs/handTracking/HandTypes';
import { CharacterEffects, EFFECT_PREVIEWS } from './rendering/CharacterEffects';
import { characterAudio } from './audio/CharacterAudio';
import { PlaylistMiniPlayer } from './audio/PlaylistMiniPlayer';
import { DebugHUD } from "./ui/DebugHUD";

import { AbilityInputBus } from "./input/AbilityInput";
import { PoseLibrary } from "./calibration/PoseLibrary";
import { GESTURE_LABELS, type GestureType } from "./handTracking/GestureTypes";
import { CHARACTERS } from "./characters/Characters";
import { characterGestures, type CharacterDefinition } from "./characters/CharacterTypes";
import { DEBUGGER_CHARACTER } from './characters/DebugCharacter';
import { ALL_GESTURES } from './handTracking/GestureTypes';

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <div id="technique-reveal" aria-live="polite"></div><section id="character-screen" hidden></section><section id="multiplayer-screen" hidden></section>
  <section id="match-result" role="status" aria-live="assertive" hidden><div class="result-card"><p class="result-player"></p><h2></h2><p class="result-reason"></p></div></section>
  <header class="topbar"><strong>DomainClash</strong><a href="#characters">Change fighter</a><label>Character <select id="character"></select></label><details><summary>Character kit</summary><p id="kit"></p></details><a id="settings-link" href="#gesture-settings">Gesture settings</a><a id="back-to-combat" href="#combat" hidden>← Back to combat</a><a id="online-link" href="#online">Online 1v1</a><button id="toggle-debug" aria-pressed="false">Debug (D)</button><button id="camera-toggle">Enable camera</button></header>
  <main class="workspace">
    <section class="camera-column">
      <p id="local-camera-label" class="camera-player-label" hidden>P1 · YOU</p><div class="stage"><video id="webcam" autoplay playsinline muted></video><canvas id="overlay"></canvas></div>
      <div id="live-feedback" aria-label="Live feedback"><div id="passive-popup" class="passive-popup" role="status" aria-live="polite" hidden><span class="passive-owner"></span><strong class="passive-name"></strong></div><p id="combat-status" role="status"></p></div>
      <details id="original-debug" hidden><summary>Original hand recognition · scores &amp; identifiers</summary><div id="original-stats"></div><div id="original-checks"></div><p id="vfx-stats"></p></details><div id="hud"></div><p id="camera-status" role="status">Enable camera to use hand signs. Buttons work without a camera.</p><button id="camera-retry" hidden>Retry camera</button>
      <p id="ability-status" role="status"></p>
    </section>
    <aside class="controls">
      <nav class="mode-tabs" aria-label="Gesture settings" hidden>
        <label class="settings-fighter-picker" for="gesture-character">Recognition fighter <select id="gesture-character"></select></label>
        <button data-mode="posture" aria-pressed="false">Record</button>
      </nav>
      <div class="panel-area">
        <section id="combat"></section>
        <section id="online" hidden></section>
        <section id="posture" hidden><p>Loading your saved postures…</p></section>
      </div>
    </aside>
    <section id="opponent-camera" class="camera-column" hidden><p id="remote-camera-label" class="camera-player-label">P2 · OPPONENT</p><div class="remote-preview stage"><span>OPPONENT CAMERA</span></div><div id="remote-stats" class="debug-hud">Hands detected: — · FPS: — · Waiting for opponent</div><p id="remote-video-status" class="camera-help" role="status">Video: waiting</p><p class="camera-help">Camera preview is shared only with your room opponent.</p></section>
  </main>
`;
// The local music player moves between the selection footer and battle logs.
const musicPlayer = new PlaylistMiniPlayer(document.body);
const disclaimer = document.createElement('dialog');
disclaimer.className = 'domainclash-disclaimer';
disclaimer.setAttribute('aria-labelledby', 'domainclash-disclaimer-title');
disclaimer.innerHTML = `<h1 id="domainclash-disclaimer-title">DISCLAIMER</h1><p></p><button type="button">Got it</button>`;
disclaimer.querySelector('p')!.textContent = 'domainClash is a fan-made, Jujutsu Kaisen inspired game. It is not officially endorsed by, sponsored by, or connected to Jujutsu Kaisen or any of its subsidiaries/affiliates in any way. All original characters, trademarks, and intellectual property belong to their respective owners. No copyright infringement is intended.';
document.body.append(disclaimer);
disclaimer.querySelector<HTMLButtonElement>('button')!.onclick = () => {
  if (!disclaimer.open) return;
  const button = disclaimer.querySelector<HTMLButtonElement>('button')!;
  if (button.disabled) return;
  button.disabled = true;
  musicPlayer.startFromUserGesture();
  const motionDuration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450;
  disclaimer.classList.add('is-closing');
  window.setTimeout(() => {
    disclaimer.close();
    disclaimer.classList.remove('is-closing');
    button.disabled = false;
  }, motionDuration + 50);
};
disclaimer.showModal();
app.dataset.mode = 'combat';
app.dataset.page = 'combat';
for (const button of app.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
  button.onclick = () => {
    const mode = button.dataset.mode!;
    originalRecorder?.cancel();
    gestures.suspend();
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
const effects = new CharacterEffects(videoEl.parentElement!);
const remoteEffects = new CharacterEffects(document.querySelector('.remote-preview')!);
const originalHud = new OriginalDebugHUD(document.querySelector('#original-stats')!);
const originalChecks = new GestureDebugPanel(document.querySelector('#original-checks')!, .7);
let debugOn = false;
let lastOriginalFrame: HandFrame | null = null;
let lastDebugUpdate = 0;
let originalRecorder: GestureRecorder | null = null;
let originalDatasetPanel: DatasetPanel | null = null;
let unsubscribeDataset: (() => void) | undefined;
let retrainTimer: ReturnType<typeof setTimeout> | undefined;
function setDebug(on: boolean): void {
  debugOn = on;document.body.classList.toggle('debug-on',on);
  document.querySelector<HTMLElement>('#original-debug')!.hidden=!on;
  (document.querySelector('#original-debug') as HTMLDetailsElement).open=on;
  originalChecks.setVisible(on);
  document.querySelector('#toggle-debug')!.setAttribute('aria-pressed',String(on));
  if(!on)renderer.clear();else if(lastOriginalFrame)renderer.draw(lastOriginalFrame);
  try{localStorage.setItem('domainclash.debug',on?'1':'0');}catch{}
}
document.querySelector<HTMLButtonElement>('#toggle-debug')!.onclick=()=>setDebug(!debugOn);
try{setDebug(localStorage.getItem('domainclash.debug')==='1');}catch{setDebug(false);}
const camera = new CameraManager(videoEl);
const tracker = new HandTracker();
const library = new PoseLibrary();
const inputs = new AbilityInputBus();
inputs.subscribe(input => {
  if (app.dataset.mode === 'combat' && !online.visible) {
    if (input.characterId === combat.character.id) combat.attack(input.gesture);
    combatPanel.render();
    return;
  }
  // Online uses the same signs (and your recordings) as solo: a confirmed sign locks in that move.
  if (online.visible && online.screen === 'fight') { online.choose(input.gesture); return; }
  const inputCharacter = input.characterId === DEBUGGER_CHARACTER.id ? DEBUGGER_CHARACTER : CHARACTERS.find(c => c.id === input.characterId) ?? selectedCharacter;
  document.querySelector('#ability-status')!.textContent = `${inputCharacter.name} — ${GESTURE_LABELS[input.gesture]} input received (${input.source === 'button' ? 'manual test' : 'camera'}). Practice input only.`;
});
let selectedCharacter = CHARACTERS[0];
let gestureSettingsCharacter: CharacterDefinition = selectedCharacter;
const combat = new CombatManager(selectedCharacter);
const combatPanel = new CombatPanel(document.querySelector<HTMLElement>('#combat')!, combat, () => gestures.suspend());
const online = new OnlineArena(document.querySelector<HTMLElement>('#online')!,videoEl,document.querySelector<HTMLElement>('.remote-preview')!,document.querySelector<HTMLElement>('#multiplayer-screen')!);
let onlineLocked=false;
const characterSelect = document.querySelector<HTMLSelectElement>('#character')!;
characterSelect.innerHTML = CHARACTERS.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
const gestureCharacterSelect = document.querySelector<HTMLSelectElement>('#gesture-character')!;
gestureCharacterSelect.innerHTML = [...CHARACTERS.map(c => `<option value="${c.id}">${c.name}</option>`), `<option value="${DEBUGGER_CHARACTER.id}">Debugger · all attacks</option>`].join('');
const activeGestureCharacter = (): CharacterDefinition => app.dataset.mode === 'posture' ? gestureSettingsCharacter : selectedCharacter;
const activeGestures = () => characterGestures(activeGestureCharacter());
const gestures = new GestureRecognizer(hands => library.evaluate(hands, videoEl.videoWidth / videoEl.videoHeight, activeGestures()),
  () => ({moves:activeGestures(),aspect:videoEl.videoWidth/videoEl.videoHeight||4/3}));
gestureCharacterSelect.onchange = () => {
  gestureSettingsCharacter = gestureCharacterSelect.value === DEBUGGER_CHARACTER.id
    ? DEBUGGER_CHARACTER
    : CHARACTERS.find(c => c.id === gestureCharacterSelect.value) ?? selectedCharacter;
  gestures.suspend();
  document.querySelector('#ability-status')!.textContent = `${gestureSettingsCharacter.name} selected for gesture testing.`;
};
gestures.core.onEvent(e=>originalHud.logEvent(e));
combat.onEffect=cue=>effects.play(cue);
combat.onVoiceEvent=(event,state)=>characterAudio.playBattleEvent(event,state);
combat.onResetEffects=()=>effects.clear();
online.onEffect=cue=>(cue.side==='enemy'?remoteEffects:effects).play(cue);
online.onVoiceEvent=(event,state)=>characterAudio.playBattleEvent(event,state);
function placeMusicPlayer(): void {
  if (location.hash === '' || location.hash === '#characters') {
    const footer = document.querySelector<HTMLElement>('#character-screen .selection-footer');
    if (footer) {
      const action = footer.querySelector<HTMLElement>('#choose-fighter, #p1-confirm, .confirm-pick');
      musicPlayer.mount(footer, action);
      return;
    }
  }
  if (location.hash === '#online' && online.screen !== 'fight') {
    const footer = document.querySelector<HTMLElement>('#network-selection .selection-footer');
    if (footer) {
      musicPlayer.mount(footer, footer.querySelector('.leave-selection'));
      return;
    }
    const lobby = document.querySelector<HTMLElement>('.room-form');
    if (lobby) { musicPlayer.mount(lobby); return; }
  }
  if (location.hash === '#online') {
    const slot = document.querySelector<HTMLElement>('#online-music-slot');
    if (slot) { musicPlayer.mount(slot); return; }
  }
  if (location.hash === '#gesture-settings') {
    const panel = document.querySelector<HTMLElement>('.panel-area');
    if (panel) { musicPlayer.mount(panel); return; }
  }
  const localBattleSlot = document.querySelector<HTMLElement>('#fight-music-slot');
  if (localBattleSlot) musicPlayer.mount(localBattleSlot);
}
window.addEventListener('domainclash:selection-updated', placeMusicPlayer);
function selectCharacter(): void {
  originalRecorder?.cancel();
  selectedCharacter = CHARACTERS.find(c => c.id === characterSelect.value)!;
  if (gestureSettingsCharacter.id !== DEBUGGER_CHARACTER.id) {
    gestureSettingsCharacter = selectedCharacter;
    gestureCharacterSelect.value = selectedCharacter.id;
  }
  combat.reset(selectedCharacter);
  effects.prefetch(selectedCharacter.id);
  online.setCharacter(selectedCharacter.id);
  combatPanel.setButtons(g => inputs.send(selectedCharacter, g, 'button'));
  gestures.suspend();
  document.querySelector('#kit')!.textContent = `Shared attack and abilities${selectedCharacter.abilityGroup ? ` — ${selectedCharacter.abilityGroup}` : ""}: ${selectedCharacter.abilities.map(g => GESTURE_LABELS[g]).join(', ')}. ${selectedCharacter.ultimate?.name ?? 'No active ultimate assigned'}. ${selectedCharacter.plannedKit ? `Planned technique: ${selectedCharacter.plannedKit.technique ?? 'None'}. Planned ultimate: ${selectedCharacter.plannedKit.ultimate ?? 'None for now'}. Combat effects pending. ` : ''}Meter: ${selectedCharacter.meter}.`;
  document.querySelector('#ability-status')!.textContent = 'Play from Combat, or open Gesture settings → Record to train a sign.';
}
characterSelect.onchange = selectCharacter;
selectCharacter();
online.onLock=locked=>{
  if(onlineLocked===locked)return;
  onlineLocked=locked;characterSelect.disabled=locked;
  for(const link of app.querySelectorAll<HTMLAnchorElement>('.topbar a:not(#online-link)'))link.setAttribute('aria-disabled',String(locked));
};
function applyPage(): void {
  if(onlineLocked&&location.hash!=='#online'){location.hash='online';return;}
  originalRecorder?.cancel();
  effects.clear();remoteEffects.clear();
  const selection = !location.hash || location.hash === '#characters';
  online.visible=location.hash==='#online';
  const onlineMenu=online.visible&&online.screen!=='fight';
  const onlineFight=online.visible&&!onlineMenu;
  document.body.classList.toggle('character-select-active', selection || onlineMenu);
  document.querySelector<HTMLElement>('#multiplayer-screen')!.hidden=!onlineMenu;
  document.querySelector<HTMLElement>('#character-screen')!.hidden = !selection;
  document.querySelector<HTMLElement>('.workspace')!.hidden = selection||onlineMenu;
  document.querySelector<HTMLElement>('.topbar')!.hidden = selection||onlineMenu;
  const settings = location.hash === '#gesture-settings';
  gestures.suspend();online.suspend();
  app.dataset.page = settings ? 'settings' : 'combat';
  const mode = selection||onlineMenu ? 'selection' : settings ? 'posture' : 'combat';
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
  placeMusicPlayer();
}
online.onScreen=applyPage;
online.onFighter=id=>{characterSelect.value=id;selectCharacter();};
new CharacterSelect(document.querySelector<HTMLElement>('#character-screen')!, (id,opponent) => {
  characterSelect.value = id; selectCharacter();
  combat.reset(selectedCharacter,CHARACTERS.find(c=>c.id===opponent)!);
  effects.prefetch(opponent);
  document.querySelector<HTMLSelectElement>('#fight-opponent')!.value=opponent;combatPanel.render();location.hash = 'combat';
},()=>{location.hash='online';});
window.addEventListener('hashchange', applyPage);
applyPage();
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
  gestures.suspend();online.cameraStopped();
  lastOriginalFrame=null;originalRecorder?.cancel();renderer.clear();
  document.querySelector<HTMLButtonElement>('#camera-toggle')!.textContent='Enable camera';
  hud.setMessage('Camera off. Buttons remain available.');cameraStatus('Camera off.');
}

gestures.onEvent((event: GestureEvent) => {
  if (event.type === 'confirmed') {
    inputs.send(activeGestureCharacter(), event.gesture, 'camera');
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
  lastOriginalFrame=mainFrame(result.hands,now,videoEl.videoWidth/videoEl.videoHeight);
  originalRecorder?.capture(lastOriginalFrame);
  if(debugOn||app.dataset.mode==='posture')renderer.draw(lastOriginalFrame);
  if(online.visible&&online.screen==='fight')online.reportTracking(result.hands.length,fps,now);
  if(app.dataset.mode==='selection'){gestures.suspend();frameId=requestAnimationFrame(detectionLoop);return;}
  // Recording captures raw frames; recognition pauses so a held training posture never casts.
  const gestureState = gestures.update(originalRecorder?.busy ? [] : result.hands, now);

  hud.update({
    handsDetected: result.hands.length,
    handedness: result.hands.map((h) => `${h.handedness} (${(h.handednessScore * 100).toFixed(0)}%)`),
    fps,
    candidateGesture: gestureState.candidateGesture ? GESTURE_LABELS[gestureState.candidateGesture] : null,
    confirmedGesture: gestureState.confirmedGesture ? GESTURE_LABELS[gestureState.confirmedGesture] : null,
    holdProgress: gestureState.holdProgress,
  });

  updateOriginalDebug(now);
  frameId = requestAnimationFrame(detectionLoop);
}
function updateOriginalDebug(now:number):void {
  if(!debugOn||now-lastDebugUpdate<100)return;
  lastDebugUpdate=now;
  const snapshot=gestures.core.snapshot();
  originalHud.update({status:'Original DomainClash recognition · hold 500ms · release before repeating'+(camera.isActive?'':'\nCamera off'),fps:camera.isActive?fps:0,frame:camera.isActive?lastOriginalFrame:null,gesture:camera.isActive?snapshot:null});
  originalChecks.update(camera.isActive?snapshot:null);
  document.querySelector('#vfx-stats')!.textContent=effects.stats;
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
  const { videoWidth, videoHeight } = videoEl;
  videoEl.parentElement!.style.aspectRatio = `${videoWidth} / ${videoHeight}`;
  renderer.resize(videoWidth, videoHeight);
  canvasEl.width = videoWidth;
  canvasEl.height = videoHeight;

  cancelAnimationFrame(frameId);frameId = requestAnimationFrame(detectionLoop);
}

// Original recording/import UI keeps exact dataset labels and the existing browser store.
void GestureDatasetManager.create().then(async({manager,startup})=>{
  if(disposed)return;
  const host=document.querySelector<HTMLElement>('#posture')!;
  host.replaceChildren();
  // Every tracked frame is saved; batching the writes keeps saving in step with the camera.
  const saver=new BatchedSaver(samples=>manager.import(samples,'merge'));
  originalRecorder=new GestureRecorder(()=>camera.isActive?lastOriginalFrame:null,sample=>saver.save(sample),{continuous:true});
  const groups:LabelGroup[]=CHARACTERS.map(c=>({name:c.name,labels:characterGestures(c).map(g=>({id:signDefinition(g).datasetLabel,name:GESTURE_LABELS[g],gestureId:g}))}));
  groups.push({name:'Debugger · all attacks',labels:ALL_GESTURES.map(g=>({id:signDefinition(g).datasetLabel,name:GESTURE_LABELS[g],gestureId:g}))});
  const listed=new Set(groups.flatMap(g=>g.labels.map(label=>typeof label==='string'?label:label.id)));
  groups.push({name:'Other original signs',labels:GESTURE_DEFINITIONS.map(d=>d.datasetLabel).filter(label=>!listed.has(label))});
  groups.push({name:'No sign / negative examples',labels:['NONE']});
  // Pose-library recordings from the combined build ride along in exports and merge on import.
  originalDatasetPanel=new DatasetPanel(host,manager,originalRecorder,groups,{
    export:()=>Object.keys(library.data).length?library.data:null,
    merge:data=>{const result=library.merge(data);void originalDatasetPanel?.refreshCounts();return result;},
    countGesture:gestureId=>library.data[gestureId as GestureType]?.length??0,
    deleteGesture:gestureId=>library.deleteGesture(gestureId as GestureType),
  });
  const train=async()=>{const samples=await manager.all();if(!disposed)library.setImportedSamples(samples);};
  // Retraining re-reads every sample; while recording it would stall tracking and saving,
  // so it waits until the recording has stopped and its last samples are written.
  const scheduleTrain=()=>{clearTimeout(retrainTimer);retrainTimer=setTimeout(()=>{if(originalRecorder?.busy)scheduleTrain();else void train();},500);};
  unsubscribeDataset=manager.onChange(scheduleTrain);
  await train();await originalDatasetPanel.refreshCounts();
  originalDatasetPanel.setStatus(`Loaded ${startup.storedCount+startup.seededFromBundle} original samples.`);
}).catch(()=>{document.querySelector('#posture')!.textContent='Posture storage could not open. Reload to try again; existing recordings have not been deleted.';cameraStatus('Built-in signs work. Browser storage is unavailable for original recordings.');});
function onKey(event:KeyboardEvent):void{
  if(!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!(event.target instanceof HTMLElement&&event.target.closest('input,select,textarea,[contenteditable="true"]'))&&event.key.toLowerCase()==='d'){event.preventDefault();setDebug(!debugOn);return;}
  if(!online.visible && app.dataset.mode==='combat' && event.code==='Space' && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && !(event.target instanceof HTMLElement && event.target.closest('input,select,textarea,button,[contenteditable=true]'))){event.preventDefault();combat.attack('GUARD');combatPanel.render();}
  online.key(event);
}
window.addEventListener('keydown',onKey);
function onVisibility():void{if(document.hidden){originalRecorder?.cancel();gestures.suspend();online.suspend();}}
document.addEventListener('visibilitychange',onVisibility);



let lastCombatTime = performance.now();
const combatTimer = window.setInterval(() => {
  const now = performance.now();
  if (app.dataset.mode === 'combat' && !online.visible && !document.hidden) combat.tick(Math.min(now - lastCombatTime, 250));
  if (online.visible && !document.hidden) online.tick(Math.min(now - lastCombatTime, 250));
  lastCombatTime = now;
  if(!online.visible)combatPanel.render();
  updateOriginalDebug(now);
}, 100);
const previews=document.createElement('div');previews.className='effect-previews';
const previewLabel=document.createElement('label');previewLabel.textContent='Effect preview ';
const previewSelect=document.createElement('select');previewSelect.setAttribute('aria-label','Effect preview');
for(const [character,actions] of Object.entries(EFFECT_PREVIEWS))for(const action of actions){const option=document.createElement('option');option.value=character+':'+action;option.textContent=character+' · '+action.replaceAll('_',' ');previewSelect.append(option);}
previewLabel.append(previewSelect);const previewButton=document.createElement('button');previewButton.textContent='Play effect';
previewButton.onclick=()=>{const [character,action]=previewSelect.value.split(':');effects.play({character,action});};
const clearButton=document.createElement('button');clearButton.textContent='Clear effects';clearButton.onclick=()=>effects.clear();
previews.append(previewLabel,previewButton,clearButton);document.querySelector('#original-debug')!.append(previews);
const removeLogoCursor = installLogoCursor();
function cleanup(): void {
  disposed=true;cameraGeneration++;
  effects.dispose();remoteEffects.dispose();originalRecorder?.cancel();originalDatasetPanel?.dispose();unsubscribeDataset?.();clearTimeout(retrainTimer);
  online.dispose();
  window.removeEventListener('keydown',onKey);
  document.removeEventListener('visibilitychange',onVisibility);
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
