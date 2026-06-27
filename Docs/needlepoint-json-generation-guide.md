# Needlepoint JSON Generation Guide

Internal generation structure for Codex. Not public canon copy.

Build Needlepoint JSON as a table-running tool, not a lore document.

Every entry must answer three questions:

1. What does the Handler show at the table?
2. What mechanical or positional thing changes?
3. What new choice does that create for Operators?

If a field only sounds eerie but does not change play, rewrite it.

## Core Rule

Use this pattern everywhere:

Trigger -> Concrete Consequence -> Changed Options

Bad:

"Floor 13 opens hungry."

Good:

"The elevator opens to Floor 13 at Tick 3 instead of Tick 4. Operators arrive with fewer clues. One exit is already locked. One phone starts streaming without permission."

## Needlepoint JSON Field Contract

The JSON is internal scaffolding. It is used to generate Handler-facing packets, app data, mission templates, and control panels. Do not expose the word JSON in public Operator-facing canon unless the interface is explicitly technical.

Every Needlepoint must produce playable data in these categories:

1. Case identity
2. Site behavior
3. Pressure loop
4. Clue routes
5. Clock escalation
6. Scene modules
7. Failure conversions
8. Recovery and aftermath
9. Handler table prompts
10. Validation notes

### Required Object Shape

```json
{
  "needlepoint_id": "NP-001A",
  "title": "Viridian House",
  "public_label": "Needlepoint 001a",
  "handler_summary": "",
  "operator_brief": "",
  "central_question": "",
  "runtime": {
    "expected_sessions": 1,
    "expected_hours": "2-4",
    "operator_count": "2-5",
    "starting_pressure": "controlled"
  },
  "site": {
    "ordinary_read": "",
    "wrong_read": "",
    "locus": "",
    "safe_first_tell": "",
    "what_the_site_wants": "",
    "what_makes_it_worse": [],
    "what_stabilizes_it": []
  },
  "pressure_loop": {
    "need": "",
    "lure": "",
    "pressure": "",
    "gift": "",
    "violence": "",
    "exit": ""
  },
  "core_clues": [],
  "clock": [],
  "scenes": [],
  "failure_states": [],
  "success_states": [],
  "aftermath": [],
  "handler_prompts": [],
  "attention_states": {},
  "clock_attention_consequences": [],
  "player_view": {
    "safe_consequence": ""
  },
  "validation": {}
}
```

## Deterministic Handler Attention

Make Handler Attention deterministic.

Attention = who or what is watching the Operators.
Clock = how far the Needlepoint has progressed.
Consequence = Attention + Clock + active Needlepoint table.

Do not let Residue, Follows Home, or Consequences be static text once a Needlepoint is loaded.

When the Handler changes Attention, update those fields from the active Needlepoint `attention_states` table.

When the Clock advances, update Consequences from the active Needlepoint `clock_attention_consequences` matrix.

Use these Attention states:

- Unseen
- Noticed
- Focused
- Targeted
- Exposed

Accept legacy Attention aliases during import or cleanup:

- Observed = Noticed
- Fixed / Witnessed / Marked / Pursued = Targeted
- Mythic / Claimed = Exposed

Use the five-step Attention ladder during play. Use any older Threat Visibility ladder only when designing large-scale entity pursuit, not as the Handler runtime ladder.

A runnable Needlepoint must include 6-10 `table_triggers`. If it has no triggers, it is prep text, not table-ready. Each trigger should name the clock responsibility it affects: Primary Clock, Attention Clock, Case Clock, or Primary + Attention.

Player View must not show Handler clocks, attention state, consequence tiers, or follows-home text unless explicitly marked `player_safe` in `player_view.safe_consequence`.

Viridian House location is Kansas City / KC unless overridden by verified source text. Do not generate Chicago for Viridian House.

Example shape:

```json
{
  "attention_states": {
    "unseen": {
      "residue": "A comment arrives before anyone types it.",
      "follows_home": "One device briefly predicts harmless phrasing.",
      "consequence": "No penalty; warning only."
    },
    "noticed": {
      "residue": "Screens hesitate before showing the Operator's reflection.",
      "follows_home": "One useful lie is predicted.",
      "consequence": "First lie under observation has Disadvantage unless shielded."
    }
  },
  "clock_attention_consequences": [
    {
      "clock_min": 0,
      "clock_max": 1,
      "attention": "unseen",
      "consequence": "Minor tell only."
    },
    {
      "clock_min": 4,
      "clock_max": 5,
      "attention": "focused",
      "consequence": "Once per scene, the Audience may target an Operator through a screen."
    }
  ],
  "player_view": {
    "safe_consequence": ""
  }
}
```

