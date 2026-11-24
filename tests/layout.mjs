import assert from 'node:assert/strict';
import {renderer} from '../matter/cube_lib.mjs';
for(const orient of ['left','right'])for(const font of ['classic','compact']) {
 const r=renderer(orient,font);
 for(const text of [':P','♥','I','HELLO','A B','!!!','T_T'])for(const page of r.staticPages(text)){
  const xs=page.flatMap(row=>row.flatMap((p,x)=>p.some(Boolean)?[x]:[]));
  if(xs.length)assert.ok(Math.abs(Math.min(...xs)-(19-Math.max(...xs)))<=1,`${font}/${text} must center`);
 }
 const weather=r.weather('cloud',18),digitColumns=[...new Set(weather.flatMap(row=>row.flatMap((p,x)=>p.join(',')==='80,220,120'?[x]:[])))].sort((a,b)=>a-b);
 assert.deepEqual(digitColumns,[6,7,8,10,11,12]);
 assert.ok(weather.every(row=>row[9].join(',')==='0,0,0'));
 for(const temp of [-3,0,8,18,99])assert.equal(r.encode(r.weather('sun',temp)).length,400);
}
console.log('橫放兩種字型靜態文字置中；氣溫數字相距一欄、正負與單位編碼通過');
