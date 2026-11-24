"""Build original vector-inspired Cube icons locally; no source photos are embedded."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import colorsys
ROOT = Path(__file__).resolve().parents[1] / 'assets'
ROOT.mkdir(exist_ok=True)
N = 1024
im = Image.new('RGB', (N, N)); pix=im.load()
for y in range(N):
 for x in range(N):
  f=max(0,1-((x-430)**2+(y-400)**2)**.5/1000)
  pix[x,y]=(int(9+9*f),int(16+12*f),int(30+16*f))
d=ImageDraw.Draw(im)
d.rounded_rectangle((150,815,860,865),radius=25,fill='#080e1b')
d.polygon([(182,290),(326,180),(842,180),(698,290)],fill='#344055')
d.polygon([(698,290),(842,180),(842,703),(698,813)],fill='#101a2b')
d.rounded_rectangle((172,280,708,820),radius=36,fill='#0a101c',outline='#526078',width=3)
d.rounded_rectangle((198,306,682,792),radius=24,fill='#111d2e')
d.line([(720,304),(822,226)],fill='#45546c',width=2)
glow=Image.new('RGBA',(N,N));g=ImageDraw.Draw(glow)
circles=[]
for row in range(5):
 for col in range(5):
  hue=(.47+row*.105+col*.025)%1
  rgb=tuple(round(v*255) for v in colorsys.hsv_to_rgb(hue,.60,.98))
  cx,cy=252+col*94,360+row*94;r=25
  g.ellipse((cx-r,cy-r,cx+r,cy+r),fill=rgb+(200,));circles.append((cx,cy,r,rgb))
im=Image.alpha_composite(im.convert('RGBA'),glow.filter(ImageFilter.GaussianBlur(21)))
d=ImageDraw.Draw(im)
for cx,cy,r,c in circles:
 d.ellipse((cx-r,cy-r,cx+r,cy+r),fill=c)
 d.ellipse((cx-12,cy-16,cx+4,cy-4),fill=tuple(min(255,v+20) for v in c))
im=im.convert('RGB')
for size in (32,180,192,512,1024): im.resize((size,size),Image.Resampling.LANCZOS).save(ROOT/f'icon-{size}.png')
svg=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#111c2e"/>', '<path d="M182 290L326 180H842L698 290Z" fill="#344055"/><path d="M698 290L842 180V703L698 813Z" fill="#101a2b"/>','<rect x="172" y="280" width="536" height="540" rx="36" fill="#0a101c" stroke="#526078" stroke-width="3"/>']
for cx,cy,r,c in circles:svg.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="rgb{c}"/>')
svg.append('</svg>');(ROOT/'icon.svg').write_text(''.join(svg))
print('Generated icons:',', '.join(p.name for p in ROOT.iterdir()))
