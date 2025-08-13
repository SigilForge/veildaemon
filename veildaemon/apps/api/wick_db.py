import sqlite3
import time
from pathlib import Path

DB_FILE = "wick_log.db"


def init_db():
	conn = sqlite3.connect(DB_FILE)
	c = conn.cursor()
	c.execute("""
		CREATE TABLE IF NOT EXISTS wick_events (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp REAL,
			wicks INTEGER,
			delta INTEGER,
			reason TEXT,
			context TEXT
		);
	""")
	c.execute("""
		CREATE TABLE IF NOT EXISTS chat_log (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp REAL,
			speaker TEXT,
			message TEXT
		);
	""")
	c.execute("""
		CREATE TABLE IF NOT EXISTS journal_entries (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp REAL,
			entry TEXT,
			mood TEXT,
			tags TEXT
		);
	""")
	conn.commit()
	conn.close()


def log_wick_event(wicks, delta, reason, context=""):
	init_db()
	conn = sqlite3.connect(DB_FILE)
	c = conn.cursor()
	c.execute(
		"INSERT INTO wick_events (timestamp, wicks, delta, reason, context) VALUES (?, ?, ?, ?, ?)",
		(time.time(), wicks, delta, reason, context)
	)
	conn.commit()
	conn.close()


def log_chat_message(speaker, message):
	init_db()
	conn = sqlite3.connect(DB_FILE)
	c = conn.cursor()
	c.execute(
		"INSERT INTO chat_log (timestamp, speaker, message) VALUES (?, ?, ?)",
		(time.time(), speaker, message)
	)
	conn.commit()
	conn.close()


def log_journal_entry(text, mood="", tags=""):
	init_db()
	conn = sqlite3.connect(DB_FILE)
	c = conn.cursor()
	c.execute(
		"INSERT INTO journal_entries (timestamp, entry, mood, tags) VALUES (?, ?, ?, ?)",
		(time.time(), text, mood, tags)
	)
	conn.commit()
	conn.close()


def get_recent_events(n=10):
	init_db()
	conn = sqlite3.connect(DB_FILE)
	c = conn.cursor()
	c.execute(
		"SELECT timestamp, wicks, delta, reason, context FROM wick_events ORDER BY id DESC LIMIT ?", (n,))
	events = c.fetchall()
	conn.close()
	return events


def get_today_events():
	import datetime
	now = time.time()
	today = datetime.date.fromtimestamp(now)
	midnight = time.mktime(today.timetuple())
	conn = sqlite3.connect(DB_FILE)
	c = conn.cursor()
	c.execute("SELECT timestamp, wicks, delta, reason, context FROM wick_events WHERE timestamp >= ? ORDER BY id ASC", (midnight,))
	events = c.fetchall()
	conn.close()
	return events


def get_journal_entries(date=None, mood=None, search=None):
	init_db()
	import datetime
	conn = sqlite3.connect(DB_FILE)
	c = conn.cursor()
	query = "SELECT timestamp, entry, mood, tags FROM journal_entries WHERE 1=1"
	params = []
	if date:
		# Date should be YYYY-MM-DD
		dt = datetime.datetime.strptime(date, "%Y-%m-%d")
		start = dt.timestamp()
		end = (dt + datetime.timedelta(days=1)).timestamp()
		query += " AND timestamp >= ? AND timestamp < ?"
		params.extend([start, end])
	if mood:
		query += " AND mood = ?"
		params.append(mood)
	if search:
		query += " AND (entry LIKE ? OR tags LIKE ?)"
		params.extend([f"%{search}%", f"%{search}%"])
	query += " ORDER BY timestamp ASC"
	c.execute(query, params)
	results = c.fetchall()
	conn.close()
	# returns [(timestamp, entry, mood, tags), ...]
	return results


def get_mood_history(days=30):
	import datetime
	init_db()
	conn = sqlite3.connect(DB_FILE)
	c = conn.cursor()
	cutoff = time.time() - days * 86400
	c.execute(
		"SELECT timestamp, mood FROM journal_entries WHERE timestamp >= ? ORDER BY timestamp ASC", (cutoff,))
	data = c.fetchall()
	conn.close()
	# Map mood strings to numbers
	mood_map = {"calm": 2, "good": 2, "hopeful": 1,
				"blank": 0, "sad": -1, "anxious": -2, "angry": -2}
	mood_points = []
	dates = []
	for ts, mood in data:
		dates.append(datetime.datetime.fromtimestamp(ts))
		mood_points.append(mood_map.get(mood, 0))
	return dates, mood_points
