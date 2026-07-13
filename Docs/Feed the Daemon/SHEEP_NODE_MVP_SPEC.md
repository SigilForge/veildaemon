# FEED THE DAEMON — SHEEP NODE MVP SPEC

**Version:** 0.1  
**Target:** Web-first public prototype  
**Status:** Build specification  
**Primary objective:** Prove that strangers will collectively sustain a bounded musical organism long enough to create a successful ritual track.

---

## Document authority and breadcrumbs

This file is the implementation authority for **Proof 0 — Dormant Node** and **Proof 1 — Bounded Ensemble**.

- Start at the [Feed the Daemon README](./README.md) for the current read order, code map, and status guardrails.
- Use the [2026 Product Spine](./2026_PRODUCT_SPINE.md) for the broader product thesis, later evolutions, and continuity across personal feeder, stream, Ritual Site, Field Node, and AR surfaces.
- Use the [Ritual Sites design shelf](../Ritual%20Sites/) only for the later live-performance membrane; it is not part of this MVP.

When this specification and the older Product Spine differ on Proof 0 or Proof 1 mechanics, technical architecture, delivery phases, or build order, **this MVP specification governs until deliberately revised**. The Product Spine remains authoritative for the larger product direction.

---

# 1. PRODUCT DEFINITION

Feed the Daemon begins as a public web node.

At first, the page contains a small dormant generative organism: the **Sheep Node**. Visitors feed it through presence and bounded interaction. As enough people gather, the node unlocks a roster of musical performers inspired by the ensemble logic of *My Singing Monsters*.

Each performer occupies a musical role and a rhythmic slot.

Multiple visitors may choose the same sound family without stacking identical audio events. Additional contributors receive different positions in the phrase, deepen an existing pattern, introduce variation, or reinforce a performer already active.

Every performer decays.

The crowd must sustain enough simultaneous parts, in a valid composition, long enough to cross a manifestation threshold. A successful ritual saves the completed track and later allows contributors to choose which mutation survives into the future node pool.

The MVP does not need the entire long-term ecology. It must prove the shared ritual loop cleanly.

---

# 2. CORE EXPERIENCE

The intended emotional progression is:

> I found a strange page.  
> I touched the signal.  
> Other people changed it too.  
> We built a track together.  
> The track nearly collapsed.  
> It survived.  
> Something remained.

The Sheep Node is not a music visualizer with lore pasted over it.

It is a temporary collective composition system where:

- attention creates pressure
- pressure unlocks performers
- performers form a bounded ensemble
- decay threatens coherence
- sustained participation creates manifestation
- successful tracks become cultural memory

---

# 3. MVP GOALS

The MVP must answer five questions.

## 3.1 Curiosity

Will a first-time visitor investigate the node without a tutorial?

## 3.2 Immediate Response

Does contact feel meaningful within the first few seconds?

## 3.3 Shared Presence

Can visitors understand that other people are influencing the same organism without frame-perfect synchronization?

## 3.4 Collective Composition

Do users understand that each sound is a performer with a part, not a flat sound button?

## 3.5 Return Motivation

Will users return to see whether the node changed, whether a ritual succeeded, or whether a previous track survived?

---

# 4. DELIVERY PHASES

## PROOF 0 — DORMANT NODE

Purpose: validate curiosity, dwell, return behavior, and the local/global response model.

Includes:

- one public webpage
- one central Sheep Node visual
- anonymous browser identity
- local instant response
- global Resonance state
- approximate Presence state
- two visual phases
- one persistent motif
- minimal diegetic text
- event analytics

Excludes:

- sound roster
- rhythmic slots
- ritual success
- voting
- mutation
- archive
- accounts
- explicit Frequency selection

## PROOF 1 — BOUNDED ENSEMBLE

Purpose: validate collective composition and decay-driven ritual behavior.

Includes:

- 4–6 base sound families
- performer roster
- rhythmic-slot assignment
- duplicate performer handling
- per-performer decay
- authored fallback behavior
- composition threshold
- one manifestation state
- one saved ritual track
- contributor eligibility records