Generate Needlepoints as playable pressure machines. Attention picks the flavor of being watched. Clock picks how dangerous it is. The active Needlepoint decides what that means.

## Writing Rules For Codex

Use **Handler**, not GM.

Use **Operator**, not player, except when discussing table behavior directly.

Use **Needlepoint**, not adventure/module in final-facing copy.

Avoid vague consequence words unless immediately defined:

- hungry
- marked
- wrong
- contaminated
- unstable
- worse positioning
- public-facing
- learns them
- pressure rises

These are allowed only if followed by table effects.

Example:

```json
{
  "label": "Audience marks the Operator",
  "table_meaning": "Once per scene, the Handler may target that Operator through any active screen.",
  "mechanical_effect": "First refusal costs 1 Stability or ticks the Clock.",
  "changed_options": [
    "avoid screens",
    "speak honestly while watched",
    "let another Operator shield them",
    "break the device and move the pressure elsewhere"
  ]
}
```

## Clue Map Rules

Clues cannot disappear because of a failed roll.

Failure changes:

- who sees the clue
- how public the clue becomes
- what it costs
- what the site learns
- which route opens
- which NPC becomes exposed

Use this shape:

```json
{
  "clue": "The elevator opens to Floor 13 after a lie under observation.",
  "first_route": "Test the elevator while the camera is active.",
  "alternate_route": "Read the future comment thread in the security office.",
  "failure_cost": "The elevator opens early, before Operators have enough context.",
  "table_effect": "Floor 13 becomes reachable, but one exit is locked and the Clock ticks."
}
```

Store clue entries in `core_clues`.

## Clock Tick Rules

Every Clock tick needs four pieces:

```json
{
  "tick": 3,
  "name": "Elevator Listens",
  "visible_change": "The elevator repeats a sentence an Operator avoided saying.",
  "mechanical_effect": "The next elevator action is TN 15 instead of TN 12 unless someone speaks honestly while recorded.",
  "changed_options": [
    "confess a small operational truth",
    "force the elevator and accept a Clock tick",
    "leave and seek another clue route",
    "ask another Operator to shield the speaker"
  ]
}
```

No Clock tick should be only mood.

## Failure State Rules

Failure states are not endings. They are altered boards.

Use this shape:

```json
{
  "trigger": "Operators treat Mara as content or evidence.",
  "immediate_consequence": "Mara stops responding to off-camera comfort.",
  "mechanical_effect": "Attempts to calm, guide, or rescue Mara off-camera have Disadvantage.",
  "changed_options": [
    "turn the camera on and risk feeding the Audience",
    "name Mara as a person, not proof",
    "use Saffi's true memory as an anchor",
    "cut the broadcast and accept a harder rescue roll"
  ],
  "aftermath_hook": "Mara returns with edited memories if recovered through performance."
}
```

## Scene Rules

Each scene needs:

- normal detail
- wrong detail
- emotional pressure
- available clues
- possible rolls
- failure costs
- exit condition

```json
{
  "scene_id": "act_2_security_office",
  "title": "Security Office",
  "normal_detail": "Cheap monitors, timestamp logs, manager keys.",
  "wrong_detail": "One monitor shows comments from three minutes in the future.",
  "dominant_pressure": "performance under observation",
  "available_clues": [
    "Mara's reflection stayed behind",
    "the comment thread predicts withheld speech"
  ],
  "common_rolls": [
    {
      "action": "Recover corrupted footage",
      "roll": "3d6 + Mind + Tech",
      "tn": 15,
      "success": "Footage shows Mara stepping out while her reflection remains.",
      "partial": "Clue gained, but the comment thread learns one Operator's preferred mask.",
      "miss": "Clue gained publicly; Clock ticks."
    }
  ],
  "exit_conditions": [
    "Operators recover one clue",
    "Clock ticks",
    "a screen addresses an Operator directly"
  ]
}
```

## Table Sense Rule

Codex must ask, for every generated line:

"Can the Handler use this in the next five minutes?"

If not, convert it into:

- a roll
- a cost
- a visible change
- a choice
- an NPC reaction
- a Clock tick
- a new route
- a locked route
- a Stability effect
- an aftermath hook

## Viridian House Example Failure Rewrite

