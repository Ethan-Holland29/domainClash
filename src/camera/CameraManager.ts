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
    if (typeof window !== "undefined" && !window.isSecureContext) {
      throw new CameraError(
        "unavailable",
        "Camera access requires HTTPS (or localhost). This address uses HTTP, so the browser blocks the webcam. Open the game from an HTTPS link to enable camera play.",
      );
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new CameraError("unavailable", "This browser does not support webcam access.");
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: GameConfig.camera.facingMode,
          frameRate: {ideal:24,max:30},
          width: { ideal: GameConfig.camera.width },
          height: { ideal: GameConfig.camera.height },
        },
      });
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