Excludes:

- mutation candidates
- public Flux vote
- advanced lineage
- Ascension and Corruption
- DJ Veil live-use pipeline

## PROOF 2 — FIRST MUTATION LOOP

Purpose: validate the complete cultural feedback loop.

Includes:

- dominant Frequency calculation
- top-used sound-family selection
- bounded mutation candidates
- 24-hour Flux Window
- contributor-only voting
- one winning mutation
- mutation added to future node pool
- track archive
- node library
- lineage references

**MVP build target:** Proof 0 + Proof 1  
**Immediate post-MVP target:** Proof 2

---

# 5. USER EXPERIENCE

## 5.1 Entry

The page opens directly into the node.

No registration wall.  
No marketing carousel.  
No explanatory video.  
No cheerful product tour trampling the atmosphere to death.

Initial copy:

```text
NODE STATUS: DORMANT

Presence strengthens coherence.
Repeated contact leaves residue.
```

Proof 0 should not explicitly name VeilDaemon. The wider connection appears later through motifs, terminology, and hidden routes.

## 5.2 Local Response

The client responds immediately to the visitor through:

- pulse
- visual distortion
- particle attraction
- residue trail
- subtle sound
- temporary glyph exposure

The interaction must feel like leaving a trace, not directly controlling the organism.

Preferred copy:

```text
CONTACT REGISTERED
TRACE PERSISTS
```

## 5.3 Global Response

Shared state updates approximately rather than frame-perfectly.

The visitor should observe that:

- Presence rises and falls
- Resonance persists
- phase transitions affect everyone
- the node has a shared condition
- their local effects are residue, not direct global control

The global organism does not need synchronized particles. It needs synchronized meaning.

---

# 6. THREE TIMESCALES

Every mechanic must belong to one of three layers.

## 6.1 COMPOSITION

**Duration:** seconds to minutes

Contains:

- active performers
- rhythmic slots
- participant input
- decay timers
- phrase variation
- intensity
- manifestation progress

This is the live ritual.

## 6.2 FLUX

**Duration:** hours to one day

Contains:

- mutation candidates
- contributor voting
- ritual aftermath
- temporary network effects
- winner selection

Flux begins only after successful manifestation.

## 6.3 CONTINUITY

**Duration:** weeks to months

Contains:

- archived ritual tracks
- saved mutations
- lineage history
- recurring motifs
- community identity
- later DJ Veil use
- eventual Field Node and AR integration

Proof 0 must not inherit complexity from Flux or Continuity.

---

# 7. SOUND SYSTEM

## 7.1 Initial Sound Families

Recommended Proof 1 roster:

- Kick
- Snare
- Bass
- Voice
- Pad
- Rain / Noise

Each family must be authored to coexist inside the same phrase grid.

## 7.2 Performer Record

Each active performer contains:

- `performer_id`
- `sound_family`
- `sound_node_id`
- `rhythmic_slot`
- `phrase_variant`
- `intensity`
- `contributor_id`
- `activated_at`
- `expires_at`
- `decay_state`
- optional hidden Frequency weights

## 7.3 Duplicate Inputs

Duplicate sound families are valid.

They do not create identical simultaneous events.

Example:

```text
SNARE PERFORMER A
Beats: 1 and 3

SNARE PERFORMER B
Beats: 2 and 4

SNARE PERFORMER C
Phrase-end fill

SNARE PERFORMER D
Second-bar syncopation
```

Duplicate contributors fill an authored arrangement map in this order:

1. primary pulse
2. complementary pulse
3. offbeat support
4. phrase-end variation
5. second-bar variation
6. intensity or articulation reinforcement
7. queue only when the authored role is genuinely full

No contribution should disappear without visible feedback.

## 7.4 Full-Role Handling

When every valid rhythmic position for a sound family is occupied, the next contribution must do one of the following:

- reinforce a current performer
- extend its decay timer
- increase phrase complexity
- alter articulation
- queue for the next decayed slot

