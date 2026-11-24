// 自行繪製的點陣表情。橫放整面大臉，直放每塊一張小臉。
const PALETTE = {'.':'#000000',W:'#fff0cf',P:'#ff79b0',C:'#66e4ff',A:'#ffc06a',Y:'#ffda55',B:'#459bff',R:'#ff5555'};
export const PIXEL_FACES = {
    cat: {name:'貓咪', small:['P...P','PPPPP','.C.C.','..W..','.W.W.'],
        wide:['P.........P','PP..C.C..PP','P...C.C...P','PPP..W..PPP','..W.W.W.W..']},
    bear: {name:'熊', small:['AA.AA','AAAAA','A.A.A','AAWAA','.WWW.'],
        wide:['AA.......AA','A.........A','A..W...W..A','A....W....A','.AAA.W.AAA.']},
    happy: {name:'開心', small:['.....','.Y.Y.','.....','Y...Y','.YYY.'],
        wide:['..YY.....YY..','..YY.....YY..','.............','.Y.........Y.','..YYYYYYYYY..']},
    cry: {name:'哭哭', small:['.....','.W.W.','.B.B.','.B.B.','..W..'],
        wide:['..WWW...WWW..','...B.....B...','...B.....B...','...B..W..B...','.....WWW.....']},
    angry: {name:'生氣', small:['R...R','.R.R.','.....','..R..','.R.R.'],
        wide:['..RR.....RR..','....R...R....','...RR...RR...','.....RRR.....','....R...R....']},
};
function draw(rows, w, h, repeat = false) {
    const rowWidth = rows[0].length;
    if (rows.length !== 5 || rows.some(row => row.length !== rowWidth || [...row].some(c => !(c in PALETTE))))
        throw new Error('表情圖樣格式錯誤');
    const offset = Math.floor((w - rowWidth) / 2);
    return { w, h, pixels: Array.from({length:w*h}, (_,i) => {
        const x = i % w - offset, y = repeat ? Math.floor(i / w) % 5 : Math.floor(i / w);
        return x < 0 || x >= rowWidth ? '#000000' : PALETTE[rows[y][x]];
    })};
}
export function faceImage(id, orient = 'left') {
    const face = Object.hasOwn(PIXEL_FACES,id) ? PIXEL_FACES[id] : null;
    if (!face) throw new Error('不支援的像素表情');
    if (!['up','down','left','right'].includes(orient)) throw new Error('不支援的表情方向');
    return ['left','right'].includes(orient) ? draw(face.wide,20,5) : draw(face.small,5,20,true);
}
export const FACE_CATALOG = Object.entries(PIXEL_FACES).map(([id,face]) => ({id,name:face.name,thumbnail:draw(face.small,5,5)}));
