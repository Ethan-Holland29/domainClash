// Accept only bounded JPEG frames. Retain one frame per player in memory, never on disk.
export function validFrame(data){
 if(data.length<4||data[0]!==255||data[1]!==216)return false;
 let i=2;
 while(i+3<data.length){
  if(data[i++]!==255)return false;
  while(data[i]===255)i++;
  const marker=data[i++];
  if(marker===0xd9||marker===0xda)return false;
  const length=data.readUInt16BE(i);
  if(length<2||i+length>data.length)return false;
  if([0xc0,0xc1,0xc2].includes(marker)){
   if(length<8)return false;
   const h=data.readUInt16BE(i+3),w=data.readUInt16BE(i+5);
   return w>0&&h>0&&w<=640&&h<=640&&w*h<=307200;
  }
  i+=length;
 }
 return false;
}
