import edge_tts
import asyncio


async def test():
    c = edge_tts.Communicate(
        "If you hear this, your daemon is alive.", "en-US-JennyNeural")
    await c.run()

asyncio.run(test())
