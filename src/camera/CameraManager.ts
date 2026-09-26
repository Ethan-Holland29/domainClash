import { GameConfig } from "../config/GameConfig";

export type CameraErrorKind = "permission" | "unavailable" | "unknown";

export class CameraError extends Error {
  readonly kind: CameraErrorKind;

  constructor(kind: CameraErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export class CameraManager {
  private stream: MediaStream | null = null;
  private generation = 0;
  private readonly video: HTMLVideoElement;

  constructor(video: HTMLVideoElement) {
    this.video = video;
  }

  async start(): Promise<void> {
    if (this.isActive()) return;
    this.stop();
    const generation = this.generation;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new CameraError("unavailable", "This browser does not support webcam access.");
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: GameConfig.camera.facingMode,
          width: { ideal: GameConfig.camera.width },
          height: { ideal: GameConfig.camera.height },
        },
      };
      let stream: MediaStream;
      try { stream = await navigator.mediaDevices.getUserMedia(constraints); }
      catch (error) {
        if (generation !== this.generation) return;
        if (!(error instanceof DOMException) || !['NotFoundError', 'OverconstrainedError'].includes(error.name)) throw error;
        stream = await navigator.mediaDevices.getUserMedia({audio:false, video:true});
      }
      if (generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
    } catch (error) {
      throw this.toCameraError(error);
    }

    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;
    try {
      await this.video.play();
      const started = performance.now();
      while (generation === this.generation && !this.isReady()) {
        if (performance.now() - started > 5000) throw new CameraError('unavailable', 'Camera opened but no video frames arrived. Retry the camera.');
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    } catch (error) {
      if(generation!==this.generation)return;
      this.stop();
      throw this.toCameraError(error);
    }
  }

  stop(): void {
    this.generation++;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.srcObject = null;
  }

  isReady(): boolean {
    return !!this.stream?.getVideoTracks().some(track => track.readyState === "live" && !track.muted)
      && this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && this.video.videoWidth > 0;
  }

  isActive(): boolean { return !!this.stream?.getVideoTracks().some(track => track.readyState === 'live'); }

  getVideo(): HTMLVideoElement {
    return this.video;
  }

  private toCameraError(error: unknown): CameraError {
    if (error instanceof CameraError) return error;
    const name = error instanceof DOMException ? error.name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return new CameraError(
        "permission",
        "Camera blocked. Use the browser’s site permissions to allow Camera, then click Enable camera. Check Windows camera privacy settings too.",
      );
    }
    if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError") {
      return new CameraError("unavailable", "Camera unavailable. Close other camera apps and old game tabs, check the camera connection, then retry Enable camera.");
    }
    return new CameraError("unknown", "Could not start the webcam.");
  }
}
