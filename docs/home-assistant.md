# 接入 Home Assistant

控制台（`cube_panel.py`）本身就是一組 HTTP API，Home Assistant 不需要額外外掛，用內建的 REST 感測器和 `rest_command` 就能同時「看狀態」和「下指令」。下面的 `<控制主機IP>` 換成執行控制台那台機器的區網位址。

燈本身的開關、亮度、顏色仍可由 HA 的 Matter 整合或 Apple 家庭處理；本文只處理這個專案才有的功能：倒數、補眠、通知、文字、情境。

> 提醒：點陣程式偵測到燈的顏色在別處被改（HA 的燈光卡片、Apple 家庭）時，會讓步並停止點陣。要在 HA 改顯示內容，請用下面的指令，不要用 HA 內建燈光卡片改顏色。

## 1. 狀態感測器

`configuration.yaml`（或你放 REST 整合的地方）：

```yaml
rest:
  - resource: http://<控制主機IP>:8771/api/status
    scan_interval: 10
    sensor:
      - name: "方塊燈 模式"
        unique_id: yeelight_cube_mode
        value_template: "{{ value_json.mode }}"
        json_attributes: [text, effect, face, orient, font, color, color2, colorFx, colorSpeed, peek]
      - name: "方塊燈 倒數剩餘"
        unique_id: yeelight_cube_timer_left
        unit_of_measurement: "s"
        device_class: duration
        value_template: "{{ value_json.timer.left if value_json.timer else 0 }}"
      - name: "方塊燈 補眠到"
        unique_id: yeelight_cube_rest_until
        device_class: timestamp
        value_template: "{{ value_json.rest.until if value_json.rest else none }}"
      - name: "方塊燈 插播文字"
        unique_id: yeelight_cube_alert_text
        value_template: "{{ value_json.alert.text if value_json.alert else '' }}"
      - name: "方塊燈 暫停原因"
        unique_id: yeelight_cube_yield_reason
        value_template: "{{ value_json.yieldReason or '' }}"
    binary_sensor:
      - name: "方塊燈 連線正常"
        unique_id: yeelight_cube_connected
        device_class: connectivity
        value_template: "{{ value_json.fails | int(0) == 0 and value_json.lastOkAt is not none }}"
      - name: "方塊燈 倒數中"
        unique_id: yeelight_cube_timer_running
        value_template: "{{ value_json.timer is not none }}"
      - name: "方塊燈 補眠中"
        unique_id: yeelight_cube_resting
        value_template: "{{ value_json.rest is not none }}"
      - name: "方塊燈 天氣輪播"
        unique_id: yeelight_cube_peek_enabled
        value_template: "{{ value_json.peek.enabled }}"
      - name: "方塊燈 天氣顯示中"
        unique_id: yeelight_cube_peek_active
        value_template: "{{ value_json.peekActive }}"
```

## 2. 指令

加進（或合併到）既有的 `rest_command:`，同一個檔案只能有一個 `rest_command:` 區塊：

