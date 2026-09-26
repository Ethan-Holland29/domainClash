// MediaPipe's official CommonJS bundle has no require dependencies; expose its exports in this classic worker.
self.exports={};
importScripts('/tracking/vision-bundle.js');
let detector=null;
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){
   const vision=await self.exports.FilesetResolver.forVisionTasks('/tracking/wasm');
   detector=await self.exports.HandLandmarker.createFromOptions(vision,{
    baseOptions:{modelAssetPath:'/tracking/hand_landmarker.task',delegate:'CPU'},
    canvas:new OffscreenCanvas(640,480),runningMode:'VIDEO',numHands:2,
    minHandDetectionConfidence:.6,minHandPresenceConfidence:.6,minTrackingConfidence:.5
   });
   self.postMessage({type:'ready'});
  }else if(data.type==='frame'&&detector){
   try{
    const result=detector.detectForVideo(data.image,data.timestampMs);
    const hands=(result.landmarks||[]).map((landmarks,i)=>({landmarks:landmarks.map(p=>({x:p.x,y:p.y,z:p.z})),handedness:result.handedness?.[i]?.[0]?.categoryName||'Unknown',score:result.handedness?.[i]?.[0]?.score||0}));
    self.postMessage({type:'frame',frame:{hands,timestampMs:data.timestampMs}});
   }finally{data.image.close();}
  }
 }catch(error){self.postMessage({type:'error',message:String(error)});}
};