```json
{
  "trigger": "Operators lie constantly under observation.",
  "bad_label": "Floor 13 opens hungry.",
  "usable_version": {
    "immediate_consequence": "The elevator opens to Floor 13 at Tick 3 instead of Tick 4.",
    "mechanical_effect": "Operators arrive with only two core clues. First action on Floor 13 is made under pressure at TN 15.",
    "visible_change": "One hallway exit is already locked. One Operator's phone begins streaming without permission.",
    "changed_options": [
      "push forward with incomplete context",
      "speak an honest sentence to unlock one door",
      "break the streaming phone and move pressure into the elevator",
      "retreat and let Saffi become exposed"
    ]
  }
}
```

## Validation Rules

Before finalizing, Codex must inspect every scene, clue, clock tick, and failure state.

For each generated item, answer:

```json
{
  "is_visible_at_table": true,
  "has_trigger": true,
  "has_concrete_consequence": true,
  "changes_operator_options": true,
  "uses_handler_language": true,
  "avoids_public_json_language": true,
  "avoids_vague_vibe_only_terms": true
}
```

If any value is false, rewrite the item.

Store aggregate validation results in the top-level `validation` object.

## Anti-Vibe Converter

When Codex writes a vague phrase, it must immediately convert it.

| Vague Phrase | Required Conversion |
|---|---|
| The site gets hungry | What opens early? What locks? What costs Stability? |
| The entity marks them | How can it target them later? How often? Through what interface? |
| Mara returns wrong | What behavior changes? What rolls become harder? What future hook appears? |
| Attention rises | Who notices? What clock starts? What TN increases? |
| The room learns them | What specific mask, habit, fear, lie, or tactic can the site now use? |
| Bad positioning | Who is separated? What exit is locked? What clue is missing? |
| Public exposure | Who records it? What must be contained? What future consequence exists? |
| Contamination spreads | Where does it spread? Device, NPC, building, feed, mirror, record, dream? |

Codex should never delete the vibe. It should **cash the vibe out into table operations**.

Example:

```json
{
  "bad_phrase": "The site gets hungry.",
  "converted_table_effect": {
    "visible_change": "The elevator opens to Floor 13 before the Operators have three core clues.",
    "mechanical_effect": "The first action on Floor 13 is TN 15. One exit is locked until an Operator speaks honestly while recorded.",
    "changed_options": [
      "push forward with incomplete context",
      "retreat and expose Saffi",
      "break the recording device and move pressure into the elevator",
      "speak a small truth to unlock one route"
    ]
  }
}
```

## Scene Generation Contract

Each scene must be runnable from the JSON without the Handler needing to invent the core function.

Every scene requires:

```json
{
  "scene_id": "",
  "title": "",
  "purpose": "",
  "normal_detail": "",
  "wrong_detail": "",
  "dominant_pressure": "",
  "entry_condition": "",
  "available_clues": [],
  "npc_or_site_reactions": [],
  "common_actions": [],
  "pressure_moves": [],
  "failure_costs": [],
  "exit_conditions": []
}
```

Common actions must include roll data when uncertainty matters:

```json
{
  "action": "Recover corrupted security footage",
  "roll": "3d6 + Mind + Tech",
  "tn": 15,
  "success": "Recover the clue cleanly.",
  "partial": "Recover the clue, but the site learns one Operator's preferred mask.",
  "miss": "Recover the clue publicly; tick the Clock."
}
```

Failure should almost always still provide movement.
A failed roll may cost Stability, time, privacy, position, trust, or containment, but it should not simply say "nothing happens."

## Codex Generation Instruction

When generating a Needlepoint:

1. Start with the central emotional question.
2. Define the site as ordinary first, impossible second.
3. Build the pressure loop using Need, Lure, Pressure, Gift, Violence, Exit.
4. Create 4-6 core clues.
5. Give every clue at least two routes.
6. Give every failed clue route a cost that still advances play.
7. Build a 4-6 tick Clock.
8. Give every Clock tick a visible table change and changed Operator options.
9. Build 4-5 scenes.
10. Convert every spooky phrase into a concrete consequence.
11. Add failure states that alter the board instead of ending play.
12. Add aftermath hooks that can feed later Needlepoints.

Final check:
If the Handler cannot use a field within five minutes at the table, rewrite it.

Do not generate spooky summaries. Generate playable consequences.

Every eerie phrase must cash out as a table operation: what changes, what it costs, and what Operators can do next.

**One-line command:**

Generate Needlepoints as playable pressure machines. Lore is allowed, but every lore beat must produce a visible change, a cost, a choice, a route, a roll, a Clock tick, or an aftermath hook.

The JSON is not "store the story." It is **store the usable table physics**.
