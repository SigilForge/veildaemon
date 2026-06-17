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

Alert card art is copied from the Cradlepoint marketing repository into `stream/alerts/assets` as small local derivatives for hosted OBS use.

## Alert Sound Map

Sound files should be placed under:

```txt
public/assets/alerts/sfx/
```

The overlay references them from `/assets/alerts/sfx/...`. Use original, generated, royalty-free, or otherwise cleared files only. If a file is missing, the overlay logs a debug warning and plays the alert silently.

Expected files:

```txt
observer-detected.wav
```
Short CCTV focus click, tiny static chirp, soft terminal confirmation beep.

```txt
clearance-upgraded.wav
```
Heavy vault latch, low bass thud, rubber stamp impact, faint electrical shimmer.

```txt
continuity-confirmed.wav
```
Cassette rewind blip, tape deck click, warm low synth pulse, subtle heartbeat.

```txt
exposure-transferred.wav
```
Electric snap jumping from one node to another, paper file duplication, quick glitch flutter.

```txt
mass-arrival-event.wav
```
Distant containment alarm, distorted downward elevator ding, multiple soft footfalls, bass swell.

```txt
signal-offering.wav
```
Small glass/data shards raining into a machine, modem chirp fragments, soft power-up pulse.

```txt
cascade-initiated.wav
```
Reactor start-up, warning relay clicks, low rising drone, first alarm pulse.

```txt
cascade-rising.wav
```
Faster rhythmic signal pings, static pressure building, layered warning tones.

```txt
cascade-contained.wav
```
Pressure release, power-down thrum, final containment stamp, fading CRT hum.

```txt
field-funding-received.wav
```
Old receipt printer, coinless digital transaction chirp, suspicious bass note.

```txt
archive-ping.wav
```
Generic fallback: short terminal ping plus soft static.

Audio query controls:

```txt
?mute=1
```
Silent testing.

```txt
?volume=0.5
```
Globally scales configured alert volumes.

Normal browsers may block autoplay before interaction. OBS Browser Source should play browser-source audio.

After the deployed callback is live, run:

```txt
npm run twitch:subscribe
```
