import { AbilityId } from '../combat/AbilityTypes';
import { Moves, isDomain } from '../combat/MoveCatalog';
import { fingerExtension, palmSize, dist2d } from './HandGeometry';
import type { TrackedHand } from './HandTypes';
import type { GestureEval } from './GestureTypes';

/** Silhouette approximations, not a claim to recover occluded finger topology. */
export function evaluateDomainSigns(hands: TrackedHand[]): GestureEval[] {
  const ext=(h:TrackedHand)=>[5,9,13,17].map(b=>fingerExtension(h,b+3,b+1,b));
  const facts=hands.map(h=>{
    const e=ext(h), p=h.landmarks, scale=palmSize(h);
    return {e,p,scale, open:e.every(v=>v>.45), fist:e.every(v=>v<.42),
      pinch:dist2d(p[4],p[8])/scale<.48,
      diagonal:Math.abs(p[8].x-p[5].x)>Math.abs(p[8].y-p[5].y)*.45,
      up:p[8].y<p[5].y-.2*scale,
      thumbOut:dist2d(p[4],p[5])/scale>.65};
  });
  const [a,b]=facts;
  const gap=a&&b?dist2d(a.p[9],b.p[9])/((a.scale+b.scale)/2):99;
  const close=gap<2.1;
  const both=(fn:(f:typeof facts[number])=>boolean)=>!!a&&!!b&&fn(a)&&fn(b);
  return Moves.filter(m=>isDomain(m.id)).map(m=>{
    const c: [string,boolean][]=[];
    const check=(name:string,passed:boolean)=>c.push([name,passed]);
    check(m.id===AbilityId.UNLIMITED_VOID?'One visible hand':'Both hands visible',m.id===AbilityId.UNLIMITED_VOID?!!a:!!a&&!!b);
    if(a && (b||m.id===AbilityId.UNLIMITED_VOID)) switch(m.id) {
      case AbilityId.DOMAIN_EXPANSION: check('Close clasped fists',close&&both(f=>f.fist));break;
      case AbilityId.MALEVOLENT_SHRINE: check('Middle and ring extended; index and pinky folded',both(f=>f.e[1]>.45&&f.e[2]>.45&&f.e[0]<.42&&f.e[3]<.42));check('Hands together',close);break;
      case AbilityId.UNLIMITED_VOID: check('Index and middle raised, other fingers folded',facts.some(f=>f.e[0]>.45&&f.e[1]>.45&&f.e[2]<.42&&f.e[3]<.42&&dist2d(f.p[8],f.p[12])/f.scale<.55));break;
      case AbilityId.IRON_MOUNTAIN: check('Partly bent fingers',both(f=>f.e.filter(v=>v>.15&&v<.65).length>=2&&!f.fist&&!f.open));check('Angled close hands',close&&both(f=>f.diagonal));break;
      case AbilityId.SELF_EMBODIMENT: check('Raised finger steeple',both(f=>f.e[0]>.45&&f.e[1]>.45));check('Thumbs joined',dist2d(a.p[4],b.p[4])/(a.scale+b.scale)<.35);check('Index tips joined',dist2d(a.p[8],b.p[8])/(a.scale+b.scale)<.45);break;
      case AbilityId.MUTUAL_LOVE: check('One open palm and one fist',(a.open&&b.fist)||(b.open&&a.fist));check('Hands alongside',close);break;
      case AbilityId.CAPTIVATING_SKANDHA: check('Curved fingers',both(f=>!f.open&&!f.fist&&f.e.filter(v=>v>.15&&v<.7).length>=2));check('Cupped gap',gap>.8&&gap<2.3);check('Upright clasp',!a.diagonal&&!b.diagonal);break;
      case AbilityId.YUJI_DOMAIN: check('Index fingers upright',both(f=>f.e[0]>.45&&f.up&&!f.diagonal&&f.e[1]<.42&&f.e[2]<.42&&f.e[3]<.42));check('Index tips close',dist2d(a.p[8],b.p[8])/(a.scale+b.scale)<.5);break;
      case AbilityId.WOMB_PROFUSION: check('Diagonal index fingers; lower fingers curled',both(f=>f.e[0]>.45&&f.diagonal&&f.e[2]<.42&&f.e[3]<.42));check('Fingers point toward each other',(a.p[8].x-a.p[5].x)*(b.p[8].x-b.p[5].x)<0);check('Hands close',close);break;
      case AbilityId.DEATH_GAMBLE: check('Pinch above a flat palm',(a.pinch&&b.open&&a.p[8].y<b.p[9].y)||(b.pinch&&a.open&&b.p[8].y<a.p[9].y));check('Hands nearby',gap<3);break;
      case AbilityId.RYU_DOMAIN: check('Outer fingers raised, central fingers bent',both(f=>f.e[0]>.45&&f.e[3]>.45&&f.e[1]<.5&&f.e[2]<.5));check('Thumb arch joined',dist2d(a.p[4],b.p[4])/(a.scale+b.scale)<.5);break;
      case AbilityId.URO_DOMAIN: check('Two fists with thumbs out',both(f=>f.fist&&f.thumbOut));check('Crossed wrist silhouette',dist2d(a.p[0],b.p[0])/(a.scale+b.scale)<.6&&(a.p[9].x-a.p[0].x)*(b.p[9].x-b.p[0].x)<0);break;
    }
    const passed=c.length>1&&c.every(([,v])=>v);
    return {id:m.id,displayName:m.name,passed,score:passed?(m.id===AbilityId.URO_DOMAIN?.99:.95):0,checks:c.map(([name,passed])=>({name,passed,value:passed?1:0,detail:m.short}))};
  });
}
