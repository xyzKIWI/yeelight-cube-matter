#!/usr/bin/env python3
"""Yeelight 方塊燈網頁控制台（手機優先）。

只用 Python 內建模組。所有控制都轉給 matter/cube_daemon.mjs（Matter 常駐程式）：
整燈開關／亮度／顏色／色溫走 Matter 標準指令（家庭 App 會同步），其餘畫在點陣上。
版面（2026-11-25 依 Codex 審查＋ui-ux-pro-max 重設計）：底部三分頁「控制／內容／自動化」＋右上設定；
「燈上現在」即時畫面、套用前預覽、三段式回饋（傳送中→已儲存→燈已回應）。

用法：
    python3 cube_panel.py                       # 只有這台開 http://localhost:8765
    python3 cube_panel.py --lan --port 8771     # 家裡網路的手機也能開（區域網路使用）
環境變數：CUBE_DAEMON（常駐程式 API，預設 http://127.0.0.1:8766）、CAL_STATE（行事曆提醒狀態檔）
"""
import argparse
import json
import os
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DAEMON = os.environ.get("CUBE_DAEMON", "http://127.0.0.1:8766")
CAL_STATE = os.environ.get("CAL_STATE", os.path.expanduser("~/.matter-yeelight/cal_watch.json"))


def daemon_call(method, path, body=None):
    """呼叫常駐程式；回 (HTTP 狀態碼, JSON)。連不到時回 502。"""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(DAEMON + path, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")
    except Exception as e:
        return 502, {"error": f"常駐程式沒有回應：{e}"}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        data = body.encode() if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _json(self, code, obj):
        self._send(code, json.dumps(obj, ensure_ascii=False))

    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            return self._send(200, PAGE, "text/html; charset=utf-8")
        if self.path == "/api/status":
            return self._json(*daemon_call("GET", "/status"))
        if self.path == "/api/frame":
            return self._json(*daemon_call("GET", "/frame"))
        if self.path == "/api/cal":  # 行事曆提醒（cal_watch.py）最近一次執行結果
            try:
                with open(CAL_STATE, encoding="utf-8") as f:
                    s = json.load(f)
                s.pop("notified", None)
                return self._json(200, s)
            except (OSError, ValueError):
                return self._json(200, {"last_run": None})
        self._json(404, {"error": "not found"})

    def do_POST(self):
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        except ValueError:
            return self._json(400, {"error": "JSON 格式錯誤"})
        routes = {"/api/mode": "/mode", "/api/light": "/light", "/api/preview": "/preview", "/api/rest": "/rest", "/api/history": "/history", "/api/timer": "/timer"}
        if self.path in routes:
            return self._json(*daemon_call("POST", routes[self.path], body))
        if self.path == "/api/notify":  # 給 HA 等外部呼叫：{"text":"WASH DONE","seconds":300,"color":"#00ff80"}
            body.setdefault("seconds", 300)
            return self._json(*daemon_call("POST", "/alert", body))
        if self.path == "/api/alert-clear":
            return self._json(*daemon_call("POST", "/alert", {"clear": True}))
        if self.path == "/api/alert-test":  # 插播 1 分鐘的測試提醒
            until = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + 60))
            return self._json(*daemon_call("POST", "/alert", {"text": "NEXT TEST", "until": until}))
        self._json(404, {"error": "not found"})


