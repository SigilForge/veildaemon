# VoidDesk (Hybrid)

Ultra-minimal Electron client with two modes:

- **API Mode** — local streaming client for OpenAI-compatible chat
- **Plus Mode** — embedded WebView of ChatGPT (uses your normal login & Plus features)

---

## Setup

1. Install **Node 18+**
2. `npm i`
3. `npm run start`

---

## Usage

- Toggle top-left: **🜏 API ↔ ☁ Plus**
- **Plus Mode** persists your login (uses `partition="persist:voiddesk-plus"`). Use **Logout Plus** to clear it.
- **Send → Other** (Ctrl/Cmd+Shift+S) moves selected text between modes.
- System prompt box applies only to API mode.

Config/history stored via `electron-store`.

**CSP** currently allows:  
- `connect-src`: `https://api.openai.com`, `https://chat.openai.com`, `https://platform.openai.com`, `wss:`  
- `frame-src`: `https://chat.openai.com`, `https://platform.openai.com`

> If your account routes to `https://chatgpt.com`, add it to CSP `connect-src` and `frame-src`.

---

## Packaging

