# CubeLight · Matter 控制台

> 非官方專案，與 Yeelight 無關。Yeelight 及相關名稱為其所有者的商標，這裡僅用來說明相容的設備。

透過 Matter 直接控制 Yeelight Cube 的點陣像素，提供手機網頁控制台、時鐘、文字、天氣、倒數計時與通知插播。

目前實機驗證的配置為 **1 個底座＋4 塊 5×5 點陣模組**，支援直放與橫放。其他模組數量、混搭模組或不同韌體尚未驗證；程式目前固定為 100 個像素，不能直接增加模組數量。

## 功能與操作

手機或電腦連到可存取控制主機的區域網路，開啟 `http://<控制主機IP>:8771`。iPhone 可用 Safari 的「分享 → 加入主畫面」建立捷徑。

底部有三個分頁；**內容是首頁**，右上角齒輪可設定擺放方向。

| 分頁 | 功能 |
|---|---|
| 內容 | 時鐘、文字、天氣、計時、像素畫、氛圍；先看「現在／預覽」，按「套用到燈」才套用內容 |
| 控制 | 電源、亮度、整燈純色與色溫、常用模式、即時畫面、通知插播卡、補眠模式 |
| 自動化 | 最多 6 個時段自動切換、行事曆提醒狀態與測試、Home Assistant 通知測試 |

橫放時「現在／預覽」改成上下排列，套用按鈕放在畫面下方，避免寬點陣擠出手機畫面。操作回饋分為「傳送中 → 已儲存，等待燈回應 → 燈已回應」；裝置回應代表接受指令，畫面仍以實燈為準。

### 常用情境收藏

在內容頁調整好預覽，填入「情境名稱」並按「☆ 收藏預覽」。收藏最多 12 組、名稱最多 20 字，會保存內容模式、文字／圖片、字型、配色、方向與捲動設定。收藏不會立即改燈，也不包含亮度、排程、補眠、通知或正在倒數的計時器。

收藏列位於內容頁頂端，左右滑動可找其他收藏，點名稱就直接套用；「管理收藏」可改名或刪除。資料存於控制主機的 `MATTER_STORAGE_PATH/cube_scenes.json`，換手機仍可使用，重新啟動也保留。補眠或倒數進行中須先結束再套用收藏，避免內容被蓋住。

### 時鐘與配色

1. 在「內容 → 時鐘」選擇配色。
2. 需要雙色時，分別選小時和分鐘顏色。
3. 選擇「顏色變化」，確認預覽後按「套用到燈」。

時鐘配色分成「精選／單色／雙色／主題」，預設只顯示 5 組精選。切換分組只改選單，仍須選色並套用才會改燈；自訂雙色入口保留。

提供 17 組配色：預設橘藍、暖白、琥珀、夜間紅、冰藍、薄荷、薰衣草、櫻花、青＋粉、金＋白、綠＋黃、紫＋青，另加蜜糖暖光、北歐冰川、德古拉、奶霜粉彩、復古電光，也可自訂。

**字型**：時鐘與文字可選「經典 5×5」或「窄字 3×5」。橫放窄字時鐘使用 `HH:MM`，直放則置中顯示四位數；窄字橫放靜止英文一頁最多 5 字，例如 `HELLO`。原有狀態預設保留經典字型，可在內容頁切換。橫放的靜止／閃爍文字在兩種字型下都依實際點亮範圍置中，跑馬燈維持原本捲動方向。

目前時間、排程和補眠時間使用 `Asia/Taipei`，時鐘採 24 小時制；經典字型維持 `HHMM`，窄字橫放才顯示冒號。

### 文字

在「內容 → 文字」輸入最多 60 個字元，選效果、配色及捲動速度，再套用。支援英文、數字、空白、`! ? - . : + < > / ( ) ^ _ = ;`，以及 `♥ ★ ☆ ♪ ☺ ☹ ↑ ↓ ← →`；輸入自動轉大寫，不支援中文與一般 emoji。

文字欄下方有「符號與文字表情」，先選「符號」或「文字表情（4 格內）」，再選分類，每次只展開一組：

