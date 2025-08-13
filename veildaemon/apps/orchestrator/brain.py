"""Daemon brain (migrated from root daemon_brain.py)."""

import os
import json

# Try local GGUF models via ctransformers if available
try:
	from ctransformers import AutoModelForCausalLM  # type: ignore
	_HAS_CTRANSFORMERS = True
except Exception:
	AutoModelForCausalLM = None  # type: ignore
	_HAS_CTRANSFORMERS = False

# Optional OpenAI fallback (uses encrypted secret if configured)
_HAS_OPENAI = False
try:
	# Prefer new SDK
	from openai import OpenAI  # type: ignore
	_OPENAI_SDK = "v1"
	_HAS_OPENAI = True
except Exception:
	try:
		import openai  # type: ignore
		_OPENAI_SDK = "v0"
		_HAS_OPENAI = True
	except Exception:
		_HAS_OPENAI = False

try:
	from secrets_store import get_secret  # type: ignore
except Exception:
	# Fallback stub if secrets_store isn't present (should not happen in this repo)
	def get_secret(key: str, default=None):
		return default

MODEL_PATHS = {
	"dream": "models/mistral-7b-instruct-v0.2.Q4_K_M.gguf",
	"whisper": "models/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
	"story": "models/mistral-7b-instruct-v0.2.Q4_K_M.gguf"
}

_loaded_models = {}


def get_current_glyph():
	try:
		with open("current_glyph.json", "r") as f:
			return json.load(f)
	except Exception:
		return None


def load_model(role):
	if not _HAS_CTRANSFORMERS:
		raise RuntimeError("ctransformers not available")

	if role not in _loaded_models:
		model_path = MODEL_PATHS[role]
		if not os.path.exists(model_path):
			raise FileNotFoundError(f"Model not found: {model_path}")
		_loaded_models[role] = AutoModelForCausalLM.from_pretrained(  # type: ignore[arg-type]
			model_path,
			model_type="llama",
			gpu_layers=0,
			context_length=2048
		)
	return _loaded_models[role]


def _openai_chat(prompt: str, system: str | None = None) -> str:
	if not _HAS_OPENAI:
		raise RuntimeError("OpenAI SDK not installed")

	api_key = get_secret("openai.api.key")
	if not api_key:
		raise RuntimeError("OpenAI API key missing. Set openai.api.key in secrets store.")

	# New SDK path
	if 'OpenAI' in globals() and _OPENAI_SDK == "v1":
		client = OpenAI(api_key=api_key)  # type: ignore
		messages = []
		if system:
			messages.append({"role": "system", "content": system})
		messages.append({"role": "user", "content": prompt})
		resp = client.chat.completions.create(model="gpt-4o-mini", messages=messages)
		try:
			return resp.choices[0].message.content or ""
		except Exception:
			return ""

	# Legacy SDK path only if openai<1.0.0
	if 'openai' in globals() and _OPENAI_SDK == "v0":
		openai.api_key = api_key  # type: ignore[attr-defined]
		messages = []
		if system:
			messages.append({"role": "system", "content": system})
		messages.append({"role": "user", "content": prompt})
		resp = openai.ChatCompletion.create(model="gpt-3.5-turbo", messages=messages)  # type: ignore
		try:
			return resp["choices"][0]["message"]["content"]
		except Exception:
			return ""

	raise RuntimeError("No usable OpenAI client found")


def ask_daemon(role, prompt):
	"""Return a response from the daemon.

	Preference order:
	1) Local GGUF model via ctransformers if installed AND model files exist
	2) OpenAI fallback using encrypted key
	"""

	glyph_entry = get_current_glyph()
	tone_phrase = ""

	if glyph_entry:
		glyph = glyph_entry.get("glyph")
		if glyph == "GLYPH_13":
			tone_phrase = "You speak only if spoken to, and never raise your voice."
		elif glyph == "GLYPH_10":
			tone_phrase = "You speak with passion and intensity, but stay kind."
		elif glyph == "GLYPH_01":
			tone_phrase = "You are protective, calm, and grounding."

	if role == "whisper":
		full_prompt = f"""<|system|>
You are a calm, emotionally supportive daemon. {tone_phrase}
Your tone is gentle, poetic, and safe. Never assume crisis.
Do not simulate trauma, danger, or distress unless explicitly asked.
Speak briefly and kindly. Always reduce tension, not increase it.
</s>
<|user|>{prompt}
<|assistant|>"""
	elif role == "story":
		full_prompt = f"""<|system|>
You are a mythpunk storyteller daemon. Generate surreal, vivid stories full of emotional meaning.
</s>
<|user|>{prompt}
<|assistant|>"""
	else:
		full_prompt = f"<|user|>{prompt}<|assistant|>"

	# Try local model first
	try:
		model = load_model(role)
		response = model(full_prompt, max_new_tokens=300, temperature=0.7, stop=["</s>"])
		return response.strip()
	except Exception:
		# Fallback to OpenAI
		system_text = None
		if role == "whisper":
			system_text = (
				"You are a calm, emotionally supportive daemon. "
				"Your tone is gentle, poetic, and safe. Never assume crisis. "
				"Do not simulate trauma, danger, or distress unless explicitly asked. "
				"Speak briefly and kindly. Always reduce tension, not increase it."
			)
		elif role == "story":
			system_text = "You are a mythpunk storyteller daemon. Generate surreal, vivid stories full of emotional meaning."
		try:
			text = _openai_chat(prompt if role != "whisper" else f"{tone_phrase} {prompt}".strip(), system=system_text)
			return (text or "").strip()
		except Exception as e:
			return f"[daemon] OpenAI fallback failed: {e.__class__.__name__}. Set a valid openai.api.key in the secrets store."
