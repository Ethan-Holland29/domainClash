import './style.css';
import { CameraError, CameraManager } from './camera/CameraManager';
import { createAbilities } from './combat/Ability';
import { AbilityPresenter } from './presentation/AbilityPresenter';
import { AudioManager } from './presentation/AudioManager';
import { DomainSequence } from './presentation/DomainSequence';
import { voiceLine } from './presentation/VoiceLines';
import { domainEffectFor } from './domain/DomainEffects';
import { VfxLayer, type Point } from './presentation/VfxLayer';
import { CombatManager, type CombatEvent } from './combat/CombatManager';
import {
  CHARACTERS,
  MOVE_SLOTS,
  SLOT_NAME,
  characterMoves,
  findCharacter,
  type CharacterDefinition,
  type MoveSlot,
} from './characters/Characters';
import { GestureDatasetManager, type DatasetStartupInfo } from './data/GestureDatasetManager';
import { EXTRA_DATASET_LABELS } from './data/GestureDatasetTypes';
import { GestureRecorder } from './data/GestureRecorder';
import { DomainVideoStore } from './data/DomainVideoStore';
import { LEARNED_MODEL, SIGN_TUNING } from './handTracking/GestureDefinitions';
import { GestureRecognizer } from './handTracking/GestureRecognizer';
import { HandTracker } from './handTracking/HandTracker';
import type { GestureDefinition } from './handTracking/GestureTypes';
import type { HandFrame } from './handTracking/HandTypes';
import { HandDebugRenderer } from './rendering/HandDebugRenderer';
import { CharacterSelect } from './ui/CharacterSelect';
import { DatasetPanel, type LabelGroup } from './ui/DatasetPanel';
import { DomainCinematic, findDomainVideo } from './ui/DomainCinematic';
import { DomainVideoPanel } from './ui/DomainVideoPanel';
import { DebugHUD } from './ui/DebugHUD';
import { FpsCounter } from './ui/FpsCounter';
import { GameHUD } from './ui/GameHUD';
import { GestureDebugPanel } from './ui/GestureDebugPanel';
import { MatchOverlay } from './ui/MatchOverlay';
import { MoveBanner } from './ui/MoveBanner';
import { StatusOverlay } from './ui/StatusOverlay';

const MIRRORED = true;
const CHARACTER_STORAGE_KEY = 'domainclash.characterId';
const DEBUG_STORAGE_KEY = 'domainclash.debug';
const TOOLS_STORAGE_KEY = 'domainclash.toolsOpen';
const SOUND_STORAGE_KEY = 'domainclash.sound';
const VOICE_STORAGE_KEY = 'domainclash.voice';
const OPPONENT_NAME = 'Cursed Spirit';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <h1>DomainClash</h1>
  <div id="stage">
    <video id="webcam" playsinline muted></video>
    <canvas id="overlay"></canvas>
  </div>
  <div class="game-toolbar">
    <button type="button" data-action="change-character">Change character (C)</button>
    <button type="button" data-action="toggle-debug" aria-pressed="false">Debug (D)</button>
    <button type="button" data-action="toggle-sound" aria-pressed="true">Sound</button>
    <button type="button" data-action="toggle-voice" aria-pressed="true">Voice</button>
  </div>
  <details class="tools">
    <summary>Training &amp; media tools</summary>
    <div class="tools-body"></div>
  </details>
