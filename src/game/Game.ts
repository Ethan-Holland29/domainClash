import { CharacterSelect } from '../characters/CharacterSelect';
import { characterById } from '../characters/Characters';
import { Training } from '../signs/Training';
import { TrackingInput } from "../handTracking/TrackingInput";
import { PeerCamera } from "../multiplayer/PeerCamera";
import { LocalCastFeedback } from "../multiplayer/LocalCastFeedback";
import { MultiplayerClient, type MatchSnapshot, type NetEvent } from "../multiplayer/MultiplayerClient";
import { MultiplayerUI } from "../multiplayer/MultiplayerUI";
import { isDomain, MoveById } from "../combat/MoveCatalog";
import { MoveDock } from "../ui/MoveDock";
import { moveGuide } from "../ui/MoveGuide";
import { CameraError, CameraManager } from "../camera/CameraManager";
import { AudioManager } from "../audio/AudioManager";
import { CombatManager } from "../combat/CombatManager";
import { AbilityId } from "../combat/AbilityTypes";
import { GameConfig } from "../config/GameConfig";
import { MergedGestureRecognizer as GestureRecognizer } from "../handTracking/MergedGestureRecognizer";
import { HandTracker } from "../handTracking/HandTracker";
import { GameRenderer } from "../rendering/GameRenderer";
import { DebugHUD } from "../ui/DebugHUD";
import { GameHUD } from "../ui/GameHUD";

export class Game {
  private readonly camera = new CameraManager(el("webcam", HTMLVideoElement));
  private readonly tracker = new HandTracker();
  private readonly gestures = new GestureRecognizer();
  private character = characterById('gojo');
  private trainingOpen = false;
  private readonly training = new Training(this.gestures);
  private readonly combat = new CombatManager();
  private readonly audio = new AudioManager();
  private readonly renderer = new GameRenderer(el("game-canvas", HTMLCanvasElement), el("webcam", HTMLVideoElement));
  private readonly hud = new GameHUD(el("game-hud", HTMLElement));
  private readonly debugHud = new DebugHUD(el("debug-hud", HTMLElement));
  private readonly overlay = el("screen-overlay", HTMLElement);
  private readonly card = el("overlay-card", HTMLElement);
  private readonly net = new MultiplayerClient();
  private readonly netUI: MultiplayerUI;
  private readonly relay = new PeerCamera(this.net, el("webcam", HTMLVideoElement));
  private multiplayer = false;
  private readonly feedback=new LocalCastFeedback();
  private readonly dock: MoveDock;
  private started = false;
  private paused = false;
  private debug: boolean = GameConfig.debug.showByDefault;
  private muted = false;
  private lastTs = 0;
  private simulationMs = 0;
  private readonly trackingInput = new TrackingInput();
  private fps = 60;
  private lastHands: import("../handTracking/HandTypes").TrackedHand[] = [];
  private trackerReady = false;
  private cameraBusy = false;
  private cameraGeneration = 0;
  private status = "Choose webcam or keyboard controls to enter the arena.";
  private raf = 0;
  private disposed = false;
  private readonly events = new AbortController();

