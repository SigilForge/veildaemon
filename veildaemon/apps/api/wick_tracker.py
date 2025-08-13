# Moved implementation from root wick_tracker.py into package for cleanliness.
import datetime
try:
	from googleapiclient.discovery import build  # type: ignore
	from google_auth_oauthlib.flow import InstalledAppFlow  # type: ignore
	_FIT_AVAILABLE = True
except Exception:
	_FIT_AVAILABLE = False
from secrets_store import get_secret
import time
import json
from pathlib import Path

# === Add these imports for dual memory ===
from veildaemon.apps.api.wick_db import log_wick_event as db_log_wick_event
from veildaemon.apps.api.wick_obsidian import append_to_obsidian_log
try:
	from veildaemon.apps.api.wick_api_adapter import fetch_wick_status  # type: ignore
except Exception:
	fetch_wick_status = None  # type: ignore

WICK_STATE_FILE = "wick_state.json"
WICK_LOG_FILE = "wick_log.json"
DEFAULT_MAX_WICKS = 16
DEFAULT_DECAY_INTERVAL = 60 * 60  # 1 hour
DEFAULT_DECAY_AMOUNT = 1

# --- Wick state and log logic ---


def load_state():
	if Path(WICK_STATE_FILE).exists():
		return json.loads(Path(WICK_STATE_FILE).read_text())
	return {"wicks": DEFAULT_MAX_WICKS, "last_decay": time.time()}


def save_state(state):
	Path(WICK_STATE_FILE).write_text(json.dumps(state, indent=2))

# === Unified logging: log to JSON, DB, and optionally Obsidian ===


def log_wick_event(amount, reason, context=""):
	wicks = get_wicks()
	entry = {
		"timestamp": time.time(),
		"wicks": wicks,
		"delta": amount,
		"reason": reason,
		"context": context,
	}
	logs = []
	if Path(WICK_LOG_FILE).exists():
		logs = json.loads(Path(WICK_LOG_FILE).read_text())
	logs.append(entry)
	Path(WICK_LOG_FILE).write_text(json.dumps(logs, indent=2))
	# Log to SQLite always
	db_log_wick_event(wicks, amount, reason, context)
	# Log to Obsidian only for meaningful events (edit as needed)
	if abs(amount) >= 1 or "ritual" in reason.lower() or "#trigger" in reason.lower():
		append_to_obsidian_log(wicks, amount, reason, context)


def get_wicks():
	state = load_state()
	return state["wicks"]


def set_wicks(val):
	state = load_state()
	state["wicks"] = max(0, min(DEFAULT_MAX_WICKS, int(val)))
	save_state(state)


