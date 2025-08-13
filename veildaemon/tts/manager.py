import asyncio
import time
import os
import platform
import pathlib
import tempfile
import configparser
from pathlib import Path
import json
import sys
from urllib import request as urlrequest
from urllib.error import URLError, HTTPError

try:
    from playsound import playsound  # type: ignore
except Exception:
    playsound = None  # optional

# Back-compat constants (env overrides are preferred)
VOICE = os.environ.get("EDGE_VOICE", "en-US-JennyNeural")
RATE = os.environ.get("EDGE_RATE", "+0%")

# Note: No SAPI fallback by default as per user preference


# ---- Backend helpers (adapted from StreamDaemon/tts_audition.py) ----
async def _edge_tts_to_file(text: str, voice: str, rate: str) -> str:
    from edge_tts import Communicate  # lazy import to avoid mandatory dep at import time
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
        out_path = tmp.name
    try:
        comm = Communicate(text=text, voice=voice, rate=rate)
        with open(out_path, "wb") as f:
            async for chunk in comm.stream():
                ctype = (chunk.get("type") or chunk.get("Type") or "").lower()
                if ctype == "audio":
                    f.write(chunk.get("data") or chunk.get("Data") or b"")
    except Exception as e:
        try:
            os.remove(out_path)
        except Exception:
            pass
        raise RuntimeError(f"edge-tts failed: {e}")
    return out_path


async def _elevenlabs_to_file(text: str, voice: str, model_id: str) -> str:
    from secrets_store import get_secret  # type: ignore
    api_key = (get_secret('elevenlabs.api.key') or '').strip()
    if not api_key:
        raise RuntimeError("Missing elevenlabs.api.key; set via: python secrets_store.py set elevenlabs.api.key <key>")
    voice_id = voice or ''
    # If looks like a short name, try to resolve to voice_id
    if voice_id and len(voice_id) < 20:
        try:
            voice_id = await _elevenlabs_resolve_voice_id_by_name(api_key, voice_id)
        except Exception:
            pass
    if not voice_id:
        raise RuntimeError("Provide ELEVENLABS_VOICE env var to use ElevenLabs.")
    mdl = model_id or 'eleven_multilingual_v2'
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    payload = {"text": text, "model_id": mdl, "voice_settings": {"stability": 0.5, "similarity_boost": 0.8}}
    headers = {"xi-api-key": api_key, "accept": "audio/mpeg", "content-type": "application/json"}

    def fetch_bytes():
        req = urlrequest.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
        with urlrequest.urlopen(req, timeout=30) as resp:
            return resp.read()

    try:
        mp3_bytes = await asyncio.get_running_loop().run_in_executor(None, fetch_bytes)
    except (HTTPError, URLError, TimeoutError) as e:
        raise RuntimeError(f"ElevenLabs error: {e}")
    except Exception as e:
        raise RuntimeError(f"ElevenLabs error: {e}")
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
        out_path = tmp.name
        tmp.write(mp3_bytes)
    return out_path


async def _elevenlabs_resolve_voice_id_by_name(api_key: str, name: str) -> str:
    url = "https://api.elevenlabs.io/v1/voices"
    headers = {"xi-api-key": api_key, "accept": "application/json"}

    def fetch_list():
        req = urlrequest.Request(url, headers=headers, method='GET')
        with urlrequest.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode('utf-8', errors='ignore') or '{}')

    data = await asyncio.get_running_loop().run_in_executor(None, fetch_list)
    voices = (data.get('voices') or []) if isinstance(data, dict) else []
    target = name.strip().lower()
    for v in voices:
        try:
            if str(v.get('name', '')).strip().lower() == target:
                vid = str(v.get('voice_id') or v.get('voiceId') or '').strip()
                if vid:
                    return vid
        except Exception:
            continue
    return name  # fall back to original