PAGE = r"""<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="方塊燈">
<meta name="theme-color" content="#0F172A">
<title>方塊燈</title>
<style>
:root{--bg:#F4F6FA;--card:#FFFFFF;--muted:#EEF1F6;--fg:#0F172A;--dim:#475569;--line:#D9DEE7;
 --acc:#16A34A;--on-acc:#FFFFFF;--warn:#DC2626;--info:#2563EB;--r:16px}
@media (prefers-color-scheme:dark){:root{--bg:#0F172A;--card:#1B2336;--muted:#272F42;--fg:#F8FAFC;--dim:#94A3B8;
 --line:#334155;--acc:#22C55E;--on-acc:#0F172A;--warn:#EF4444;--info:#60A5FA}}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 -apple-system,"PingFang TC","Noto Sans TC",system-ui,sans-serif}
header{position:sticky;top:0;z-index:5;background:var(--bg);display:flex;align-items:center;gap:10px;
 padding:calc(10px + env(safe-area-inset-top)) 16px 10px}
header h1{font-size:20px;margin:0;flex:1}
.chip{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--dim)}
.dot{width:9px;height:9px;border-radius:50%;background:var(--dim)}
.dot.ok{background:var(--acc)}.dot.bad{background:var(--warn)}
main{max-width:560px;margin:0 auto;padding:4px 16px calc(96px + env(safe-area-inset-bottom))}
.view{display:none}.view.on{display:block}
section{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:16px;margin-bottom:12px}
h2{font-size:15px;margin:0 0 10px;font-weight:600}
.hint{font-size:13px;color:var(--dim);margin:6px 0 0}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
button,select,input[type=text],input[type=time]{font:inherit;color:var(--fg);background:var(--muted);border:1px solid var(--line);
 border-radius:12px;min-height:48px;padding:0 16px}
button{cursor:pointer;font-weight:500}button:active{transform:scale(.97)}
button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--info);outline-offset:2px}
button.pri{background:var(--acc);border-color:var(--acc);color:var(--on-acc)}
button.ghost{background:transparent}
button:disabled{opacity:.45}
input[type=text]{flex:1;min-width:0;font-size:16px}
input[type=range]{width:100%;height:32px;accent-color:var(--acc)}
input[type=color]{width:48px;height:48px;border:1px solid var(--line);border-radius:12px;background:none;padding:2px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.sw{height:44px;border-radius:12px;border:1px solid var(--line);cursor:pointer}
.seg{display:flex;background:var(--muted);border:1px solid var(--line);border-radius:12px;padding:3px;gap:3px;overflow-x:auto}
.seg button{flex:1;min-height:42px;border:0;background:transparent;border-radius:9px;padding:0 10px;white-space:nowrap}
.seg button.on{background:var(--card);box-shadow:0 1px 2px rgba(0,0,0,.25);font-weight:600}
.now{display:flex;gap:16px;align-items:center}
.now .info{flex:1;min-width:0}
.big{font-size:18px;font-weight:600}
.card-alert{border-color:var(--warn)}
.pal{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.pal button{min-height:72px;padding:6px 4px;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:13px;background:transparent;border:1px solid var(--line)}
.pal button .dg{width:40px;height:30px;border-radius:8px;display:flex;overflow:hidden;font:700 15px/30px ui-monospace,monospace;background:#05070c}
.pal button .dg span{flex:1;text-align:center}
.pal button.on{border:2px solid var(--acc);background:var(--muted)}
.cfx{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.cfx button{min-height:72px;padding:6px 4px;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:13px;background:transparent;border:1px solid var(--line)}
.cfx button .sw2{width:40px;height:26px;border-radius:7px;border:1px solid var(--line)}
.cfx button.on{border:2px solid var(--acc);background:var(--muted)}
.tbig{font:700 56px/1.1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:2px;text-align:center;margin:4px 0}
.bar{height:8px;border-radius:4px;background:var(--muted);overflow:hidden;margin:6px 0 14px}.bar i{display:block;height:100%;background:var(--acc)}
.flash{display:flex;gap:10px;flex-wrap:wrap}.flash button{width:48px;height:48px;padding:0;border-radius:50%;border:2px solid var(--line)}
.flash button.on{border:3px solid var(--fg);box-shadow:0 0 0 2px var(--acc)}
.chips{display:flex;flex-wrap:wrap;gap:10px;margin:8px 0 12px}
.chip{position:relative;display:inline-flex}
.chip>button:first-child{min-height:44px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 22px 0 14px}
.chip .x{position:absolute;top:-8px;right:-8px;width:26px;height:26px;min-height:26px;padding:0;border-radius:50%;
 display:flex;align-items:center;justify-content:center;background:var(--card);border:1px solid var(--line)}
.chip .x::before{content:"";position:absolute;inset:-9px}
.duo{display:flex;gap:16px;align-items:flex-end}
.now.wide{flex-direction:column;align-items:stretch;gap:12px}
.now.wide .duo{flex-direction:column;align-items:center;gap:10px}
.now.wide>canvas{align-self:center}
canvas.led{max-width:100%}
.duo .lbl{font-size:12px;color:var(--dim);text-align:center;margin-top:4px}.card-rest{border-color:#f97316}
.toggle{width:64px;height:36px;border-radius:18px;border:0;background:var(--muted);position:relative;padding:0;min-height:36px}
.toggle::after{content:"";position:absolute;top:4px;left:4px;width:28px;height:28px;border-radius:50%;background:var(--dim);transition:transform .2s}
.toggle.on{background:var(--acc)}.toggle.on::after{transform:translateX(28px);background:var(--on-acc)}
canvas.led{background:#05070c;border-radius:10px;display:block}
nav{position:fixed;left:0;right:0;bottom:0;z-index:6;background:var(--card);border-top:1px solid var(--line);
 display:flex;padding:6px 8px calc(6px + env(safe-area-inset-bottom))}
nav button{flex:1;border:0;background:transparent;min-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;
 gap:2px;font-size:12px;color:var(--dim)}
nav button.on{color:var(--acc);font-weight:600}
nav svg{width:24px;height:24px}
#toast{position:fixed;left:16px;right:16px;bottom:calc(84px + env(safe-area-inset-bottom));z-index:7;max-width:528px;margin:0 auto;
 background:var(--fg);color:var(--bg);border-radius:12px;padding:12px 16px;font-size:14px;opacity:0;transform:translateY(8px);
 transition:opacity .2s,transform .2s;pointer-events:none}
#toast.show{opacity:1;transform:none}
.sheet{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:8;display:none;align-items:flex-end}
.sheet.on{display:flex}
.sheet .panel{background:var(--card);width:100%;max-width:560px;margin:0 auto;border-radius:20px 20px 0 0;padding:20px 16px calc(20px + env(safe-area-inset-bottom))}
.bad{color:var(--warn)}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style></head><body>
<header><h1>方塊燈</h1>
<span class="chip" id="conn"><span class="dot" id="cdot"></span><span id="ctxt">讀取中</span></span>
<button class="toggle" id="pw" aria-label="電源" onclick="power()"></button>
<button class="ghost" aria-label="設定" onclick="sheet(true)" style="min-width:48px;padding:0">
<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button>
</header>
<main>
<!-- ===== 控制 ===== -->
<div class="view" id="v-ctl">
 <section id="alertCard" class="card-alert" hidden><div class="row" style="justify-content:space-between">
  <div><div class="big" id="alertTxt"></div><div class="hint" id="alertLeft"></div></div>
  <button onclick="api('/api/alert-clear',{})">結束插播</button></div></section>
 <section id="restOn" class="card-rest" hidden><div class="row" style="justify-content:space-between;flex-wrap:nowrap">
  <div><div class="big" id="restTxt"></div><div class="hint" id="restSub"></div></div>
  <button onclick="api('/api/rest',{stop:true})">結束補眠</button></div><div class="hint" id="restMissed"></div></section>
 <section><div class="now"><canvas class="led" id="cur" width="60" height="240" aria-label="燈上現在的畫面"></canvas>
  <div class="info"><div class="hint">燈上現在</div><div class="big" id="curMode">—</div>
  <div class="hint" id="curSub"></div>
  <button id="resume" hidden style="margin-top:10px" onclick="mode({mode:'clock'})">恢復時鐘</button></div></div></section>
 <section id="restOff"><h2>補眠</h2><p class="hint" style="margin:0 0 10px">亮度降到 5%、暖橘時鐘；期間的通知先存著，醒來再播。</p>
  <div class="grid3"><button onclick="api('/api/rest',{minutes:120})">2 小時</button><button onclick="api('/api/rest',{minutes:240})">4 小時</button>
  <button onclick="api('/api/rest',{minutes:360})">6 小時</button></div>
  <div class="row" style="margin-top:8px;flex-wrap:nowrap"><span class="hint">睡到</span><input type="time" id="restUntil" value="14:00" aria-label="補眠結束時間" style="width:132px;padding:0 6px">
  <button class="pri" style="flex:1" onclick="api('/api/rest',{until:$('restUntil').value})">開始</button></div></section>
 <section><h2>亮度 <span id="bv" class="hint"></span></h2>
  <input id="br" type="range" min="1" max="100" value="100" aria-label="亮度"
   oninput="bv.textContent=this.value+'%';dragging=true" onchange="dragging=false;light({level:+this.value})"></section>
 <section><h2>常用</h2><div class="grid2">
  <button data-q="clock" onclick="mode({mode:'clock'})">時鐘</button><button data-q="weather" onclick="mode({mode:'weather'})">天氣</button>
  <button data-q="effect:candle" onclick="mode({mode:'effect',effect:'candle'})">燭光</button><button data-q="effect:sleep" onclick="mode({mode:'effect',effect:'sleep'})">漸暗關燈</button></div></section>
 <section><h2>整燈純色</h2><p class="hint" style="margin:0 0 10px">會停止點陣顯示；家庭 App 會同步看到。</p>
  <div class="grid3" id="sw"></div>
  <div class="row" style="margin-top:10px"><input id="cp" type="color" value="#ffc387" aria-label="自選顏色" onchange="light({color:this.value})">
  <span class="hint">自選顏色</span></div>
  <h2 style="margin-top:14px">色溫 <span id="cv" class="hint">4000K</span></h2>
  <input id="ct" type="range" min="1700" max="6500" step="100" value="4000" aria-label="色溫"
   oninput="cv.textContent=this.value+'K'" onchange="light({ct:+this.value})">
  <div class="row hint" style="justify-content:space-between"><span>暖黃</span><span>冷白</span></div></section>
</div>
<!-- ===== 內容 ===== -->
<div class="view on" id="v-con">
 <div class="seg" id="cseg" style="margin-bottom:12px">
  <button data-k="clock">時鐘</button><button data-k="text">文字</button><button data-k="weather">天氣</button>
  <button data-k="timer">計時</button><button data-k="image">像素畫</button><button data-k="mood">氛圍</button></div>
 <section id="pv"><div class="now"><div class="duo">
  <div><canvas class="led" id="cur2" width="60" height="240" aria-label="燈上現在"></canvas><div class="lbl">現在</div></div>
  <div><canvas class="led" id="pre" width="60" height="240" aria-label="預覽"></canvas><div class="lbl">預覽</div></div></div>
  <div class="info"><div class="hint">尚未套用</div><div class="big" id="preTitle">—</div>
  <div class="hint" id="preSub"></div>
  <button class="pri" id="applyBtn" style="margin-top:12px;width:100%" onclick="apply()">套用到燈</button></div></div></section>
 <section data-p="clock"><h2>時鐘數字顏色</h2><div class="pal" id="pal"></div>
  <h2 style="margin-top:14px">自訂</h2><div class="row"><input type="color" id="cc1" value="#00c8ff" aria-label="小時顏色" onchange="customClock()"><span class="hint">小時</span>
  <input type="color" id="cc2" value="#ff40a0" aria-label="分鐘顏色" onchange="customClock()"><span class="hint">分鐘</span></div>
  <p class="hint">夜間建議琥珀或夜間紅，最不刺眼。</p>
  <h2 style="margin-top:14px">顏色變化</h2><div class="cfx" data-cfx></div><p class="hint" data-cfxhint></p></section>
 <section data-p="text">
  <h2>文字</h2><input type="text" id="txt" maxlength="60" autocapitalize="characters" placeholder="英文、數字、♥" oninput="onText()">
  <p class="hint" id="txtHint">支援英文、數字、♥ 與 ! ? - . : + &lt; &gt; /</p>
  <div class="hint" style="margin-top:8px">用過的文字（點一下帶入，右上 ✕ 刪除）</div><div class="chips" id="hist"></div>
  <h2>效果</h2><div class="seg" id="fxseg"><button data-v="scroll">捲動</button><button data-v="still">靜止</button><button data-v="blink">閃爍</button><button data-v="scrollblink">捲動＋閃爍</button></div>
  <h2 style="margin-top:14px">顏色</h2><div class="row"><button onclick="draft.color='';renderCfx();preview()">彩虹</button>
   <input type="color" value="#00c8ff" aria-label="自選文字顏色" onchange="draft.color=this.value;renderCfx();preview()"></div>
  <h2 style="margin-top:14px">顏色變化</h2><div class="cfx" data-cfx></div><p class="hint" data-cfxhint></p>
  <div id="spdBox"><h2 style="margin-top:14px">捲動速度 <span id="spv" class="hint"></span></h2>
   <input id="spd" type="range" min="200" max="800" step="10" value="300" aria-label="捲動速度"
    oninput="spv.textContent=this.value+' 毫秒／格'" onchange="draft.speed=+this.value;preview()"></div></section>
 <section data-p="weather"><h2>天氣</h2><div class="big" id="wxNow">讀取中</div>
  <p class="hint">依服務設定的座標，每 15 分鐘更新；上到下：天氣圖示、溫度兩位數、C。</p></section>
 <section data-p="timer" id="tRun" hidden><h2>倒數中</h2>
  <div class="tbig" id="tLeft" aria-live="polite">00:00</div><div class="bar"><i id="tBar"></i></div>
  <div class="grid3"><button id="tPause" onclick="timerPause()">暫停</button><button onclick="api('/api/timer',{add:60})">＋1 分</button>
  <button onclick="api('/api/timer',{cancel:true})">取消</button></div>
  <p class="hint">時間到會整面閃燈 8 秒，之後回到原本的畫面。</p></section>
 <section data-p="timer"><h2>開始倒數</h2>
  <div class="grid3" id="tQuick"></div>
  <div class="row" style="margin-top:10px;flex-wrap:nowrap"><input type="text" inputmode="numeric" id="tMin" value="5" aria-label="分鐘" style="width:72px;flex:none;text-align:center">
  <span class="hint">分</span><input type="text" inputmode="numeric" id="tSec" value="0" aria-label="秒" style="width:72px;flex:none;text-align:center"><span class="hint">秒</span>
  <button class="pri" style="flex:1" onclick="timerStart(+$('tMin').value*60+ +$('tSec').value)">開始</button></div>
  <h2 style="margin-top:16px">時間到閃燈顏色</h2><div class="flash" id="tFlash"></div>
  <p class="hint">最長 99 分 59 秒；燈上顯示「分分秒秒」，最後 10 秒變紅。</p></section>
 <section data-p="image"><h2>像素畫</h2><input type="file" id="pic" accept="image/*" onchange="loadPic()" style="width:100%">
  <p class="hint">會置中裁切並縮成 5×20 點（橫放為 20×5）。</p></section>
 <section data-p="mood"><h2>動畫</h2><div class="grid2" id="fx"></div>
  <h2 style="margin-top:14px">呼吸</h2><div class="row"><input type="color" id="brc" value="#ff9040" aria-label="呼吸顏色">
  <button onclick="draft={mode:'breathe',color:brc.value};preview()">預覽呼吸</button></div></section>
</div>
<!-- ===== 自動化 ===== -->
<div class="view" id="v-auto">
 <section><h2>時段自動切換 <span class="hint" id="slotCount"></span></h2>
  <label class="row" style="min-height:48px"><input type="checkbox" id="sch_on" style="width:22px;height:22px"> 啟用</label>
  <p class="hint" style="margin-top:0">到了每個時段的開始時間才切換；中途手動改的會維持到下一段。</p>
  <div id="slots"></div>
  <div class="row" style="margin-top:8px"><button id="addSlotBtn" onclick="addSlot()">＋ 加時段</button>
  <button class="pri" onclick="saveSched()">儲存排程</button></div><p class="hint bad" id="schErr"></p></section>
 <section><h2>行事曆提醒</h2><p class="hint" style="margin-top:0">依行事曆服務設定，預設在事件開始前 10 分鐘，插播紅色「NEXT 時:分」。點陣停止時不插播。</p>
  <div class="hint" id="cst"></div><button style="margin-top:10px" onclick="api('/api/alert-test',{})">測試提醒（1 分鐘）</button></section>
 <section><h2>Home Assistant 通知</h2>
  <p class="hint" style="margin-top:0">洗衣機／洗衣塔／Styler 完成與錯誤、冰箱門 2 分鐘、寵物缺水缺糧、NAS 異常、回家歡迎。設定在 HA 自動化（名稱以「方塊燈：」開頭）。</p>
  <button onclick="api('/api/notify',{text:'WASH DONE',seconds:20})">測試 WASH DONE（20 秒）</button></section>
</div>
</main>
<div class="sheet" id="sheet" onclick="if(event.target===this)sheet(false)"><div class="panel">
 <h2>擺放方向</h2><select id="ori" style="width:100%" onchange="mode({orient:this.value})">
  <option value="up">直放（底座在下）</option><option value="left">橫放（底座在左）</option>
  <option value="right">橫放（底座在右）</option><option value="down">倒放</option></select>
 <p class="hint">手機需與控制主機位於可互通的區域網路。</p>
 <button style="width:100%;margin-top:12px" onclick="sheet(false)">關閉</button></div></div>
<nav aria-label="主要分頁">
 <button class="on" data-v="con"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>內容</button>
 <button data-v="ctl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>控制</button>
 <button data-v="auto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>自動化</button>
</nav>
<div id="toast" role="status" aria-live="polite"></div>
<script>
const $=id=>document.getElementById(id);
const MODE={clock:'時鐘',text:'文字',breathe:'呼吸',effect:'動畫',weather:'天氣',image:'像素畫',off:'點陣停止'};
const FX={scroll:'捲動',still:'靜止',blink:'閃爍',scrollblink:'捲動＋閃爍'};
const WX={sun:'晴',moon:'晴（夜）',partly:'晴時多雲',cloud:'陰',fog:'霧',rain:'雨',snow:'雪',thunder:'雷雨'};
const SW=['#ff0000','#ff8000','#ffd000','#00e060','#00c8ff','#2050ff','#8b00ff','#ff40a0','#ffffff'];
let S=null, dragging=false, draft={mode:'clock'}, conTab='clock', schedLoaded=false, pending=null, playTimer=null;
const CLOCK_PAL=[['預設','',''],['暖白','#ffd8a0',''],['琥珀','#ff8a00',''],['夜間紅','#ff2a00',''],
 ['冰藍','#40c8ff',''],['薄荷','#30ffa0',''],['薰衣草','#a070ff',''],['櫻花','#ff5aa0',''],
 ['青＋粉','#00e0ff','#ff40a0'],['金＋白','#ffb000','#ffffff'],['綠＋黃','#30e060','#ffd040'],['紫＋青','#b060ff','#00e0c0']];
function renderPal(){$('pal').innerHTML=CLOCK_PAL.map(([n,a,b],i)=>{const h=a||'#ff8c00',m=b||a||'#00aaff';
  const on=(draft.color||'')===a&&(draft.color2||'')===b;
  return `<button class="${on?'on':''}" data-i="${i}" aria-pressed="${on}" aria-label="時鐘顏色 ${n}"><span class="dg"><span style="color:${h}">1</span><span style="color:${m}">2</span></span>${n}</button>`;}).join('');
 $('pal').querySelectorAll('button').forEach(b=>b.onclick=()=>{const [,a,c]=CLOCK_PAL[+b.dataset.i];draft.color=a;draft.color2=c;renderPal();renderCfx();preview();});}
const RB='#ff0000,#ffd000,#00e060,#00c8ff,#8b00ff,#ff40a0';
const CFX=[['fixed','固定',null],['flow','彩虹流動','linear-gradient(180deg,'+RB+')'],['diagonal','斜向彩虹','linear-gradient(135deg,'+RB+')'],
 ['sunset','夕陽漸層','linear-gradient(135deg,#ff4600,#ff006e,#9600ff)'],['ocean','海洋漸層','linear-gradient(135deg,#00ffbe,#0082ff,#461eff)'],
 ['pulse','呼吸',null],['sparkle','閃亮',null]];
function renderCfx(){const base=draft.color||'#ff8c00',cur=draft.colorFx||'fixed';
 document.querySelectorAll('[data-cfx]').forEach(box=>{box.innerHTML=CFX.map(([k,n,g])=>{
  const bg=g||(k==='pulse'?`radial-gradient(circle,${base},#05070c)`:k==='sparkle'?`radial-gradient(circle at 30% 40%,#fff 2px,transparent 3px),radial-gradient(circle at 70% 65%,#fff 2px,transparent 3px),${base}`:(draft.color||'linear-gradient(90deg,'+RB+')'));
  return `<button class="${k===cur?'on':''}" data-k="${k}" aria-pressed="${k===cur}" aria-label="顏色變化 ${n}"><span class="sw2" style="background:${bg}"></span>${n}</button>`;}).join('');
  box.querySelectorAll('button').forEach(b=>b.onclick=()=>{draft.colorFx=b.dataset.k;renderCfx();preview();});});
 const h=['flow','diagonal','sunset','ocean'].includes(cur)?'這個效果會取代上面選的顏色；燈上每 0.3 秒換一次色。':cur==='fixed'?'':'用上面選的顏色'+(draft.color?'':'（沒選就用橘色）')+'變化。';
 document.querySelectorAll('[data-cfxhint]').forEach(p=>p.textContent=h);}
const FLASH=[['綠','#00ff80'],['紅','#ff2020'],['橘','#ff8000'],['黃','#ffd000'],['藍','#2080ff'],['紫','#a040ff'],['粉','#ff40a0'],['白','#ffffff']];
let flashSel='#00ff80';try{flashSel=localStorage.getItem('cubeFlash')||flashSel;}catch(e){}
function renderFlash(){$('tFlash').innerHTML=FLASH.map(([n,c])=>`<button class="${c===flashSel?'on':''}" style="background:${c}" data-c="${c}" aria-pressed="${c===flashSel}" aria-label="閃燈顏色 ${n}"></button>`).join('');
 $('tFlash').querySelectorAll('button').forEach(b=>b.onclick=()=>{flashSel=b.dataset.c;try{localStorage.setItem('cubeFlash',flashSel);}catch(e){}renderFlash();});}
function timerStart(sec){if(!(sec>=5&&sec<=5999)){toast('要在 5 秒到 99 分 59 秒之間',3000);return;}api('/api/timer',{seconds:sec,flash:flashSel});}
function timerPause(){api('/api/timer',S&&S.timer&&S.timer.paused?{resume:true}:{pause:true});}
let tAt=0;
function tickTimer(){const T=S&&S.timer;$('tRun').hidden=!T||conTab!=='timer';if(!T)return;
 const left=T.paused?T.left:Math.max(0,T.left-Math.floor((Date.now()-tAt)/1000));
 $('tLeft').textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');
 $('tBar').style.width=(T.total?100*left/T.total:0)+'%';$('tPause').textContent=T.paused?'繼續':'暫停';}
function customClock(){draft.color=$('cc1').value;draft.color2=$('cc2').value;renderPal();preview();}
function renderHist(){const h=(S&&S.history)||[];$('hist').innerHTML=h.length?'':'<span class="hint">還沒有紀錄</span>';
 h.forEach(t=>{const d=document.createElement('span');d.className='chip';
  d.innerHTML='<button></button><button class="x"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
  d.firstChild.textContent=t;d.firstChild.title=t;d.firstChild.onclick=()=>setText(t);
  d.lastChild.setAttribute('aria-label','刪除紀錄 '+t);
  d.lastChild.onclick=async()=>{d.remove();const r=await fetch('/api/history',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({remove:t})});
   if(r.ok){S.history=(await r.json()).history;}toast('已刪除「'+t+'」');};
  $('hist').appendChild(d);});}
let histKey='';
let SLOT_OPTS=[['clock','時鐘'],['weather','天氣'],['image','像素畫'],['off','點陣停止']];

// ---- LED 畫布：保留 4 塊方塊的分界 ----
function drawLED(cv,f){const w=f.w||5,h=f.h||20,px=f.pixels||[];const cell=12,gap=4;
 const blocks=w>h?[Math.ceil(w/5),1]:[1,Math.ceil(h/5)];
 cv.width=w*cell+(blocks[0]-1)*gap;cv.height=h*cell+(blocks[1]-1)*gap;
 const k=w>h?1.2:1.4;cv.style.width=(cv.width/k)+'px';cv.style.height=(cv.height/k)+'px';
 const box=cv.closest('.now');if(box)box.classList.toggle('wide',w>h); // 橫放：點陣與文字改上下排，免得擠出畫面
 const g=cv.getContext('2d');g.fillStyle='#05070c';g.fillRect(0,0,cv.width,cv.height);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=px[y*w+x]||'#000000';
  const ox=x*cell+Math.floor(x/5)*(w>h?gap:0),oy=y*cell+Math.floor(y/5)*(w>h?0:gap);
  g.fillStyle=c==='#000000'?'#151a24':c;g.beginPath();g.arc(ox+cell/2,oy+cell/2,cell*0.4,0,7);g.fill();}}

function toast(t,ms=2500){const el=$('toast');el.textContent=t;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),ms);}
async function api(u,b){toast('傳送中…');
 try{const r=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});const j=await r.json();
  if(!r.ok){toast('失敗：'+(j.error||r.status),4000);return null;}
  pending=Date.now();toast('已儲存，等待燈回應…',8000);setTimeout(load,600);return j;}
 catch(e){toast('連不到控制台，請確認區域網路連線',4000);return null;}}
const light=b=>api('/api/light',b), mode=b=>api('/api/mode',b);
function power(){api('/api/light',{on:!(S&&S.light&&S.light.on)});}
function sheet(on){$('sheet').classList.toggle('on',on);}

// ---- 分頁 ----
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('on',x===b));
 document.querySelectorAll('.view').forEach(v=>v.classList.toggle('on',v.id==='v-'+b.dataset.v));if(b.dataset.v==='con')openCon(conTab);});
document.querySelectorAll('#cseg button').forEach(b=>b.onclick=()=>openCon(b.dataset.k));
function openCon(k){conTab=k;document.querySelectorAll('#cseg button').forEach(x=>x.classList.toggle('on',x.dataset.k===k));
 document.querySelectorAll('[data-p]').forEach(p=>p.hidden=p.dataset.p!==k);
 if(k==='clock'){draft={mode:'clock',color:(S&&S.color)||'',color2:(S&&S.color2)||'',colorFx:(S&&S.colorFx)||'fixed'};renderPal();}
 if(k==='text')draft={mode:'text',text:$('txt').value||(S&&S.text)||'HELLO',textFx:(S&&S.textFx)||'scroll',speed:+$('spd').value,color:(S&&S.mode==='text'&&S.color)||'',colorFx:(S&&S.colorFx)||'fixed'};
 if(k==='weather')draft={mode:'weather'};
 if(k==='image')draft={mode:'image',image:null};
 if(k==='mood')draft={mode:'effect',effect:'rainbow'};
 $('pv').hidden=k==='timer';if(k==='timer'){$('tQuick').innerHTML=[1,3,5,10,15,25].map(m=>`<button onclick="timerStart(${m*60})">${m} 分</button>`).join('');renderFlash();tickTimer();return;}
 syncFxSeg();renderCfx();preview();}
document.querySelectorAll('#fxseg button').forEach(b=>b.onclick=()=>{draft.textFx=b.dataset.v;syncFxSeg();preview();});
function syncFxSeg(){document.querySelectorAll('#fxseg button').forEach(x=>x.classList.toggle('on',x.dataset.v===(draft.textFx||'scroll')));
 $('spdBox').hidden=draft.textFx==='blink'||draft.textFx==='still';}

// ---- 文字輸入：即時大寫、標出不支援的字 ----
function setText(t){$('txt').value=t;onText();}
function onText(){const raw=$('txt').value.toUpperCase();const ok=S?S.supportedChars:'';
 const bad=[...new Set([...raw].filter(c=>ok&&!ok.includes(c)))];
 $('txtHint').innerHTML=bad.length?'<span class="bad">不支援：'+bad.join(' ')+'（請改掉才能套用）</span>':(raw?'實際顯示：'+raw:'請輸入文字');
 draft.text=raw;$('applyBtn').disabled=!raw||bad.length>0;if(!bad.length&&raw)preview();}

// ---- 預覽：向常駐程式要畫面，在手機上播放，不送燈 ----
async function preview(){clearTimeout(playTimer);const d={...draft};if(d.mode==='image'&&!d.image){$('preTitle').textContent='請選一張圖片';$('applyBtn').disabled=true;return;}
 if(d.mode==='text'&&!d.text){$('applyBtn').disabled=true;return;}
 $('applyBtn').disabled=false;
 $('preTitle').textContent=MODE[d.mode]+(d.mode==='text'?'「'+d.text+'」':'')+(d.mode==='effect'&&S?'：'+S.effects[d.effect]:'');
 const cf=d.colorFx&&d.colorFx!=='fixed'?CFX.find(c=>c[0]===d.colorFx)[1]:'';
 $('preSub').textContent=[d.mode==='text'?FX[d.textFx||'scroll']:(d.color?'自選顏色':''),cf].filter(Boolean).join(' · ');
 try{const r=await fetch('/api/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});const p=await r.json();
  if(!r.ok){$('preSub').innerHTML='<span class="bad">'+(p.error||'預覽失敗')+'</span>';$('applyBtn').disabled=true;return;}
  let i=0;const play=()=>{const f=p.frames[i%p.frames.length];drawLED($('pre'),{w:p.w,h:p.h,pixels:f.pixels});i++;
   if(p.frames.length>1)playTimer=setTimeout(play,Math.max(f.ms,200));};play();}catch(e){}}
function apply(){const d={...draft};if(d.mode==='image'&&!d.image)return;mode(d);}

// ---- 像素畫：手機端縮圖 ----
async function loadPic(){const f=$('pic').files[0];if(!f)return;const wide=S&&(S.orient==='left'||S.orient==='right');
 const w=wide?20:5,h=wide?5:20,img=await createImageBitmap(f);const c=document.createElement('canvas');c.width=w;c.height=h;
 const g=c.getContext('2d');const sc=Math.max(w/img.width,h/img.height);g.imageSmoothingQuality='high';
 g.drawImage(img,(w-img.width*sc)/2,(h-img.height*sc)/2,img.width*sc,img.height*sc);
 const d=g.getImageData(0,0,w,h).data,px=[];for(let i=0;i<d.length;i+=4)px.push('#'+[d[i],d[i+1],d[i+2]].map(v=>v.toString(16).padStart(2,'0')).join(''));
 draft={mode:'image',image:{w,h,pixels:px}};preview();}

// ---- 排程 ----
function slotRow(sl){const opts=SLOT_OPTS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
 const d=document.createElement('div');d.className='row';d.style.cssText='margin-bottom:8px;flex-wrap:nowrap';
 d.innerHTML=`<input type="time" value="${sl.at||'07:00'}" aria-label="開始時間" style="width:132px;padding:0 6px"><select style="flex:1;min-width:0;padding:0 8px" aria-label="內容">${opts}</select><button class="ghost" aria-label="刪除時段" style="padding:0;width:48px;flex:none"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
 d.querySelector('select').value=sl.mode==='effect'?'effect:'+sl.effect:sl.mode;d.querySelector('button').onclick=()=>{d.remove();slotCount();};
 $('slots').appendChild(d);slotCount();}
function slotCount(){const n=$('slots').children.length;$('slotCount').textContent='已用 '+n+'／6';$('addSlotBtn').disabled=n>=6;}
function addSlot(){slotRow({at:'07:00',mode:'clock'});}
function saveSched(){const s=[...$('slots').children].map(d=>{const at=d.querySelector('input').value,v=d.querySelector('select').value;
  return v.startsWith('effect:')?{at,mode:'effect',effect:v.slice(7)}:{at,mode:v};});
 const dup=s.map(x=>x.at).filter((t,i,a)=>a.indexOf(t)!==i);
 if(dup.length){$('schErr').textContent='時間重複：'+dup.join('、');return;}
 if(s.some(x=>x.mode==='image')&&S&&!S.hasImage){$('schErr').textContent='還沒上傳像素畫，不能排像素畫時段';return;}
 $('schErr').textContent='';mode({schedule:{enabled:$('sch_on').checked,slots:s}});}

// ---- 狀態輪詢 ----
const ago=t=>{if(!t)return null;const s=Math.round((Date.now()-new Date(t))/1000);return s<60?s+' 秒前':Math.round(s/60)+' 分鐘前';};
async function load(){try{const r=await fetch('/api/status');S=await r.json();
 if(!r.ok){$('cdot').className='dot bad';$('ctxt').textContent='常駐程式未回應';return;}
 const okAge=S.lastOkAt?(Date.now()-new Date(S.lastOkAt))/1000:1e9;
 $('cdot').className='dot '+(S.lastError?'bad':okAge<180?'ok':'');$('ctxt').textContent=S.lastError?'燈沒回應':(okAge<180?'燈 '+ago(S.lastOkAt)+'回應':'尚未確認連線');
 if(pending&&S.lastOkAt&&new Date(S.lastOkAt)>pending){toast('燈已回應 ✓');pending=null;}
 const L=S.light;$('pw').classList.toggle('on',!!(L&&L.on));$('pw').setAttribute('aria-pressed',!!(L&&L.on));
 if(L&&!dragging){$('br').value=L.level;$('bv').textContent=L.level+'%';if(L.ct){$('ct').value=L.ct;$('cv').textContent=L.ct+'K';}}
 else if(!L)$('bv').textContent='尚未讀取';
 $('curMode').textContent=S.paused?'燈已關':(MODE[S.mode]+(S.mode==='text'?'「'+S.text+'」':'')+(S.mode==='effect'?'：'+S.effects[S.effect]:''));
 const sub=[];if(S.yieldReason)sub.push(S.yieldReason);if(S.nextSlot)sub.push('下次 '+S.nextSlot.at+' 切換'+(S.nextSlot.mode==='effect'?S.effects[S.nextSlot.effect]:MODE[S.nextSlot.mode]));
 $('curSub').textContent=sub.join(' · ');const cur=S.mode==='effect'?'effect:'+S.effect:S.mode;
 document.querySelectorAll('[data-q]').forEach(b=>b.classList.toggle('pri',b.dataset.q===cur));$('resume').hidden=S.mode!=='off';
 tAt=Date.now();tickTimer();
 const R=S.rest;$('restOn').hidden=!R;$('restOff').hidden=!!R;
 if(R){const u=new Date(R.until),left=Math.max(0,Math.round((u-Date.now())/60000));
  $('restTxt').textContent='補眠中，到 '+u.toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false});
  $('restSub').textContent='還剩 '+(left>=60?Math.floor(left/60)+' 小時 ':'')+left%60+' 分';
  $('restMissed').textContent=R.missed.length?'先存著的通知 '+R.missed.length+' 則：'+R.missed.map(m=>m.text).join('、'):'目前沒有錯過的通知';
  $('curMode').textContent='補眠（暖色時鐘）';}
 if(S.timer)$('curMode').textContent='倒數'+(S.timer.paused?'（暫停）':'')+' '+String(Math.floor(S.timer.left/60)).padStart(2,'0')+':'+String(S.timer.left%60).padStart(2,'0');
 if(S.timerDone)$('curMode').textContent='時間到！';
 $('alertCard').hidden=!S.alert;if(S.alert){$('alertTxt').textContent='插播中「'+S.alert.text+'」';
  $('alertLeft').textContent='剩 '+Math.max(0,Math.round((new Date(S.alert.until)-Date.now())/1000))+' 秒，結束後回到'+MODE[S.mode];}
 const hk=JSON.stringify(S.history||[]);if(hk!==histKey){histKey=hk;renderHist();}
 $('ori').value=S.orient;$('wxNow').textContent=S.weather?(WX[S.weather.icon]||'')+' '+Math.round(S.weather.temp)+'°C':'讀取中';
 if(!$('fx').children.length){$('fx').innerHTML=Object.entries(S.effects).map(([k,v])=>`<button data-e="${k}">${v}</button>`).join('');
  $('fx').querySelectorAll('button').forEach(b=>b.onclick=()=>{draft={mode:'effect',effect:b.dataset.e};
   $('fx').querySelectorAll('button').forEach(x=>x.classList.toggle('pri',x===b));preview();});
  SLOT_OPTS=SLOT_OPTS.concat(Object.entries(S.effects).map(([k,v])=>['effect:'+k,v]));}
 if(!schedLoaded){$('sch_on').checked=S.schedule.enabled;$('slots').innerHTML='';
  (S.schedule.slots.length?S.schedule.slots:[{at:'07:00',mode:'clock'},{at:'21:00',mode:'effect',effect:'candle'},{at:'23:00',mode:'effect',effect:'sleep'}]).forEach(slotRow);schedLoaded=true;}
 }catch(e){$('cdot').className='dot bad';$('ctxt').textContent='連不到控制台';}}
async function loadFrame(){try{const f=await (await fetch('/api/frame')).json();if(f.w){drawLED($('cur'),f);drawLED($('cur2'),f);}}catch(e){}}
async function loadCal(){try{const s=await (await fetch('/api/cal')).json();
 $('cst').textContent=!s.last_run?'還沒執行過':'最近檢查 '+ago(s.last_run)+(s.last_error?' · 錯誤：'+s.last_error:' · 正常')+' · 10 分鐘內事件 '+(s.upcoming??0)+' 個';}catch(e){}}
SW.forEach(c=>{const d=document.createElement('button');d.className='sw';d.style.background=c;d.setAttribute('aria-label','整燈顏色 '+c);
 d.onclick=()=>{$('cp').value=c;light({color:c});};$('sw').appendChild(d);});
load().then(()=>{if(S&&S.text)$('txt').value=S.text;
 openCon(S&&S.timer?'timer':S?({clock:'clock',text:'text',weather:'weather',image:'image',effect:'mood',breathe:'mood'}[S.mode]||'clock'):'clock');});loadFrame();loadCal();
setInterval(load,4000);setInterval(tickTimer,1000);setInterval(loadFrame,1500);setInterval(loadCal,30000);
</script></body></html>"""


def main():
    ap = argparse.ArgumentParser(description="Yeelight 方塊燈網頁控制台")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--lan", action="store_true", help="讓同網路的手機也能開（不設密碼）")
    a = ap.parse_args()
    host = "0.0.0.0" if a.lan else "127.0.0.1"
    print(f"控制台：http://localhost:{a.port}  （常駐程式 {DAEMON}）  按 Ctrl+C 結束")
    ThreadingHTTPServer((host, a.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
