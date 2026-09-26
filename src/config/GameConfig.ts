export const GameConfig = {
  camera: {
    width: 1280,
    height: 720,
    facingMode: "user" as const,
  },

  tracking: {
    numHands: 2,
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.6,
    minTrackingConfidence: 0.5,
    mediapipeWasmCdn:
      "/tracking/wasm",
    modelAssetPath:
      "/tracking/hand_landmarker.task",
  },

  gestures: {
    staleFrameMs: 250,
    holdMs: {
      PRIMARY_ATTACK: 380,
      SECONDARY_ATTACK: 420,
      DOMAIN_EXPANSION: 520,
    },
    debounceMs: 700,
    minScore: 0.62,
    stabilityFrames: 4,
    releaseMs: 180,
    thresholds: {
      extended: 0.45, folded: 0.38, primaryOpen: 0.58, palmReadable: 0.22,
      thumbOut: 0.12, primaryScore: 0.62, ringFolded: 0.42, pinkyFolded: 0.45,
      indexPointing: 0.5, openPalmCeiling: 0.78, secondaryScore: 0.6,
      domainClose: 0.42, domainUp: 0.28, domainOpen: 0.35, domainScore: 0.58,
    },
  },

  combat: {
    playerMaxHp: 100,
    opponentMaxHp: 100,
    primary: {
      damage: 5,
      cooldownMs: 750,
      meterGain: 10,
      windupMs: 140,
    },
    secondary: {
      damage: 12,
      cooldownMs: 2100,
      meterGain: 20,
      windupMs: 420,
    },
    opponentAttackIntervalMs: 3400,
    opponentDamage: 8,
    opponentTelegraphMs: 500,
  },

  domain: {
    meterMax: 100,
    cinematicMs: 2400,
    durationMs: 9000,
    damageMultiplier: 1.35,
    tickDamage: 4,
    tickIntervalMs: 1800,
  },

  audio: {
    masterVolume: 0.55,
    useFiles: false,
    paths: {
      primary: "/audio/primary.wav",
      secondary: "/audio/secondary.wav",
      hit: "/audio/hit.wav",
      domain: "/audio/domain.wav",
    },
  },

  debug: {
    showByDefault: false,
    keyboardShortcuts: true,
  },
} as const;

export type GestureHoldKey = keyof typeof GameConfig.gestures.holdMs;
