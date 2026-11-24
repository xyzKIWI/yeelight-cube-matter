#!/usr/bin/env python3
"""iCloud 行事曆 → 方塊燈提醒：事件開始前 10 分鐘，插播紅色跑馬燈「NEXT HH:MM」到事件開始。

每次執行讀一輪後結束，可由 launchd 或其他排程器每 2 分鐘執行。
需另安裝 caldav，帳密放在 Git 以外的本機設定檔。

環境變數：
    CAL_ENV_FILE    CalDAV 設定檔，預設 ~/.config/yeelight-cube/calendar.env
    CAL_NAMES       要提醒的行事曆名稱，逗號分隔，必填，請填自己的行事曆名稱
    CAL_LEAD_MIN    提前幾分鐘，預設 10
    CUBE_DAEMON     像素常駐程式 API，預設 http://127.0.0.1:8772
    CAL_STATE       狀態檔（已提醒過的事件、最近一次執行結果），預設 ~/.matter-yeelight/cal_watch.json
全天事件、已取消的事件不提醒；同一事件同一開始時間只提醒一次。
"""
import json
import os
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

HOME = Path.home()
ENV_FILE = Path(os.environ.get("CAL_ENV_FILE", HOME / ".config" / "yeelight-cube" / "calendar.env"))
CAL_NAMES = [n.strip() for n in os.environ.get("CAL_NAMES", "").split(",") if n.strip()]
LEAD = timedelta(minutes=int(os.environ.get("CAL_LEAD_MIN", "10")))
DAEMON = os.environ.get("CUBE_DAEMON", "http://127.0.0.1:8772")
STATE_FILE = Path(os.environ.get("CAL_STATE", HOME / ".matter-yeelight" / "cal_watch.json"))
TPE = timezone(timedelta(hours=8))


def load_env(path):
    env = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip("\"'")
    return env


def load_state():
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"notified": {}}


def save_state(state):
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(STATE_FILE)


def upcoming_events(now):
    """回傳 [(uid, 開始時間, 行事曆名稱)]，只含 (now, now+LEAD] 內開始、有時間的事件。"""
    import caldav

    if not CAL_NAMES:
        raise RuntimeError("請設定 CAL_NAMES，指定要提醒的行事曆")
    env = load_env(ENV_FILE)
    client = caldav.DAVClient(url=env["CALDAV_BASE_URL"], username=env["CALDAV_USERNAME"],
                              password=env["CALDAV_PASSWORD"])
    cals = [c for c in client.principal().calendars() if c.name in CAL_NAMES]
    missing = set(CAL_NAMES) - {c.name for c in cals}
    if missing:
        raise RuntimeError("找不到行事曆：" + "、".join(sorted(missing)))
    out = []
    for cal in cals:
        for ev in cal.search(start=now - timedelta(minutes=1), end=now + LEAD, event=True, expand=True):
            for comp in ev.icalendar_instance.walk("VEVENT"):
                if str(comp.get("STATUS", "")).upper() == "CANCELLED":
                    continue
                start = comp.decoded("DTSTART")
                if not isinstance(start, datetime):  # 全天事件
                    continue
                if start.tzinfo is None:
                    start = start.replace(tzinfo=TPE)
                if now < start <= now + LEAD:
                    out.append((str(comp.get("UID")), start, cal.name))
    return out


def post_alert(text, until):
    body = json.dumps({"text": text, "until": until.astimezone(timezone.utc).isoformat()}).encode()
    req = urllib.request.Request(DAEMON + "/alert", data=body, method="POST",
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read() or b"{}")


def main():
    now = datetime.now(TPE)
    state = load_state()
    state.setdefault("notified", {})
    # 清掉一天前的紀錄，狀態檔不會一直長大
    cutoff = (now - timedelta(days=1)).isoformat()
    state["notified"] = {k: v for k, v in state["notified"].items() if v >= cutoff}
    try:
        events = upcoming_events(now)
        sent = []
        for uid, start, cal_name in sorted(events, key=lambda e: e[1]):
            key = f"{uid}|{start.isoformat()}"
            if key in state["notified"]:
                continue
            text = "NEXT " + start.astimezone(TPE).strftime("%H:%M")
            post_alert(text, start)
            state["notified"][key] = start.isoformat()
            sent.append(f"{cal_name} {start.astimezone(TPE):%H:%M}")
            break  # 一次只插播最近的一個
        state["last_run"] = now.isoformat(timespec="seconds")
        state["last_ok"] = state["last_run"]
        state["last_error"] = None
        state["upcoming"] = len(events)
        save_state(state)
        if sent:
            print(now.strftime("%F %T"), "提醒", "、".join(sent))
        return 0
    except Exception as e:  # 失敗也記下來，控制台看得到
        state["last_run"] = now.isoformat(timespec="seconds")
        state["last_error"] = f"{type(e).__name__}: {e}"
        save_state(state)
        print(now.strftime("%F %T"), "ERROR", state["last_error"], file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
