import asyncio
import webbrowser
from pathlib import Path
import sys

# Ensure StreamDaemon on path
ROOT = Path(__file__).resolve().parent
SD = ROOT / 'StreamDaemon'
if str(SD) not in sys.path:
    sys.path.append(str(SD))

from streamdaemon_main import main as stream_main  # type: ignore

async def run():
    # Kick the daemon; the main prints the admin URL after overlay starts
    # Delay-open the admin page a moment later.
    async def open_admin_later():
        await asyncio.sleep(2.5)
        try:
            webbrowser.open('http://127.0.0.1:8765/admin')
        except Exception:
            pass
    asyncio.create_task(open_admin_later())
    await stream_main()

if __name__ == '__main__':
    asyncio.run(run())
