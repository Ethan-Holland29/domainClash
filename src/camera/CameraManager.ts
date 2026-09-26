/**
 * CameraManager
 *
 * Owns webcam acquisition and the <video> element that other systems
 * (hand tracking, debug rendering) read frames from. Nothing outside
 * this file should touch getUserMedia directly.
 */

export interface CameraManagerOptions {
  width?: number;
  height?: number;
  facingMode?: "user" | "environment";
}

export class CameraManager {
  private videoElement: HTMLVideoElement;
  private stream: MediaStream | null = null;

  constructor(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement;
  }

  /**
   * Requests webcam access and starts streaming into the video element.
   * Throws on permission denial or unavailable camera so callers can
   * show an appropriate UI state.
   */
  async start(options: CameraManagerOptions = {}): Promise<void> {
    const { width = 640, height = 480, facingMode = "user" } = options;

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Webcam access is not supported in this browser.");
    }

    this.stop();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: width }, height: { ideal: height }, facingMode },
        audio: false,
      });
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => finish(new Error("Camera did not provide video within 15 seconds.")), 15000);
        const finish = (error?: unknown) => {
          clearTimeout(timeout);
          this.videoElement.onloadedmetadata = null;
          this.videoElement.onerror = null;
          if (error) reject(error); else resolve();
        };
        this.videoElement.onloadedmetadata = () => {
          this.videoElement.play().then(() => finish(), finish);
        };
        this.videoElement.onerror = () => finish(new Error("The camera video could not be played."));
        this.videoElement.srcObject = this.stream;
      });
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.videoElement.pause();
    this.videoElement.srcObject = null;
  }

  get isActive(): boolean {
    return this.stream !== null;
  }

  getVideoElement(): HTMLVideoElement {
    return this.videoElement;
  }
}
