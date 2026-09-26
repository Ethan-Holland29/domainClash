# Webcam VFX art direction

This update covers the existing nine-character roster, 21 actions and the existing Black Flash combat proc. It does not introduce additional fighters, a stamina mechanic or new damage/cooldown rules. The supplied longer specification also proposes those gameplay changes; they are separate from this effects pass.

## Reference decisions

The user supplied Red, Hollow Purple and a turquoise cursed-energy aura still. These are visual references, not runtime textures: no footage or screenshot is uploaded into the game. Exact hex values are display approximations. The anime varies lighting and energy color between scenes; the palette is not an official universal color chart.

| Character | Treatment | Basis and limits |
| --- | --- | --- |
| Gojo | Blue pulls wisps inward; Red has a compact pale core and outward scarlet streaks; Purple has a violet-white discharge, turbulent corona and brief shake. Void has a dark center, luminous lens and stars. | User's Red/Purple stills and [Blue's attraction](https://jujutsu-kaisen.fandom.com/wiki/Cursed_Technique_Lapse%3A_Blue). The beam is a screen-readable depiction of Purple's discharge, not a claim that it is always a thin laser. |
| Sukuna | Fast pale cuts against dark contrast; Shrine uses deep red illumination behind a black shrine silhouette. | [Shrine](https://jujutsu-kaisen.fandom.com/wiki/Shrine) describes cutting attacks and [Malevolent Shrine](https://jujutsu-kaisen.fandom.com/wiki/Malevolent_Shrine) its repeated slashes. Cleave is not treated as a canonical neon-magenta energy beam; the pale trace makes the otherwise hard-to-see cut readable. |
| Megumi | Dark violet-black portals, tendrils and claws; Nue uses electrical arcs; Mahoraga uses an eight-spoked wheel; Garden spreads liquid shadows. | [Ten Shadows](https://jujutsu-kaisen.fandom.com/wiki/Ten_Shadows_Technique). These are stylized silhouettes and motifs, not full 3D shikigami models. |
| Choso | Dense dark-red jet and blood droplets; Supernova disperses compressed red orbs. | [Blood Manipulation](https://jujutsu-kaisen.fandom.com/wiki/Blood_Manipulation). Blood is distinct from a generic pink energy laser. |
| Ryu | Pale cyan-white blast and matching recovery flourish. | Direct visual inspection of the [official episode 59 stills](https://jujutsukaisen.jp/episodes/59.php), specifically the pompadour charging shot. Hand placement is this webcam game's control convention. Way Too Sweet! is an existing game ability, not a canonical healing technique. |
| Yuji | Cyan cursed-energy impacts; actual Black Flash procs replace these with dark branching fractures and a white impact core. | [Black Flash](https://jujutsu-kaisen.fandom.com/wiki/Black_Flash). It is not shown for every punch. The existing game's probabilities/damage are preserved, not presented as the manga's exact rules. |
| Toji | Pale metallic weapon streaks and physical impacts, no personal charge aura. | [Heavenly Restriction](https://jujutsu-kaisen.fandom.com/wiki/Heavenly_Restriction): Toji has zero cursed energy. The tool trail is a readable weapon-motion cue. |
| Geto | An inward dark orb for absorption; twisted, smoky concentric energy for Uzumaki. | [Cursed Spirit Manipulation](https://jujutsu-kaisen.fandom.com/wiki/Cursed_Spirit_Manipulation). The charcoal-violet palette is an art-direction approximation. |
| Yuta | Pink-violet spectral energy, a pale monstrous Rika manifestation, and a ring/diamond release for Copy. | [Yuta](https://jujutsu-kaisen.fandom.com/wiki/Yuta_Okkotsu) and [Copy](https://jujutsu-kaisen.fandom.com/wiki/Copy). The Copy lattice is a UI VFX motif, not a claimed canonical attack shape. |

## Implementation and tuning

`src/effects/characters.json` owns character aura overrides, move colors, particle and motion styles, durations, tier budgets, sound signatures and Purple's shake amplitude. The existing combat rule files remain the authority for damage, meters and turn cooldowns; VFX configuration cannot bypass them.

`EnergyLayer` renders procedural WebGL energy on its own transparent canvas. It never samples the webcam into a texture or changes camera/encoder settings. Particle positions live in fixed typed arrays; no per-frame particle objects, gradients or path arrays are created. Low/medium/high budgets are 24/56/96 particles, with 96 per player and 160 across the two local display layers. The renderer is idle when no effect or charge is active (unless the debug overlay is open).

Eight sustained frames slower than 33 ms reduce particle density, shader detail and VFX buffer resolution. Recovery requires 240 fast frames. This governs effects only: existing network bitrate adaptation operates independently. It does not guarantee a particular FPS on every GPU. Browsers without WebGL receive a simple 2D fallback. Reduced-motion mode suppresses particles/shake and limits the release to a short stationary glow.

Gesture candidates produce a local charge aura; release effects are synchronized using the accepted move id, server time, normalized wrist/finger anchor and server-computed Black Flash flag. Clients skip expired events rather than replaying a backlog. No particles or shader state travel across the network. The private-match system is two-player; the global particle cap covers both players rendered on each client.

The **VFX stats** toggle shows animation FPS, active particle counts, quality and both fighters' existing health/meter state. **Gesture settings → Manual** includes Purple/Black Flash visual-only previews; these cannot damage an opponent or satisfy gameplay unlocks.
