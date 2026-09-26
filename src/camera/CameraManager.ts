export type CameraErrorKind =
  | 'unsupported' // no getUserMedia (old browser or insecure context)
  | 'permission-denied'
  | 'not-found'
  | 'in-use' // device busy / hardware error
  | 'disconnected'
  | 'no-frames' // stream opened but never produced video
  | 'unknown';

export class CameraError extends Error {
  readonly kind: CameraErrorKind;
  /** The exact browser error, e.g. "NotFoundError: Requested device not found". */
  readonly browserError: string | null;

  constructor(kind: CameraErrorKind, message: string, browserError: string | null = null) {
    super(message);
    this.name = 'CameraError';
    this.kind = kind;
    this.browserError = browserError;
  }
}

export interface CameraOptions {
  width: number;
  height: number;
  /** Show the feed like a mirror (selfie view). */
  mirrored: boolean;
  /** How long to wait for the first frame before reporting an error. */
  firstFrameTimeoutMs: number;
}

export const DEFAULT_CAMERA_OPTIONS: CameraOptions = {
  width: 1280,
  height: 720,
  mirrored: true,
  firstFrameTimeoutMs: 5000,
};

/** Owns the webcam stream and the <video> element. */
export class CameraManager {
  readonly video: HTMLVideoElement;
  readonly options: CameraOptions;
  /** Called if the stream ends unexpectedly (e.g. camera unplugged). */
  onDisconnect: ((error: CameraError) => void) | null = null;

  private stream: MediaStream | null = null;

  constructor(video: HTMLVideoElement, options: Partial<CameraOptions> = {}) {
    this.video = video;
    this.options = { ...DEFAULT_CAMERA_OPTIONS, ...options };
    this.video.classList.toggle('mirrored', this.options.mirrored);
  }

  get isRunning(): boolean {
    return this.stream !== null;
  }

  /** Name of the active camera as reported by the browser. */
  get label(): string {
    return this.stream?.getVideoTracks()[0]?.label ?? '';
  }

  /** Native resolution of the stream (0 until metadata is loaded). */
  get width(): number {
    return this.video.videoWidth;
  }

  get height(): number {
    return this.video.videoHeight;
  }

  /** True when the video has a decoded frame ready to be processed. */
  get hasFrame(): boolean {
    return this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
  }

  /** Starts the browser's camera (the one selected in the site's camera settings). */
  async start(): Promise<void> {
    if (this.stream) this.stop();
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new CameraError(
        'unsupported',
        'Camera API unavailable. Use a modern browser over https:// or http://localhost.',
      );
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { ideal: this.options.width },
          height: { ideal: this.options.height },
          facingMode: 'user',
        },
      });
    } catch (err) {
      if (!isDeviceLookupError(err)) throw toCameraError(err);
      // Some cameras reject the preferred constraints; retry with the plainest request.
      console.warn('getUserMedia with preferred constraints failed, retrying with { video: true }', err);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      } catch (retryErr) {
        throw toCameraError(retryErr);
      }
    }

    this.stream = stream;
    for (const track of stream.getVideoTracks()) {
      track.addEventListener('ended', this.handleTrackEnded);
    }

    this.video.srcObject = stream;
    try {
      await withTimeout(
        (async () => {
          await waitForMetadata(this.video);
          await this.video.play();
          await waitForFirstFrame(this.video);
        })(),
        this.options.firstFrameTimeoutMs,
        () =>
          new CameraError(
            'no-frames',
            'The camera opened but is not sending video. Close other apps using it, then retry.',
          ),
      );
    } catch (err) {
      this.stop();
      throw toCameraError(err);
    }
  }

  stop(): void {
    if (!this.stream) return;
    for (const track of this.stream.getTracks()) {
      track.removeEventListener('ended', this.handleTrackEnded);
      track.stop();
    }
    this.stream = null;
    this.video.srcObject = null;
  }

  private readonly handleTrackEnded = (): void => {
    this.stop();
    this.onDisconnect?.(new CameraError('disconnected', 'The camera was disconnected.'));
  };
}

function waitForMetadata(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve();
  return new Promise((resolve, reject) => {
    video.addEventListener('loadedmetadata', () => resolve(), { once: true });
    video.addEventListener('error', () => reject(video.error), { once: true });
  });
}

function waitForFirstFrame(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    if ('requestVideoFrameCallback' in video) {
      video.requestVideoFrameCallback(() => resolve());
    } else if ((video as HTMLVideoElement).readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      resolve();
    } else {
      (video as HTMLVideoElement).addEventListener('loadeddata', () => resolve(), { once: true });
    }
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => Error): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(onTimeout()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function isDeviceLookupError(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'NotFoundError' || err.name === 'OverconstrainedError');
}

/** Formats the raw browser error exactly as reported, e.g. "NotFoundError: Requested device not found". */
function describeBrowserError(err: unknown): string {
  if (err instanceof DOMException || err instanceof Error) {
    const constraint = (err as { constraint?: string }).constraint;
    const detail = `${err.name}: ${err.message || '(no message)'}`;
    return constraint ? `${detail} (constraint: ${constraint})` : detail;
  }
  return String(err);
}

function toCameraError(err: unknown): CameraError {
  if (err instanceof CameraError) return err;
  const raw = describeBrowserError(err);
  const name = err instanceof DOMException || err instanceof Error ? err.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return new CameraError(
        'permission-denied',
        'Camera permission was denied. Allow camera access for this site in the browser, and for the browser in macOS System Settings > Privacy & Security > Camera, then retry.',
        raw,
      );
    case 'NotFoundError':
    case 'OverconstrainedError':
      return new CameraError('not-found', 'The browser did not find a usable camera.', raw);
    case 'NotReadableError':
    case 'AbortError':
      return new CameraError('in-use', 'The camera could not be started. It may be in use by another app.', raw);
    default:
      return new CameraError('unknown', 'The camera could not be started.', raw);
  }
}
