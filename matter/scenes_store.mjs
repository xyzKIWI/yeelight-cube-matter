import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
export const SCENE_FIELDS=['mode','face','font','text','textFx','orient','speed','color','color2','colorFx','colorSpeed','effect','image'];
export const sceneSettings=s=>Object.fromEntries(SCENE_FIELDS.filter(k=>s[k]!==undefined).map(k=>[k,s[k]]));
export class ScenesStore {
 // 收藏檔壞掉不能讓整個程式起不來：整檔壞→改用空白收藏；單筆壞→略過那筆。兩種都先把原檔另存一份。
 constructor(file,normalize,warn=console.error){this.file=file;this.normalize=normalize;this.items=[];
  let raw;
  try{raw=fs.readFileSync(file,'utf8');}catch(e){if(e.code!=='ENOENT')warn(`讀不到收藏檔，先用空白收藏：${e.message}`);return;}
  let data=null;try{data=JSON.parse(raw);}catch{}
  if(!Array.isArray(data))return this.quarantine(warn,'收藏檔格式錯誤，先用空白收藏');
  let dropped=Math.max(0,data.length-12);
  for(const x of data.slice(0,12)){
   try{if(!x||typeof x!=='object')throw Error();this.items.push({...x,id:typeof x.id==='string'&&x.id?x.id:randomUUID(),name:this.name(x.name),settings:normalize(x.settings)});}
   catch{dropped++;}
  }
  if(dropped)this.quarantine(warn,`收藏檔有 ${dropped} 筆讀不懂，已略過`);
 }
 quarantine(warn,msg){const bak=`${this.file}.bad-${Date.now()}-${randomUUID().slice(0,6)}`;try{fs.copyFileSync(this.file,bak);warn(`${msg}（原檔另存 ${bak}）`);}catch(e){warn(`${msg}（原檔另存失敗：${e.message}）`);}}
 name(s){if(typeof s!=='string'||!s.trim()||s.trim().length>20)throw Error('收藏名稱需為 1–20 字');return s.trim();}
 list(){return this.items.map(({id,name,settings})=>({id,name,mode:settings.mode,color:settings.color,color2:settings.color2}));}
 persist(){fs.mkdirSync(path.dirname(this.file),{recursive:true});const tmp=this.file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(this.items,null,2),{mode:0o600});fs.renameSync(tmp,this.file);}
 change(b){const prior=this.items;
  try{
   if(b.action==='save'){if(this.items.length>=12)throw Error('最多 12 組收藏，請先刪除不用的情境');const name=this.name(b.name);if(this.items.some(x=>x.name===name))throw Error('名稱已存在，請使用另一個名稱');this.items=[...this.items,{id:randomUUID(),name,settings:this.normalize(b.settings)}];}
   else {const item=this.items.find(x=>x.id===b.id);if(!item)throw Error('找不到這組收藏');
    if(b.action==='apply')return structuredClone(item.settings);
    if(b.action==='delete')this.items=this.items.filter(x=>x.id!==b.id);
    else if(b.action==='rename'){const name=this.name(b.name);if(this.items.some(x=>x.id!==b.id&&x.name===name))throw Error('名稱已存在');this.items=this.items.map(x=>x.id===b.id?{...x,name}:x);}
    else throw Error('不支援的收藏操作');
   }
   this.persist();return null;
  }catch(e){this.items=prior;throw e;}
 }
}
