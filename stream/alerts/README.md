# VeilCorp Alert Overlay

OBS browser source:

```txt
https://YOUR_ALERT_DEPLOYMENT/stream/alerts
```

Control surface:

```txt
https://YOUR_ALERT_DEPLOYMENT/admin/alerts
```

Required deployment variables:

```txt
ALERT_ADMIN_TOKEN
TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET
TWITCH_BROADCASTER_USER_ID
TWITCH_EVENTSUB_SECRET
TWITCH_EVENTSUB_CALLBACK
```

Optional queue variables:

```txt
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

Without Upstash, the queue uses process memory. That is useful for local testing and warm serverless instances, but Redis is the durable production path.

After the deployed callback is live, run:

```txt
npm run twitch:subscribe
```
