# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: surface-nav.spec.js >> operator file edits sync into local record preview on other surfaces
- Location: tests/browser/surface-nav.spec.js:241:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('[name="voidMarks"]')
    - locator resolved to <input readonly value="0" type="hidden" name="voidMarks"/>
    - fill("3")
  - attempting fill action
    2 × waiting for element to be visible, enabled and editable
      - element is not visible
    - retrying fill action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and editable
      - element is not visible
    - retrying fill action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and editable
       - element is not visible
     - retrying fill action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - navigation "Surface files" [ref=e2]:
    - link "CASE FILE NEEDLEPOINT" [ref=e3] [cursor=pointer]:
      - /url: "#casefile-drawer"
      - generic [ref=e4]: CASE FILE
      - strong [ref=e5]: NEEDLEPOINT
    - link "HOME RETURN HOME" [ref=e6] [cursor=pointer]:
      - /url: /
      - generic [ref=e7]: HOME
      - strong [ref=e8]: RETURN HOME
    - link "REPORTS PUBLIC INDEX" [ref=e9] [cursor=pointer]:
      - /url: "#recovered-reports-drawer"
      - generic [ref=e10]: REPORTS
      - strong [ref=e11]: PUBLIC INDEX
  - main "Personal operations node" [ref=e12]:
    - generic [ref=e13]:
      - img "VeilCorp sigil" [ref=e15]
      - generic [ref=e16]:
        - paragraph [ref=e17]: VEILDAEMON.APP // LOCAL OPERATIONS NODE
        - heading "PERSONAL OPERATIONS NODE" [level=1] [ref=e18]
        - paragraph [ref=e19]: Initialize. Record. Operate. Local record only.
    - paragraph [ref=e21]: "> Local record detected: SYNC-OP. Artifact cache reports 0 recovered items."
    - region "Operator snapshot" [ref=e22]:
      - generic [ref=e23]:
        - generic [ref=e24]: Record ID
        - strong [ref=e25]: SYNC-OP
      - generic [ref=e26]:
        - generic [ref=e27]: Classification
        - strong [ref=e28]: Operator
      - generic [ref=e29]:
        - generic [ref=e30]: Primary Frequency
        - strong [ref=e31]: Dream
      - generic [ref=e32]:
        - generic [ref=e33]: Status
        - strong [ref=e34]: LOCAL RECORD
      - generic [ref=e35]:
        - generic [ref=e36]: Access
        - strong [ref=e37]: LOCAL
    - navigation "Console modules" [ref=e38]:
      - button "Anomaly Log" [ref=e39] [cursor=pointer]
      - button "Sheet" [ref=e40] [cursor=pointer]
      - button "Equipment" [ref=e41] [cursor=pointer]
      - button "Authorized Unlocks" [ref=e42] [cursor=pointer]
      - button "Frequency" [ref=e43] [cursor=pointer]
      - button "Relationships" [ref=e44] [cursor=pointer]
      - button "Archive" [ref=e45] [cursor=pointer]
    - region "Operator sheet" [ref=e46]:
      - generic [ref=e47]:
        - paragraph [ref=e48]: ACTIVE CASE
        - heading "At-table controls for the next thirty seconds." [level=2] [ref=e49]
        - 'button "Edit Sheet: Off" [ref=e50] [cursor=pointer]'
      - generic [ref=e52]:
        - article [ref=e53]:
          - paragraph [ref=e54]: Identity / Access Strip
          - generic [ref=e55]:
            - generic [ref=e56]:
              - text: Operator Name
              - textbox "Operator Name" [ref=e57]: June Rook
            - generic [ref=e58]:
              - text: Record ID
              - textbox "Record ID" [ref=e59]: SYNC-OP
            - generic [ref=e60]:
              - text: Role
              - textbox "Role" [ref=e61]:
                - /placeholder: Operator
                - text: Operator
            - generic [ref=e62]:
              - text: Needlepoint
              - textbox "Needlepoint" [active] [ref=e63]:
                - /placeholder: Viridian House
                - text: Silence Gap
            - generic [ref=e64]:
              - text: Background
              - combobox "Background" [ref=e65]:
                - option "No Background selected" [selected]
                - option "Caretaker"
                - option "Outsider"
                - option "Tech"
                - option "Street"
                - option "Academic"
                - option "Field Medic"
                - option "First Responder"
                - option "Service Worker"
                - option "Burnout Professional"
                - option "Occult Dabbler"
                - option "Former Believer"
                - option "Local Witness"
            - generic [ref=e66]:
              - text: Presentation / Ontology
              - combobox "Presentation / Ontology" [ref=e67]:
                - option "No Presentation selected" [selected]
                - option "Baseline Human"
                - option "Resonant Sensitive"
        - article [ref=e68]:
          - paragraph [ref=e69]: Active Case / Frequency Readout
          - generic [ref=e70]:
            - generic [ref=e71]:
              - generic [ref=e72]: Primary
              - strong [ref=e73]: Dream
            - generic [ref=e74]:
              - generic [ref=e75]: Bleed Cue
              - strong [ref=e76]: DEJA VU, FALSE FAMILIARITY, AND MEMORY CONFUSION
            - generic [ref=e77]:
              - text: Current emotional state
              - textbox "Current emotional state" [ref=e78]:
                - /placeholder: focused, scared, hungry, numb
            - generic [ref=e79]:
              - text: Common tell
              - textbox "Common tell" [ref=e80]
            - generic "Operator currencies" [ref=e81]:
              - generic [ref=e82]:
                - generic [ref=e83]: Void Bank
                - strong [ref=e84]: "0"
              - generic [ref=e85]:
                - generic [ref=e86]: Breach Bank
                - strong [ref=e87]: "0"
        - article [ref=e88]:
          - paragraph [ref=e89]: Action Roll
          - generic [ref=e90]:
            - generic [ref=e91]:
              - text: Attribute
              - combobox "Attribute" [ref=e92]:
                - option "Body +1" [selected]
                - option "Agility +1"
                - option "Mind +1"
                - option "Instinct +1"
                - option "Presence +1"
                - option "Nerves +1"
            - generic [ref=e93]:
              - text: Skill
              - combobox "Skill" [ref=e94]:
                - option "Untrained +0" [selected]
            - generic [ref=e95]:
              - text: Modifier
              - spinbutton "Modifier" [ref=e96]: "0"
            - group "Roll mode" [ref=e97]:
              - generic [ref=e98]:
                - checkbox "Advantage" [ref=e99]
                - text: Advantage
              - generic [ref=e100]:
                - checkbox "Disadvantage" [ref=e101]
                - text: Disadvantage
            - button "Roll 3D6" [ref=e102] [cursor=pointer]
          - generic [ref=e103]: Awaiting action.
        - article [ref=e104]:
          - generic [ref=e105]:
            - article [ref=e106]:
              - generic [ref=e107]:
                - strong [ref=e108]: Harm
                - generic [ref=e109]: 0/5
              - generic [ref=e110]:
                - button "Harm 1" [ref=e111] [cursor=pointer]
                - button "Harm 2" [ref=e112] [cursor=pointer]
                - button "Harm 3" [ref=e113] [cursor=pointer]
                - button "Harm 4" [ref=e114] [cursor=pointer]
                - button "Harm 5" [ref=e115] [cursor=pointer]
              - paragraph [ref=e116]: "Condition: Fine"
            - article [ref=e117]:
              - generic [ref=e118]:
                - strong [ref=e119]: Stability
                - generic [ref=e120]: 10/10
              - generic [ref=e121]:
                - button "Stability 1" [ref=e122] [cursor=pointer]
                - button "Stability 2" [ref=e123] [cursor=pointer]
                - button "Stability 3" [ref=e124] [cursor=pointer]
                - button "Stability 4" [ref=e125] [cursor=pointer]
                - button "Stability 5" [ref=e126] [cursor=pointer]
                - button "Stability 6" [ref=e127] [cursor=pointer]
                - button "Stability 7" [ref=e128] [cursor=pointer]
                - button "Stability 8" [ref=e129] [cursor=pointer]
                - button "Stability 9" [ref=e130] [cursor=pointer]
                - button "Stability 10" [ref=e131] [cursor=pointer]
              - paragraph [ref=e132]: "Band: Calm"
        - generic [ref=e133]:
          - generic [ref=e134]:
            - article [ref=e135]:
              - paragraph [ref=e136]: Attributes
              - generic [ref=e137]:
                - article [ref=e138]:
                  - button "Body" [ref=e139] [cursor=pointer]
                  - generic [ref=e140]:
                    - button "Body 1" [disabled] [ref=e141]
                    - button "Body 2" [disabled] [ref=e142]
                    - button "Body 3" [disabled] [ref=e143]
                    - button "Body 4" [disabled] [ref=e144]
                    - button "Body 5" [disabled] [ref=e145]
                - article [ref=e146]:
                  - button "Agility" [ref=e147] [cursor=pointer]
                  - generic [ref=e148]:
                    - button "Agility 1" [disabled] [ref=e149]
                    - button "Agility 2" [disabled] [ref=e150]
                    - button "Agility 3" [disabled] [ref=e151]
                    - button "Agility 4" [disabled] [ref=e152]
                    - button "Agility 5" [disabled] [ref=e153]
                - article [ref=e154]:
                  - button "Mind" [ref=e155] [cursor=pointer]
                  - generic [ref=e156]:
                    - button "Mind 1" [disabled] [ref=e157]
                    - button "Mind 2" [disabled] [ref=e158]
                    - button "Mind 3" [disabled] [ref=e159]
                    - button "Mind 4" [disabled] [ref=e160]
                    - button "Mind 5" [disabled] [ref=e161]
                - article [ref=e162]:
                  - button "Instinct" [ref=e163] [cursor=pointer]
                  - generic [ref=e164]:
                    - button "Instinct 1" [disabled] [ref=e165]
                    - button "Instinct 2" [disabled] [ref=e166]
                    - button "Instinct 3" [disabled] [ref=e167]
                    - button "Instinct 4" [disabled] [ref=e168]
                    - button "Instinct 5" [disabled] [ref=e169]
                - article [ref=e170]:
                  - button "Presence" [ref=e171] [cursor=pointer]
                  - generic [ref=e172]:
                    - button "Presence 1" [disabled] [ref=e173]
                    - button "Presence 2" [disabled] [ref=e174]
                    - button "Presence 3" [disabled] [ref=e175]
                    - button "Presence 4" [disabled] [ref=e176]
                    - button "Presence 5" [disabled] [ref=e177]
                - article [ref=e178]:
                  - button "Nerves" [ref=e179] [cursor=pointer]
                  - generic [ref=e180]:
                    - button "Nerves 1" [disabled] [ref=e181]
                    - button "Nerves 2" [disabled] [ref=e182]
                    - button "Nerves 3" [disabled] [ref=e183]
                    - button "Nerves 4" [disabled] [ref=e184]
                    - button "Nerves 5" [disabled] [ref=e185]
            - article [ref=e186]:
              - paragraph [ref=e187]: Skill Summary
              - paragraph [ref=e189]: No trained skills assigned.
          - generic [ref=e190]:
            - article [ref=e191]:
              - paragraph [ref=e192]: Active Misfire
              - generic [ref=e193]:
                - text: Current consequence
                - textbox "Current consequence" [ref=e194]:
                  - /placeholder: Describe the wrong-success consequence currently in play.
              - button "Clear Active Misfire" [ref=e195] [cursor=pointer]
              - generic [ref=e196]:
                - text: Misfires recorded
                - textbox "Misfires recorded" [ref=e197]:
                  - /placeholder: Consequence, flavor, who noticed.
            - article [ref=e198]:
              - paragraph [ref=e199]: Recovery
              - group [ref=e200]:
                - generic [ref=e201]:
                  - checkbox "Ground" [ref=e202]
                  - text: Ground
                - generic [ref=e203]:
                  - checkbox "Breathe" [ref=e204]
                  - text: Breathe
                - generic [ref=e205]:
                  - checkbox "Connect" [ref=e206]
                  - text: Connect
                - generic [ref=e207]:
                  - checkbox "Leave" [ref=e208]
                  - text: Leave
                - generic [ref=e209]:
                  - checkbox "Name It" [ref=e210]
                  - text: Name It
        - article [ref=e211]:
          - paragraph [ref=e212]: Immediate Notes
          - textbox "Scene facts, table reminders, current risk." [ref=e213]
    - region "Local data controls" [ref=e214]:
      - generic [ref=e215]:
        - paragraph [ref=e216]: LOCAL RECORD CONTROLS
        - paragraph [ref=e217]: Local console record held in this browser.
      - generic [ref=e218]:
        - button "Export Operator Record" [ref=e219] [cursor=pointer]
        - generic [ref=e220] [cursor=pointer]:
          - text: Import Operator Record
          - button "Import Operator Record" [ref=e221]
        - button "Authorized Unlocks" [ref=e222] [cursor=pointer]
        - button "Export Local Console Record" [ref=e223] [cursor=pointer]
        - generic [ref=e224] [cursor=pointer]:
          - text: Import Local Console Record
          - button "Import Local Console Record" [ref=e225]
        - button "Purge Local Console" [ref=e226] [cursor=pointer]
        - link "Return to Intake" [ref=e227] [cursor=pointer]:
          - /url: ../