def decay_wicks(decay_amount=DEFAULT_DECAY_AMOUNT, interval=DEFAULT_DECAY_INTERVAL):
	state = load_state()
	now = time.time()
	elapsed = now - state["last_decay"]
	decays = int(elapsed // interval)
	if decays > 0:
		total_decay = decays * decay_amount
		state["wicks"] = max(0, state["wicks"] - total_decay)
		state["last_decay"] += decays * interval
		save_state(state)
		log_wick_event(-total_decay,
					   f"auto-decay ({decays}x @ {decay_amount}/interval)")
	return state["wicks"]


def add_wicks(amount, reason="rest", context=""):
	state = load_state()
	prev = state["wicks"]
	state["wicks"] = min(DEFAULT_MAX_WICKS, state["wicks"] + amount)
	save_state(state)
	log_wick_event(state["wicks"] - prev, reason, context)
	return state["wicks"]


def subtract_wicks(amount, reason="exertion", context=""):
	state = load_state()
	prev = state["wicks"]
	state["wicks"] = max(0, state["wicks"] - amount)
	save_state(state)
	log_wick_event(state["wicks"] - prev, reason, context)
	return state["wicks"]


# --- Google Fit Integration ---

SCOPES = [
	'https://www.googleapis.com/auth/fitness.activity.read',
	'https://www.googleapis.com/auth/fitness.heart_rate.read',
	'https://www.googleapis.com/auth/fitness.sleep.read'
]


def get_fit_service():
	if not _FIT_AVAILABLE:
		raise RuntimeError("Google Fit client libraries not installed.")
	# Defer imports to inside function to satisfy static analysis
	from googleapiclient.discovery import build as _build  # type: ignore
	from google_auth_oauthlib.flow import InstalledAppFlow as _InstalledAppFlow  # type: ignore
	# Prefer encrypted client config if available
	client_cfg = get_secret("google.oauth.client_config")
	if client_cfg:
		try:
			if isinstance(client_cfg, str):
				client_cfg = json.loads(client_cfg)
			flow = _InstalledAppFlow.from_client_config(client_cfg, SCOPES)
		except Exception as e:
			print(f"⚠️ Failed to load encrypted Google client config: {e}. Falling back to client_secret.json")
			flow = _InstalledAppFlow.from_client_secrets_file('client_secret.json', SCOPES)
	else:
		flow = _InstalledAppFlow.from_client_secrets_file('client_secret.json', SCOPES)
	creds = flow.run_local_server(port=0)
	service = _build('fitness', 'v1', credentials=creds)
	return service


def get_today_stats(service):
	now = datetime.datetime.now()
	start_time = int(datetime.datetime(
		now.year, now.month, now.day).timestamp() * 1000)
	end_time = int(now.timestamp() * 1000)
	dataset = f"{start_time}000000-{end_time}000000"

	# Steps
	steps = 0
	step_ds = "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps"
	step_resp = service.users().dataSources().datasets().get(
		userId='me', dataSourceId=step_ds, datasetId=dataset).execute()
	for point in step_resp.get('point', []):
		for val in point['value']:
			steps += val.get('intVal', 0)

	# Heart Rate
	hr_values = []
	hr_ds = "derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm"
	hr_resp = service.users().dataSources().datasets().get(
		userId='me', dataSourceId=hr_ds, datasetId=dataset).execute()
	for point in hr_resp.get('point', []):
		for val in point['value']:
			hr_values.append(val.get('fpVal', 0))
	avg_hr = sum(hr_values) / len(hr_values) if hr_values else None

	# Stress (if present)
	stress = None
	stress_ds = "derived:com.google.stress.level:com.google.android.gms:merge_stress_level"
	try:
		stress_resp = service.users().dataSources().datasets().get(
			userId='me', dataSourceId=stress_ds, datasetId=dataset).execute()
		for point in stress_resp.get('point', []):
			for val in point['value']:
				stress = val.get('fpVal', 0)
	except Exception:
		pass

	# Sleep (total minutes asleep)
	sleep_minutes = 0
	sleep_ds = "derived:com.google.sleep.segment:com.google.android.gms:merge_sleep_segments"
	sleep_resp = service.users().dataSources().datasets().get(
		userId='me', dataSourceId=sleep_ds, datasetId=dataset).execute()
	for point in sleep_resp.get('point', []):
		# 2 = sleep (light/deep/REM)
		if point.get("value", [{}])[0].get("intVal", -1) == 2:
			s = int(point.get("startTimeNanos", 0)) // 1_000_000_000 // 60
			e = int(point.get("endTimeNanos", 0)) // 1_000_000_000 // 60
			sleep_minutes += max(0, e - s)

	return steps, avg_hr, stress, sleep_minutes


def update_from_fit(steps=0, hr=None, stress=None, sleep_minutes=None):
	"""
	Mythic mapping (customize as you wish):
	- Each 1000 steps = +1 wick (max once/hour)
	- Each 10 minutes of deep sleep = +1 wick
	- High HR or high stress = -1 wick
	"""
	added = 0
	context = f"steps={steps}, hr={hr}, stress={stress}, sleep={sleep_minutes}"
	if steps:
		added += steps // 1000
	if sleep_minutes:
		added += sleep_minutes // 10
	if hr and hr > 120:
		added -= 1
	if stress and stress > 70:
		added -= 1
	if added > 0:
		add_wicks(added, "Google Fit sync: activity/rest", context)
	elif added < 0:
		subtract_wicks(abs(added), "Google Fit sync: fatigue/stress", context)
	# Log always, even if 0
	log_wick_event(added, "Google Fit sync summary", context)
	return get_wicks()


def sync_wicks_with_fit():
	if not _FIT_AVAILABLE:
		print("[Fit] Google Fit libraries not available.")
		return get_wicks()
	service = get_fit_service()
	steps, hr, stress, sleep_minutes = get_today_stats(service)
	update_from_fit(steps=steps, hr=hr, stress=stress, sleep_minutes=sleep_minutes)
	print(f"Fit sync: steps={steps}, avg_hr={hr}, stress={stress}, sleep={sleep_minutes}min")
	return get_wicks()


def sync_wicks_with_api():
	"""Optional: sync wicks from external API if configured."""
	if not fetch_wick_status:
		print("[WickAPI] adapter not available.")
		return get_wicks()
	data = fetch_wick_status()
	if not data:
		print("[WickAPI] no data.")
		return get_wicks()
	# Apply
	w = data.get("wicks")
	delta = data.get("delta", 0)
	reason = data.get("reason", "API sync")
	context = data.get("context", "")
	if isinstance(w, int):
		set_wicks(w)
	if isinstance(delta, int) and delta != 0:
		log_wick_event(delta, reason, context)
	# Always log a summary line
	log_wick_event(0, "API sync summary", json.dumps(data))
	print("[WickAPI] synced:", data)
	return get_wicks()


def manual_log(reason="manual", context=""):
	log_wick_event(0, reason, context)


# ====== For Testing ======
if __name__ == "__main__":
	print("Wicks before decay:", get_wicks())
	decay_wicks()
	print("Wicks after decay:", get_wicks())
	print("Add 3 wicks for rest:", add_wicks(3, "rest/test"))
	print("Subtract 2 wicks for stress:", subtract_wicks(2, "stress/test"))
	sync_wicks_with_fit()
	manual_log("test entry")
