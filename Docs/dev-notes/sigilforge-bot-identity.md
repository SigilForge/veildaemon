# SigilForge bot identity (Twitch service account)

Broadcaster owns the channel. **SigilForge** is the bot/service identity that
VeilDaemon logs in as. VeilForge never holds broadcaster or bot passwords.

## Live channel map (public IDs only)

| Role | Login | Numeric id |
| --- | --- | --- |
| Broadcaster / main channel | **VeilCorpNode** | `181850555` |
| Bot / service identity | **SigilForge** | `1327200493` |

```text
TWITCH_BROADCASTER_USER_ID=181850555
TWITCH_MODERATOR_USER_ID=1327200493
TWITCH_BOT_LOGIN=sigilforge
TWITCH_BOT_USER_ID=1327200493
```

EventSub is **already live** in VeilDaemon (Twitch alerts / overlay path).
Remaining work is bot-user OAuth for chat read/respond (phase 1–2), not EventSub bootstrap.

```text
Broadcaster account
→ owns channel and final authority

SigilForge bot account
→ reads chat
→ posts Forge responses
→ receives only necessary moderation permissions
→ executes actions approved by VeilForge policy
```

```text
Twitch OAuth token
→ VeilDaemon only
→ chat / EventSub / mod integration
→ typed event or action result

VeilForge
→ decides and authorizes
→ never stores broadcaster/bot tokens
```

## Rollout

```text
1. SigilForge connects and reads chat
2. Bot posts overlay/chat responses
3. Moderation classifications produce proposals only
4. Trusted UI approves individual actions
5. Low-risk configured actions may later run automatically
```

## Moderation audit (both layers)

```python
ModerationAudit(
    proposal_id="...",
    viewer_id="twitch:...",
    proposed_action="timeout",
    reason="repeated targeted harassment",
    policy_mode="assist",
    approved_by="operator",
    executed_by="twitch:sigilforge",
    twitch_result_id="...",
)
```

## What to create (operator checklist)

### A. Accounts & channel setup

1. **SigilForge** Twitch account exists and can log in.
2. On the **main broadcast channel**, grant SigilForge **Moderator**.
3. Prefer testing first in the **SigilForge** channel before pointing EventSub at the live audience channel.

### B. Twitch Developer Console (app)

Create or reuse a Twitch app (Console → Applications):

| Item | Notes |
| --- | --- |
| Client ID | public; goes in env |
| Client Secret | secret; VeilDaemon only |
| OAuth Redirect URL | must match `TWITCH_REDIRECT_URI` (e.g. `http://localhost:3000/twitch/callback`) |

### C. Numeric IDs (safe to share with tooling)

| Env | Meaning |
| --- | --- |
| `TWITCH_BROADCASTER_USER_ID` | Main channel owner numeric id |
| `TWITCH_MODERATOR_USER_ID` | **SigilForge** numeric user id (bot as moderator) |
| `TWITCH_BOT_LOGIN` | `sigilforge` (login name, optional convenience) |
| `TWITCH_BOT_USER_ID` | same as moderator id if bot is the only service identity |

Lookup: Twitch API `GET /users?login=sigilforge` with app token, or [twitchtracker / command tools].

### D. Secrets (never paste into chat / commits)

Store only in VeilDaemon env / secret store (e.g. `.env.local`, not git):

| Secret | Phase |
| --- | --- |
| `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` | app |
| `TWITCH_EVENTSUB_SECRET` | random string for webhook HMAC |
| `TWITCH_EVENTSUB_CALLBACK` | public HTTPS URL of EventSub handler |
| Bot **user** OAuth access + refresh tokens | chat read/write, later mod APIs |
| Optional: broadcaster token | only if a subscription truly requires broadcaster auth (prefer bot + mod scopes) |

Recommended split once chat write lands:

| Env | Identity | Scopes (start minimal) |
| --- | --- | --- |
| `TWITCH_BOT_ACCESS_TOKEN` | SigilForge | `chat:read` then `chat:edit` |
| `TWITCH_BOT_REFRESH_TOKEN` | SigilForge | refresh |
| `TWITCH_BOT_SCOPES` | recorded | audit |

EventSub app-token path already uses client credentials for many subscriptions;
follower topics need `moderator_user_id` = SigilForge and bot/mod scopes.

### E. Phase-gated scopes

**Phase 1 — read only**

- EventSub (app token + `TWITCH_MODERATOR_USER_ID=sigilforge id`)
- Chat read: `chat:read` as SigilForge

**Phase 2 — respond**

- `chat:edit` as SigilForge (posts as SigilForge, not broadcaster)

**Phase 3 — moderation execute (after Forge proposals + UI)**

- Only when 4F.6 is ready, e.g. `moderator:manage:banned_users` / timeouts as needed
- Still: proposal → approve → VeilDaemon executes as SigilForge → audit `executed_by=twitch:sigilforge`

Do **not** grant mod write scopes until phase 3.

## Local OAuth helper scripts (repo)

```bash
# 1) Open authorize URL — log in as SigilForge (not broadcaster) for bot tokens
npm run twitch:auth-url

# 2) Exchange code for tokens (prints access token — store securely, do not commit)
npm run twitch:auth-code -- YOUR_CODE

# 3) EventSub subscriptions (app token; set BROADCASTER + MODERATOR=SigilForge id)
npm run twitch:subscribe
```

Today’s auth-url scopes are EventSub-oriented (`moderator:read:followers`, subs, bits, hype train).
Chat read/write scopes will be added when the IRC/Helix bot client is wired for 4F.3 responses.

## VeilForge side

- **No** bot OAuth in Forge config.
- Stream bridge only: `VEIL_STREAM_BRIDGE_SOCKET` / `VEIL_STREAM_BRIDGE_TOKEN`.
- Traces record proposal + `executed_by` when actions return from VeilDaemon.

## What to send the implementer (safe)

You can share **non-secrets**:

- [ ] Confirm bot login name: `sigilforge` (or exact casing)
- [ ] Broadcaster channel login (main channel)
- [ ] `TWITCH_BROADCASTER_USER_ID` (numeric)
- [ ] `TWITCH_MODERATOR_USER_ID` / bot user id (numeric)
- [ ] Whether EventSub callback is already live (`TWITCH_EVENTSUB_CALLBACK`)
- [ ] Target phase: read-only / chat respond / later mod execute

**Do not** paste client secrets, OAuth tokens, or refresh tokens into chat.
Put those only in VeilDaemon’s local secret env and say “tokens stored in `.env.local`”.
