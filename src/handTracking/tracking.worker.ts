import {FilesetResolver,HandLandmarker} from '@mediapipe/tasks-vision';
let model:HandLandmarker|null=null;
self.onmessage=async(event:MessageEvent)=>{
 const {id,type,base,bitmap,timestamp}=event.data;
 try{
  if(type==='initialize'){
   const files=await FilesetResolver.forVisionTasks(base+'wasm',true);
   const options={baseOptions:{modelAssetPath:base+'models/hand_landmarker.task',delegate:'GPU' as 'GPU'|'CPU'},runningMode:'VIDEO' as const,numHands:2};
   try{model=await HandLandmarker.createFromOptions(files,options);}
   catch{options.baseOptions.delegate='CPU';model=await HandLandmarker.createFromOptions(files,options);}
   self.postMessage({id,ready:true});
  }else if(type==='detect'){
   if(!model)throw Error('Tracker not initialized');
   const result=model.detectForVideo(bitmap,timestamp);
   self.postMessage({id,result});
  }
 }catch(error){self.postMessage({id,error:String(error)});}
 finally{bitmap?.close();}
};
