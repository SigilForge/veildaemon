# TODO

## Handler Live Dashboard

- Add more "What Just Happened?" buttons in `handler/handler-triggers.js` / Needlepoint trigger JSON that explicitly route table events to clock responsibility:
  - Primary Clock (site-owned): the place is getting worse.
  - Attention Clock: something in the place is noticing the Operators.
  - Case Clock: mission-level pressure is advancing.
- Trigger behavior should follow the table rule:
  - If the action disturbs the site, tick Zone.
  - If the action exposes an Operator, tick Attention.
  - If the action is loud, intimate, mirrored, bloody, or directly supernatural, consider both, but prefer the more immediate threat.
  - On a severe misfire or natural 3, tick both or tick one clock twice.
- Add buttons for common live events such as misfire disturbs site, misfire exposes Operator, loud supernatural action, mirrored contact, blood exposure, repeated behavior, evidence decay, witness risk, and external forces arrive.
