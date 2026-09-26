import type {CombatAction} from '../combat/CombatManager';
import config from './characters.json';
import type {VfxTier} from './VfxBudget';
export interface MoveLook {color:string;accent:string;ambient:string;shape:string;duration:number;notes:number[];wave:OscillatorType;noise:number;tier:VfxTier;particleStyle:string;aura:boolean;shake?:number;}
export const MOVE_LOOKS=Object.fromEntries(config.moves.map(m=>[m.gestureId,{
 color:m.colorPrimary,accent:m.colorSecondary,ambient:m.ambient,shape:m.motionStyle,duration:m.duration_ms,
 notes:m.notes,wave:m.wave,noise:m.noise,tier:m.vfxTier,particleStyle:m.particleStyle,aura:true,shake:m.screenShake??0,
}])) as Record<CombatAction,MoveLook>;
const characterLooks=new Map(config.characters.map(c=>[c.id,{
 ...MOVE_LOOKS.BASIC_PUNCH,color:c.aura??c.accent,accent:c.accent,aura:c.aura!==null,
}]));
const toolsLook={...MOVE_LOOKS.CURSED_TOOLS,aura:false};
export const BLACK_FLASH_LOOK=config.blackFlash as MoveLook;
export function moveLook(action:CombatAction,characterId?:string):MoveLook {
 if(action==='BASIC_PUNCH')return characterLooks.get(characterId??'')??MOVE_LOOKS.BASIC_PUNCH;
 if(action==='CURSED_TOOLS')return toolsLook;
 return MOVE_LOOKS[action];
}
export interface HandOrigin{x:number;y:number;}
export function validOrigin(value:unknown):HandOrigin|null{
 const v=value as HandOrigin|undefined;
 return v&&Number.isFinite(v.x)&&Number.isFinite(v.y)?{x:Math.max(0,Math.min(1,v.x)),y:Math.max(0,Math.min(1,v.y))}:null;
}
