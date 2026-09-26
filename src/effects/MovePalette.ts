import type {CombatAction} from '../combat/CombatManager';
export interface MoveLook {color:string;accent:string;shape:string;duration:number;notes:number[];wave:OscillatorType;noise:number;}
export const MOVE_LOOKS:Record<CombatAction,MoveLook>={
 BASIC_PUNCH:{color:'#ffb54d',accent:'#fff7d9',shape:'impact',duration:380,notes:[150,65],wave:'triangle',noise:.35},
 CLEAVE:{color:'#ff294f',accent:'#fff4f6',shape:'slashes',duration:440,notes:[1200,450,110],wave:'sawtooth',noise:.6},
 PIERCING_BLOOD:{color:'#df0837',accent:'#ffb8c5',shape:'blood',duration:520,notes:[180,880,330],wave:'sawtooth',noise:.35},
 DIVINE_DOGS:{color:'#52e6bf',accent:'#f4ffff',shape:'claws',duration:650,notes:[180,130,90],wave:'triangle',noise:.22},
 NUE:{color:'#be67ff',accent:'#ecdcff',shape:'lightning',duration:600,notes:[920,140,720,80],wave:'square',noise:.6},
 MAHORAGA:{color:'#ffcf65',accent:'#ffffdd',shape:'wheel',duration:1200,notes:[220,330,440,660],wave:'triangle',noise:.16},
 GOJO_ULTIMATE:{color:'#509dff',accent:'#e2e8ff',shape:'void',duration:1400,notes:[110,165,247,370],wave:'sine',noise:.12},
 SUKUNA_ULTIMATE:{color:'#f22548',accent:'#ffcf88',shape:'shrine',duration:1350,notes:[82,123,98,49],wave:'sawtooth',noise:.28},
 MEGUMI_ULTIMATE:{color:'#20d9ab',accent:'#b6ffe8',shape:'garden',duration:1300,notes:[130,65,98,44],wave:'sine',noise:.3},
 REVERSAL_RED:{color:'#ff3348',accent:'#ffdad0',shape:'repel',duration:520,notes:[130,260,780],wave:'sawtooth',noise:.32},
 AMPLIFICATION_BLUE:{color:'#258aff',accent:'#acfaff',shape:'attract',duration:600,notes:[790,390,160],wave:'sine',noise:.08},
 GRANITE_BLAST:{color:'#ffc959',accent:'#fff9dc',shape:'granite',duration:520,notes:[95,190,760],wave:'square',noise:.4},
 RYU_ULTIMATE:{color:'#ffe095',accent:'#ffffff',shape:'restore',duration:850,notes:[262,330,392,523],wave:'sine',noise:.02},
 YUJI_ULTIMATE:{color:'#ff1947',accent:'#ff8baf',shape:'combo',duration:650,notes:[72,96,128,192],wave:'square',noise:.48},
 CURSED_TOOLS:{color:'#65d9ec',accent:'#f4ffff',shape:'blade',duration:450,notes:[1400,2100,700],wave:'triangle',noise:.2},
 CURSE_SWALLOW:{color:'#b06bff',accent:'#f2c8ff',shape:'swallow',duration:650,notes:[440,220,55],wave:'sine',noise:.18},
 GETO_ULTIMATE:{color:'#9c50ff',accent:'#e6b6ff',shape:'uzumaki',duration:1100,notes:[65,130,260,520],wave:'sawtooth',noise:.22},
 RIKA:{color:'#ff7bd4',accent:'#ffe7fa',shape:'spirit',duration:780,notes:[233,466,349],wave:'triangle',noise:.15},
 YUTA_ULTIMATE:{color:'#87ffec',accent:'#ff9edb',shape:'copy',duration:950,notes:[330,495,660,990],wave:'triangle',noise:.04},
 CHOSO_ULTIMATE:{color:'#ee2357',accent:'#ffcab8',shape:'supernova',duration:820,notes:[145,290,580,70],wave:'sawtooth',noise:.42},
 HOLLOW_PURPLE:{color:'#b05cff',accent:'#ffdbff',shape:'purple',duration:880,notes:[196,294,588,98],wave:'sine',noise:.28},
};
export interface HandOrigin{x:number;y:number;}
export function validOrigin(value:unknown):HandOrigin|null{
 const v=value as HandOrigin|undefined;
 return v&&Number.isFinite(v.x)&&Number.isFinite(v.y)?{x:Math.max(0,Math.min(1,v.x)),y:Math.max(0,Math.min(1,v.y))}:null;
}