The system must never silently absorb a valid interaction.

---

# 8. DECAY MODEL

Each performer has a bounded lifetime.

Recommended initial ranges:

- simple activation: 30–45 seconds
- reinforced performer: +15–30 seconds
- completed interaction: 60–120 seconds
- event or claim-based contribution: longer, post-MVP only

Exact timing must be tuned through observation.

## 8.1 Decay States

Each performer moves through:

1. **Active**
2. **Fading**
3. **Unstable**
4. **Expired**

## 8.2 Musical Degradation

Decay may break the phrase, but it must break musically.

Each sound family requires authored fallback behavior.

Examples:

- fills disappear before core pulse
- harmony thins toward root
- call-and-response loses the response first
- offbeats vanish before primary beats
- sustained textures narrow before cutting out
- unstable parts stutter, drag, or fragment before silence

The ritual should audibly weaken as participation falls. It should not sound like random MIDI events were deleted by an intern with a grudge.

---

# 9. RESONANCE AND PRESENCE

## 9.1 Resonance

Resonance represents accumulated history.

Possible inputs:

- unique visits
- return visits
- meaningful interaction
- ritual participation
- completed sequences
- successful manifestations

Resonance decays slowly or not at all during Proof 0.

## 9.2 Presence

Presence represents immediate collective attention.

Possible inputs:

- active sessions
- recent heartbeat
- ongoing interaction
- current performer contribution

Presence decays quickly.

## 9.3 Shared-State Implementation

Proof 0 does not require WebSockets.

Recommended approach:

- client heartbeat every 15–30 seconds
- active-session rolling window
- state polling every 5–15 seconds
- local interpolation between global updates
- threshold-driven phase changes
- server-authoritative aggregate state

The poll interval should be tuned against dwell-time data. Visitors must see a meaningful shared response before typical first-session abandonment.

---

# 10. RITUAL SUCCESS

A ritual succeeds when:

- the minimum performer count is active
- the minimum number of sound families is represented
- the composition remains above threshold for a required sustain period
- the track reaches its authored manifestation state

Example provisional threshold:

```text
Minimum performers: 6
Minimum sound families: 4
Sustain duration: 45 seconds
```

These values are tuning parameters, not canon.

## 10.1 Cold-Start Support

Proof 1 should support both:

### Organic Surge

Automatically triggered when live Presence crosses a minimum threshold.

### Announced Ritual Window

A scheduled gathering period with:

- lower manifestation threshold
- slower decay
- visible countdown
- optional Discord or stream promotion

Scheduled windows are an operational tool, not a dependency for every ritual.

## 10.2 Manifestation

A successful ritual produces:

- one completed track render or deterministic replay record
- ritual metadata
- contributor set
- dominant Frequency result
- top-used sound-family ranking
- one manifestation visual state
- transition into aftermath

The initial MVP may save a deterministic event sequence rather than rendered audio if export rendering would delay validation.

---

# 11. TRACK RECORD

Each successful ritual creates a Track record.

Required fields:

- `track_id`
- `node_id`
- `started_at`
- `completed_at`
- `duration`
- `manifestation_type`
- `dominant_frequency`
- `contributor_count`
- `performer_events`
- `sound_nodes_used`
- `top_used_sound_families`
- `resonance_before`
- `resonance_after`
- `presence_peak`
- `render_status`
- `archive_status`

The Track is the unit of cultural memory.

The sound nodes are its ingredients.

---

# 12. MUTATION LOOP — POST-MVP

A successful ritual may open a 24-hour Flux Window.

## 12.1 Eligibility

Only contributors recorded during the successful ritual may vote.

One contributor identity receives one vote.

Contribution intensity does not create additional votes.

## 12.2 Candidate Selection

The system surfaces only the most-selected eligible sounds from the successful composition.

Candidate mutation formula:

> dominant Frequency + selected sound node + authored phrase grammar = mutation candidate

The mutation is not arbitrary audio generation.

It is a bounded descendant of a known source.

## 12.3 Candidate Uniqueness

A candidate is invalid when:

