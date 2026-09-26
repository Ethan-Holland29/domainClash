import './style.css';
import { CameraError, CameraManager } from './camera/CameraManager';
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
import { GestureDebugPanel } from './ui/GestureDebugPanel';
import { MoveBanner } from './ui/MoveBanner';
import { MovePanel } from './ui/MovePanel';
import { StatusOverlay } from './ui/StatusOverlay';

const MIRRORED = true;
const CHARACTER_STORAGE_KEY = 'domainclash.characterId';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <h1>DomainClash</h1>
  <div id="stage">
    <video id="webcam" playsinline muted></video>
    <canvas id="overlay"></canvas>
  </div>
`;

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
const banner = new MoveBanner(stage);
const characterSelect = new CharacterSelect(stage, CHARACTERS, moveStatus);
const movePanel = new MovePanel(app, moveStatus);
const cinematic = new DomainCinematic();
// Keeps the video panel between the move panel and the (later-created) dataset panel.
const videoPanelHost = document.createElement('div');
videoPanelHost.className = 'panel-host';
app.appendChild(videoPanelHost);
let videoStore: DomainVideoStore | null = null;

let character: CharacterDefinition | null = null;
let characterMoveSlots: Record<MoveSlot, GestureDefinition> | null = null;
let datasetPanel: DatasetPanel | null = null;

gestures.onEvent((event) => hud.logEvent(event));
// Combat will subscribe here later; for now a fired move is announced.
gestures.onAction((action, gesture) => {
  const slot = MOVE_SLOTS.find((s) => characterMoveSlots?.[s].id === gesture.id);
  console.info(`[move] ${character?.name} ${slot ?? '?'} (${action}): ${gesture.name}`);
  if (!character || !slot) return;
  const title = slot === 'ultimate' ? `Domain Expansion: ${gesture.name}` : gesture.name;
  banner.show(`${character.name} · ${SLOT_NAME[slot]}`, title.toUpperCase(), character.color);
  if (slot === 'ultimate') void playDomainVideo(character, gesture);
});

/**
 * Plays the Domain Expansion clip for this domain: the video uploaded in the
 * "Domain Expansion videos" panel, else a bundled file in src/assets/domains/.
 */
async function playDomainVideo(who: CharacterDefinition, domain: GestureDefinition): Promise<void> {
  await prepareDomainVideo(); // normally already loaded when the character was picked
  const url = prepared?.domainId === domain.id ? prepared.url : findDomainVideo(who.id, domain.id);
  if (!url) {
    console.info(`No video for ${domain.name}: add one in the "Domain Expansion videos" panel.`);
    return;
  }
  await runCinematic(url);
  if (character === who && !characterSelect.isOpen) gestures.requireRelease(domain.id); // holding the sign must not re-fire it
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
  if (cinematic.playing) return;
  gestures.setDefinitions([]); // nothing can fire during the cinematic
  await cinematic.play(url);
  if (character && !characterSelect.isOpen) selectCharacter(character);
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

/** Short learned/rule status of a move, for the select screen and move panel. */
function moveStatus(gesture: GestureDefinition): string {
  const n = LEARNED_MODEL.countFor(gesture.datasetLabel);
  const need = SIGN_TUNING.learned.minSamples;
  if (n >= need) return `learned (${n})`;
  if (gesture.taughtOnly) return `teach it: record ${gesture.datasetLabel} (${n}/${need})`;
  return `built-in sign (${n}/${need} recorded)`;
}

function selectCharacter(next: CharacterDefinition): void {
  character = next;
  characterMoveSlots = characterMoves(next);
  gestures.setDefinitions(MOVE_SLOTS.map((slot) => characterMoveSlots![slot]));
  movePanel.setCharacter(next, characterMoveSlots);
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
movePanel.onChangeCharacter = openCharacterSelect;
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if ((e.key === 'c' || e.key === 'C') && !characterSelect.isOpen && !cinematic.playing) openCharacterSelect();
});

let lastVideoTime = -1;
let lastFrame: HandFrame | null = null;

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
  hud.update({ status: statusText(), fps: fps.fps, frame: running ? lastFrame : null, gesture: snapshot });
  gestureDebug.update(snapshot);
  movePanel.update(snapshot);
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
    const panel = new DatasetPanel(app, manager, recorder, labelGroups());
    datasetPanel = panel;
    await panel.refreshCounts();

    // Learned gestures (e.g. Piercing Blood) train on the recorded samples, and
    // retrain whenever the dataset changes. Debounced: a 100-sample recording
    // saves one sample at a time.
    let retrain: ReturnType<typeof setTimeout> | undefined;
    const train = async () => {
      LEARNED_MODEL.train(await manager.all());
      movePanel.refreshStatus();
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