async def _piper_to_file(text: str, piper_exe: str, piper_model: str, verbose: bool = False) -> str:
    if not (piper_exe and os.path.exists(piper_exe)):
        raise RuntimeError("PIPER_EXE path invalid or missing")
    if not (piper_model and os.path.exists(piper_model)):
        raise RuntimeError("PIPER_MODEL path invalid or missing")
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        out_path = tmp.name
    cmd = [piper_exe, '-m', piper_model, '-f', out_path]
    if not verbose:
        cmd.append('-q')
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    if proc.stdin:
        proc.stdin.write(text.encode('utf-8', errors='ignore') + b"\n")
        await proc.stdin.drain()
        proc.stdin.close()
    stdout_b, stderr_b = await proc.communicate()
    if proc.returncode != 0:
        se = (stderr_b or b'').decode('utf-8', errors='ignore')
        raise RuntimeError(f"piper exited with {proc.returncode}: {se.strip()}")
    try:
        size = os.path.getsize(out_path)
        if size < 1024:
            raise RuntimeError(f"piper produced a tiny WAV ({size} bytes)")
    except Exception:
        raise
    return out_path


# (SAPI backend intentionally disabled by default)


def _play_and_cleanup(path: str) -> None:
    try:
        if platform.system() == 'Windows' and pathlib.Path(path).suffix.lower() == '.wav':
            try:
                import winsound  # type: ignore
                winsound.PlaySound(path, winsound.SND_FILENAME)
            except Exception:
                if playsound is not None:
                    playsound(path)
                else:
                    try:
                        import winsound  # type: ignore
                        winsound.MessageBeep()
                    except Exception:
                        pass
        else:
            if playsound is not None:
                playsound(path)
            else:
                print(f"Saved audio to {path}")
    finally:
        try:
            os.remove(path)
        except Exception:
            pass


from .handles import HandleRegistry, PlaybackHandle
from .wps_meter import WPSMeter


