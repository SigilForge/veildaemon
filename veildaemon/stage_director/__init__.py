import time
from typing import Any, Dict, Optional

from veildaemon.apps.bus.event_bus import EventBus
from .schema_guard import validate_utterance_plan


class StageDirector:
	"""Arbitrates utterances, priorities, and barge-in vs. hold.

	Inputs:
	  - beats snapshots on channel 'beats' from HRM control loop
	  - utterance plans on channel 'utterance'
	Outputs:
	  - emits decided speech on channel 'speak' as {'text','priority','duration_ms','anim','overlay'}
	Policies are simple and configurable via constructor args.
	"""

	RISK_ON = 0.45
	RISK_OFF = 0.35
	PRIO = {"raid": 5, "donation": 4, "near_miss": 3, "killstreak": 2, "banter": 1}

	def __init__(self, bus: EventBus, risk_talk_threshold: float = 0.4, tts_manager: Any | None = None) -> None:
		self.bus = bus
		self.risk_talk_threshold = float(risk_talk_threshold)
		self._current: Optional[Dict[str, Any]] = None
		self._tts_cancel_cb = None  # optional callback to cancel TTS
		self._speaking_blocked = False
		# Track latest seq per utterance_id to drop stale chunks
		self._latest_seq: Dict[str, int] = {}
		self._tts_manager = tts_manager

	def set_tts_cancel(self, cb):
		self._tts_cancel_cb = cb

	async def run(self) -> None:
		q = await self.bus.subscribe("utterance")
		while True:
			plan = await q.get()
			# Basic schema validation
			if not validate_utterance_plan(plan):
				continue
			# Validate schema and sequence
			utt_id = str(plan.get("utterance_id") or "")
			seq = int(plan.get("seq") or 0)
			exp_ts = float(plan.get("expiry_ts") or 0.0)  # monotonic epoch
			prio = int(plan.get("priority") or 1)
			if utt_id:
				last_seq = self._latest_seq.get(utt_id, -1)
				if seq <= last_seq:
					# stale chunk
					continue
				self._latest_seq[utt_id] = seq
			# Drop expired
			try:
				if exp_ts and time.monotonic() > exp_ts:
					continue
			except Exception:
				pass
			beats = await self.bus.latest("beats") or {}
			risk = float(beats.get("risk") or 0.0)
			phase = str(beats.get("phase") or "")
			# Hysteresis for speaking block
			if self._speaking_blocked:
				if risk < self.RISK_OFF:
					self._speaking_blocked = False
			else:
				if risk > self.RISK_ON:
					self._speaking_blocked = True
			# Boss gate: allow only higher-priority quips (>=3)
			allow = True
			if phase.lower() == "boss" and prio < 3:
				allow = False
			if self._speaking_blocked and prio < 3:
				allow = False
			if not allow and prio < 4:
				# Drop unless force
				continue
			# Infer priority from beats ladder
			try:
				beats_tags = plan.get("beats") or []
				for b in beats_tags:
					prio = max(prio, self.PRIO.get(str(b), prio))
				plan["priority"] = prio
			except Exception:
				pass
			# Barge-in: cancel current if higher priority lands
			if self._current is not None:
				cur_prio = int(self._current.get("priority") or 1)
				if prio > cur_prio:
					uid = self._current.get("utterance_id") or None
					# Prefer tts_manager.cancel(uid) if provided
					if uid and self._tts_manager and hasattr(self._tts_manager, '_handles'):
						try:
							import asyncio
							asyncio.create_task(self._tts_manager._handles.cancel(uid))
						except Exception:
							pass
					elif callable(self._tts_cancel_cb):
						try:
							if uid is not None:
								self._tts_cancel_cb(uid)
							else:
								self._tts_cancel_cb()
						except Exception:
							pass
			self._current = plan
			await self.bus.publish("speak", plan)

__all__ = ["StageDirector"]