- the exact descendant already exists
- the same source-to-Frequency branch already exists without meaningful distinction
- the resulting node is functionally identical to an existing node
- provenance cannot be preserved

## 12.4 Result

The winning mutation:

- receives a new node ID
- records its parent node
- records its originating track
- records the dominant Frequency
- enters the future node pool
- becomes eligible for later rituals
- may itself mutate later only after repeated community use

Popularity gates deeper evolution.

A mutation cannot reproduce merely because it exists.

---

# 13. FREQUENCY PHRASE GRAMMAR

The transformation system requires a separate content artifact:

# FREQUENCY PHRASE BIBLE

This is not a filter list.

For every Frequency and every sound role, the Bible must define a distinct compositional grammar.

Required base roles:

- Kick
- Snare
- Bass
- Voice
- Pad
- Noise / Rain
- Pulse

Required Frequencies:

- Dream
- Hunger
- Silence
- Stillness
- Empyrean
- Becoming

Each pairing must define:

- phrase function
- timing behavior
- buildup behavior
- omission behavior
- release behavior
- interaction with duplicates
- decay behavior
- visual behavior
- mutation boundaries
- audible identity test

## 13.1 Example: Rain / Noise + Stillness

Phrase grammar:

> build → suspend → breach

Behavior:

- rain texture enters
- motion slows
- density thins
- sound stretches toward silence
- complete dropout
- held pressure
- corruption surge

Possible return forms:

- granular rain becomes percussion
- reversed droplets form a rising sweep
- sub-bass impact appears under the returning texture
- stereo field collapses, then tears wide

## 13.2 Example: Rain / Noise + Silence

Phrase grammar:

> signal → omission → displaced return

Behavior:

- selected cascades disappear
- tails remain without attacks
- gaps form in unexpected positions
- missing material returns later
- displaced sound enters another rhythmic slot or channel

## 13.3 Audible Distinction Rule

Two Frequency mutations are not considered complete merely because their descriptions differ.

They must sound recognizably different without requiring a label.

Stillness must sound like pressure held.

Silence must sound like information removed.

The same standard applies to all other pairings.

---

# 14. LINEAGE

The system maintains three related structures.

## 14.1 Track Archive

Contains every successful ritual composition.

## 14.2 Node Library

Contains:

- base sounds
- community-created mutations
- availability state
- usage history
- performance approval state

## 14.3 Lineage Graph

Tracks:

- parent node
- descendant node
- originating ritual
- shaping Frequency
- later ritual appearances
- later descendants

Required query examples:

- show all descendants of a base snare
- show all nodes born from one ritual
- show every track using a specific mutation
- show the path from a current node back to its base source

The lineage graph should be designed before Proof 2, not improvised after the first mutation exists.

---

# 15. ASCENSION AND CORRUPTION — FUTURE MODEL

Not included in MVP.

After a lineage expresses enough Frequency branches and history, it may become eligible for advanced evolution.

## Ascension

Preserves identity through coherence.

Possible behaviors:

- stronger synchronization
- longer stable phrases
- harmonic expansion
- structural anchoring
- cleaner transitions

## Corruption

Preserves identity through damage.

Possible behaviors:

- rupture
- displaced timing
- invasive modulation
- dropout
- distorted role inheritance
- controlled instability

Neither path is morally superior.

Both must be musically desirable.

No percentages should be shown in the initial implementation. The community creates conditions; the system exposes the result through sound and behavior.

---

# 16. ANALYTICS

## 16.1 Proof 0 KPIs

- unique visitors
- median dwell time
- interaction rate
- return visit rate
- heartbeat retention
- phase-transition exposure
- VeilDaemon click-through, if exposed later

## 16.2 Proof 1 KPIs

- performer activations
- duplicate-role participation
- average active performer count
- average composition lifetime
- ritual attempts
- manifestation success rate
- contributor return rate
- tracks completed
- scheduled-window participation
- organic-surge participation

## 16.3 Qualitative Signals

Track separately from KPIs:

