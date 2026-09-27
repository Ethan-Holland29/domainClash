import type { AbilityId } from '../combat/AbilityTypes';
import battleRules from "../../server/rules.json" with {type:"json"};
import { Moves } from '../combat/MoveCatalog';
export function moveGuide(ids?:AbilityId[]):string {
 const selected=ids?Moves.filter(m=>ids.includes(m.id)):Moves;
 return `<p class="eyebrow">${selected.length} TECHNIQUES / HAND-SIGN FIELD GUIDE</p><h1>Your hands.<br><span>Your domain.</span></h1>
 <p class="intro">Keys 1–3 cast your selected fighter’s techniques. Built-in signs work immediately; custom signs must first be recorded in Gesture training. Hold steadily for about half a second, then relax before repeating. Regular attacks share a one-second recovery online.</p>
 <div class="guide-list" tabindex="0" aria-label="All moves and hand instructions">${selected.map((m,i)=>`<article class="guide-move" style="--move-color:${m.color}"><header><span>${String(i+1).padStart(2,'0')} / ${m.user}</span><b>${m.cooldownMs/1000}s cooldown</b></header><h2>${m.name}</h2><p class="pose">${m.sign}</p><p class="battle-stat">PRIVATE MATCH · ${battleRules[m.id].cost} energy · ${battleRules[m.id].domain?"Refinement tier "+battleRules[m.id].tier:battleRules[m.id].damage+" damage"}</p><p>${m.description}</p><p class="sound">Sound: ${m.sound}.</p><small>${m.note}</small></article>`).join('')}</div>
 <details class="reference"><summary>Open the supplied hand-sign illustration</summary><img src="/hand-sign-reference.jpg" alt="User-supplied JJK domain hand signs reference. Time Cell Moon Palace appears in this reference but is not included in this game."/></details>
 <div class="guide-actions"><button id="start-camera">Enable my camera</button><button id="start-keyboard" class="secondary-button">Preview effects</button><button id="start-multiplayer" class="secondary-button">Private match</button></div>
 <p class="fine">Complex signs use silhouette approximations; hidden fingers cannot be verified. Use keys or cards if tracking struggles. Solo camera frames stay on your device. In multiplayer, a live camera preview is shared with your room’s opponent; no microphone or recording. Hand tracking runs locally. Multiplayer supports domain clashes. Free cast refills the domain meter; cooldowns still apply.</p>`;
}