class TTSManager:
    """Orchestrate TTS with fallbacks: ElevenLabs -> Piper -> Edge.
    Configure via environment variables:
      - TTS_PRIORITY (csv): default 'elevenlabs,piper,edge'
      - ELEVENLABS_VOICE, ELEVENLABS_MODEL_ID
      - PIPER_EXE, PIPER_MODEL
      - EDGE_VOICE, EDGE_RATE
    Secrets:
      - elevenlabs.api.key (secrets_store)
    """

    def __init__(self) -> None:
        # Defaults/env
        env_priority = (os.environ.get('TTS_PRIORITY') or '').strip()
        # Edge
        self.edge_voice = os.environ.get('EDGE_VOICE', VOICE)
        self.edge_rate = os.environ.get('EDGE_RATE', RATE)
        # ElevenLabs
        self.el_voice = os.environ.get('ELEVENLABS_VOICE', '')
        self.el_model = os.environ.get('ELEVENLABS_MODEL_ID', 'eleven_multilingual_v2')
        # Piper
        self.piper_exe = os.environ.get('PIPER_EXE', '')
        self.piper_model = os.environ.get('PIPER_MODEL', '')
    # No SAPI in default chain

        # Try to load StreamDaemon/veil.config if present to fill gaps
        try:
            cfg_path = Path(__file__).resolve().parent / 'StreamDaemon' / 'veil.config'
            if not cfg_path.exists():
                # Repo root relative path
                cfg_path = Path(__file__).resolve().parent / 'StreamDaemon' / 'veil.config'
            if cfg_path.exists():
                cp = configparser.ConfigParser()
                cp.read(cfg_path, encoding='utf-8')
                if cp.has_section('audio'):
                    if not self.piper_exe:
                        self.piper_exe = (cp.get('audio', 'piper_exe', fallback='') or '').strip()
                    if not self.piper_model:
                        self.piper_model = (cp.get('audio', 'piper_model', fallback='') or '').strip()
                    # voice id in config may be a name or id
                    if not self.el_voice:
                        self.el_voice = (cp.get('audio', 'elevenlabs_voice_id', fallback='') or '').strip()
                if cp.has_section('elevenlabs') and not self.el_model:
                    self.el_model = (cp.get('elevenlabs', 'model_id', fallback=self.el_model) or self.el_model).strip()
        except Exception:
            pass

        # Determine backend availability
        el_ok = False
        try:
            from secrets_store import get_secret  # type: ignore
            el_ok = bool((get_secret('elevenlabs.api.key') or '').strip()) and bool(self.el_voice)
        except Exception:
            el_ok = False
        piper_ok = bool(self.piper_exe and os.path.exists(self.piper_exe) and self.piper_model and os.path.exists(self.piper_model))
    # No SAPI availability check needed

        # Compute priority
        if env_priority:
            self.priority = [p.strip().lower() for p in env_priority.split(',') if p.strip()]
        else:
            # Default: ElevenLabs -> Piper -> Edge (no SAPI)
            self.priority = ['elevenlabs', 'piper', 'edge']

        # Serialize speaks to avoid overlapping audio
        try:
            self._lock = asyncio.Lock()
        except Exception:
            self._lock = None
        self._handles = HandleRegistry()
        self._wps = WPSMeter()

    async def speak(self, text: str, utterance_id: str | None = None) -> PlaybackHandle | None:
        # Ensure sane text
        if not (text and str(text).strip()):
            return None
        if utterance_id is None:
            utterance_id = f"utt-{int(asyncio.get_running_loop().time()*1000)}"
        lock = getattr(self, '_lock', None)
        if lock is not None:
            async with lock:
                task = asyncio.create_task(self._speak_inner(text))
        else:
            task = asyncio.create_task(self._speak_inner(text))
        return await self._handles.register(utterance_id, task)

    async def _speak_inner(self, text: str) -> None:
        last_error = None
        # Skip network TTS when offline
        prio = self.priority
        if (os.environ.get('VEIL_MODE','').strip().lower() == 'offline'):
            prio = [p for p in prio if p != 'elevenlabs']
        words = len((text or '').split())
        for be in prio:
            try:
                t0 = time.perf_counter()
                if be == 'elevenlabs':
                    if not self.el_voice:
                        raise RuntimeError('ELEVENLABS_VOICE not set')
                    # Pre-check key to avoid misleading backend log
                    try:
                        from secrets_store import get_secret  # type: ignore
                        if not (get_secret('elevenlabs.api.key') or '').strip():
                            raise RuntimeError('elevenlabs.api.key missing')
                    except Exception:
                        raise RuntimeError('elevenlabs.api.key missing')
                    print(f"[TTS] backend=elevenlabs voice={self.el_voice}")
                    path = await asyncio.wait_for(_elevenlabs_to_file(text, self.el_voice, self.el_model), timeout=25.0)
                    _play_and_cleanup(path)
                    dt = max(0.001, time.perf_counter() - t0)
                    self._wps.update(words, dt)
                    return
                if be == 'piper':
                    print('[TTS] backend=piper')
                    path = await asyncio.wait_for(_piper_to_file(text, self.piper_exe, self.piper_model), timeout=20.0)
                    _play_and_cleanup(path)
                    dt = max(0.001, time.perf_counter() - t0)
                    self._wps.update(words, dt)
                    return
                if be == 'edge':
                    print('[TTS] backend=edge')
                    path = await asyncio.wait_for(_edge_tts_to_file(text, self.edge_voice, self.edge_rate), timeout=12.0)
                    _play_and_cleanup(path)
                    dt = max(0.001, time.perf_counter() - t0)
                    self._wps.update(words, dt)
                    return
            except Exception as e:
                # Explain why a backend was skipped
                try:
                    print(f"[TTS] {be} failed: {e}")
                except Exception:
                    pass
                last_error = e
                continue
        # If we got here, all backends failed
        msg = f"[TTS error] {last_error}" if last_error else "[TTS error] No backends available"
        print(msg)


# Default manager to preserve simple import usage
_manager = TTSManager()


async def speak(text: str, utterance_id: str | None = None):
    return await _manager.speak(text, utterance_id=utterance_id)


def say(text: str, utterance_id: str | None = None):
    print(f"[daemon] {text}")
    try:
        asyncio.run(speak(text, utterance_id=utterance_id))
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(speak(text, utterance_id=utterance_id))

async def cancel(utterance_id: str) -> bool:
    return await _manager._handles.cancel(utterance_id)

def get_wps() -> float:
    return _manager._wps.get()
