import { AbilityId } from '../combat/AbilityTypes';
export interface SoundProfile { notes: number[]; spacing: number; duration: number; wave: OscillatorType; noise: number[]; noiseDuration: number }
export const DomainSounds: Partial<Record<AbilityId,SoundProfile>> = {
 LAPSE_BLUE:{notes:[720,480,240,100],spacing:.04,duration:.15,wave:'sine',noise:[],noiseDuration:.05},
 REVERSAL_RED:{notes:[140,280,560,1120],spacing:.035,duration:.1,wave:'sawtooth',noise:[.1],noiseDuration:.09},
 HOLLOW_PURPLE:{notes:[220,330,110,55],spacing:.045,duration:.2,wave:'triangle',noise:[.14],noiseDuration:.12},
 BLACK_FLASH:{notes:[60,45,120,30],spacing:.025,duration:.12,wave:'square',noise:[0,.05],noiseDuration:.05},
 DOMAIN_EXPANSION:{notes:[110,165,220,330],spacing:.17,duration:.6,wave:'sine',noise:[],noiseDuration:.1},
 MALEVOLENT_SHRINE:{notes:[65,130,195,260,65],spacing:.25,duration:1.2,wave:'triangle',noise:[.5,.72,.94],noiseDuration:.08},
 UNLIMITED_VOID:{notes:[880,1320,1760,2640,3520],spacing:.14,duration:.9,wave:'sine',noise:[],noiseDuration:.1},
 IRON_MOUNTAIN:{notes:[42,48,55,65],spacing:.3,duration:.75,wave:'sawtooth',noise:[0,.19,.41,.83],noiseDuration:.3},
 SELF_EMBODIMENT:{notes:[233,247,466,493,311],spacing:.19,duration:.65,wave:'triangle',noise:[.3],noiseDuration:.08},
 MUTUAL_LOVE:{notes:[261.6,329.6,392,523.2,659.2],spacing:.12,duration:.45,wave:'triangle',noise:[],noiseDuration:.1},
 CAPTIVATING_SKANDHA:{notes:[620,480,350,240],spacing:.3,duration:.4,wave:'sine',noise:[0,.5,1],noiseDuration:.65},
 YUJI_DOMAIN:{notes:[523,659,82,82],spacing:.35,duration:.3,wave:'sine',noise:[.8,1.15],noiseDuration:.04},
 WOMB_PROFUSION:{notes:[180,120,90,60],spacing:.28,duration:.7,wave:'triangle',noise:[0,.28,.56],noiseDuration:.06},
 DEATH_GAMBLE:{notes:[523,659,784,1047,784,1047,1319],spacing:.105,duration:.17,wave:'square',noise:[.74],noiseDuration:.2},
 RYU_DOMAIN:{notes:[48,96,192,768],spacing:.075,duration:.8,wave:'sawtooth',noise:[.22],noiseDuration:.45},
 URO_DOMAIN:{notes:[1480,2217,1175,2960],spacing:.21,duration:.55,wave:'sine',noise:[0,.42],noiseDuration:.2},
};
