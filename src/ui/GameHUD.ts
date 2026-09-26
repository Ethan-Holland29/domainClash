import type { CombatManager } from '../combat/CombatManager';
import { CombatRejectReason } from '../combat/AbilityTypes';
import type { GestureState } from '../handTracking/GestureTypes';
import { MoveById, isDomain } from "../combat/MoveCatalog";

export class GameHUD {
  private readonly root: HTMLElement;
  constructor(root: HTMLElement) { this.root=root; }
  render(combat: CombatManager, gesture: GestureState, now: number): void {
    const ready=combat.meter.isFull();
    const reject=combat.lastReject&&now-combat.lastReject.at<1100?combat.lastReject:null;
    const id=gesture.candidate??gesture.confirmed;
    const domainState=combat.domain.isBusy?'EXPANDING':combat.domain.isActive?`${(combat.domain.remainingMs/1000).toFixed(1)}s ACTIVE`:combat.practiceMode||ready?'DOMAIN READY':`${combat.meter.get()}% DOMAIN`;
    this.root.innerHTML=`
      ${combat.practiceMode?'':`<div class="hud-top"><div class="fighter-panel"><div class="fighter-name">YOUR ENERGY</div>${bar('HP',combat.playerHp.current,100,'hp')}${bar('Domain',combat.meter.get(),100,'domain')}</div><div class="fighter-panel"><div class="fighter-name">CURSE / DUEL</div>${bar('HP',combat.opponentHp.current,100,'enemy')}</div></div>`}
      <div class="hud-feedback"><div class="gesture-line">${id?MoveById[id].name:'SHOW A SIGN'} · ${gesture.phase==='confirmed'||gesture.phase==='cooldown'?'RELAX TO REARM':'HOLD TO CAST'}<div class="hold-track"><span style="width:${gesture.holdProgress*100}%"></span></div></div>${reject?`<div class="reject-flash">${rejectText(reject.reason)}</div>`:''}</div>
      <div class="lab-info"><b>${domainState}</b>${combat.practiceMode?'FREE CAST / EVERY TECHNIQUE UNLOCKED':'DUEL / BUILD YOUR DOMAIN'}</div>`;
    for(const [index,button] of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-ability]')).entries()) {
      const ability=button.dataset.ability as import('../combat/AbilityTypes').AbilityId;
      const remaining=combat.cooldowns.remainingMs(ability);
      const state=remaining>0?`${(remaining/1000).toFixed(1)}s COOLDOWN`:combat.domain.isBusy?'EXPANDING':isDomain(ability)?(combat.domain.isActive&&combat.domain.abilityId!==ability?'DOMAIN IN USE':domainState):'READY';
      const label=button.querySelector('.technique-index');
      if(label)label.textContent=`${index+1} · ${state}`;
    }
  }
}
function bar(label:string,value:number,max:number,kind:string):string {
  return `<div class="bar-wrap"><div class="bar-label"><span>${label}</span><span>${Math.round(value)} / ${max}</span></div><div class="bar ${kind}"><div class="bar-fill" style="width:${Math.max(0,Math.min(100,value/max*100))}%"></div></div></div>`;
}
function rejectText(reason:string):string {
  if(reason===CombatRejectReason.cooldown)return 'Technique cooling down';
  if(reason===CombatRejectReason.meter)return 'Build Domain Meter to 100';
  if(reason===CombatRejectReason.alreadyActive)return 'Domain already active';
  if(reason===CombatRejectReason.busy)return 'Technique in progress';
  return 'Technique unavailable';
}
