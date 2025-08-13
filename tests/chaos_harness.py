import asyncio, time

from veildaemon.apps.bus.event_bus import EventBus
from veildaemon.apps.stage.stage_director import StageDirector


async def run():
    bus = EventBus()
    sd = StageDirector(bus=bus)

    now = time.monotonic()
    await bus.publish("beats", {"risk": 0.34, "beats": ["banter"]})
    await bus.publish("utterance", {"utterance_id": "u_test", "seq": 0, "final": False, "priority": 1, "scene": "Gaming",
                                   "budget_ms": 900, "expiry_ts": now + 3, "safe_mode": "clean", "beats": ["banter"], "text": "setup line"})
    await asyncio.sleep(0.1)
    await bus.publish("utterance", {"utterance_id": "uRaid", "seq": 0, "final": True, "priority": 5, "scene": "Gaming",
                                   "budget_ms": 900, "expiry_ts": now + 3, "safe_mode": "clean", "beats": ["raid"], "text": "RAID!"})
    await bus.publish("beats", {"risk": 0.46, "beats": ["banter"]})
    await asyncio.sleep(0.5)


if __name__ == "__main__":
    asyncio.run(run())
