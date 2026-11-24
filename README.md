# Yeelight Cube Matter 控制台

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

### 時鐘與配色

1. 在「內容 → 時鐘」選擇配色。
2. 需要雙色時，分別選小時和分鐘顏色。
3. 選擇「顏色變化」，確認預覽後按「套用到燈」。

提供 12 組配色：預設橘藍、暖白、琥珀、夜間紅、冰藍、薄荷、薰衣草、櫻花、青＋粉、金＋白、綠＋黃、紫＋青，另可自訂。

目前時間、排程和補眠時間使用 `Asia/Taipei`，時鐘顯示 24 小時制 `HHMM`，四塊配置沒有獨立的冒號欄位。

### 文字

在「內容 → 文字」輸入最多 60 個字元，選效果、配色及捲動速度，再套用。支援英文、數字、空白、`! ? - . : + < > / ♥`；輸入自動轉大寫，不支援中文與其他 emoji。

| 效果 | 顯示方式 |
|---|---|
| 捲動 | 直放由下往上，橫放由右往左；介面可選每格 200–800 毫秒 |
| 靜止 | 4 字內保持不動；超過 4 字時每 2.5 秒換一頁，每頁最多 4 字 |
| 閃爍 | 每頁最多 4 字，亮 1.5 秒、暗 0.6 秒，閃 3 次後換頁 |
| 捲動＋閃爍 | 捲動時每隔幾格短暫變暗 |

每次套用文字會自動保存紀錄，最多 12 筆，最近使用的排在前面；點紀錄可帶回輸入框，右上角 ✕ 可刪除。紀錄存在控制主機的狀態檔，換手機仍可共用。

### 顏色變化

時鐘與文字都支援下列效果，文字的靜止、捲動與閃爍可搭配使用。動畫約每 0.3 秒更新，文字捲動速度另外設定。

| 選項 | 效果 |
|---|---|
| 固定 | 使用選定的顏色 |
| 彩虹流動 | 沿點陣長邊流動 |
| 斜向彩虹 | 顏色由左上往右下一波波流動 |
| 夕陽漸層 | 橘、粉、紫漸層 |
| 海洋漸層 | 青、藍、紫漸層 |
| 呼吸 | 選定顏色一明一暗 |
| 閃亮 | 選定顏色上出現白色亮點 |

### 倒數計時

「內容 → 計時」提供 1／3／5／10／15／25 分鐘快捷鍵，也可輸入分、秒，範圍為 **5 秒至 99 分 59 秒**。開始前先選「時間到閃燈顏色」（8 色可選，選擇記在該瀏覽器）。

燈顯示 `MMSS`，分鐘琥珀色、秒數青色，最後 10 秒全紅。可暫停／繼續、＋1 分鐘、取消；暫停時數字變暗。時間到整面以選定顏色閃爍 8 秒，再回到原本內容。通知插播期間倒數仍繼續計時。

### 補眠

在「控制 → 補眠」選 2／4／6 小時，或指定「睡到 HH:MM」後開始。補眠期間亮度降到 5%，顯示暖橘時鐘，一般通知先暫存並列在控制頁。

時間到或按「結束補眠」會恢復原本亮度與內容，再逐則補播通知，每則 1 分鐘；已經過期的行事曆提醒不補播。補眠狀態會存檔。倒數計時的顯示優先於補眠時鐘，使用補眠前請先取消不需要的倒數。

### 天氣、像素畫與氛圍

- **天氣**：設定服務的 `WEATHER_LAT`、`WEATHER_LON` 後，從 Open-Meteo 每 15 分鐘取得天氣圖示與攝氏溫度。未設定座標時不查詢天氣，也不使用預設位置。
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
# 時鐘、文字與顏色變化
curl -X POST http://127.0.0.1:8772/mode -H 'Content-Type: application/json' \
  -d '{"mode":"clock","color":"#ff8a00","color2":"#00c8ff","colorFx":"fixed"}'
curl -X POST http://127.0.0.1:8772/mode -H 'Content-Type: application/json' \
  -d '{"mode":"text","text":"HELLO","textFx":"still","colorFx":"diagonal"}'
# 倒數、暫停、繼續、加時、取消
curl -X POST http://127.0.0.1:8772/timer -H 'Content-Type: application/json' -d '{"minutes":5,"flash":"#ff2020"}'
# 其他 /timer 請求：{"pause":true}、{"resume":true}、{"add":60}、{"cancel":true}
# 補眠；結束時傳 {"stop":true}
curl -X POST http://127.0.0.1:8772/rest -H 'Content-Type: application/json' -d '{"minutes":240}'
# 通知插播；清除時傳 {"clear":true}
curl -X POST http://127.0.0.1:8772/alert -H 'Content-Type: application/json' \
  -d '{"text":"DONE","seconds":60,"color":"#00ff80"}'
```

常用讀取端點為 `GET /status`、`GET /frame`；`POST /preview` 可產生預覽，不套用到燈。完整處理邏輯見 [cube_daemon.mjs](matter/cube_daemon.mjs)。

## Matter 協定與相容性

- 端點 1：標準 OnOff `0x0006`、LevelControl `0x0008`、ColorControl `0x0300`。
- 端點 2：Yeelight 自訂 cluster `0x1312FC03`。
- `setEffect 0x13120000`：TLV `{0:{0:36,1:0},1:true}` 切到塗鴉效果 36。
- `setData 0x13120007`：TLV `{0:octstr}`，4 塊 × 25 顆 × `[A,R,G,B]`，共 400 bytes。
- 第 0 塊接底座，每塊由右下角向左數，再往上一排；方向轉換由 renderer 處理。

協定來自 App 靜態分析與實機驗證；不同韌體的 cluster 和指令可能不同。並非所有 Cube 都適用區網 JSON 的 `update_leds`，本專案使用 Matter，不依賴 TCP 55443。

恢復原廠設定後，需重新建立配對。先停止使用該控制器的所有程式，把舊憑證目錄離線備份，再依首次配對步驟建立新控制器；不要把失效的舊憑證與新配對混用。

## 檔案與隱私

| 檔案 | 用途 |
|---|---|
| `cube_panel.py` | 手機網頁控制台與 API 轉送 |
| `matter/cube_daemon.mjs` | 常駐、模式、通知、補眠、倒數與排程 |
| `matter/cube_lib.mjs` | 字型、方向、繪圖、Matter 指令 |
| `matter/cube_pixels.mjs` | 指令列時鐘／文字與離線 `selftest` |
| `matter/fc_tool.mjs` | 原始 vendor cluster 指令除錯 |
| `matter/probe_read.mjs` | 標準屬性除錯讀取 |
| `cal_watch.py` | 選用的行事曆提醒 |

憑證、配對碼、行事曆帳密、個人文字紀錄、圖片、提醒狀態和 log 都應留在私有本機路徑。`.gitignore` 已排除常見敏感檔案；不要將實際狀態或憑證目錄加入 repo。除錯工具和常駐程式也不要同時搶用同一個控制器。
