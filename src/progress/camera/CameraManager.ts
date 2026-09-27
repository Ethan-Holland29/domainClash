import { CameraManager as StableCamera } from '../../camera/CameraManager';
export class CameraManager {
  private camera:StableCamera;
  constructor(video:HTMLVideoElement){this.camera=new StableCamera(video);}
  start():Promise<void>{return this.camera.start();}
  stop():void{this.camera.stop();}
  get isActive():boolean{return this.camera.isActive();}
  getVideoElement():HTMLVideoElement{return this.camera.getVideo();}
}