  constructor() {
    this.dock = new MoveDock(id=>this.activate(id), ()=>{}, this.events.signal);
    this.netUI = new MultiplayerUI(this.net, () => {
      this.closeTraining();this.multiplayer=true;this.started=true;this.reset();this.setNetworkControls(true);
      void this.audio.unlock();this.renderer.setSplit(true);this.relay.start();

    }, () => {this.relay.stop();this.renderer.setSplit(false);this.multiplayer=false;this.renderer.clearNetwork();this.setNetworkControls(false);this.reset();}, this.events.signal, () => {if(!this.started)this.start(true);else void this.enableCamera();});
    this.relay.onFrame = frame => this.renderer.setRemoteFrame(frame);
    this.relay.onVideo = video => this.renderer.setRemoteVideo(video);
    this.net.onState = state => this.networkState(state);
    this.net.onEvent = event => this.networkEvent(event);
    this.net.onStatus = text => this.netUI.message(text);
    this.combat.practiceMode = true;
    this.gestures.onConfirmed(id => this.activate(id));
    this.combat.on(event => {
      if (event.type === "ability_start" && event.abilityId) {
        this.renderer.startAbility(event.abilityId);
        this.audio.playAbility(event.abilityId);
      }
      if (event.type === "hit") { this.audio.play("hit"); this.renderer.onHit(); }
      if (event.type === "player_hurt") { this.audio.play("hurt"); this.renderer.onPlayerHurt(); }
      if (event.type === "domain_active") this.renderer.onDomainActive(event.abilityId!);
      if (event.type === "domain_end") this.renderer.onDomainEnd();
      if (event.type === "victory" || event.type === "defeat") this.showEnd(event.type);
    });
    const options = { signal: this.events.signal };
    window.addEventListener("keydown", event => this.onKey(event), options);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.started && this.overlay.hidden) this.togglePause();
    }, options);
    window.addEventListener("pagehide", () => this.dispose(), options);
    el("camera-toggle", HTMLButtonElement).addEventListener("click", () => {
      if (this.cameraBusy || this.camera.isActive()) this.stopCamera();
      else {if(!this.started)this.start(true);else void this.enableCamera();}
    }, options);
    el("tracking-retry", HTMLButtonElement).addEventListener("click", () => void this.enableCamera(), options);
    el("mute", HTMLButtonElement).addEventListener("click", () => {
      this.muted = !this.muted;
      this.audio.setMuted(this.muted);
      el("mute", HTMLButtonElement).textContent = this.muted ? "Sound off" : "Sound on";
      el("mute", HTMLButtonElement).setAttribute("aria-pressed", String(this.muted));
    }, options);
    el("pause", HTMLButtonElement).addEventListener("click", () => this.togglePause(), options);
    el("debug-toggle", HTMLButtonElement).addEventListener("click", () => this.toggleDebug(), options);
    el("guide", HTMLButtonElement).addEventListener("click", () => {
      this.paused = this.started;
      this.gestures.reset();
      this.overlay.hidden = false;
      this.showStart();
    }, options);
    el("mode", HTMLButtonElement).addEventListener("click", () => {
      this.combat.practiceMode = !this.combat.practiceMode;
      el("mode", HTMLButtonElement).textContent = this.combat.practiceMode ? "Free cast" : "Duel mode";
      if (this.started) this.reset();
    }, options);
    el("reset-effects", HTMLButtonElement).addEventListener("click", () => { if (this.started) this.reset(); }, options);
    el("game-canvas", HTMLCanvasElement).addEventListener("pointermove", event => {
      const rect = el("game-canvas", HTMLCanvasElement).getBoundingClientRect();
      this.renderer.setPointer((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
    }, options);
    new CharacterSelect(el('character-screen',HTMLElement),id=>this.selectFighter(id));
    el('change-fighter',HTMLButtonElement).addEventListener('click',()=>{
      if(this.multiplayer)return;
      this.closeTraining();this.paused=true;this.gestures.reset();
      el('character-screen',HTMLElement).hidden=false;el('battle-screen',HTMLElement).hidden=true;
    },options);
    el('gesture-training',HTMLButtonElement).addEventListener('click',()=>{
      if(this.multiplayer)return;
      this.trainingOpen=true;this.paused=false;this.overlay.hidden=true;this.gestures.reset();
      el('training-panel',HTMLElement).hidden=false;
      this.setStatus('Enable camera to record signs. Your training inputs never attack.');
    },options);
    el('training-camera',HTMLButtonElement).addEventListener('click',()=>void this.enableCamera(),options);
    el('training-camera-stop',HTMLButtonElement).addEventListener('click',()=>this.stopCamera(),options);
    el('close-training',HTMLButtonElement).addEventListener('click',()=>this.closeTraining(),options);
    this.gestures.setMoves(this.character.moves);this.dock.setMoves(this.character.moves);
    this.training.onTrained=()=>{this.gestures.refreshLabels();this.dock.setMoves(this.character.moves);};
    void this.training.init();
    this.debugHud.setVisible(this.debug);
    this.raf = requestAnimationFrame(t => this.loop(t));
  }

  private selectFighter(id:string):void {
    if(this.multiplayer)return;
    this.character=characterById(id);this.net.characterId=this.character.id;
    this.gestures.setMoves(this.character.moves);this.dock.setMoves(this.character.moves);this.training.changed();
    el('fighter-name',HTMLElement).textContent=this.character.name;
    el('character-screen',HTMLElement).hidden=true;el('battle-screen',HTMLElement).hidden=false;
    this.start(false);
    this.setStatus(this.character.name+' selected. Keys 1–3 cast your techniques. Enable camera for signs, or Multiplayer to challenge a friend.');
  }
  private closeTraining():void {
    this.trainingOpen=false;this.training.cancel();this.gestures.reset();
    el('training-panel',HTMLElement).hidden=true;
    this.setStatus('Hold a sign to cast, or use keys 1–3.');
  }
  private activate(id: AbilityId): void {
    if(this.trainingOpen||!this.character.moves.includes(id))return;
    if (!this.started || this.paused || !this.overlay.hidden) return;
    if (this.combat.practiceMode && isDomain(id) && this.combat.domain.canActivate()) this.combat.meter.add(100);
    if(this.multiplayer){
      const prediction=this.net.connected?this.feedback.predict(id,this.net.state,performance.now()):null;
      if(prediction!==null){this.renderer.startAbility(id);this.audio.playAbility(id);}
      void this.net.action("cast",{id}).then(ok=>{if(!ok&&prediction!==null)this.feedback.reject(prediction);});return;
    }
    this.combat.tryActivate(id, this.simulationMs);
  }

  private start(camera: boolean): void {
    this.started = true;
    this.reset();
    void this.audio.unlock().then(() => this.audio.setMuted(this.muted)).catch(() => {
      this.setStatus("Audio unavailable. The game can still be played silently.");
    });
    this.setStatus("Preview: move your pointer to set the source. Scroll the dock for more moves; keys 1–3 cast the visible cards.");
    if (camera) void this.enableCamera();
  }

  private reset(): void {
    this.feedback.reset();this.combat.reset();
    if (this.combat.practiceMode) this.combat.meter.add(100);
    this.gestures.reset();
    this.renderer.reset();
    this.simulationMs = 0;
    this.trackingInput.reset();
    this.paused = false;
    this.overlay.hidden = true;
    el("pause", HTMLButtonElement).textContent = "Pause";
  }

  private async enableCamera(): Promise<void> {
    if (this.cameraBusy || this.disposed) return;
    this.cameraBusy = true;
    const generation = ++this.cameraGeneration;
    this.cameraMessage("Waiting for camera permission. Allow Camera in your browser; you can cancel and retry from the camera button.");
    el("camera-toggle", HTMLButtonElement).textContent = "Cancel camera";
    try {
      await this.camera.start();
      if (generation !== this.cameraGeneration || this.disposed) return;
      el("camera-toggle", HTMLButtonElement).textContent = "Stop camera";
      this.cameraMessage("Camera live. Loading hand tracking… You can already see yourself.");
      try {
        await this.tracker.initialize();
        if (generation !== this.cameraGeneration || this.disposed) return;
        this.trackerReady = true;
        this.gestures.reset();this.trackingInput.reset();
        el("tracking-retry", HTMLButtonElement).hidden=true;
        this.cameraMessage("Camera and hand tracking ready. Show your hands, hold a sign, then relax.");
      } catch {
        if (generation !== this.cameraGeneration || this.disposed) return;
        this.tracker.close();this.trackerReady=false;
        el("tracking-retry", HTMLButtonElement).hidden=false;
        this.cameraMessage("Camera is live, but hand tracking failed to load. Click Retry hand tracking. Buttons still work.");
      }
    } catch (error) {
      if (generation !== this.cameraGeneration || this.disposed) return;
      this.camera.stop();this.tracker.close();this.trackerReady=false;
      this.cameraMessage(error instanceof CameraError ? error.message : "Could not start the camera. Check browser permissions and retry.");
      el("camera-toggle", HTMLButtonElement).textContent = "Enable camera";
    } finally {
      if(generation===this.cameraGeneration)this.cameraBusy=false;
    }
  }

  private cameraMessage(text:string):void {
    el("camera-status",HTMLElement).textContent=text;
    el("training-camera-status",HTMLElement).textContent=text;
    const message=document.getElementById("mp-camera-status");if(message)message.textContent=text;
    this.setStatus(text);
  }

  private stopCamera(): void {
    this.cameraGeneration++;this.cameraBusy=false;
    this.camera.stop();void this.relay.clear();
    this.tracker.close();
    this.trackerReady = false;this.trackingInput.reset();
    this.lastHands = [];
    this.gestures.reset();
    this.renderer.setHands([]);
    el("camera-toggle", HTMLButtonElement).textContent = "Enable camera";
    el("tracking-retry", HTMLButtonElement).hidden=true;
    this.cameraMessage("Camera stopped. Enable it here or from the multiplayer menu.");
  }

  private loop(ts: number): void {
    if (this.disposed) return;
    const dt = this.lastTs ? Math.max(0, Math.min(50, ts - this.lastTs)) : 0;
    this.lastTs = ts;
    if(this.trackerReady&&!this.camera.isActive()){
      this.stopCamera();this.cameraMessage("Camera disconnected. Check its connection, close other camera apps, and click Enable camera.");
    }
    this.fps += ((dt > 0 ? 1000 / dt : 60) - this.fps) * 0.06;
    if (this.started && !this.paused && this.overlay.hidden) {
      this.simulationMs += dt;
      if (this.trackerReady && this.camera.isReady()) {
        try {
          this.gestures.aspectRatio=this.camera.getVideo().videoWidth/this.camera.getVideo().videoHeight||4/3;
          const frame = this.tracker.detect(this.camera.getVideo(), ts);
          if(frame.timestampMs>=0){this.lastHands=frame.hands;this.renderer.setHands(frame.hands);}
          this.trackingInput.update(frame,ts,this.simulationMs,this.gestures);
          this.lastHands=this.trackingInput.hands;
          this.renderer.setHands(this.lastHands);
        } catch {
          this.tracker.close();this.trackerReady=false;this.lastHands=[];this.renderer.setHands([]);
          el("tracking-retry", HTMLButtonElement).hidden=false;
          this.cameraMessage("Camera is live; hand tracking interrupted. Click Retry hand tracking.");
        }
      } else {
        this.gestures.suspend();this.trackingInput.reset();
        this.renderer.setHands([]);
        this.lastHands = [];
      }
      if(!this.multiplayer&&!this.trainingOpen)this.combat.update(dt, this.simulationMs);
    }
    this.renderer.draw(this.combat, this.paused ? 0 : dt / 1000);
    el("tracking-badge", HTMLElement).textContent = this.lastHands.length
      ? this.lastHands.length + " HAND" + (this.lastHands.length > 1 ? "S" : "") + " TRACKED / LIVE VFX"
      : this.camera.isActive() ? this.trackerReady ? "CAMERA LIVE / SHOW YOUR HANDS" : "CAMERA LIVE / TRACKING NOT READY" : "POINTER PREVIEW / CAMERA OFF";
    document.querySelector(".private-label")!.textContent=this.multiplayer?(this.camera.isActive()?"VIDEO SHARED WITH OPPONENT":"ONLINE / CAMERA OFF"):"ON-DEVICE / PRIVATE";
    const gesture = this.gestures.state();
    if(!this.multiplayer)this.hud.render(this.combat, gesture, this.simulationMs);
    else el("game-hud",HTMLElement).innerHTML="";
    if (this.debug) this.debugHud.render({ hands: this.lastHands, fps: this.fps, gesture,
      evals: this.gestures.debugEvals(), cameraError: null });
    this.raf = requestAnimationFrame(t => this.loop(t));
  }

  private onKey(event: KeyboardEvent): void {
    if(!el('character-screen',HTMLElement).hidden)return;
    if(this.trainingOpen){if(event.key==='Escape')this.closeTraining();return;}
    if(!document.querySelector<HTMLElement>('.multiplayer-panel')!.hidden)return;
    if (event.key === "Tab" && !this.overlay.hidden) {
      const buttons = Array.from(this.card.querySelectorAll<HTMLElement>("button, summary, [tabindex]"));
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
      buttons[next]?.focus(); event.preventDefault(); return;
    }
    if(this.multiplayer && event.code==="Space" && this.overlay.hidden){event.preventDefault();if(!event.repeat)void this.net.action("guard");return;}
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.key.toLowerCase() === "d") { this.toggleDebug(); return; }
    if (event.key === "Escape" || event.key.toLowerCase() === "p") { this.togglePause(); return; }
    if (this.overlay.hidden && (event.key === "PageDown" || event.key === "PageUp")) { event.preventDefault();this.dock.move(event.key === "PageDown" ? 1 : -1);return; }
    const id = this.dock.ids[Number(event.key)-1];
    if (id && GameConfig.debug.keyboardShortcuts) { event.preventDefault(); this.activate(id); }
  }

  private toggleDebug(): void {
    this.debug = !this.debug;
    this.debugHud.setVisible(this.debug);
    this.renderer.setDebug(this.debug);
    el("debug-toggle", HTMLButtonElement).setAttribute("aria-pressed", String(this.debug));
  }

  private togglePause(): void {
    if(this.multiplayer){this.setStatus("Online matches keep running. Use Multiplayer to leave the room.");return;}
    if (!this.started || (!this.overlay.hidden && !this.paused)) return;
    this.paused = !this.paused;
    this.gestures.reset();
    this.overlay.hidden = !this.paused;
    el("pause", HTMLButtonElement).textContent = this.paused ? "Resume" : "Pause";
    if (this.paused) {
      this.card.innerHTML = '<p class="eyebrow">TAKE A BREATH</p><h1>Paused</h1><p>Combat is frozen. Resume when you are ready.</p><button id="resume">Resume fight</button>';
      el("resume", HTMLButtonElement).addEventListener("click", () => this.togglePause());
      el("resume", HTMLButtonElement).focus();
    }
  }

  private showStart(): void {
    this.card.classList.add("library-card");
    this.card.innerHTML = moveGuide(this.character.moves);
    el("start-multiplayer", HTMLButtonElement).addEventListener("click",()=>{if(!this.started)this.start(false);else{this.paused=false;this.overlay.hidden=true;}this.netUI.open();});
    if (this.started) {
      el("start-keyboard", HTMLButtonElement).textContent = "Resume studio";
      el("start-keyboard", HTMLButtonElement).addEventListener("click",()=>{this.paused=false;this.overlay.hidden=true;el("pause",HTMLButtonElement).textContent="Pause";});
      el("start-camera", HTMLButtonElement).addEventListener("click",()=>{this.paused=false;this.overlay.hidden=true;if(!this.trackerReady)void this.enableCamera();});
    } else {
      el("start-camera", HTMLButtonElement).addEventListener("click", () => this.start(true));
      el("start-keyboard", HTMLButtonElement).addEventListener("click", () => this.start(false));
    }
  }

  private showEnd(kind: "victory" | "defeat"): void {
    this.overlay.hidden = false;
    this.gestures.reset();
    this.card.innerHTML = `<p class="eyebrow">MATCH COMPLETE</p><h1>${kind === "victory" ? "Victory" : "Defeat"}</h1>
      <p>${kind === "victory" ? "The arena is yours." : "Every clash is a lesson. Try again."}</p>
      <p class="fine">${Math.round(this.simulationMs / 1000)} seconds · ${this.combat.playerHp.current} HP remaining</p><button id="restart">Fight again</button>`;
    el("restart", HTMLButtonElement).addEventListener("click", () => this.reset());
    el("restart", HTMLButtonElement).focus();
  }

  private setNetworkControls(active:boolean):void {
    if(!active)el("network-status",HTMLElement).textContent="";
    document.querySelector(".private-label")!.textContent=active?"VIDEO SHARED WITH OPPONENT":"ON-DEVICE / PRIVATE";
    for(const id of ["mode","reset-effects","pause","change-fighter","gesture-training","guide"])el(id,HTMLButtonElement).disabled=active;
  }
  private networkState(state:MatchSnapshot):void {
    if(!this.multiplayer)return;
    if(state.phase==='finished')this.relay.stop();else this.relay.update(state);
    el('network-status',HTMLElement).textContent=this.net.transport+' · '+this.relay.status+' · '+this.tracker.mode;
    this.renderer.setNetworkDomains(state.domains,state.now,state.seat);
    this.netUI.render(state);
  }
  private networkEvent(event:NetEvent):void {
    if(!this.multiplayer)return;
    if(event.type==="cast"&&event.id&&!(event.owner===this.net.state?.seat&&this.feedback.confirm(event.id,performance.now()))){this.renderer.startAbility(event.id,event.owner!==this.net.state?.seat);this.audio.playAbility(event.id);}
    if(event.type==="hit"){if(event.target===this.net.state?.seat)this.renderer.onPlayerHurt();else this.renderer.onHit();}
    if(event.type==="clash"){this.renderer.announce("DOMAIN CLASH", "EQUAL REFINEMENT / SURE-HITS CANCELLED");this.audio.announceClash();}
    if(event.type==="overtake")this.renderer.announce("DOMAIN OVERRIDE",event.id?MoveById[event.id].name:"");
    if(event.type==="fight")this.renderer.announce("FIGHT", "ONE SECOND BETWEEN REGULAR ATTACKS");
    if(event.type==="finished")this.renderer.announce(event.winner===null?"DRAW":event.winner===this.net.state?.seat?"VICTORY":"DEFEAT",event.reason??"");
  }

  private setStatus(text: string): void {
    this.status = text;
    el("status", HTMLElement).textContent = this.status;
  }

  dispose(): void {
    this.disposed = true;
    this.training.dispose();
    this.cameraGeneration++;
    cancelAnimationFrame(this.raf);
    this.events.abort();
    this.camera.stop();
    this.tracker.close();
    this.relay.stop();void this.net.leave();this.netUI.dispose();
    this.audio.close();
  }
}

function el<T extends HTMLElement>(id: string, ctor: { new (): T }): T {
  const element = document.getElementById(id);
  if (!(element instanceof ctor)) throw new Error(`Missing #${id}`);
  return element;
}