```

# Test source

```ts
  156 |   const nav = page.getByRole("navigation", { name: "Surface files" });
  157 |   await nav.getByText("CASE FILE").click();
  158 | 
  159 |   const preview = page.locator("#casefile-drawer");
  160 |   await expect(preview.getByText("Mara Vale")).toBeVisible();
  161 |   await expect(preview.getByText("Silence")).toBeVisible();
  162 |   await expect(preview.getByText("Viridian House")).toBeVisible();
  163 |   await expect(preview.getByText("8/10")).toBeVisible();
  164 |   await expect(preview.getByText("2/5")).toBeVisible();
  165 |   await expect(preview.getByText("Investigation 2 // Occult 1")).toBeVisible();
  166 | });
  167 | 
  168 | test("home case file grounds intake record with operator file data", async ({ page }) => {
  169 |   await page.addInitScript(() => {
  170 |     window.localStorage.setItem("veildaemon.operatorRecord.v2", JSON.stringify({
  171 |       designation: "RECORD-MV-7",
  172 |       primaryFrequency: "Silence",
  173 |       observerClassification: "POTENTIAL OPERATOR",
  174 |       attentionStatus: "NOTED",
  175 |       accessLevel: "INTAKE ACCEPTED",
  176 |       assignmentGroup: "THE REDACTED",
  177 |       handlerSignal: "SHADE",
  178 |       archiveAuthority: "VEILCORP",
  179 |       intakeNode: "VEILDAEMON",
  180 |       observedTraits: [],
  181 |       frequencyDrift: [{ frequency: "Silence", value: 2 }],
  182 |       knownIncidents: ["Silence Gap"],
  183 |       incidentExposure: ["Silence Gap"],
  184 |       archiveFlags: ["OBSERVED: Operator Intake"],
  185 |       relatedRecords: [],
  186 |       recommendedTraining: "Document absences.",
  187 |       archiveRoute: "https://wiki.veildaemon.app/",
  188 |       classificationHistory: [],
  189 |       visits: 1,
  190 |       filesReviewed: 2,
  191 |       lastSeen: new Date().toISOString(),
  192 |       lastActivity: new Date().toISOString()
  193 |     }));
  194 |     window.localStorage.setItem("veildaemon.operatorConsole.v1", JSON.stringify({
  195 |       version: 1,
  196 |       operatorStatus: {
  197 |         operatorName: "Mara Vale",
  198 |         activeNeedlepoint: "Viridian House",
  199 |         stability: "8",
  200 |         harmBoxes: "2",
  201 |         voidMarks: "4",
  202 |         breachPoints: "9",
  203 |         attributes: { Body: "1", Mind: "3" },
  204 |         skills: { Investigation: "2" }
  205 |       }
  206 |     }));
  207 |   });
  208 | 
  209 |   await page.goto("/");
  210 |   await page.getByRole("navigation", { name: "Surface files" }).getByText("CASE FILE").click();
  211 | 
  212 |   const caseFile = page.locator("#casefile-drawer");
  213 |   await expect(caseFile.getByText("Mara Vale")).toBeVisible();
  214 |   await expect(caseFile.getByText("Viridian House")).toBeVisible();
  215 |   await expect(caseFile.getByText("8/10")).toBeVisible();
  216 |   await expect(caseFile.getByText("4 / 9")).toBeVisible();
  217 |   await expect(caseFile.getByText("Investigation 2")).toBeVisible();
  218 | });
  219 | 
  220 | test("empty home case file opens intake", async ({ page }) => {
  221 |   await page.goto("/");
  222 |   const nav = page.getByRole("navigation", { name: "Surface files" });
  223 |   await nav.getByText("CASE FILE").click();
  224 | 
  225 |   await expect(page.locator("#casefile-empty")).toBeVisible();
  226 |   await page.getByRole("button", { name: "Complete Intake" }).click();
  227 | 
  228 |   await expect(page.locator("#intake-node")).toBeVisible();
  229 |   await expect(page.locator("#casefile-drawer")).not.toBeVisible();
  230 | });
  231 | 
  232 | test("empty subpage case file offers intake route", async ({ page }) => {
  233 |   await page.goto("/updates/");
  234 |   await page.getByRole("navigation", { name: "Surface files" }).getByText("CASE FILE").click();
  235 | 
  236 |   const caseFile = page.locator("#casefile-drawer");
  237 |   await expect(caseFile.getByText("INTAKE REQUIRED")).toBeVisible();
  238 |   await expect(caseFile.getByRole("link", { name: "Complete Intake" })).toHaveAttribute("href", "/#intake-node");
  239 | });
  240 | 
  241 | test("operator file edits sync into local record preview on other surfaces", async ({ page }) => {
  242 |   await page.addInitScript(() => {
  243 |     window.localStorage.setItem("veildaemon.operatorRecord.v2", JSON.stringify({
  244 |       designation: "SYNC-OP",
  245 |       primaryFrequency: "Dream",
  246 |       observerClassification: "Operator",
  247 |       attentionStatus: "Local",
  248 |       accessLevel: "LOCAL"
  249 |     }));
  250 |   });
  251 |   await page.goto("/operator/");
  252 | 
  253 |   await page.getByRole("button", { name: "Sheet" }).click();
  254 |   await page.locator('[name="operatorName"]').fill("June Rook");
  255 |   await page.locator('[name="activeNeedlepoint"]').fill("Silence Gap");
> 256 |   await page.locator('[name="voidMarks"]').fill("3");
      |                                            ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  257 |   await page.locator('[name="breachPoints"]').fill("7");
  258 | 
  259 |   await page.goto("/debrief/");
  260 |   const nav = page.getByRole("navigation", { name: "Surface files" });
  261 |   await nav.getByText("CASE FILE").click();
  262 | 
  263 |   const preview = page.locator("#casefile-drawer");
  264 |   await expect(preview.getByText("June Rook")).toBeVisible();
  265 |   await expect(preview.getByText("Silence Gap")).toBeVisible();
  266 |   await expect(preview.getByText("3 / 7")).toBeVisible();
  267 | });
  268 | 
  269 | test("shift clicking file tabs bypasses preview and routes directly", async ({ page }) => {
  270 |   await page.goto("/updates/");
  271 | 
  272 |   const nav = page.getByRole("navigation", { name: "Surface files" });
  273 |   await nav.getByText("OPERATOR FILE").click();
  274 |   await expect(page.locator("#operator-preview")).toBeVisible();
  275 | 
  276 |   await page.goto("/updates/");
  277 |   await nav.getByText("OPERATOR FILE").click({ modifiers: ["Shift"] });
  278 |   await expect(page).toHaveURL(/\/operator\/$/);
  279 | 
  280 |   await page.goto("/updates/");
  281 |   await page.getByRole("navigation", { name: "Surface files" }).getByText("REPORTS").click({ modifiers: ["Shift"] });
  282 |   await expect(page).toHaveURL(/\/recovered-operator-reports\/$/);
  283 | });
  284 | 
  285 | test("surface drawers allow only one open preview", async ({ page }) => {
  286 |   await page.setViewportSize({ width: 2200, height: 1000 });
  287 |   await page.goto("/");
  288 | 
  289 |   const nav = page.getByRole("navigation", { name: "Surface files" });
  290 |   await nav.getByText("OPERATOR FILE").click();
  291 |   await expect(page.locator("#operator-preview")).toBeVisible();
  292 | 
  293 |   await nav.getByText("REPORTS").click();
  294 |   await expect(page.locator("#operator-preview")).not.toBeVisible();
  295 |   await expect(page.locator("#recovered-reports-drawer")).toBeVisible();
  296 | });
  297 | 
  298 | test("home operator drawer moves the tab rack to the open file rail", async ({ page }) => {
  299 |   await page.setViewportSize({ width: 2200, height: 1000 });
  300 |   await page.goto("/");
  301 | 
  302 |   await page.getByRole("navigation", { name: "Surface files" }).getByText("OPERATOR FILE").click();
  303 |   await expect(page.locator("#operator-preview")).toBeVisible();
  304 |   await page.waitForTimeout(300);
  305 | 
  306 |   const rects = await page.evaluate(() => {
  307 |     const tabs = document.querySelector(".surface-tabs")?.getBoundingClientRect();
  308 |     const drawer = document.querySelector("#operator-preview")?.getBoundingClientRect();
  309 |     return {
  310 |       tabLeft: tabs?.left || 0,
  311 |       drawerRight: drawer?.right || 0
  312 |     };
  313 |   });
  314 | 
  315 |   expect(Math.abs(rects.tabLeft - rects.drawerRight)).toBeLessThanOrEqual(2);
  316 | });
  317 | 
  318 | test("operator file tab toggles the open drawer closed", async ({ page }) => {
  319 |   await page.setViewportSize({ width: 2600, height: 1000 });
  320 |   await page.goto("/updates/");
  321 | 
  322 |   const nav = page.getByRole("navigation", { name: "Surface files" });
  323 |   await nav.getByText("OPERATOR FILE").click();
  324 |   await expect(page.locator("#operator-preview")).toBeVisible();
  325 | 
  326 |   await nav.getByText("OPERATOR FILE").click();
  327 |   await expect(page.locator("#operator-preview")).not.toBeVisible();
  328 |   await expect(page).not.toHaveURL(/#operator-preview$/);
  329 | });
  330 | 
  331 | test("operator drawer close restores the tab rack to the terminal rail", async ({ page }) => {
  332 |   await page.setViewportSize({ width: 2600, height: 1000 });
  333 |   await page.goto("/updates/");
  334 | 
  335 |   const nav = page.getByRole("navigation", { name: "Surface files" });
  336 |   await nav.getByText("OPERATOR FILE").click();
  337 |   await expect(page.locator("#operator-preview")).toBeVisible();
  338 | 
  339 |   await page.locator("#operator-preview").getByRole("link", { name: "Close" }).click();
  340 |   await expect(page.locator("#operator-preview")).not.toBeVisible();
  341 | 
  342 |   const rects = await page.evaluate(() => {
  343 |     const tabs = document.querySelector(".surface-tabs")?.getBoundingClientRect();
  344 |     const terminal = document.querySelector(".report-terminal")?.getBoundingClientRect();
  345 |     return {
  346 |       tabLeft: tabs?.left || 0,
  347 |       terminalRight: terminal?.right || 0
  348 |     };
  349 |   });
  350 | 
  351 |   expect(Math.abs(rects.tabLeft - rects.terminalRight)).toBeLessThanOrEqual(2);
  352 | });
  353 | 
  354 | test("desktop drawers pan politely when opened", async ({ page }) => {
  355 |   await page.setViewportSize({ width: 1400, height: 900 });
  356 | 
```