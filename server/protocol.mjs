export function signal(room,seat,body){
 if(room.match.phase==='finished')return 'Match finished';
 if(!body||!['offer','answer'].includes(body.type)||typeof body.sdp!=='string'||body.sdp.length>30000||!body.sdp.startsWith('v=0'))return 'Invalid video negotiation';
 if((seat===0)!==(body.type==='offer'))return 'Invalid negotiation role';
 room.signals??=[null,null];room.signalSeq=(room.signalSeq||0)+1;
 room.signals[seat]={seq:room.signalSeq,type:body.type,sdp:body.sdp};return null;
}
export function snapshot(room,seat){return {...room.match.snapshot(seat),peerSignal:room.signals?.[1-seat]??null,cameraActive:room.cameraActive??[false,false]};}