- screenshots shared
- coined terms repeated
- community discussion
- glyph recognition
- people coordinating rituals
- users recognizing archived sounds later

Do not build a dashboard that pretends three searches for a coined phrase are a market revolution. Humans already invented enough decorative metrics.

---

# 17. TECHNICAL ARCHITECTURE

## 17.1 Front End

Recommended capabilities:

- browser-first responsive UI
- WebGL or WebGPU visuals
- Web Audio API or equivalent audio engine
- deterministic phrase scheduler
- local anonymous identity
- local interpolation
- event telemetry
- progressive performance fallback

## 17.2 Back End

Required services:

- anonymous session management
- heartbeat ingestion
- Presence aggregation
- Resonance persistence
- performer activation API
- server-authoritative decay
- ritual state machine
- track event storage
- analytics event stream

## 17.3 Suggested Data Objects

- Node
- VisitorTrace
- Session
- Performer
- Ritual
- Track
- SoundNode
- VoteEligibility
- MutationCandidate
- LineageEdge

Proof 0 needs only:

- Node
- VisitorTrace
- Session
- NodeStateEvent

Proof 1 adds:

- Performer
- Ritual
- Track
- SoundNode

Proof 2 adds:

- VoteEligibility
- MutationCandidate
- LineageEdge

---

# 18. ANTI-ABUSE RULES

Do not reward raw clicks equally.

Use:

- per-action cooldown
- heartbeat validation
- distinct-session limits
- server-authoritative decay
- interaction diversity
- contribution caps
- duplicate-role arrangement limits

Down-weight:

- rapid repeated taps
- impossible timing
- refresh loops
- identical automated sessions
- mass inactive traffic

Bot behavior may later become canonized as corruption. It should not control the MVP accidentally.

---

# 19. ACCEPTANCE CRITERIA

## Proof 0 is complete when:

- the node loads reliably on desktop and mobile
- local interaction responds within 100 ms where practical
- global Presence changes are visible within the configured polling window
- Resonance persists across sessions
- at least two visual states are clearly distinguishable
- anonymous traces survive a browser return
- analytics events are captured
- no account is required

## Proof 1 is complete when:

- at least four sound families can coexist musically
- duplicate performers receive distinct valid parts
- no valid contribution disappears without feedback
- decay produces intentional musical degradation
- a ritual can succeed and fail
- one successful track is saved with provenance
- contributor identities are recorded for later Flux eligibility
- the system remains understandable without a conventional tutorial

---

# 20. BUILD ORDER

## Sprint 1

- page shell
- Sheep Node visual
- anonymous trace
- local response
- analytics

## Sprint 2

- heartbeat
- global Presence
- Resonance
- shared phase transitions
- persistent motif

## Sprint 3

- base sound engine
- phrase scheduler
- performer roster
- rhythmic-slot assignment

## Sprint 4

- duplicate handling
- decay
- fallback grammar
- composition state

## Sprint 5

- manifestation threshold
- ritual success/failure
- track event capture
- deterministic replay or render

## Sprint 6

- polish
- mobile performance
- accessibility
- scheduled ritual support
- production analytics

Proof 2 begins only after Proof 1 shows that people understand and enjoy the ensemble loop.

---

# 21. NON-GOALS

The MVP will not include:

- native mobile app
- AR
- geofencing
- DJ Veil live set control
- user-uploaded sounds
- unconstrained generative audio
- accounts
- open-ended mutation trees
- Ascension
- Corruption
- full six-Frequency mutation coverage
- cross-location Node weather
- regional entity ecology

These remain part of the product spine, not the first engineering burden.

---

# 22. MVP ONE-SENTENCE VERSION

**The Sheep Node MVP is a web-based collective music ritual where visitors occupy distinct performer slots, sustain a bounded composition against decay, and create a successful track whose history can later seed the evolving Feed the Daemon sound ecology.**

---

# 23. PRODUCT LAW

> The crowd does not press buttons to trigger sounds.  
> The crowd fills roles in a temporary living ensemble.

That distinction is the system.