```yaml
rest_command:
  yeelight_cube_notify:        # 通知插播；text、seconds、color
    url: "http://<控制主機IP>:8771/api/notify"
    method: POST
    content_type: "application/json"
    payload: >-
      {{ {"text": text, "seconds": seconds | default(300) | int,
          "color": color | default("#00ff80")} | to_json }}
  yeelight_cube_alert_clear:   # 結束目前插播
    url: "http://<控制主機IP>:8771/api/alert-clear"
    method: POST
    content_type: "application/json"
    payload: "{}"
  yeelight_cube_mode:          # mode：clock／weather／breathe／off…；effect 可選
    url: "http://<控制主機IP>:8771/api/mode"
    method: POST
    content_type: "application/json"
    payload: >-
      {{ ({"mode": mode} | combine({"effect": effect} if effect is defined else {})) | to_json }}
  yeelight_cube_clock:         # 切到時鐘並設定外觀；欄位都可省略，沒給的維持現況
    url: "http://<控制主機IP>:8771/api/mode"
    method: POST
    content_type: "application/json"
    payload: >-
      {% set p = {"mode": "clock"} %}
      {% if color is defined %}{% set p = p | combine({"color": color}) %}{% endif %}
      {% if color2 is defined %}{% set p = p | combine({"color2": color2}) %}{% endif %}
      {% if color_fx is defined %}{% set p = p | combine({"colorFx": color_fx}) %}{% endif %}
      {% if color_speed is defined %}{% set p = p | combine({"colorSpeed": color_speed | float}) %}{% endif %}
      {% if font is defined %}{% set p = p | combine({"font": font}) %}{% endif %}
      {% if orient is defined %}{% set p = p | combine({"orient": orient}) %}{% endif %}
      {{ p | to_json }}
  yeelight_cube_text:          # 顯示文字；text、color 可選
    url: "http://<控制主機IP>:8771/api/mode"
    method: POST
    content_type: "application/json"
    payload: >-
      {{ ({"mode": "text", "text": text}
          | combine({"color": color} if color is defined else {})) | to_json }}
  yeelight_cube_timer:         # 開始倒數；seconds（5–5999）、flash 閃燈顏色
    url: "http://<控制主機IP>:8771/api/timer"
    method: POST
    content_type: "application/json"
    payload: >-
      {{ {"seconds": seconds | int, "flash": flash | default("#00ff80")} | to_json }}
  yeelight_cube_timer_cancel:
    url: "http://<控制主機IP>:8771/api/timer"
    method: POST
    content_type: "application/json"
    payload: '{"cancel": true}'
  yeelight_cube_rest_start:    # 補眠；minutes（1–960）
    url: "http://<控制主機IP>:8771/api/rest"
    method: POST
    content_type: "application/json"
    payload: >-
      {{ {"minutes": minutes | int} | to_json }}
  yeelight_cube_rest_stop:
    url: "http://<控制主機IP>:8771/api/rest"
    method: POST
    content_type: "application/json"
    payload: '{"stop": true}'
  yeelight_cube_peek:          # 天氣輪播；enabled、every（分鐘）、seconds 存設定；show_now＋hold（秒）立刻看一次
    url: "http://<控制主機IP>:8771/api/peek"
    method: POST
    content_type: "application/json"
    payload: >-
      {% set p = {} %}
      {% if enabled is defined %}{% set p = p | combine({"enabled": enabled | bool}) %}{% endif %}
      {% if every is defined %}{% set p = p | combine({"every": every | int}) %}{% endif %}
      {% if seconds is defined %}{% set p = p | combine({"seconds": seconds | int}) %}{% endif %}
      {% if show_now is defined %}{% set p = p | combine({"now": show_now | bool}) %}{% endif %}
      {% if hold is defined %}{% set p = p | combine({"hold": hold | int}) %}{% endif %}
      {{ p | tojson }}
  yeelight_cube_scene:         # 套用收藏情境；id 在控制台「常用情境」的收藏檔裡
    url: "http://<控制主機IP>:8771/api/scenes"
    method: POST
    content_type: "application/json"
    payload: >-
      {{ {"action": "apply", "id": id} | to_json }}
```

### 時鐘設定

`yeelight_cube_clock` 可用的欄位：

| 欄位 | 說明 | 可用值 |
|---|---|---|
| `color` | 時鐘主色（小時） | `#rrggbb`；空字串＝預設 |
| `color2` | 分鐘色（雙色時鐘） | `#rrggbb`；空字串＝同主色 |
| `color_fx` | 顏色變化 | `fixed`、`flow`、`diagonal`、`sunset`、`ocean`、`pulse`、`sparkle`、`honey`、`nord`、`dracula`、`catppuccin`、`synthwave` |
| `color_speed` | 顏色變化速度 | 0.1（慢）到 1.5（快） |
| `font` | 字型 | `classic`、`compact` |
| `orient` | 擺放方向 | `up`、`down`、`left`、`right` |

### 氛圍與天氣

`yeelight_cube_mode` 傳 `mode: effect` 加 `effect`（`rainbow`、`party`、`candle`、`ocean`、`aurora`、`fire`、`stars`、`rain`、`sakura`、`heartbeat`、`snow`、`moon`、`lavender`、`mint`、`lamp`、`sunrise`）可切氛圍；傳 `mode: weather` 切到常駐天氣。`yeelight_cube_peek` 控制天氣輪播（每 `every` 分鐘顯示 `seconds` 秒），或用 `show_now: true` 搭配 `hold` 立刻看一次。

## 3. 自動化裡怎麼用

```yaml
action: rest_command.yeelight_cube_timer
data:
  seconds: 300
  flash: "#ffb74c"
```

```yaml
action: rest_command.yeelight_cube_clock
data:
  color: "#ffd8a0"
  color2: "#ff8a00"
  color_fx: fixed
  font: compact
```

```yaml
action: rest_command.yeelight_cube_rest_start
data:
  minutes: 480
```

## 4. 注意

- 感測器每 10 秒讀一次；倒數剩餘秒數會有 10 秒內的誤差，要精準倒數請看燈本身。
- 補眠中收到的通知先存著，結束後逐則補播；手動操作（控制台按套用）後 1 分鐘內進來的通知會排隊，時間到再播。
- 這些指令沒有認證，只適合放在家裡區網，不要對外開放控制台埠。