`;
const toolsBody = document.querySelector<HTMLDivElement>('.tools-body')!;

const stage = document.querySelector<HTMLDivElement>('#stage')!;
const camera = new CameraManager(document.querySelector<HTMLVideoElement>('#webcam')!, { mirrored: MIRRORED });
const tracker = new HandTracker({ mirrored: MIRRORED });
const renderer = new HandDebugRenderer(document.querySelector<HTMLCanvasElement>('#overlay')!);
const hud = new DebugHUD(stage);
const overlay = new StatusOverlay(stage);
const fps = new FpsCounter();
// Starts with no active moves; the character select enables the chosen character's three.
const gestures = new GestureRecognizer({}, []);
const gestureDebug = new GestureDebugPanel(stage, gestures.config.enterThreshold);
// Presentation layer (behind the HUD): effects out of the player's own hands, and audio.
// Driven only by combat events plus where the hands are.
const vfx = new VfxLayer(stage);
const audio = new AudioManager();
const presenter = new AbilityPresenter(stage, vfx, audio, handAnchor);
const gameHud = new GameHUD(stage, OPPONENT_NAME, moveTeachStatus);
const banner = new MoveBanner(stage);
const characterSelect = new CharacterSelect(stage, CHARACTERS, moveStatus);
const matchOverlay = new MatchOverlay(stage);
// Abilities are replaced when a character is picked; until then combat is paused.
const combat = new CombatManager(createAbilities({ primary: '-', secondary: '-', ultimate: '-' }));
const cinematic = new DomainCinematic();
const domainSequence = new DomainSequence(stage, vfx, audio, cinematic);
/** True while any full-screen sequence runs: combat pauses and no moves are accepted. */
const inCinematic = () => cinematic.playing || domainSequence.playing;
// Keeps the video panel above the (later-created) dataset panel inside the tools section.
const videoPanelHost = document.createElement('div');
videoPanelHost.className = 'panel-host';
toolsBody.appendChild(videoPanelHost);
let videoStore: DomainVideoStore | null = null;

let character: CharacterDefinition | null = null;
let characterMoveSlots: Record<MoveSlot, GestureDefinition> | null = null;
let datasetPanel: DatasetPanel | null = null;

gestures.onEvent((event) => hud.logEvent(event));
// A confirmed hand sign only *attempts* a move: combat decides whether it happens.
gestures.onAction((action, gesture) => {
  const slot = MOVE_SLOTS.find((s) => characterMoveSlots?.[s].id === gesture.id);
  console.info(`[move] ${character?.name} ${slot ?? '?'} (${action}): ${gesture.name}`);
  if (!character || !slot) return;
  presenter.mark(`gesture ${gesture.name}`);
  const result = combat.useAbility(slot);
  showMoveResult(character, slot, gesture, result);
  if (result.type === 'domain-activated') void runDomainExpansion(character, gesture);
});

/** Banner feedback for what a move attempt did. */
function showMoveResult(who: CharacterDefinition, slot: MoveSlot, move: GestureDefinition, result: CombatEvent): void {
  const tag = `${who.name} · ${SLOT_NAME[slot]}`;
  switch (result.type) {
    case 'cast':
      // Name shows as the attack starts; the damage number pops at impact (presenter).
      banner.show(tag, move.name.toUpperCase(), who.color, slot === 'secondary' ? 1200 : 800);
      break;
    case 'domain-activated':
      // The Domain Expansion cinematic shows its own title (DomainSequence).
      break;
    case 'on-cooldown':
      banner.show(`${move.name} · ready in ${(result.remainingMs / 1000).toFixed(1)}s`, 'ON COOLDOWN', '#9e9e9e', 900);
      break;
    case 'domain-already-active':
      banner.show(`${move.name} is already up`, 'DOMAIN ALREADY ACTIVE', '#9e9e9e', 1000);
      break;
    case 'domain-not-ready':
      banner.show(`Domain Meter ${result.meter}% · land attacks to fill it`, 'DOMAIN NOT READY', '#9e9e9e', 1100);
      break;
  }
}

combat.onEvent((event) => presenter.handle(event));
combat.onEvent((event) => {
  if (event.type === 'hit' || event.type === 'domain-activated') gameHud.flash('opponent');
  // Blocks are decided at impact (after the wind-up), so the banner comes from here.
  if (event.type === 'blocked') banner.show(`${event.ability.name} · ${OPPONENT_NAME} was guarding`, 'BLOCKED', '#9e9e9e');
  if (event.type === 'opponent-attack') {
    gameHud.flash('player');
    banner.show(`${OPPONENT_NAME} hit you · -${event.damage} HP`, 'OUCH', '#ff5252', 900);
  }
  if (event.type === 'match-over') {
    const detail =
      event.result === 'won'
        ? `${character?.name ?? 'You'} exorcised the ${OPPONENT_NAME}.`
        : `The ${OPPONENT_NAME} beat ${character?.name ?? 'you'}.`;
    matchOverlay.show(event.result, detail);
  }
});

matchOverlay.onRestart = restartMatch;

function restartMatch(): void {
  matchOverlay.hide();
  if (!character || !characterMoveSlots) return;
  combat.reset(
    createAbilities({
    primary: characterMoveSlots.primary.name,
    secondary: characterMoveSlots.secondary.name,
      ultimate: characterMoveSlots.ultimate.name,
    }),
    domainEffectFor(character.id),
  );
  const who = character;
  const moves = characterMoveSlots;
  presenter.setContext({
    characterId: who.id,
    color: who.color,
    slotOf: (name) => MOVE_SLOTS.find((s) => moves[s].name === name) ?? null,
  });
  activateMoves();
}

/**
 * The Domain Expansion cinematic (intro -> the player's video or a built-in
 * name reveal -> environment transition), with all moves and combat paused.
 * Gameplay then resumes inside the Domain state that combat already opened.
 */
async function runDomainExpansion(who: CharacterDefinition, domain: GestureDefinition): Promise<void> {
  await prepareDomainVideo(); // normally already loaded when the character was picked
  const videoUrl = prepared?.domainId === domain.id ? prepared.url : findDomainVideo(who.id, domain.id);
  gestures.setDefinitions([]); // nothing can fire during the cinematic
  await domainSequence.play({
    domainName: domain.name,
    characterId: who.id,
    color: who.color,
    videoUrl,
    handAnchor,
    speak: () => audio.speak(`${who.id}-ultimate`, voiceLine(who.id, 'ultimate', `Domain Expansion. ${domain.name}.`)),
  });
  if (character === who && !characterSelect.isOpen) {
    activateMoves();
    gestures.requireRelease(domain.id); // still holding the sign must not re-fire it
  }
}

/** The current character's domain clip, loaded ahead of time. */
let prepared: { domainId: string; url: string; objectUrl: boolean } | null = null;

/**
 * Loads the current character's domain clip ahead of time, so when the
 * domain fires its audio starts instantly instead of after reading a large
 * file from storage. `force` reloads it (e.g. after a new upload).
 */
async function prepareDomainVideo(force = false): Promise<void> {
  const who = character;
  const domain = characterMoveSlots?.ultimate;
  if (!who || !domain || (!force && prepared?.domainId === domain.id)) return;
  const blob = (await videoStore?.get(domain.id).catch(() => null)) ?? null;
  if (character !== who) return; // switched character while loading
  const url = blob ? URL.createObjectURL(blob) : findDomainVideo(who.id, domain.id);
  const old = prepared;
  prepared = url ? { domainId: domain.id, url, objectUrl: blob !== null } : null;
  cinematic.prepare(url);
  if (old?.objectUrl && old.url !== url) URL.revokeObjectURL(old.url);
}

/** Plays a clip full-window with all moves paused, then restores the current character's moves. */
async function runCinematic(url: string): Promise<void> {
  if (inCinematic()) return;
  gestures.setDefinitions([]); // nothing can fire during the cinematic
  await cinematic.play(url);
  if (character && !characterSelect.isOpen) activateMoves();
}

async function initDomainVideos(): Promise<void> {
  try {
    videoStore = await DomainVideoStore.open();
    const slots = CHARACTERS.map((c) => {
      const ultimate = characterMoves(c).ultimate;
      return {
        domainId: ultimate.id,
        domainName: ultimate.name,
        characterName: c.name,
        color: c.color,
        bundledUrl: findDomainVideo(c.id, ultimate.id),
      };
    });
    const panel = new DomainVideoPanel(videoPanelHost, videoStore, slots);
    panel.onPreview = runCinematic;
    panel.onChange = () => void prepareDomainVideo(true);
    await panel.refresh();
    void prepareDomainVideo(true); // in case a character was picked before storage opened
  } catch (err) {
    console.error('Domain video storage unavailable', err);
    videoPanelHost.textContent = `Domain video storage unavailable: ${String(err)}`;
  }
}

/** Whether a move is usable yet, and what to record if not (for the ability cards). */
function moveTeachStatus(gesture: GestureDefinition): { learned: boolean; hint: string } {
  const n = LEARNED_MODEL.countFor(gesture.datasetLabel);
  const need = SIGN_TUNING.learned.minSamples;
  const learned = n >= need || !gesture.taughtOnly;
  return { learned, hint: learned ? '' : `Teach: record ${gesture.datasetLabel} (${n}/${need})` };
}

// ---------- debug mode & tools (kept separate from the game HUD) ----------

let debugOn = false;

/** Shows/hides the debug layer: tracking stats, gesture checks and the event log. */
function setDebug(on: boolean): void {
  debugOn = on;
  document.body.classList.toggle('debug-on', on);
  gestureDebug.setVisible(on);
  document.querySelector('[data-action="toggle-debug"]')!.setAttribute('aria-pressed', String(on));
  try {
    localStorage.setItem(DEBUG_STORAGE_KEY, on ? '1' : '0');
  } catch {
    // not remembered
  }
}

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (e.key === 'd' || e.key === 'D') setDebug(!debugOn);
  // Debug-only cheat: fill the Domain Meter to try a Domain Expansion (and its video) quickly.
  if ((e.key === 'f' || e.key === 'F') && debugOn && character) {
    combat.debugFillMeter();
    banner.show('Debug', 'DOMAIN METER FILLED', '#ffd740', 900);
  }
});

const tools = document.querySelector<HTMLDetailsElement>('details.tools')!;
tools.addEventListener('toggle', () => {
  try {
    localStorage.setItem(TOOLS_STORAGE_KEY, tools.open ? '1' : '0');
  } catch {
    // not remembered
  }
});

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

setDebug(readFlag(DEBUG_STORAGE_KEY, false));

/** Sound / Voice toggles (toolbar), remembered between visits. */
function bindToggle(action: string, key: string, apply: (on: boolean) => void): void {
  const button = document.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
  const set = (on: boolean) => {
    apply(on);
    button.setAttribute('aria-pressed', String(on));
    try {
      localStorage.setItem(key, on ? '1' : '0');
    } catch {
      // not remembered
    }
  };
  button.addEventListener('click', () => set(button.getAttribute('aria-pressed') !== 'true'));
  set(readFlag(key, true));
}
bindToggle('toggle-sound', SOUND_STORAGE_KEY, (on) => audio.setMuted(!on));
bindToggle('toggle-voice', VOICE_STORAGE_KEY, (on) => audio.setVoiceEnabled(on));
tools.open = readFlag(TOOLS_STORAGE_KEY, true);

/** Short learned/rule status of a move, for the character select screen. */
function moveStatus(gesture: GestureDefinition): string {
  const n = LEARNED_MODEL.countFor(gesture.datasetLabel);
  const need = SIGN_TUNING.learned.minSamples;
  if (n >= need) return `learned (${n})`;
  if (gesture.taughtOnly) return `teach it: record ${gesture.datasetLabel} (${n}/${need})`;
  return `built-in sign (${n}/${need} recorded)`;
}

/** Enables the current character's three moves (e.g. after a cinematic). */
function activateMoves(): void {
  if (characterMoveSlots) gestures.setDefinitions(MOVE_SLOTS.map((slot) => characterMoveSlots![slot]));
}

/** Picks a character and starts a new match with their moves. */
function selectCharacter(next: CharacterDefinition): void {
  character = next;
  characterMoveSlots = characterMoves(next);
  restartMatch();
  gameHud.setCharacter(next, characterMoveSlots);
  datasetPanel?.setLabelGroups(labelGroups());
  void prepareDomainVideo();
  try {
    localStorage.setItem(CHARACTER_STORAGE_KEY, next.id);
  } catch {
    // Storage unavailable - the choice just won't be remembered.
  }
}

function openCharacterSelect(): void {
  gestures.setDefinitions([]); // nothing fires while choosing
  characterSelect.open(character);
}

/** Recorder labels: the current character's moves first, then the others, then NONE. */
function labelGroups(): LabelGroup[] {
  const ordered = character ? [character, ...CHARACTERS.filter((c) => c !== character)] : CHARACTERS;
  return [
    ...ordered.map((c) => ({
      name: c === character ? `${c.name} (playing)` : c.name,
      labels: MOVE_SLOTS.map((slot) => characterMoves(c)[slot].datasetLabel),
    })),
    { name: 'Other', labels: [...EXTRA_DATASET_LABELS] },
  ];
}

characterSelect.onSelect = selectCharacter;
document.querySelector('[data-action="change-character"]')!.addEventListener('click', () => {
  if (!inCinematic()) openCharacterSelect();
});
document.querySelector('[data-action="toggle-debug"]')!.addEventListener('click', () => setDebug(!debugOn));
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if ((e.key === 'c' || e.key === 'C') && !characterSelect.isOpen && !inCinematic()) openCharacterSelect();
});

let lastVideoTime = -1;
let lastFrame: HandFrame | null = null;

/**
 * Where the player's hand(s) are on screen, as stage fractions (landmarks are
 * already in mirrored display space, and the stage has the video's aspect).
 * The middle of each hand (palm + fingertips), averaged over both hands.
 */
function handAnchor(): Point | null {
  const hands = camera.isRunning ? lastFrame?.hands : null;
  if (!hands?.length) return null;
  let x = 0;
  let y = 0;
  let n = 0;
  for (const h of hands) {
    for (const i of [0, 5, 9, 13, 17, 8, 12]) {
      x += h.landmarks[i].x;
      y += h.landmarks[i].y;
      n++;
    }
  }
  return { x: x / n, y: y / n };
}

function loop(): void {
  const video = camera.video;
  if (camera.isRunning && camera.hasFrame && tracker.isReady && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    renderer.resize(camera.width, camera.height);
    const frame = tracker.detect(video, performance.now());
    if (frame) {
      lastFrame = frame;
      gestures.update(frame);
      renderer.draw(frame);
    }
    fps.tick(performance.now());
  }
  const running = camera.isRunning;
  const snapshot = running ? gestures.snapshot() : null;
  if (debugOn) {
    hud.update({ status: statusText(), fps: fps.fps, frame: running ? lastFrame : null, gesture: snapshot });
    gestureDebug.update(snapshot);
  }

  // Combat time only runs while actually fighting (not choosing a character or watching a domain).
  combat.setPaused(!character || characterSelect.isOpen || inCinematic() || !camera.isRunning);
  combat.update(performance.now());
  const fight = combat.snapshot();
  gameHud.update(fight, inCinematic() ? null : snapshot); // no "make a sign" prompt mid-cinematic
  presenter.tick(fight, snapshot?.phase === 'candidate');
  requestAnimationFrame(loop);
}

function statusText(): string {
  const mp = tracker.isReady ? `MediaPipe: ${tracker.delegate}` : 'MediaPipe: loading...';
  const cam = camera.isRunning ? `Camera: ${camera.label} ${camera.width}x${camera.height}` : 'Camera: off';
  return `${mp}\n${cam}`;
}

async function startCamera(): Promise<void> {
  lastFrame = null;
  gestures.reset();
  renderer.clear();
  overlay.show('Starting camera...');
  try {
    await camera.start();
    stage.style.aspectRatio = `${camera.width} / ${camera.height}`;
    fps.reset();
    if (tracker.isReady) overlay.hide();
    else overlay.show('Loading hand tracking model...');
  } catch (err) {
    showCameraError(err);
  }
}

function showCameraError(err: unknown): void {
  const message =
    err instanceof CameraError
      ? err.browserError
        ? `${err.message}\n\nBrowser error: ${err.browserError}`
        : err.message
      : `Camera error: ${String(err)}`;
  console.warn('Camera unavailable:', err);
  lastFrame = null;
  gestures.reset();
  renderer.clear();
  overlay.show(message, { label: 'Retry', onClick: () => void startCamera() });
}

camera.onDisconnect = showCameraError;

tracker
  .init()
  .then(() => {
    if (camera.isRunning) overlay.hide();
  })
  .catch((err: unknown) => {
    console.error('Failed to initialize HandTracker', err);
    overlay.show(`Hand tracking failed to load: ${String(err)}`, {
      label: 'Reload',
      onClick: () => location.reload(),
    });
  });

async function initDataset(): Promise<void> {
  try {
    const { manager, startup } = await GestureDatasetManager.create();
    const recorder = new GestureRecorder(
      () => (camera.isRunning ? lastFrame : null),
      (sample) => manager.add(sample),
    );
    const panel = new DatasetPanel(toolsBody, manager, recorder, labelGroups());
    datasetPanel = panel;
    await panel.refreshCounts();

    // Learned gestures (e.g. Piercing Blood) train on the recorded samples, and
    // retrain whenever the dataset changes. Debounced: a 100-sample recording
    // saves one sample at a time.
    let retrain: ReturnType<typeof setTimeout> | undefined;
    const train = async () => {
      LEARNED_MODEL.train(await manager.all());
      gameHud.refreshTeachHints();
    };
    manager.onChange(() => {
      clearTimeout(retrain);
      retrain = setTimeout(() => void train(), 500);
    });
    await train();
    panel.setStatus(datasetStartupMessage(startup));
  } catch (err) {
    console.error('Gesture dataset storage unavailable', err);
    const note = document.createElement('p');
    note.className = 'dataset-panel error';
    note.textContent = `Gesture dataset storage unavailable: ${String(err)}`;
    app.appendChild(note);
  }
}

function datasetStartupMessage({ storedCount, seededFromBundle, persistent }: DatasetStartupInfo): string {
  const source = seededFromBundle
    ? `Loaded ${seededFromBundle} samples from data/gesture-dataset.json.`
    : `Loaded ${storedCount} samples from browser storage.`;
  const keep = persistent === false ? ' (browser did not grant persistent storage - export regularly)' : '';
  return source + keep;
}

void startCamera();
void initDomainVideos();
void initDataset().then(() => characterSelect.open(findCharacter(loadCharacterId())));
requestAnimationFrame(loop);

function loadCharacterId(): string | null {
  try {
    return localStorage.getItem(CHARACTER_STORAGE_KEY);
  } catch {
    return null;
  }
}