- **64 個符號**：分為愛心星光、圖形天氣、方向運算、標點括號、花朵季節、音符紙牌；例如 ♥、♡、★、☆、♪、♫、☺、☹、✓、✕、☀、☾、↑、↓、←、→、∞，另補入 ✿、❀、✦、✧、❄、☁、☂、☃、♠、♣、♦、♩、♭、♯、◀、▶。點選會插入游標位置，也可取代選取的文字。
- **50 組文字表情**：分為開心、俏皮、難過、驚訝；例如 `:)`、`:-D`、`XD`、`^_^`、`UWU`、`;)`、`:P`、`<3`、`T_T`、`;_;`、`O_O`、`>_<`。每組最多 4 字元，四塊模組在兩種字型、四種方向皆可單頁呈現；點選會整組取代輸入框內容。

帶入只更新預覽；確認後按「套用到燈」才送出。符號都有經典與窄字點陣字形，不依賴手機 emoji 字型；3×5 的複雜圖形會簡化。總長仍限制 60 字元，輸入與顯示統一為大寫。

表情參考 [Wiktionary 常見文字表情](https://en.wiktionary.org/wiki/Appendix:Emoticons) 與 [文字表情列表](https://en.wikipedia.org/wiki/List_of_emoticons)，再依字元數與點陣限制篩選，屬常用選集，並非所有網路表情的完整收錄。可用字元以控制台回傳的 `supportedChars` 為準。

| 效果 | 顯示方式 |
|---|---|
| 捲動 | 直放由下往上，橫放由右往左；介面可選每格 200–800 毫秒 |
| 靜止 | 單頁內保持不動；超過單頁容量時每 2.5 秒換一頁，經典字型／直放每頁最多 4 字，窄字橫放最多 5 字 |
| 閃爍 | 經典字型／直放每頁最多 4 字，窄字橫放最多 5 字，亮 1.5 秒、暗 0.6 秒，閃 3 次後換頁 |
| 捲動＋閃爍 | 捲動時每隔幾格短暫變暗 |

每次套用文字會自動保存紀錄，最多 12 筆，最近使用的排在前面；點紀錄可帶回輸入框，右上角 ✕ 可刪除。紀錄存在控制主機的狀態檔，換手機仍可共用。

### 顏色變化

時鐘與文字都支援下列效果，文字的靜止、捲動與閃爍可搭配使用。畫面約每 0.3 秒更新；顏色流動速度與文字捲動速度可分開設定。選單分成「基本／流動／主題」，每次只展開一組。

| 選項 | 效果 |
|---|---|
| 固定 | 使用選定的顏色 |
| 彩虹流動 | 沿點陣長邊流動 |
| 斜向彩虹 | 顏色由左上往右下一波波流動 |
| 夕陽漸層 | 橘、粉、紫漸層 |
| 海洋漸層 | 青、藍、紫漸層 |
| 呼吸 | 選定顏色一明一暗；時鐘保留小時／分鐘雙色 |
| 閃亮 | 原有顏色上出現白色亮點；時鐘保留小時／分鐘雙色 |
| 蜜糖暖光 | 固定橘黃漸層，接近暖色點陣時鐘 |
| 北歐冰川 | 冰青與霧藍緩慢流動 |
| 德古拉霓虹 | 紫、粉、青流動 |
| 奶霜粉彩 | 淡紫、粉、蜜桃、薄荷流動 |
| 復古電光 | 高彩粉紅、紫、電光青流動 |

**顏色流動速度**：選擇動態顏色後，會出現 0.10×–1.50× 滑桿及「很慢 0.15×／柔和 0.35×／適中 0.65×／原速 1.00×」快捷鍵。數字越小越慢，預設為 0.35×；時鐘與文字均可使用，確認預覽後套用，速度會隨狀態與收藏保存。這只調整動畫相位，時鐘仍顯示正確時間，文字捲動速度另設，不提高 Matter 指令頻率。固定色與蜜糖暖光靜態漸層不顯示速度控制。

### 倒數計時

「內容 → 計時」提供 1／3／5／10／15／25 分鐘快捷鍵，也可輸入分、秒，範圍為 **5 秒至 99 分 59 秒**。開始前先選「時間到閃燈顏色」（8 色可選，選擇記在該瀏覽器）。

燈顯示 `MMSS`，分鐘琥珀色、秒數青色，最後 10 秒全紅。可暫停／繼續、＋1 分鐘、取消；暫停時數字變暗。時間到整面以選定顏色閃爍 8 秒，再回到原本內容。通知插播期間倒數仍繼續計時。

### 補眠

在「控制 → 補眠」選 2／4／6 小時，或指定「睡到 HH:MM」後開始。補眠期間亮度降到 5%，顯示暖橘時鐘，一般通知先暫存並列在控制頁。

時間到或按「結束補眠」會恢復原本亮度與內容，再逐則補播通知，每則 1 分鐘；已經過期的行事曆提醒不補播。補眠狀態會存檔。倒數計時的顯示優先於補眠時鐘，使用補眠前請先取消不需要的倒數。

### 像素表情

開啟「內容 → 像素畫 → 像素表情」，提供 **貓咪、熊、開心、哭哭、生氣** 五款原創彩色點陣圖。每張圖卡有實際像素縮圖與名稱；點選先看預覽，按「套用到燈」才顯示，也可填名稱後按「☆ 收藏預覽」。

- 橫放（底座在左或右）：使用整面 20×5 顯示大臉。
- 直放／倒放：四塊各顯示同一款 5×5 小臉。
- 表情選擇會隨狀態與收藏保存；不依賴文字字型，也不覆蓋已上傳圖片。
- 要上傳照片，切到同頁的「上傳圖片」；現有上傳與裁切流程保留。

這些是依點陣限制重新畫的簡化表情，不能完整重現複雜 Unicode 顏文字的眉毛、腮紅與上下疊字。新增符號的選取範圍亦參考 [U Joy 的符號整理](https://ujoy.pixnet.net/blog/posts/8233733087)，所有點陣字形與表情圖樣由本專案自行繪製。

### 天氣、像素畫與氛圍

- **天氣**：設定服務的 `WEATHER_LAT`、`WEATHER_LON` 後，從 Open-Meteo 每 15 分鐘取得天氣圖示與攝氏溫度。未設定座標時不查詢天氣，也不使用預設位置。橫放時圖示與 C 分列兩側，中間氣溫使用 3×5 窄字，數字只留一欄間距並置中；直放保留原來每塊一格的排列。
- **像素畫**：上傳圖片，置中裁切並縮成直放 5×20／橫放 20×5，先看預覽再套用。
- **氛圍**：彩虹、派對、燭光、海洋、極光、火焰、星空、雨滴、櫻花飄落、心跳、日出、警示閃爍、漸暗關燈，共 13 種動畫，另有自選色呼吸。

### 方向、排程與外部控制

| 設定 | 底座位置 | 畫布 |
|---|---|---|
| `up` | 下方，直放 | 5×20 |
| `left` | 左側，橫放 | 20×5 |
| `right` | 右側，橫放 | 20×5 |
| `down` | 上方，倒放 | 5×20 |

在「自動化」新增時段、選內容、開啟排程並儲存，最多 6 段。到了下一個時段才切換，中途手動選的內容會保留到下一段。

點陣模式中，如果 Apple 家庭或其他控制器改變整燈顏色，點陣約 10 秒內停止，讓外部設定接手；關燈時暫停送畫面，開燈後恢復。設定點陣停止（`off`）時不插播通知。

## 桌面圖示與名稱

網站與主畫面名稱為 **CubeLight**，使用原創點陣方塊圖示；已提供 Apple touch icon、favicon、192／512 px manifest 圖示和獨立視窗顯示設定。
iPhone 在 Safari 重新開啟頁面，按「分享 → 加入主畫面」。已有黑底文字舊圖示時，先移除舊捷徑再重新加入；瀏覽器不一定會更新已保存的圖示。名稱可在加入時自行改寫。

內網 HTTP 仍需連到控制主機；這是主畫面網頁 App 外觀，不含離線控制或推播。HTTPS 環境下的完整 PWA 安裝與離線機制未實作。
原始圖示在 `assets/icon.svg`，PNG 由 `python3 tools/build_icons.py` 建置（需 Pillow）；執行控制台不需 Pillow。

配色參考 [Nord](https://www.nordtheme.com/docs/colors-and-palettes/)、[Dracula](https://spec.draculatheme.com/)、[Catppuccin](https://catppuccin.com/palette/) 官方色盤，採用其色彩組合靈感，非人氣排名；蜜糖暖光與復古電光為自選組合。LED 與手機預覽存在色差。

## 安裝與配對

目前開發與常駐環境為 macOS。需要 Node.js（所安裝版本須符合 matter.js 0.18 的 engines 要求）、npm、Python 3，以及可互通的 Matter 區域網路。網頁控制台只用 Python 標準函式庫，行事曆功能另需 `caldav`。

```bash
git clone https://github.com/xyzKIWI/yeelight-cube-matter.git
cd yeelight-cube-matter/matter
npm ci
node cube_pixels.mjs selftest
```

`selftest` 不連燈，檢查四種方向的座標與 400 bytes ARGB 編碼。

### 首次 Matter 配對

如果燈已加入 Apple 家庭，從燈的設定選「開啟配對模式」，取得新的設定代碼；無需移除原有家庭配對。燈尚未設定時，先依裝置說明完成入網。

```bash
mkdir -p "$HOME/.matter-yeelight"
chmod 700 "$HOME/.matter-yeelight"
export MATTER_STORAGE_PATH="$HOME/.matter-yeelight"
node node_modules/@matter/nodejs-shell/dist/esm/app.js
```

在 shell 提示符輸入下列指令，把 `<設定代碼>` 換成剛取得的碼：

```text
commission pair --pairing-code <設定代碼> --nodeId 4242
nodes list
exit
```

找不到裝置時，可在配對指令追加 `--ip <燈的IP> --port 5540`。程式固定尋找節點 `4242`，所以配對時請使用相同節點編號。憑證路徑與 `shell-0` 控制器必須和執行服務時一致；不要讓兩份程式同時使用同一份控制器憑證。

### 啟動控制台

在 `matter/` 執行常駐程式：

```bash
MATTER_STORAGE_PATH="$HOME/.matter-yeelight" CUBE_PORT=8772 MATTER_LOG_LEVEL=warn node cube_daemon.mjs
```

另一個終端在專案根目錄執行：

```bash
CUBE_DAEMON=http://127.0.0.1:8772 python3 cube_panel.py --lan --port 8771
```

開啟 `http://<控制主機IP>:8771`。只需本機使用時可省略 `--lan`。控制台**沒有登入驗證**，請僅放在可信任的區域網路，不要直接公開至網際網路。公開此原始碼不會公開你的本機控制台。

### 常駐與環境設定

macOS 可建立兩個 LaunchAgent：一個執行 Node.js 常駐程式，一個執行 Python 控制台；設定 `RunAtLoad`、`KeepAlive`、完整執行檔路徑與本機 log 路徑。LaunchAgent 在使用者登入後載入。關閉終端時，要持續顯示時鐘／跑馬燈，仍需常駐服務執行。

| 變數 | 用途／預設 |
|---|---|
| `MATTER_STORAGE_PATH` | Matter 憑證目錄，必填，建議置於 Git 以外 |
| `CUBE_PORT` | Node.js API 埠，預設 `8766`，只綁定 loopback |
| `CUBE_STATE` | 狀態檔，預設憑證目錄中的 `cube_state.json` |
| `CUBE_DAEMON` | Python 轉送的 API 位址，預設 `http://127.0.0.1:8766`；請與 `CUBE_PORT` 一致 |
| `CAL_STATE` | 行事曆狀態檔，預設 `~/.matter-yeelight/cal_watch.json` |
| `WEATHER_LAT`／`WEATHER_LON` | 自己選定的城市等級座標，選用 |
| `MATTER_LOG_LEVEL` | 可設 `warn` 減少協定除錯 log |

設定存於本機狀態檔。燈斷電恢復後會嘗試重送點陣模式；連續失敗 5 次時服務結束，可由 `KeepAlive` 重啟。主機睡眠、網路或裝置離線時無法保證顯示持續更新。

## 通知整合

通知插播時，內容頁會顯示正在播放的文字及「結束插播」。例如燈上顯示 `ERROR`，可能是外部傳來的通知文字；是否連線正常仍以頂端連線狀態判斷。

按「套用到燈」、套用收藏或手動結束插播，會清除當前插播並暫停接收新通知 60 秒。這段期間通知會略過，不補播；相同文字與顏色的通知在 5 分鐘內去重，不再延長插播。去重和暫停時間只存在服務記憶體，重新啟動後重置；未修改外部通知來源的自動化。

### Home Assistant

在 HA 的 `configuration.yaml` 加入下列範例，以自己的控制主機位址取代 `<控制主機IP>`：

```yaml
rest_command:
  yeelight_cube_notify:
    url: "http://<控制主機IP>:8771/api/notify"
    method: POST
    content_type: "application/json"
    payload: >-
      {{ {"text": text, "seconds": seconds | default(300) | int,
          "color": color | default("#00ff80")} | to_json }}
```

重新載入相關設定後，可在自動化動作呼叫 `rest_command.yeelight_cube_notify`，傳入 `text`、`seconds`、`color`。例如洗衣完成用 `WASH DONE`、300 秒、綠色；事件觸發器與裝置 entity 需按自己的 HA 設定建立。本專案不包含任何個人裝置清單或現成的 HA 自動化部署。

### iCloud／CalDAV 行事曆（選用）

建立獨立 Python 環境：

```bash
python3 -m venv .venv
.venv/bin/pip install caldav
mkdir -p "$HOME/.config/yeelight-cube"
```

在 Git 以外的 `~/.config/yeelight-cube/calendar.env` 填入 `CALDAV_BASE_URL`、`CALDAV_USERNAME`、`CALDAV_PASSWORD` 三個 `KEY=value` 設定，並限制檔案權限（例如 `chmod 600`）。帳密與設定代碼不要提交到 Git。

```bash
CAL_NAMES='<行事曆名稱一>,<行事曆名稱二>' \
CUBE_DAEMON=http://127.0.0.1:8772 .venv/bin/python cal_watch.py
```

可用 `CAL_ENV_FILE` 指向其他私有設定檔、`CAL_LEAD_MIN` 修改提前時間（預設 10 分鐘），並由排程器每 2 分鐘執行一次。只讀取指定行事曆，跳過全天與取消事件；同一事件只提醒一次，顯示 `NEXT HH:MM` 至事件開始。提醒功能不會將完整事件標題送上燈。

## API 範例

以下由本機直接呼叫 Node.js API；區網控制台則使用 `/api/` 轉送端點（例如 `/api/mode`、`/api/timer`、`/api/rest`、`/api/notify`）。

```bash
# 時鐘、文字與顏色變化；interrupt:true 可結束插播並暫停通知 60 秒
curl -X POST http://127.0.0.1:8772/mode -H 'Content-Type: application/json' \
  -d '{"mode":"clock","color":"#ff8a00","color2":"#00c8ff","colorFx":"flow","colorSpeed":0.35,"interrupt":true}'
curl -X POST http://127.0.0.1:8772/mode -H 'Content-Type: application/json' \
  -d '{"mode":"text","text":"HELLO","textFx":"still","colorFx":"diagonal"}'
# 像素表情；face 可選 cat / bear / happy / cry / angry
curl -X POST http://127.0.0.1:8772/mode -H 'Content-Type: application/json' \
  -d '{"mode":"face","face":"cat","interrupt":true}'
# 倒數、暫停、繼續、加時、取消
curl -X POST http://127.0.0.1:8772/timer -H 'Content-Type: application/json' -d '{"minutes":5,"flash":"#ff2020"}'
# 其他 /timer 請求：{"pause":true}、{"resume":true}、{"add":60}、{"cancel":true}
# 補眠；結束時傳 {"stop":true}
curl -X POST http://127.0.0.1:8772/rest -H 'Content-Type: application/json' -d '{"minutes":240}'
# 通知插播；清除時傳 {"clear":true}
curl -X POST http://127.0.0.1:8772/alert -H 'Content-Type: application/json' \
  -d '{"text":"DONE","seconds":60,"color":"#00ff80"}'
```

收藏使用 `POST /scenes`（網頁轉送為 `/api/scenes`）：

```json
{"action":"save","name":"暖色時鐘","settings":{"mode":"clock","font":"compact","orient":"left","color":"#ffb74c","color2":"#ffdb8c"}}
```

回傳的 `scenes` 含收藏 `id`。再傳 `{"action":"apply","id":"<收藏id>"}` 套用、`{"action":"rename","id":"<收藏id>","name":"新名稱"}` 改名，或 `{"action":"delete","id":"<收藏id>"}` 刪除。收藏名稱不可重複；無效名稱、超額、找不到 id 均回傳 HTTP 400。通知被略過或去重時仍回傳 HTTP 200，分別帶 `suppressed:true` 或 `deduplicated:true`。

常用讀取端點為 `GET /status`、`GET /frame`；`POST /preview` 可產生預覽，不套用到燈。完整處理邏輯見 [cube_daemon.mjs](matter/cube_daemon.mjs)。

## Matter 協定與相容性

- 端點 1：標準 OnOff `0x0006`、LevelControl `0x0008`、ColorControl `0x0300`。
- 端點 2：點陣畫面走裝置的廠商自訂擴充指令（常數與格式見 [cube_lib.mjs](matter/cube_lib.mjs)）：先切到自訂效果，再送整面像素，4 塊 × 25 顆 × `[A,R,G,B]`，共 400 bytes。
- 第 0 塊接底座，每塊由右下角向左數，再往上一排；方向轉換由 renderer 處理。

指令格式經實機驗證；不同韌體可能不同。並非所有 Cube 都適用區網 JSON 的 `update_leds`，本專案使用 Matter，不依賴 TCP 55443。

恢復原廠設定後，需重新建立配對。先停止使用該控制器的所有程式，把舊憑證目錄離線備份，再依首次配對步驟建立新控制器；不要把失效的舊憑證與新配對混用。

## 接入 Home Assistant

感測器、倒數、補眠、通知與時鐘外觀設定的 HA 範例見 [docs/home-assistant.md](docs/home-assistant.md)。

## 授權

MIT License，詳見 [LICENSE](LICENSE)。這是非官方專案，與 Yeelight 無關。

## 檔案與隱私

| 檔案 | 用途 |
|---|---|
| `cube_panel.py` | 手機網頁控制台與 API 轉送 |
| `matter/cube_daemon.mjs` | 常駐、模式、通知、補眠、倒數與排程 |
| `matter/pixel_faces.mjs` | 五款像素表情、縮圖與方向配置 |
| `matter/clock_colors.mjs` | 時鐘雙色基底與呼吸／閃亮保色 |
| `matter/color_speed.mjs` | 顏色動畫速度範圍與相位 |
| `matter/scenes_store.mjs` | 常用情境收藏、檔案保存與欄位限制 |
| `matter/cube_lib.mjs` | 字型、方向、繪圖、Matter 指令 |
| `matter/cube_pixels.mjs` | 指令列時鐘／文字與離線 `selftest` |
| `matter/fc_tool.mjs` | 原始 vendor cluster 指令除錯 |
| `matter/probe_read.mjs` | 標準屬性除錯讀取 |
| `cal_watch.py` | 選用的行事曆提醒 |

憑證、配對碼、行事曆帳密、個人文字紀錄、收藏、圖片、提醒狀態和 log 都應留在私有本機路徑。`.gitignore` 已排除常見敏感檔案；不要將實際狀態或憑證目錄加入 repo。除錯工具和常駐程式也不要同時搶用同一個控制器。
