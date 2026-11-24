import assert from 'node:assert/strict';
import {renderer,COMPACT_FONT,SUPPORTED_CHARS} from '../matter/cube_lib.mjs';
for(const ch of SUPPORTED_CHARS){assert.ok(COMPACT_FONT[ch]);assert.equal(COMPACT_FONT[ch].length,5);}
for(const orient of ['up','left','right','down'])for(const font of ['classic','compact']){
 const r=renderer(orient,font),clock=r.clock(new Date('2026-01-01T14:02:00Z'));
 assert.equal(r.encode(clock).length,400);
 assert.equal(r.staticPages('HELLO',[255,200,0]).length,font==='compact'&&r.wide?1:2);
 for(const row of clock)for(const c of row)assert.equal(c.length,3);
 if(r.wide&&font==='compact') {assert.deepEqual(clock[1][9],[255,140,0]);assert.deepEqual(clock[3][9],[255,140,0]);}
 assert.ok(r.marquee('HELLO').length>20);
}
const classic=renderer('left','classic'),compact=renderer('left','compact');
assert.ok(compact.marquee('HELLO').length<classic.marquee('HELLO').length);
console.log('Glyph coverage, HH:MM colon, paging, orientations, encoding and scrolling OK');
