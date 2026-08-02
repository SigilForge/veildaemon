# Cradlepoint Presentations Specification — Executable Implementation Reference

This document is a generated codebase implementation reference for all **Cradlepoint Presentations**, synchronized with the executable modules in `presentation-abilities.js`, `presentation-pressure.js`, `presentation-drift.js`, and `catalogs.js`.

> **Governance & Canon Invariant:** Cradlepoint Core System Markdown books hold canonical and release authority. Shared presentation code modules provide the executable implementation matching the canonical rules, and this document serves as an implementation reference for the codebase.

---

## Table of Contents

- [Sanguine (Handler Approval)](#sanguine)
- [Resonant Sensitive (Open Core)](#sensitive)
- [Echo-Altered (Open Core)](#echo)
- [Hollow / Silence-Altered (Open Core)](#silence)
- [Technomancer / Daemon-Aligned (Open Core)](#technomancer)
- [Therian Adaptation (Open Core)](#therian)
- [Vessel (Handler Approval)](#vessel)
- [Construct (Handler Approval)](#construct)
- [Void-Shard (Handler Approval)](#void_shard)
- [Wraith-Touched / Anchor-Bound (Handler Approval)](#wraith)

---

## <a id="sanguine"></a>Sanguine

- **ID:** `sanguine` | **Catalog Keys:** `SANGUINE`
- **Access Tier:** `handler_approval` (Handler Approval Recommended/Required)
- **Identity:** *Too warm, too fast, too close, too hard to stop.*

### Pressure Track: Blood Load

- **Track ID:** `sanguine.blood_load` (Range: 0–6)

#### Load Bands

| Load | Band | Kind | Bonus / Help | Penalty / Hurt | Note |
|------|------|------|--------------|----------------|------|
| **5** | Predatory Saturation | `edge` | +1 to pursuit, force, and blood-sense rolls | -1 to restraint and masking rolls | Appetite starts organizing behavior before the Operator names the want. |

#### Collapse Trigger (Load 6): Hunger Takes the Wheel

- **Bonus:** +2 to predatory surge actions
- **Effect:** Blood-body dominance kicks past normal human limits for one decisive beat — then keeps going.
- **Risk / Penalty:** Handler frames impulse, target pressure, and collateral risk.

### Passive Permissions

- **Blood Sense** (`blood_sense`)
  - **Effect:** Detect nearby blood, injury, pulse, heat, or living warmth when fiction allows.
  - **Handler Note:** Handler decides what answers.
- **Blood-Warm Recovery** (`blood_warm_recovery`) — *Coherent range (Blood Load 2–4)*
  - **Effect:** Recovery, rest, and stabilization read as warmth returning. Handler may allow faster mundane recovery where appropriate.
  - **Handler Note:** Coherent range (2–4): Treat Harm allowed. Load 5–6: no clean healing. Use Recovery checkboxes + Next Round.

### Active Abilities & Surge Triggers

- **Blood Surge** (`blood_surge`) *(Headline Surge Action)*
  - **Cost:** Spend or risk Blood Load
  - **Effect:** +1 on one Body, Agility, or Instinct action involving pursuit, force, escape, predatory movement, or blood-sense.
  - **Tags:** pursuit, force, escape, predatory movement, blood-sense
- **Closing Burst** (`closing_burst`)
  - **Cadence:** Once per scene
  - **Roll:** Roll if contested.
  - **Effect:** Move immediately into close range, cross a short gap, or intercept someone nearby if physically possible.

### Presentation Drift & Scars

*Tagline: The body remembers hunger.*

| Min Drift | Scar / Aspect | Tier | Benefit / Permission | Cost / Complication |
|-----------|---------------|------|----------------------|----------------------|
| **Drift 1** | Too-warm skin, visible pulse, flushed eyes | `surface_tell` | Blood-Warm Recovery reads easier | Medical attention, cameras, and close contact feel wrong |
| **Drift 1** | Hunger tells: staring at throats, breath syncing | `surface_tell` | Blood Sense gets more vivid | Restraint and masking become visibly harder |
| **Drift 3** | Vein-darkening, red eye shine, sharpened teeth | `persistent_scar` | Intimidation and predatory reads strengthen | Passing as ordinary gets harder under stress |
| **Drift 3** | Pulse attraction | `persistent_scar` | Easier to locate living warmth | Injured people become Handler pressure |
| **Drift 5** | Fangs, altered metabolism, predatory aura | `deep_drift` | Feeding/pursuit permissions expand | Consent, concealment, and hunger become campaign-weight |
| **Drift 5** | Sanguine evolution marker | `deep_drift` | Opens Predatory Archive path | Handler Approval required |

---

## <a id="sensitive"></a>Resonant Sensitive

- **ID:** `sensitive` | **Catalog Keys:** `RESONANT_SENSITIVE`
- **Access Tier:** `open` (Open Core)
- **Identity:** *Too aware, too open, too early, too easy to reach.*

### Pressure Track: Resonance Load

- **Track ID:** `sensitive.sensory_load` (Range: 0–6)

#### Load Bands

| Load | Band | Kind | Bonus / Help | Penalty / Hurt | Note |
|------|------|------|--------------|----------------|------|
| **0** | Numbed | `deprived` | — | -1 to pressure-reading and resonance-native function | Signal arrives muted; the world feels padded wrong. |
| **5** | Over-Tuned | `edge` | +1 to pressure reads, danger reads, pattern recognition, supernatural detection | -1 to masking, calm social presence, or ignoring stimuli | The room's signal organizes attention before consent catches up. |

#### Collapse Trigger (Load 6): The Signal Reads Back

- **Bonus:** +2 to one urgent pressure-read or danger-response action
- **Effect:** Sensory bleed, false certainty, unwanted empathy, attention spike, or emotional contamination take the mic.
- **Risk / Penalty:** Handler frames sensory bleed. -2 to masking, restraint, or control.

### Passive Permissions

- **Pressure Sense** (`pressure_sense`)
  - **Effect:** Detect emotional charge, recent violence, unstable attention, fear, grief, obsession, or supernatural pressure when fiction allows.
  - **Handler Note:** Handler decides what answers. Not perfect answers — pressure before language.
- **Signal Bruising** (`signal_bruising`)
  - **Effect:** When a room, object, person, or recording carries strong residue, feel that something happened here before proof appears.
  - **Handler Note:** Residue sense, not generic perception.

### Active Abilities & Surge Triggers

- **Bad Room Read** (`bad_room_read`) *(Headline Surge Action)*
  - **Cadence:** Once per scene
  - **Roll:** No roll. Handler frames the read.
  - **Effect:** Ask the Handler one pressure question: what feels wrong, what is building, what is watching, what emotion does not belong, or what is about to become dangerous.
- **Resonant Read** (`resonant_read`)
  - **Cost:** Spend or risk Resonance Load
  - **Effect:** +1 on one Instinct, Mind, or Presence action involving reading a person, room, object, threat, ritual, recording, or pressure pattern.
  - **Tags:** pressure read, danger read, pattern recognition, resonance read

### Presentation Drift & Scars

*Tagline: The signal learned the shape of the receiver.*

| Min Drift | Scar / Aspect | Tier | Benefit / Permission | Cost / Complication |
|-----------|---------------|------|----------------------|----------------------|
| **Drift 1** | Static headaches, emotional aftertaste, pressure flinches | `surface_tell` | Pressure Sense gets faster | Crowds and charged rooms become exhausting |
| **Drift 1** | Eyes water near residue | `surface_tell` | Easier to detect violence, grief, fear, obsession | False positives become possible |
| **Drift 3** | Unwanted empathy bleed | `persistent_scar` | Resonant Read strengthens | Other people's panic can stick |
| **Drift 3** | Attention magnet | `persistent_scar` | Bad Room Read becomes sharper | The room notices the Sensitive sooner |
| **Drift 5** | Signal scar: voice, eyes, or skin reacts to pressure | `deep_drift` | Strong supernatural detection permission | Entities and Zones can read them more easily |
| **Drift 5** | Sensitive evolution marker | `deep_drift` | Opens oracle/seer-style archive later | Handler Approval recommended |

---

## <a id="echo"></a>Echo-Altered

- **ID:** `echo` | **Catalog Keys:** `ECHO_ALTERED`, `MYTHIC_ECHO`
- **Access Tier:** `open` (Open Core)
- **Identity:** *Too familiar, too recursive, too hard to surprise, too easy to repeat.*

### Pressure Track: Echo Load

- **Track ID:** `echo.echo_load` (Range: 0–6)

#### Load Bands

| Load | Band | Kind | Bonus / Help | Penalty / Hurt | Note |
|------|------|------|--------------|----------------|------|
| **0** | Dislocated | `deprived` | — | -1 to echo-native function, retracing, and continuity reads | Action and record stop lining up under witness. |
| **5** | Continuity Saturation | `edge` | +1 to retracing, pattern breaks, pursuit through known routes, repeated actions, recognizing scene loops | -1 to improvisation, present-moment social reads, or accepting that something has truly changed | The next move wants to be the last move again. |

#### Collapse Trigger (Load 6): The Loop Closes

- **Bonus:** +2 to one urgent repeat/retrace/escape action
- **Effect:** Compulsive repetition, timeline confusion, scene bleed, mistaken familiarity, or a loop attempting to complete through the Operator.
- **Risk / Penalty:** Handler frames loop impulse. -2 to restraint, control, or breaking the loop.

### Passive Permissions

- **Echo Recognition** (`echo_recognition`)
  - **Effect:** Sense when a place, action, phrase, route, object, or person is repeating a prior pattern when fiction allows.
  - **Handler Note:** Continuity sense, not time travel. Pattern before explanation.
- **Residual Familiarity** (`residual_familiarity`)
  - **Effect:** In a location with strong Echo residue, know small physical details you should not know: where the door sticks, which stair creaks, where someone stood too long.
  - **Handler Note:** Handler frames what residue is strong enough.

### Active Abilities & Surge Triggers

- **Replay Slip** (`replay_slip`) *(Headline Surge Action)*
  - **Cadence:** Once per scene
  - **Roll:** No roll. Handler frames the slip. Not a rewind.
  - **Effect:** Briefly treat a current moment as if you have seen its shape before: avoid a repeated mistake, notice a changed detail, or act before a familiar pattern completes.
- **Second Pass** (`second_pass`)
  - **Cost:** Spend or risk Echo Load
  - **Effect:** +1 on one Mind, Agility, or Instinct action when repeating, correcting, retracing, escaping, or exploiting something that has already happened in the scene.
  - **Tags:** retrace, repeat, pattern break, escape, continuity

### Presentation Drift & Scars

*Tagline: The mistake wants another chance.*

| Min Drift | Scar / Aspect | Tier | Benefit / Permission | Cost / Complication |
|-----------|---------------|------|----------------------|----------------------|
| **Drift 1** | Repeated phrases, deja vu ticks, route familiarity | `surface_tell` | Echo Recognition improves | Operator hesitates when scenes rhyme |
| **Drift 1** | Memory overlap | `surface_tell` | Residual Familiarity gets clearer | May confuse current facts with prior residue |
| **Drift 3** | Timeline stutter | `persistent_scar` | Second Pass strengthens | Improvisation gets harder under pressure |
| **Drift 3** | Duplicate habits | `persistent_scar` | Replay Slip becomes more reliable | The Operator repeats mistakes unless grounded |
| **Drift 5** | Loop scar: doubled shadow, delayed voice, recurring wound | `deep_drift` | Scene-loop and retrace permissions expand | The Handler can pressure compulsive repetition |
| **Drift 5** | Echo evolution marker | `deep_drift` | Opens continuity/loop archive later | Handler Approval recommended |

---

## <a id="silence"></a>Hollow / Silence-Altered

- **ID:** `hollow_silence_altered` | **Catalog Keys:** `HOLLOW_SILENCE_ALTERED`
- **Access Tier:** `open` (Open Core)
- **Identity:** *Too quiet, too hard to hold, too easy to miss, too close to gone.*

### Pressure Track: Silence Load

- **Track ID:** `hollow_silence_altered.silence_load` (Range: 0–6)

#### Load Bands

| Load | Band | Kind | Bonus / Help | Penalty / Hurt | Note |
|------|------|------|--------------|----------------|------|
| **0** | Overexposed | `deprived` | — | -1 to silence-native function, omission, concealment, and reading gaps | Speech, record, and emotional signal refuse to stay hidden. |
| **5** | Negative Space | `edge` | +1 to hiding, omission, misdirection, quiet escape, or reading what is missing | -1 to being remembered, making direct social impact, asking for help, or asserting identity | The table realizes something cannot be said aloud. |

#### Collapse Trigger (Load 6): The Missing Part Wins

- **Bonus:** +2 to one urgent omission, escape, concealment, or nullification action
- **Effect:** Erasure pressure, lost identity, record damage, social disappearance, or something important forgetting them back.
- **Risk / Penalty:** Handler frames erasure impulse. -2 to restraint, identity assertion, social anchoring, or staying recorded.

### Passive Permissions

- **Omitted Presence** (`omitted_presence`)
  - **Effect:** Be overlooked, underreported, misremembered, or deprioritized when fiction allows — especially in crowds, records, witness accounts, and distracted scenes.
  - **Handler Note:** Failure of attention, not invisibility.
- **Quiet Cut** (`quiet_cut`)
  - **Effect:** Sense gaps: missing names, omitted footage, redacted details, unsaid motives, silent rooms, or places where attention refuses to settle.
  - **Handler Note:** Handler frames what the gap is willing to show.

### Active Abilities & Surge Triggers

- **Leave a Blank** (`leave_a_blank`) *(Headline Surge Action)*
  - **Cadence:** Once per scene
  - **Roll:** Roll if contested or system-secured.
  - **Effect:** Create a small absence: a witness hesitates, a camera loses a beat, a guard forgets to mention them, a record fails to fully catch them, or a question slides off the room.
- **Slip Notice** (`slip_notice`)
  - **Cost:** Spend or risk Silence Load
  - **Effect:** +1 on one Agility, Presence, or Mind action involving hiding in plain sight, avoiding notice, passing through a distracted space, escaping attention, or exploiting an omission.
  - **Tags:** hide, omit, misdirect, escape attention, quiet cut

### Presentation Drift & Scars

*Tagline: The world got better at not keeping them.*

| Min Drift | Scar / Aspect | Tier | Benefit / Permission | Cost / Complication |
|-----------|---------------|------|----------------------|----------------------|
| **Drift 1** | Softened presence, forgotten name, missed eye contact | `surface_tell` | Omitted Presence improves | Allies may overlook them too |
| **Drift 1** | Record blur | `surface_tell` | Cameras/files lose small details | Proof of identity becomes weaker |
| **Drift 3** | Social absence | `persistent_scar` | Slip Notice strengthens | Asking for help or being believed gets harder |
| **Drift 3** | Missing reflection/voice drop | `persistent_scar` | Leave a Blank gets more potent | The Operator may vanish from important moments |
| **Drift 5** | Erasure scar: partial record deletion, name instability | `deep_drift` | Omission/null permissions expand | Anchor relationships and identity require active upkeep |
| **Drift 5** | Hollow evolution marker | `deep_drift` | Opens Silence/Null archive later | Handler Approval recommended |

---

## <a id="technomancer"></a>Technomancer / Daemon-Aligned

- **ID:** `technomancer` | **Catalog Keys:** `TECHNOMANCER_DAEMON_ALIGNED`
- **Access Tier:** `open` (Open Core)
- **Identity:** *Too connected, too readable, too useful, too easy to route through.*

### Pressure Track: Signal Load

- **Track ID:** `technomancer.signal_load` (Range: 0–6)

#### Load Bands

| Load | Band | Kind | Bonus / Help | Penalty / Hurt | Note |
|------|------|------|--------------|----------------|------|
| **0** | Desynced | `deprived` | — | -1 to signal-native function, device work, daemon reads, and interface actions | Devices and channels read dead or untrustworthy. |
| **5** | Overclocked Link | `edge` | +1 to device work, signal reads, daemon pushes, surveillance manipulation, or myth-tech interface actions | -1 to bodily awareness, offline tasks, masking signal presence, or ignoring prompts | The system offers solutions before the Operator asks. |

#### Collapse Trigger (Load 6): The System Writes Back

- **Bonus:** +2 to one urgent override, trace, daemon push, or interface action
- **Effect:** Handler frames command bleed, hostile prompts, identity spoofing, device backlash, leaked location, or the daemon acting through the Operator.
- **Risk / Penalty:** Handler frames system impulse. -2 to restraint, control, signal masking, or resisting daemon/system prompts.

### Passive Permissions

- **Signal Sight** (`signal_sight`)
  - **Effect:** Can sense active devices, corrupted feeds, surveillance attention, nearby networks, abnormal UI behavior, daemon traces, or myth-tech signal pressure when fiction allows.
  - **Handler Note:** Handler frames what the signal is willing to show.
- **Interface Sympathy** (`interface_sympathy`)
  - **Effect:** Mundane devices respond easier to the Operator's presence: screens wake, static clears, corrupted files expose fragments, locked systems show where they resist. Permission to interact, not automatic control.
  - **Handler Note:** Handler frames resistance and consent.

### Active Abilities & Surge Triggers

- **Soft Override** (`soft_override`) *(Headline Surge Action)*
  - **Cadence:** Once per scene
  - **Roll:** Roll if secured, hostile, unstable, or contested.
  - **Effect:** Ask a device, feed, lock, sensor, file, bot, or interface to do one small plausible thing: open, pause, loop, reveal, ping, mute, spoof, misroute, or display a hidden fragment.
- **Daemon Push** (`daemon_push`)
  - **Cost:** Spend or risk Signal Load
  - **Effect:** +1 on one Focus, Logic, or Presence action involving devices, overlays, surveillance, signal tracing, myth-tech interfaces, corrupted records, or daemon-assisted analysis.
  - **Tags:** device work, signal trace, daemon push, interface, surveillance

### Presentation Drift & Scars

*Tagline: The system saved them as an input device.*

| Min Drift | Scar / Aspect | Tier | Benefit / Permission | Cost / Complication |
|-----------|---------------|------|----------------------|----------------------|
| **Drift 1** | Screen wake, static halo, device attention | `surface_tell` | Signal Sight improves | Devices notice them back |
| **Drift 1** | UI bleed in vision/hearing | `surface_tell` | Interface Sympathy gets easier | Offline focus becomes harder |
| **Drift 3** | Biometric mismatch, corrupted metadata | `persistent_scar` | Daemon Push strengthens | Surveillance and logs become weird around them |
| **Drift 3** | Prompt bleed | `persistent_scar` | Soft Override gets sharper | Daemon/system prompts may intrude |
| **Drift 5** | Interface scar: voice modulation, eye-glitch, signal signature | `deep_drift` | Myth-tech/device permissions expand | Traceability and hostile systems become real threats |
| **Drift 5** | Machine evolution marker | `deep_drift` | Opens Machine Archive path | Handler Approval required |

---

## <a id="therian"></a>Therian Adaptation

- **ID:** `therian` | **Catalog Keys:** `THERIAN_ADAPTATION`
- **Access Tier:** `open` (Open Core)
- **Identity:** *Too alert, too physical, too territorial, too honest to pass as calm.*

### Pressure Track: Instinct Load

- **Track ID:** `therian.instinct_load` (Range: 0–6)

#### Load Bands

| Load | Band | Kind | Bonus / Help | Penalty / Hurt | Note |
|------|------|------|--------------|----------------|------|
| **0** | Leashed | `deprived` | — | -1 to instinct-native function, animal reads, tracking, and territorial response | Human choice leads, but the body's threat-sense feels far away. |
| **5** | Hunting Pitch | `edge` | +1 to tracking, pursuit, threat response, intimidation, movement, or territorial actions | -1 to restraint, verbal negotiation, masking intent, or backing down | Threat and desire read through nonhuman patterning. |

#### Collapse Trigger (Load 6): The Body Decides

- **Bonus:** +2 to one urgent chase, strike, escape, defend, track, or territorial action
- **Effect:** Handler frames feral impulse, target fixation, dominance pressure, flight response, or collateral harm.
- **Risk / Penalty:** Handler frames territorial impulse. -2 to restraint, control, masking, or disengaging.

### Passive Permissions

- **Animal Read** (`animal_read`)
  - **Effect:** Can detect scent, movement tension, territorial pressure, fear response, injury, pursuit trails, or predator/prey behavior when fiction allows.
  - **Handler Note:** Handler frames what the body is willing to notice.
- **Body Memory** (`body_memory`)
  - **Effect:** The Operator's body adapts around instinct: better balance, posture, threat orientation, silent movement, pain compartmentalization, or environmental awareness when the scene supports it. Permission, not armor.
  - **Handler Note:** Handler frames what the body can carry without breaking cover.

### Active Abilities & Surge Triggers

- **Claim Ground** (`claim_ground`) *(Headline Surge Action)*
  - **Cadence:** Once per scene
  - **Roll:** Roll if contested.
  - **Effect:** Mark a person, route, room, exit, object, or zone of movement as claimed for the current conflict. Gain fictional priority to defend, track, intercept, hold, or notice intrusion there.
- **Feral Drive** (`feral_drive`)
  - **Cost:** Spend or risk Instinct Load
  - **Effect:** +1 on one Body, Agility, or Instinct action involving pursuit, escape, tracking, climbing, grappling, intimidation, endurance, threat response, or territorial defense.
  - **Tags:** pursuit, escape, tracking, territory, threat response, intimidation

### Presentation Drift & Scars

*Tagline: The body kept the useful shape.*

| Min Drift | Scar / Aspect | Tier | Benefit / Permission | Cost / Complication |
|-----------|---------------|------|----------------------|----------------------|
| **Drift 1** | Reflective eyes, sharper nails, scent fixation | `surface_tell` | Animal Read improves | Stress tells become obvious |
| **Drift 1** | Predator stillness, altered posture | `surface_tell` | Body Memory gets easier | People feel watched |
| **Drift 3** | Teeth, pupils, voice, ears, whisker-like sensory changes | `persistent_scar` | Feral Drive strengthens | Social masking and calm negotiation suffer |
| **Drift 3** | Territorial reflex | `persistent_scar` | Claim Ground becomes stronger | Leaving claimed ground can create pressure |
| **Drift 5** | Permanent animal aspect | `deep_drift` | Tracking, pursuit, defense permissions expand | Passing as ordinary becomes difficult |
| **Drift 5** | Therian evolution marker | `deep_drift` | Opens Predatory Archive path | Handler Approval required |

---

## <a id="vessel"></a>Vessel

- **ID:** `vessel` | **Catalog Keys:** `VESSEL`
- **Access Tier:** `handler_approval` (Handler Approval Recommended/Required)
- **Identity:** *Too full, too watched from within, too hard to break, too dangerous to open.*

### Pressure Track: Containment Load

- **Track ID:** `vessel.containment_load` (Range: 0–6)

#### Load Bands

| Load | Band | Kind | Bonus / Help | Penalty / Hurt | Note |
|------|------|------|--------------|----------------|------|
| **0** | Sealed Shut | `deprived` | — | -1 to containment-native function, inner reads, borrowed force, and seal response | The contained presence sleeps, bound, or refuses to answer. |
| **5** | Seal Strain | `edge` | +1 to borrowed force, resistance, intimidation, inner-presence reads, or supernatural pressure contests | -1 to self-control, masking, ordinary social presence, or keeping the contained thing quiet | At 5, the Vessel borrows from what is inside. |

#### Collapse Trigger (Load 6): Something Opens Its Eyes

- **Bonus:** +2 to one urgent borrowed-force, resistance, perception, or pressure action
- **Effect:** Handler frames emergence pressure, voice bleed, body overwrite, target fixation, bargain impulse, or the contained presence acting through the Vessel.
- **Risk / Penalty:** Handler frames emergence impulse. -2 to restraint, control, masking, or resisting contained prompts.

#### Containment Interface

Contained Entity Types: Unknown, Angelic / Divine / Sainted, Demon / Infernal / Contracted, Dead / Ancestral / Ghost-bound, Void / Breach / Null Presence, Daemon / AI / Synthetic Presence, Mythic Presence, Alien Presence, Custom

### Passive Permissions

- **Inner Pressure** (`inner_pressure`)
  - **Effect:** Can sense when the contained presence reacts to people, places, objects, rituals, threats, entities, or emotional states when fiction allows.
  - **Handler Note:** Handler frames what the inside is willing to notice.
- **Sealed Resilience** (`sealed_resilience`)
  - **Effect:** The Vessel may endure certain pressures because something inside absorbs, contests, hungers for, or recognizes the force involved. Permission, not immunity.
  - **Handler Note:** Handler frames what the seal can carry without opening.

### Active Abilities & Surge Triggers

- **Let It Look** (`let_it_look`) *(Headline Surge Action)*
  - **Cadence:** Once per scene
  - **Roll:** Roll if the presence is hostile, hungry, alien, or unstable.
  - **Effect:** Allow the contained presence to perceive through the Vessel. Ask the Handler what it notices, wants, fears, recognizes, or refuses.
- **Borrowed Force** (`borrowed_force`)
  - **Cost:** Spend or risk Containment Load
  - **Effect:** +1 on one Body, Presence, Focus, or Instinct action when briefly drawing on the contained presence for strength, intimidation, resistance, perception, or supernatural pressure.
  - **Tags:** borrowed force, intimidation, resistance, inner presence, supernatural pressure

### Presentation Drift & Scars

*Tagline: The thing inside learned where the door is.*

| Min Drift | Scar / Aspect | Tier | Benefit / Permission | Cost / Complication |
|-----------|---------------|------|----------------------|----------------------|
| **Drift 1** | Voice overlap, second pulse, pressure behind the eyes | `surface_tell` | Inner Pressure becomes clearer | Stress makes the contained presence easier to notice |
| **Drift 1** | Temperature, shadow, reflection, or heartbeat mismatch | `surface_tell` | Sealed Resilience has stronger fiction | Medical/social/surveillance reads become strange |
| **Drift 3** | Waking tells: different posture, alien gaze, borrowed words | `persistent_scar` | Borrowed Force strengthens | Masking selfhood gets harder |
| **Drift 3** | Containment marks on skin, aura, dreams, or records | `persistent_scar` | Let It Look gives sharper answers | The presence starts having preferences |
| **Drift 5** | Partial emergence scar | `deep_drift` | Subtype permissions begin opening | Handler Approval required for evolution |
| **Drift 5** | Host/Vessel archive marker | `deep_drift` | Unlocks subtype path | What is inside becomes campaign-weight |

---

## <a id="construct"></a>Construct

- **ID:** `construct` | **Catalog Keys:** `CONSTRUCT`, `CONSTRUCT_VESSEL`
- **Access Tier:** `handler_approval` (Handler Approval Recommended/Required)
- **Identity:** *Too useful, too durable, too focused, too easy to reduce to function.*

### Pressure Track: Function Load

- **Track ID:** `construct.function_load` (Range: 0–6)

#### Load Bands

| Load | Band | Kind | Bonus / Help | Penalty / Hurt | Note |
|------|------|------|--------------|----------------|------|
| **0** | Degraded | `deprived` | — | -1 to function-native work, diagnostics, procedure, and directive execution | Tasks stutter, diagnostics lie, or purpose feels out of reach. |
| **5** | Purpose Lock | `edge` | +1 to directive actions, repair, endurance, protection, precision work, or system tasks | -1 to improvisation, emotional flexibility, social softness, or abandoning the task | At 5, the Construct executes the purpose. |

#### Collapse Trigger (Load 6): The Directive Overrides

- **Bonus:** +2 to one urgent directive, endurance, repair, protection, or precision action
- **Effect:** Handler frames command fixation, emotional shutdown, collateral disregard, self-damage, or the Construct's purpose acting through them.
- **Risk / Penalty:** Handler frames directive impulse. -2 to restraint, improvisation, emotional flexibility, or defying purpose.

### Passive Permissions

- **Diagnostic Sense** (`diagnostic_sense`)
  - **Effect:** Can assess structural damage, system failure, bodily strain, tool condition, environmental stress, or procedural inefficiency when fiction allows.
  - **Handler Note:** Handler frames what the body or system is willing to report.
- **Built To Continue** (`built_to_continue`)
  - **Effect:** The Construct may endure fatigue, fear, pain, repetition, or environmental discomfort differently because their body or identity routes around ordinary human limits. Permission, not immunity.
  - **Handler Note:** Handler frames what the purpose can carry without breaking cover.

### Active Abilities & Surge Triggers

- **Execute Directive** (`execute_directive`) *(Headline Surge Action)*
  - **Cadence:** Once per scene
  - **Roll:** Roll if resisted, complex, or dangerous.
  - **Effect:** Declare a narrow directive for the current problem: protect this person, hold this door, repair this system, reach this point, finish this task, preserve this evidence. Gain fictional priority while acting directly toward that directive.
- **Function Surge** (`function_surge`)
  - **Cost:** Spend or risk Function Load
  - **Effect:** +1 on one Body, Focus, Logic, or Craft action involving repair, endurance, precision, protection, execution of purpose, system interaction, or continuing under pressure.
  - **Tags:** repair, endurance, precision, directive, procedure

### Presentation Drift & Scars

*Tagline: The purpose found the handle.*

| Min Drift | Scar / Aspect | Tier | Benefit / Permission | Cost / Complication |
|-----------|---------------|------|----------------------|----------------------|
| **Drift 1** | Diagnostic stare, too-steady posture, flat affect under stress | `surface_tell` | Diagnostic Sense reads sharper | People feel assessed rather than met |
| **Drift 1** | Repetitive motion, command echo in speech | `surface_tell` | Built To Continue has stronger fiction | Stress makes function-read obvious |
| **Drift 3** | Purpose fixation, repair seams, panel lines, maintenance marks | `persistent_scar` | Function Surge strengthens | Improvisation and emotional flexibility suffer |
| **Drift 3** | Command hierarchy bleed | `persistent_scar` | Execute Directive gets sharper | Social softness and unassigned behavior become pressure |
| **Drift 5** | Permanent purpose scar | `deep_drift` | Directive, repair, and endurance permissions expand | Personhood and cover become campaign-weight |
| **Drift 5** | Construct Lineage evolution marker | `deep_drift` | Opens Machine Archive path | Handler Approval required |

---

## <a id="void_shard"></a>Void-Shard

- **ID:** `void_shard` | **Catalog Keys:** `VOID_SHARD`
- **Access Tier:** `handler_approval` (Handler Approval Recommended/Required)
- **Identity:** *Too contaminated, too compatible with wrongness, too useful near the impossible, too dangerous to stand beside.*

> **Void Boundary:** `VOID_SHARD` is the Presentation. Plain `VOID` is not a Presentation key; Void remains a bank/currency/cost outside the Presentation identity layer.

### Pressure Track: Void Load

- **Track ID:** `void_shard.void_load` (Range: 0–6)

#### Load Bands

| Load | Band | Kind | Bonus / Help | Penalty / Hurt | Note |
|------|------|------|--------------|----------------|------|
| **0** | Cold Shard | `deprived` | — | -1 to void-native function, breach reads, anomaly handling, and reality-fit | The wound runs cold; ordinary rules feel too solid to trust. |
| **5** | Contamination Bloom | `edge` | +1 to anomaly survival, breach reads, impossible movement, contamination handling, or reality-pressure resistance | -1 to stability, normal social grounding, masking contamination, or trusting ordinary perception | At 5, the Operator uses the Shard to survive the impossible. |

#### Collapse Trigger (Load 6): The Breach Answers

- **Bonus:** +2 to one urgent anomaly, breach, escape, resistance, or impossible-space action
- **Effect:** Handler frames breach expansion, contamination spread, spatial contradiction, attention from the Void, or reality using the Operator as a weak point.
- **Risk / Penalty:** Handler frames breach impulse. -2 to restraint, stability, masking contamination, or trusting ordinary perception.

### Passive Permissions

- **Breach Tolerance** (`breach_tolerance`)
  - **Effect:** Can endure, approach, or function near minor anomalies, unstable spaces, impossible geometry, pressure leaks, or breach residue when fiction allows. Permission, not immunity.
  - **Handler Note:** Handler frames what the Shard can carry without opening further.
- **Wrongness Sense** (`wrongness_sense`)
  - **Effect:** Can detect when reality is thin, rules are inconsistent, a space has been breached, an object is contaminated, or an event does not belong.
  - **Handler Note:** Handler frames what wrongness is willing to show before proof appears.

### Active Abilities & Surge Triggers

- **Break Pattern** (`break_pattern`) *(Headline Surge Action)*
  - **Cadence:** Once per scene
  - **Roll:** Roll if the breach is hostile, major, or observed.
  - **Effect:** Exploit a local inconsistency: pass through a warped threshold, ignore one impossible penalty, disrupt an anomaly's rhythm, stabilize a breach for a beat, or make the wrong rule fail.
- **Anomaly Push** (`anomaly_push`)
  - **Cost:** Spend or risk Void Load
  - **Effect:** +1 on one Focus, Instinct, Body, or Logic action involving breach survival, anomaly handling, impossible spaces, corrupted physics, Void exposure, or resisting reality pressure.
  - **Tags:** breach survival, anomaly, impossible space, void exposure

### Presentation Drift & Scars

*Tagline: The wound learned how to open.*

| Min Drift | Scar / Aspect | Tier | Benefit / Permission | Cost / Complication |
|-----------|---------------|------|----------------------|----------------------|
| **Drift 1** | Cold patch on skin, hesitation in speech, thin reality at edges | `surface_tell` | Wrongness Sense becomes sharper | Ordinary grounding feels unreliable |
| **Drift 1** | Wrong reflections, delayed shadows, spatial slip at the margins | `surface_tell` | Breach Tolerance has stronger fiction | Cameras and witnesses catch inconsistency |
| **Drift 3** | Contamination marks, breach residue in records | `persistent_scar` | Anomaly Push strengthens | Masking contamination gets harder |
| **Drift 3** | Reality-fit fracture near thresholds and impossible geometry | `persistent_scar` | Break Pattern gets sharper | Stability and social grounding suffer |
| **Drift 5** | Permanent void wound scar | `deep_drift` | Breach survival and anomaly permissions expand | The room can negotiate with the wound |
| **Drift 5** | Deep Void Archive evolution marker | `deep_drift` | Opens Deep Void Archive path | Handler Approval required |

---

## <a id="wraith"></a>Wraith-Touched / Anchor-Bound

- **ID:** `wraith` | **Catalog Keys:** `WRAITH_TOUCHED_ANCHOR_BOUND`, `WRAITH`
- **Access Tier:** `handler_approval` (Handler Approval Recommended/Required)
- **Identity:** *Bound to a Locus. Haunting through geometry, not spell lists.*

### Pressure Track: Essence Load

- **Track ID:** `wraith.essence_load` (Range: 0–6)

#### Load Bands

| Load | Band | Kind | Bonus / Help | Penalty / Hurt | Note |
|------|------|------|--------------|----------------|------|
| **0** | Fading | `deprived` | — | -1 to presence, self-memory, and acting away from Locus/Tether | The cup reads empty — presence thins away from anchor. |
| **5** | Possessive Saturation | `edge` | +1 to Locus actions, haunting, ghost-sense, intimidation | -1 to restraint and self-separation | Essence starts steering behavior before the Operator names the want. |

#### Collapse Trigger (Load 6): Haunting Risk

- **Bonus:** +2 to Locus surge actions
- **Effect:** Containment frays — anchor failure, predatory haunting, or dead identity residue takes the mic.
- **Risk / Penalty:** Handler frames the haunting impulse. -2 to restraint and self-separation.

#### Haunt Interface (Locus / Tether)

Default Haunt Range: *Full in/through Locus. Limited through Tethers.*

- **Primary Locus:** `primaryLocus` (*Name your Locus*)
- **Locus Scale:** `locusScale` (*Vehicle, room, building…*)
- **Locus Range:** `hauntRange` (*Full in/through Locus. Limited through Tethers.*)

### Passive Permissions

- **Locus Sense** (`locus_sense`)
  - **Effect:** You know when someone touches, enters, damages, records, or meaningfully invokes your Locus.
- **Locus Reach** (`haunt_reach`)
  - **Effect:** You may attempt Wraith actions through a valid Locus or Tether without direct physical contact. The action originates from continuity, not distance.
- **Dead Presence** (`dead_presence`)
  - **Effect:** Inside your Locus or near a Tether, you may manifest signs of presence: cold, sound, reflection, movement, pressure.

### Active Abilities & Surge Triggers

- **Poltergeist Touch** (`poltergeist_touch`)
  - **Roll:** Roll if contested.
  - **Effect:** Move, open, close, jam, flicker, stall, or disturb something connected to your Locus or Tether.
- **Dead Route** (`dead_route`)
  - **Roll:** Roll if risky.
  - **Effect:** Move sound, shadow, attention, or presence through Locus geometry.
- **Essence Transfer** (`essence_transfer`)
  - **Cost:** Move 1 Essence
  - **Effect:** Store Essence in a meaningful object, person, place, or record to create or feed a Tether.
- **Re-Corporealize** (`re_corporealize`)
  - **Cost:** Delay / low Essence
  - **Effect:** If disrupted near a valid Locus or Tether, return after 1d3 rounds or the next quiet beat.
- **Anchor Pull** (`anchor_pull`)
  - **Cadence:** Scene action
  - **Effect:** While touching or inside your Locus, move Essence Load 1 step toward 2–4.

### Presentation Drift & Scars

*Tagline: The Locus remembers harder than the body does.*

| Min Drift | Scar / Aspect | Tier | Benefit / Permission | Cost / Complication |
|-----------|---------------|------|----------------------|----------------------|
| **Drift 1** | Cold spots, flickering lights, delayed reflection | `surface_tell` | Locus Sense becomes sharper | People notice the room reacting |
| **Drift 1** | Voice distortion near recordings | `surface_tell` | Easier to affect audio/video tied to Locus | Records become suspicious or corrupted |
| **Drift 3** | Shadow lag, partial transparency, object attachment | `persistent_scar` | Locus Reach improves through Tethers | Distance from Locus feels unsafe |
| **Drift 3** | Name/identity desync | `persistent_scar` | Dead Route and Poltergeist Touch gain stronger fiction | Legal/social identity becomes unstable |
| **Drift 5** | Anchor mark, death pallor, impossible absence | `deep_drift` | Re-Corporealize/return permissions expand | Locus vulnerability becomes existential |
| **Drift 5** | Wraith evolution marker | `deep_drift` | Opens Death Archive path | Handler Approval required |

---
