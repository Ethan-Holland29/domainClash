# Technique image sources

The active VFX use cropped original anime frames, a Jujutsu Kaisen 0 Rika design, and manga excerpts. No generated imagery or procedural substitute attacks. Sources span seasons 1–3, the film, and manga. Crops and masks are prepared offline as WebP files; full downloaded frames are not bundled.

- **nue.webp**: [source image](https://pbs.twimg.com/media/EqEwnvvVQAAzb3L.jpg); crop [0, 0, 1200, 440]; manual silhouette / color-key.
- **dogs.webp**: [source image](https://a.storyblok.com/f/178900/1920x1080/0d77568cd6/jujutsu-kaisen-e55-megumi.jpg); crop [330, 240, 810, 842]; manual silhouette / color-key.
- **red.webp**: [source image](https://i.ytimg.com/vi/442c2fp_4ds/maxresdefault.jpg); crop [555, 230, 738, 391]; manual silhouette / color-key.
- **blue.webp**: [source image](https://static.deltiasgaming.com/2025/02/gojos-Blue-1536x864.jpg); crop [477, 442, 920, 842]; manual silhouette / color-key.
- **purple.webp**: [source image](https://cdn.shopify.com/s/files/1/0400/9767/7479/files/Jujutsu_Kaisen_Effect_Of_Gojo_s_Purple_Technique.png?v=1744917273); crop [244, 220, 650, 616]; manual silhouette / color-key.
- **rika.webp**: [source image](https://s.cinemacafe.net/imgs/p/HYddfX70X05nh6LzkP_ZwgIDWA8ODQwLCgkI/537806.jpg?zoom=spacing); crop [214, 0, 600, 558]; manual silhouette / color-key.
- **granite.webp**: [source image](https://img.animanch.com/2022/03/1-10.jpg); crop [135, 163, 728, 386]; manual silhouette / color-key.
- **blood.webp**: [source image](https://cdn.shopify.com/s/files/1/0400/9767/7479/files/Jujutsu_Kaisen_Piercing_Blood_Technique.png?v=1750355614); crop [790, 255, 1280, 393]; manual silhouette / color-key.
- **supernova.webp**: [source image](https://jujutsu-kaisen-wiki.vercel.app/assets/supernova-2.webp); crop None; manual silhouette / color-key.
- **slash.webp**: [source image](https://i.imgur.com/Y94qsv3.png); crop [0, 0, 1980, 880]; manual silhouette / color-key.
- **blackflash.webp**: [source image](https://www.looper.com/img/gallery/yuji-itadoris-powers-from-jujutsu-kaisen-explained/yuji-learns-the-black-flash-technique-1633188559.jpg); crop [210, 0, 650, 360]; manual silhouette / color-key.
- **swallow.webp**: [source image](https://cdn-ak.f.st-hatena.com/images/fotolife/L/Lastbreath/20231223/20231223063515.png); crop [447, 263, 654, 424]; manual silhouette / color-key.
- **uzumaki.webp**: [source image](https://pbs.twimg.com/media/GD81f8tawAAONd0.png); crop [160, 65, 341, 263]; manual silhouette / color-key.
- **spear.webp**: [source image](https://theswordstall.co.uk/cdn/shop/articles/Inverted_Spear_of_Heaven__28Anime_29.webp?v=1733166374); crop [140, 0, 1500, 1006]; manual silhouette / color-key.
- **fist.webp**: [source image](https://cdn.alfabetajuega.com/alfabetajuega/2021/07/Crear-una-tecnica-maldita-y-ser-capaz-de-usarla-El-Puno-Divergente.jpg); crop [0, 10, 300, 710]; manual silhouette / color-key.
- **curse.webp**: [source image](https://cdn.shopify.com/s/files/1/0561/3086/3278/files/Suguru_summoning_two_strong_Cursed_Spirits_1.png?v=1640311672); crop [173, 58, 555, 300]; manual silhouette / color-key.
- **void.webp**: [source image](https://static.wikia.nocookie.net/jujutsu-kaisen/images/b/ba/Episodio_07_-_210.jpg/revision/latest/scale-to-width-down/1200?cb=20201126155337&path-prefix=es); crop None; crop.
- **shrine.webp**: [source image](https://m.media-amazon.com/images/M/MV5BYTY2YTc4YjEtYmMwNi00MzY4LThjMjctMzRhNGYwNTlmYzM5XkEyXkFqcGc%40._V1_.jpg); crop None; crop.
- **shadow.webp**: [source image](https://animehunch.com/wp-content/uploads/2021/03/Megumi_Nue.jpg); crop [0, 0, 350, 500]; crop.
- **mutual.webp**: [source image](https://assets.jabarekspres.com/main/2024/02/jujutsu-kaisen-chapter-249-5.webp); crop [0, 425, 1280, 853]; crop.
- **katana.webp**: [source image](https://assets.jabarekspres.com/main/2024/02/jujutsu-kaisen-chapter-249-5.webp); crop [0, 0, 245, 853]; manual silhouette / color-key.

Mahoraga retains the user-supplied project artwork. Shared basic strikes use the cropped cursed fist. Yuji's and Ryu's Domain Expansions have no domain image, so they reuse the strike and Granite crops as impact cues. Yuta's Domain Expansion shows the Authentic Mutual Love image. Cleave and Dismantle share the anime slash crop. These game-specific moves are not presented as separate canonical scenes.

Assets are credited to the original Jujutsu Kaisen manga/anime creators and their respective rights holders, not this project. Source URLs document provenance, not a redistribution license. Some masks retain source glow/ink around their edges; they are animated still-image cutouts, not fully animated anime sequences.

Rendering uses current canvas dimensions directly, preserving image proportions at any viewport size. Domains cover-fill; summons contain-fit to 95% of the viewport; directed attacks expand toward the center. Idle and hidden effects stop drawing. Record is the only training tab, with original-format import/export and a 300-instance Trusted threshold.

## Block

Block uses a cropped crossed-forearm guard from Jujutsu Kaisen episode 15. The face and forest background are masked out; source URL is in the asset manifest and sources.json. In turn-based combat, Block spends the action, gains no meter, reduces regular damage by 55% through the next enemy turn, and has one own-turn cooldown. It covers multi-hit attacks; ultimate, passive and bleeding damage bypass it. The enemy can also block. Online retains its existing 10-energy, 450ms guard and 1.8s cooldown, now with the same image and explicit feedback. Both modes support the Block button and Space (outside form controls). Block is not added to the trained hand-sign labels.
