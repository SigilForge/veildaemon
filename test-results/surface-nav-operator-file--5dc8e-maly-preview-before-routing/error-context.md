# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: surface-nav.spec.js >> operator file opens local anomaly preview before routing
- Location: F:\veildaemon\tests\browser\surface-nav.spec.js:23:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('#operator-preview').getByText('LOCAL OPERATOR RECORD')
Expected: visible
Error: strict mode violation: locator('#operator-preview').getByText('LOCAL OPERATOR RECORD') resolved to 2 elements:
    1) <h3>LOCAL OPERATOR RECORD</h3> aka getByRole('heading', { name: 'LOCAL OPERATOR RECORD' })
    2) <p class="kicker">LOCAL OPERATOR RECORD</p> aka getByLabel('Anomaly log preview').getByText('LOCAL OPERATOR RECORD')

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('#operator-preview').getByText('LOCAL OPERATOR RECORD')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main "VeilDaemon interface" [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - img "VeilCorp Archives sigil" [ref=e6]
        - generic [ref=e7]:
          - paragraph [ref=e8]: VEILCORP // PRE-FOUNDATION INTAKE NODE
          - heading "VEILDAEMON" [level=1] [ref=e9]
          - paragraph [ref=e10]: Shade interface active. Human authorization partial. Survival authorization active.
      - generic [ref=e11]:
        - paragraph [ref=e12]: "> We noticed you noticing."
        - paragraph [ref=e13]: "> This intake node became public before authorization was complete."
        - paragraph [ref=e14]: "> If you were looking for answers, proceed carefully."
        - paragraph [ref=e15]: "> If you were not looking for answers, you are already late."
        - paragraph [ref=e16]: "> Observation creates relevance. Continued attention may require classification."
      - navigation "First contact routes" [ref=e17]:
        - button "Begin Operator Intake" [ref=e18] [cursor=pointer]:
          - img [ref=e19]
          - generic [ref=e20]: Begin Operator Intake
        - link "Read Archive" [ref=e21] [cursor=pointer]:
          - /url: https://wiki.veildaemon.app/
          - img [ref=e22]
          - generic [ref=e23]: Read Archive
        - link "Play Case File" [ref=e24] [cursor=pointer]:
          - /url: https://the-cradlepoint-archives.itch.io/needlepoint
          - img [ref=e25]
          - generic [ref=e26]: Play Case File
      - paragraph [ref=e27]: "> If you are uncertain where to begin, begin with intake. Uncertainty is a valid signal."
      - region "Latest System Notice" [ref=e28]:
        - generic [ref=e29]:
          - generic [ref=e30]: 2026-06-21
          - strong [ref=e31]: "STATUS: ACTIVE"
        - generic [ref=e32]:
          - paragraph [ref=e33]: LATEST SYSTEM NOTICE
          - heading "PUBLIC ACCESS EXPANSION CONFIRMED" [level=2] [ref=e34]
          - paragraph [ref=e35]: The Personal Operations Node, after-action review channel, and anomaly recovery channel are now active. Records remain local unless the Operator authorizes transfer.
        - navigation "Latest notice routes" [ref=e36]:
          - link "Initialize Record" [ref=e37] [cursor=pointer]:
            - /url: /#intake-node
            - generic [ref=e38]: Initialize Record
          - link "Read Notice" [ref=e39] [cursor=pointer]:
            - /url: /updates/
            - generic [ref=e40]: Read Notice
          - link "Read Devlog" [ref=e41] [cursor=pointer]:
            - /url: https://the-cradlepoint-archives.itch.io/needlepoint/devlog
            - generic [ref=e42]: Read Devlog
      - region "Public safety advisory" [ref=e43]:
        - paragraph [ref=e44]: PUBLIC SAFETY ADVISORY
        - paragraph [ref=e45]: "> If a familiar voice gives unfamiliar instructions, document the exact wording."
      - region "Primary Feed latest transmission" [ref=e46]:
        - generic [ref=e47]:
          - paragraph [ref=e48]: PRIMARY FEED // PUBLIC-SAFETY TRANSMISSIONS
          - heading "Recovered Files" [level=2] [ref=e49]
          - paragraph [ref=e50]: Recorded transmissions are separate from intake. Playback may increase observer relevance.
        - button "Open Transmission Viewer" [ref=e51] [cursor=pointer]:
          - img [ref=e52]
          - generic [ref=e53]: Open Transmission Viewer
      - region "VeilCorp status indicators" [ref=e54]:
        - generic [ref=e55]:
          - paragraph [ref=e56]: VEILCORP STATUS // SYSTEMS NOT FINAL
          - heading "Activation State" [level=2] [ref=e57]
          - paragraph [ref=e58]: You have reached an active VeilCorp intake node. Operational status remains disputed.
        - generic "System status" [ref=e59]:
          - generic [ref=e60]:
            - generic [ref=e61]: INTERFACE
            - strong [ref=e62]: SHADE.DAEMON
          - generic [ref=e63]:
            - generic [ref=e64]: AUTHORITY
            - strong [ref=e65]: PARTIAL / WITHHELD
          - generic [ref=e66]:
            - generic [ref=e67]: PROCEDURE
            - strong [ref=e68]: INTAKE ACTIVE
          - generic [ref=e69]:
            - generic [ref=e70]: OPERATIONS
            - strong [ref=e71]: DAY WATCH
          - generic [ref=e72]:
            - generic [ref=e73]: OBSERVER
            - strong [ref=e74]: NOTICED
      - region "VeilDaemon command channel" [ref=e75]:
        - generic [ref=e76]:
          - paragraph [ref=e77]: VEILDAEMON COMMAND CHANNEL // LIMITED PUBLIC INTERFACE
          - heading "Command Channel" [level=2] [ref=e78]
          - paragraph [ref=e79]: Useful commands route observers. Unhelpful commands increase confidence in automation.
        - paragraph [ref=e81]: "> Command channel listening. Try help."
        - generic [ref=e82]:
          - generic [ref=e83]: ">"
          - textbox ">" [ref=e84]:
            - /placeholder: scan, ping, trace, decrypt, stabilize, open, help
          - button "Send" [ref=e85] [cursor=pointer]
        - region "Recovered artifacts" [ref=e86]:
          - generic [ref=e87]:
            - paragraph [ref=e88]: RECOVERED ARTIFACTS // LOCAL CACHE
            - paragraph [ref=e89]: 0 / 5 UNSEALED
          - generic [ref=e90]:
            - article [ref=e91]:
              - generic [ref=e92]: "01"
              - generic [ref=e93]: SEALED
            - article [ref=e94]:
              - generic [ref=e95]: "02"
              - generic [ref=e96]: SEALED
            - article [ref=e97]:
              - generic [ref=e98]: "03"
              - generic [ref=e99]: SEALED
            - article [ref=e100]:
              - generic [ref=e101]: "04"
              - generic [ref=e102]: SEALED
            - article [ref=e103]:
              - generic [ref=e104]: "05"
              - generic [ref=e105]: SEALED
      - generic [ref=e106]:
        - paragraph [ref=e107]: OBSERVATION CREATES RELEVANCE
        - paragraph [ref=e108]: SYSTEM ACTIVATED BEFORE APPROVAL // INFRASTRUCTURE BEFORE PERMISSION
      - text: "STATUS: AWAKE"
  - navigation "Surface files" [ref=e109]:
    - button "CASE FILE NO LOCAL RECORD" [ref=e110] [cursor=pointer]:
      - generic [ref=e111]: CASE FILE
      - strong [ref=e112]: NO LOCAL RECORD
    - link "OPERATOR FILE LOCAL NODE" [ref=e113] [cursor=pointer]:
      - /url: "#operator-preview"
      - generic [ref=e114]: OPERATOR FILE
      - strong [ref=e115]: LOCAL NODE
    - button "REPORTS PUBLIC INDEX" [ref=e116] [cursor=pointer]:
      - generic [ref=e117]: REPORTS
      - strong [ref=e118]: PUBLIC INDEX
  - complementary "Local operator record" [ref=e119]:
    - generic [ref=e120]:
      - generic [ref=e121]:
        - generic [ref=e122]:
          - paragraph [ref=e123]: VEILDAEMON // LOCAL NODE
          - heading "LOCAL OPERATOR RECORD" [level=3] [ref=e124]
        - link "Close" [ref=e125] [cursor=pointer]:
          - /url: "#surface-files"
          - generic [ref=e126]: Close
      - generic "Anomaly log preview" [ref=e127]:
        - paragraph [ref=e128]: LOCAL OPERATOR RECORD
        - heading "UNNAMED OPERATOR" [level=2] [ref=e129]
        - generic [ref=e130]:
          - generic [ref=e131]: DESIGNATION
          - strong [ref=e132]: UNINITIALIZED
        - generic [ref=e133]:
          - generic [ref=e134]: PRIMARY FREQUENCY
          - strong [ref=e135]: UNASSIGNED
        - generic [ref=e136]:
          - generic [ref=e137]: ACTIVE CASE
          - strong [ref=e138]: NO ACTIVE CASE
        - generic [ref=e139]:
          - generic [ref=e140]: STABILITY
          - strong [ref=e141]: UNMEASURED
        - generic [ref=e142]:
          - generic [ref=e143]: HARM
          - strong [ref=e144]: NONE RECORDED
        - generic [ref=e145]:
          - generic [ref=e146]: ATTENTION
          - strong [ref=e147]: UNMEASURED
        - generic [ref=e148]:
          - generic [ref=e149]: MISFIRE
          - strong [ref=e150]: NONE
        - generic [ref=e151]:
          - generic [ref=e152]: VOID / BREACH
          - strong [ref=e153]: 0 / 0
        - generic [ref=e154]:
          - generic [ref=e155]: ATTRIBUTES
          - strong [ref=e156]: BASELINE UNRECORDED
        - generic [ref=e157]:
          - generic [ref=e158]: TRACKED SKILLS
          - strong [ref=e159]: NO SKILLS TRACKED
        - paragraph [ref=e160]: "> Local browser record only. Edit the personal file to change this snapshot."
      - navigation "Operator file routes" [ref=e161]:
        - link "Edit Personal File" [ref=e162] [cursor=pointer]:
          - /url: /operator/
          - generic [ref=e163]: Edit Personal File
```

# Test source

```ts
  1   | const { test, expect } = require("@playwright/test");
  2   | 
  3   | const publicSurfaces = {
  4   |   "/": ["CASE FILE", "OPERATOR FILE", "REPORTS"],
  5   |   "/operator/": ["CASE FILE", "HOME", "REPORTS"],
  6   |   "/debrief/": ["CASE FILE", "OPERATOR FILE", "HOME"],
  7   |   "/recovered-operator-reports/": ["CASE FILE", "OPERATOR FILE", "HOME"],
  8   |   "/updates/": ["CASE FILE", "OPERATOR FILE", "REPORTS", "HOME"]
  9   | };
  10  | 
  11  | for (const [path, labels] of Object.entries(publicSurfaces)) {
  12  |   test(`surface navigation is visible on ${path}`, async ({ page }) => {
  13  |     await page.goto(path);
  14  | 
  15  |     const nav = page.getByRole("navigation", { name: "Surface files" });
  16  |     await expect(nav).toBeVisible();
  17  |     for (const label of labels) {
  18  |       await expect(nav.getByText(label, { exact: true })).toBeVisible();
  19  |     }
  20  |   });
  21  | }
  22  | 
  23  | test("operator file opens local anomaly preview before routing", async ({ page }) => {
  24  |   await page.goto("/");
  25  | 
  26  |   const nav = page.getByRole("navigation", { name: "Surface files" });
  27  |   await nav.getByText("OPERATOR FILE").click();
  28  | 
  29  |   const preview = page.locator("#operator-preview");
  30  |   await expect(preview).toBeVisible();
> 31  |   await expect(preview.getByText("LOCAL OPERATOR RECORD")).toBeVisible();
      |                                                            ^ Error: expect(locator).toBeVisible() failed
  32  |   await expect(preview.getByText("DESIGNATION")).toBeVisible();
  33  |   await expect(preview.getByRole("link", { name: "Edit Personal File" })).toHaveAttribute("href", "/operator/");
  34  | });
  35  | 
  36  | test("local operator record preview mirrors saved operator file fields", async ({ page }) => {
  37  |   await page.addInitScript(() => {
  38  |     window.localStorage.setItem("veildaemon.operatorConsole.v1", JSON.stringify({
  39  |       version: 1,
  40  |       operatorStatus: {
  41  |         operatorName: "Mara Vale",
  42  |         designation: "RECORD-MV-7",
  43  |         activeNeedlepoint: "Viridian House",
  44  |         stability: "8",
  45  |         harmBoxes: "2",
  46  |         attentionState: "Noted",
  47  |         misfireSeverity: "Minor",
  48  |         voidMarks: "4",
  49  |         breachPoints: "9",
  50  |         attributes: { Body: "1", Agility: "2", Mind: "3" },
  51  |         skills: { Investigation: "2", Occult: "1" }
  52  |       }
  53  |     }));
  54  |     window.localStorage.setItem("veildaemon.operatorRecord.v2", JSON.stringify({
  55  |       designation: "RECORD-MV-7",
  56  |       primaryFrequency: "Silence",
  57  |       observerClassification: "POTENTIAL OPERATOR",
  58  |       attentionStatus: "NOTED"
  59  |     }));
  60  |   });
  61  | 
  62  |   await page.goto("/updates/");
  63  |   const nav = page.getByRole("navigation", { name: "Surface files" });
  64  |   await nav.getByText("OPERATOR FILE").click();
  65  | 
  66  |   const preview = page.locator("#operator-preview");
  67  |   await expect(preview.getByText("Mara Vale")).toBeVisible();
  68  |   await expect(preview.getByText("Silence")).toBeVisible();
  69  |   await expect(preview.getByText("Viridian House")).toBeVisible();
  70  |   await expect(preview.getByText("8/10")).toBeVisible();
  71  |   await expect(preview.getByText("2/5")).toBeVisible();
  72  |   await expect(preview.getByText("Investigation 2 // Occult 1")).toBeVisible();
  73  | });
  74  | 
  75  | test("surface drawers allow only one open preview", async ({ page }) => {
  76  |   await page.setViewportSize({ width: 2200, height: 1000 });
  77  |   await page.goto("/");
  78  | 
  79  |   const nav = page.getByRole("navigation", { name: "Surface files" });
  80  |   await nav.getByText("OPERATOR FILE").click();
  81  |   await expect(page.locator("#operator-preview")).toBeVisible();
  82  | 
  83  |   await nav.getByText("REPORTS").click();
  84  |   await expect(page.locator("#operator-preview")).not.toBeVisible();
  85  |   await expect(page.locator("#recovered-reports-drawer")).toBeVisible();
  86  | });
  87  | 
  88  | test("secondary surface tabs stay inside the console model", async ({ page }) => {
  89  |   for (const path of ["/operator/", "/debrief/", "/recovered-operator-reports/", "/updates/"]) {
  90  |     await page.goto(path);
  91  | 
  92  |     const links = await page.locator(".surface-tabs .surface-tab").evaluateAll((tabs) =>
  93  |       tabs.map((tab) => ({
  94  |         label: tab.querySelector("span")?.textContent?.trim(),
  95  |         detail: tab.querySelector("strong")?.textContent?.trim(),
  96  |         href: tab.getAttribute("href")
  97  |       }))
  98  |     );
  99  | 
  100 |     expect(links.find((link) => link.label === "CASE FILE")?.href).toBe("#casefile-drawer");
  101 |     expect(links.find((link) => link.label === "HOME")?.href).toBe("/");
  102 |     expect(links.some((link) => link.href?.includes("itch.io"))).toBe(false);
  103 |   }
  104 | 
  105 |   await page.goto("/operator/");
  106 |   await expect(page.locator(".surface-tabs .return-main-tab")).toHaveAttribute("href", "/");
  107 |   await expect(page.locator(".surface-tabs .return-main-tab strong")).toHaveText("RETURN HOME");
  108 |   await expect(page.locator("#casefile-drawer")).not.toBeVisible();
  109 |   await page.getByRole("navigation", { name: "Surface files" }).getByText("CASE FILE").click();
  110 |   await expect(page.locator("#casefile-drawer")).toBeVisible();
  111 | 
  112 |   for (const path of ["/debrief/", "/recovered-operator-reports/", "/updates/"]) {
  113 |     await page.goto(path);
  114 |     const nav = page.getByRole("navigation", { name: "Surface files" });
  115 |     await expect(nav.locator(".active-case-tab")).toHaveAttribute("href", "#operator-preview");
  116 |     await nav.getByText("OPERATOR FILE").click();
  117 |     await expect(page.locator("#operator-preview")).toBeVisible();
  118 |   }
  119 | 
  120 |   await page.goto("/recovered-operator-reports/");
  121 |   await expect(page.locator(".surface-tabs .return-main-tab")).toHaveAttribute("href", "/");
  122 |   await expect(page.locator(".surface-tabs .return-main-tab strong")).toHaveText("RETURN HOME");
  123 | });
  124 | 
  125 | test("preview panels normalize to the surface tab rack", async ({ page }) => {
  126 |   await page.goto("/");
  127 | 
  128 |   const nav = page.getByRole("navigation", { name: "Surface files" });
  129 |   await nav.getByText("CASE FILE").click();
  130 | 
  131 |   const homeHeights = await page.evaluate(() => {
```