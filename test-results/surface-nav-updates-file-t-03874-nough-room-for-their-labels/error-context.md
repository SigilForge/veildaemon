# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: surface-nav.spec.js >> updates file tabs have enough room for their labels
- Location: tests/browser/surface-nav.spec.js:499:1

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 153
Received:    151
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - navigation "Surface files" [ref=e2]:
    - link "CASE FILE NEEDLEPOINT" [ref=e3] [cursor=pointer]:
      - /url: "#casefile-drawer"
      - generic [ref=e4]: CASE FILE
      - strong [ref=e5]: NEEDLEPOINT
    - link "OPERATOR FILE START INTAKE" [ref=e6] [cursor=pointer]:
      - /url: "#operator-preview"
      - generic [ref=e7]: OPERATOR FILE
      - strong [ref=e8]: START INTAKE
    - link "REPORTS PUBLIC INDEX" [ref=e9] [cursor=pointer]:
      - /url: "#recovered-reports-drawer"
      - generic [ref=e10]: REPORTS
      - strong [ref=e11]: PUBLIC INDEX
    - link "HOME RETURN HOME" [ref=e12] [cursor=pointer]:
      - /url: /
      - generic [ref=e13]: HOME
      - strong [ref=e14]: RETURN HOME
  - main "System Notices" [ref=e15]:
    - generic [ref=e16]:
      - generic [ref=e17]:
        - img "VeilCorp Archives sigil" [ref=e19]
        - generic [ref=e20]:
          - paragraph [ref=e21]: VEILDAEMON // SYSTEM NOTICES
          - heading "SYSTEM NOTICES" [level=1] [ref=e22]
          - paragraph [ref=e23]: Operational changes remain visible. Returning observers may compare current procedure against prior activation states.
      - generic [ref=e24]:
        - paragraph [ref=e25]: "> Notice archive open."
        - paragraph [ref=e26]: "> Infrastructure changes are retained for observer orientation."
        - paragraph [ref=e27]: "> New surfaces may alter classification, field tracking, recovery review, or archive routing."
      - region "System notice archive" [ref=e28]:
        - article [ref=e29]:
          - generic [ref=e30]:
            - generic [ref=e31]: 2026-06-21
            - strong [ref=e32]: "STATUS: ACTIVE"
          - generic [ref=e33]:
            - paragraph [ref=e34]: VEILCORP SYSTEM NOTICE
            - heading "PUBLIC ACCESS EXPANSION CONFIRMED" [level=2] [ref=e35]
            - generic [ref=e36]:
              - paragraph [ref=e37]: The Personal Operations Node is now active.
              - paragraph [ref=e38]: Operators may initialize a complete field record, document Attributes and Skills, map Frequency development, track operational pressure, and preserve case activity through a single interface.
              - paragraph [ref=e39]: Records remain local to the Operator's device.
              - paragraph [ref=e40]: They may be exported, uploaded for later recovery, or purged entirely.
              - paragraph [ref=e41]: Nothing is transmitted upstream without authorization.
              - 'heading "AFTER-ACTION REVIEW CHANNEL: ACTIVE" [level=3] [ref=e42]'
              - paragraph [ref=e43]: Operators may now submit Needlepoint debriefs through the VeilCorp review system. Sensitive information is identified and redacted before submission. The Operator sees the proposed public record before approving transmission.
              - paragraph [ref=e44]: Authorized reports receive a second review before archival release.
              - 'heading "ANOMALY RECOVERY CHANNEL: ACTIVE" [level=3] [ref=e45]'
              - paragraph [ref=e46]: Anomalies may be recorded privately inside the Personal Operations Node. Operators may also volunteer a copy for VeilCorp analysis.
              - paragraph [ref=e47]: Local observation is not automatic consent.
              - paragraph [ref=e48]: You decide what crosses the threshold.
              - paragraph [ref=e49]: We noticed you noticing.
              - paragraph [ref=e50]: Now you can keep a record of what noticed you back.
          - navigation "Personal Operations Node routes" [ref=e51]:
            - link "Initialize Record" [ref=e52] [cursor=pointer]:
              - /url: ../#intake-node
              - generic [ref=e53]: Initialize Record
            - link "Submit Debrief" [ref=e54] [cursor=pointer]:
              - /url: ../debrief/
              - generic [ref=e55]: Submit Debrief
            - link "Read Devlog" [ref=e56] [cursor=pointer]:
              - /url: https://the-cradlepoint-archives.itch.io/needlepoint/devlog
              - generic [ref=e57]: Read Devlog
        - article [ref=e58]:
          - generic [ref=e59]:
            - generic [ref=e60]: 2026-06-20
            - strong [ref=e61]: "STATUS: REVIEW"
          - generic [ref=e62]:
            - paragraph [ref=e63]: SYSTEM NOTICE
            - heading "RECOVERED OPERATOR REPORTS OPENED" [level=2] [ref=e64]
            - paragraph [ref=e65]: Private Needlepoint debrief intake, redaction review, manual approval, recovered report indexing, and public archive statistics are now routed through VeilCorp recovery channels.
          - navigation "Recovered Operator Reports routes" [ref=e66]:
            - link "Open Index" [ref=e67] [cursor=pointer]:
              - /url: ../recovered-operator-reports/
              - generic [ref=e68]: Open Index
            - link "Submit Debrief" [ref=e69] [cursor=pointer]:
              - /url: ../debrief/
              - generic [ref=e70]: Submit Debrief
            - link "Read Devlog" [ref=e71] [cursor=pointer]:
              - /url: https://the-cradlepoint-archives.itch.io/needlepoint/devlog
              - generic [ref=e72]: Read Devlog
        - article [ref=e73]:
          - generic [ref=e74]:
            - generic [ref=e75]: 2026-06-17
            - strong [ref=e76]: "STATUS: STABILIZED"
          - generic [ref=e77]:
            - paragraph [ref=e78]: SYSTEM NOTICE
            - heading "COMMAND CACHE RECOVERY STABILIZED" [level=2] [ref=e79]
            - paragraph [ref=e80]: Command-channel recovery now preserves local artifact unlocks, route indexing, observer classification, and recovered cache progression inside the public intake node.
          - navigation "Command cache routes" [ref=e81]:
            - link "Open Channel" [ref=e82] [cursor=pointer]:
              - /url: ../#command-channel
              - generic [ref=e83]: Open Channel
            - link "Read Archive" [ref=e84] [cursor=pointer]:
              - /url: https://wiki.veildaemon.app/
              - generic [ref=e85]: Read Archive
            - link "Open Case File" [ref=e86] [cursor=pointer]:
              - /url: https://the-cradlepoint-archives.itch.io/needlepoint
              - generic [ref=e87]: Open Case File
        - article [ref=e88]:
          - generic [ref=e89]:
            - generic [ref=e90]: 2026-06-14
            - strong [ref=e91]: "STATUS: ROUTED"
          - generic [ref=e92]:
            - paragraph [ref=e93]: SYSTEM NOTICE
            - heading "OPERATOR INTAKE ROUTING REVISED" [level=2] [ref=e94]
            - paragraph [ref=e95]: Observer routing now prioritizes intake before channel access. Archive reading, Needlepoint play, and operator classification remain available through the public node.
          - navigation "Operator intake routes" [ref=e96]:
            - link "Begin Intake" [ref=e97] [cursor=pointer]:
              - /url: ../#intake-node
              - generic [ref=e98]: Begin Intake
            - link "Play Case File" [ref=e99] [cursor=pointer]:
              - /url: https://the-cradlepoint-archives.itch.io/needlepoint
              - generic [ref=e100]: Play Case File
            - link "Read Devlog" [ref=e101] [cursor=pointer]:
              - /url: https://the-cradlepoint-archives.itch.io/needlepoint/devlog
              - generic [ref=e102]: Read Devlog
      - navigation "System notice routes" [ref=e103]:
        - link "Return to Intake" [ref=e104] [cursor=pointer]:
          - /url: ../
          - generic [ref=e105]: Return to Intake
        - link "Open Operator File" [ref=e106] [cursor=pointer]:
          - /url: ../operator/
          - generic [ref=e107]: Open Operator File
      - text: "STATUS: AWAKE"
```

# Test source

```ts
  413 |     );
  414 | 
  415 |     expect(links.find((link) => link.label === "CASE FILE")?.href).toBe("#casefile-drawer");
  416 |     expect(links.find((link) => link.label === "HOME")?.href).toBe("/");
  417 |     expect(links.some((link) => link.href?.includes("itch.io"))).toBe(false);
  418 |   }
  419 | 
  420 |   await page.goto("/operator/");
  421 |   await expect(page.locator(".surface-tabs .return-main-tab")).toHaveAttribute("href", "/");
  422 |   await expect(page.locator(".surface-tabs .return-main-tab strong")).toHaveText("RETURN HOME");
  423 |   await expect(page.locator("#casefile-drawer")).not.toBeVisible();
  424 |   await page.getByRole("navigation", { name: "Surface files" }).getByText("CASE FILE").click();
  425 |   await expect(page.locator("#casefile-drawer")).toBeVisible();
  426 | 
  427 |   for (const path of ["/debrief/", "/recovered-operator-reports/", "/updates/"]) {
  428 |     await page.goto(path);
  429 |     const nav = page.getByRole("navigation", { name: "Surface files" });
  430 |     await expect(nav.locator(".active-case-tab")).toHaveAttribute("href", "#operator-preview");
  431 |     await nav.getByText("OPERATOR FILE").click();
  432 |     await expect(page.locator("#operator-preview")).toBeVisible();
  433 |   }
  434 | 
  435 |   await page.goto("/recovered-operator-reports/");
  436 |   await expect(page.locator(".surface-tabs .return-main-tab")).toHaveAttribute("href", "/");
  437 |   await expect(page.locator(".surface-tabs .return-main-tab strong")).toHaveText("RETURN HOME");
  438 | });
  439 | 
  440 | test("preview panels normalize to the surface tab rack", async ({ page }) => {
  441 |   await page.goto("/");
  442 | 
  443 |   const nav = page.getByRole("navigation", { name: "Surface files" });
  444 |   await nav.getByText("CASE FILE").click();
  445 | 
  446 |   const homeHeights = await page.evaluate(() => {
  447 |     const tabs = document.querySelector(".surface-tabs")?.getBoundingClientRect().height || 0;
  448 |     const panel = document.querySelector(".casefile-panel")?.getBoundingClientRect().height || 0;
  449 |     return { tabs, panel };
  450 |   });
  451 |   expect(homeHeights.panel).toBeGreaterThanOrEqual(homeHeights.tabs - 2);
  452 | 
  453 |   await page.goto("/updates/#operator-preview");
  454 |   const noticeHeights = await page.evaluate(() => {
  455 |     const tabs = document.querySelector(".surface-tabs")?.getBoundingClientRect().height || 0;
  456 |     const panel = document.querySelector(".operator-preview-panel")?.getBoundingClientRect().height || 0;
  457 |     return { tabs, panel };
  458 |   });
  459 |   expect(noticeHeights.panel).toBeGreaterThanOrEqual(noticeHeights.tabs - 2);
  460 | });
  461 | 
  462 | test("report surface tabs ride the active terminal rail", async ({ page }) => {
  463 |   await page.goto("/recovered-operator-reports/");
  464 | 
  465 |   const rects = await page.evaluate(() => {
  466 |     const tabs = document.querySelector(".surface-tabs")?.getBoundingClientRect();
  467 |     const terminal = document.querySelector(".report-terminal")?.getBoundingClientRect();
  468 |     return {
  469 |       tabTop: tabs?.top || 0,
  470 |       tabLeft: tabs?.left || 0,
  471 |       terminalTop: terminal?.top || 0,
  472 |       terminalRight: terminal?.right || 0
  473 |     };
  474 |   });
  475 | 
  476 |   expect(Math.abs(rects.tabTop - rects.terminalTop)).toBeLessThanOrEqual(2);
  477 |   expect(Math.abs(rects.tabLeft - rects.terminalRight)).toBeLessThanOrEqual(2);
  478 | });
  479 | 
  480 | test("updates four-tab rack sits below the status rail", async ({ page }) => {
  481 |   await page.goto("/updates/");
  482 | 
  483 |   const rects = await page.evaluate(() => {
  484 |     const tabs = document.querySelector(".surface-tabs")?.getBoundingClientRect();
  485 |     const terminal = document.querySelector(".report-terminal")?.getBoundingClientRect();
  486 |     return {
  487 |       tabTop: tabs?.top || 0,
  488 |       tabLeft: tabs?.left || 0,
  489 |       terminalTop: terminal?.top || 0,
  490 |       terminalRight: terminal?.right || 0
  491 |     };
  492 |   });
  493 | 
  494 |   expect(rects.tabTop - rects.terminalTop).toBeGreaterThanOrEqual(18);
  495 |   expect(rects.tabTop - rects.terminalTop).toBeLessThanOrEqual(70);
  496 |   expect(Math.abs(rects.tabLeft - rects.terminalRight)).toBeLessThanOrEqual(2);
  497 | });
  498 | 
  499 | test("updates file tabs have enough room for their labels", async ({ page }) => {
  500 |   await page.setViewportSize({ width: 900, height: 680 });
  501 |   await page.goto("/updates/");
  502 | 
  503 |   const tabs = await page.locator(".surface-tabs .surface-tab").evaluateAll((items) =>
  504 |     items.map((tab) => ({
  505 |       label: tab.querySelector("span")?.textContent?.trim(),
  506 |       clientHeight: tab.clientHeight,
  507 |       scrollHeight: tab.scrollHeight
  508 |     }))
  509 |   );
  510 | 
  511 |   expect(tabs.map((tab) => tab.label)).toEqual(["CASE FILE", "OPERATOR FILE", "REPORTS", "HOME"]);
  512 |   for (const tab of tabs) {
> 513 |     expect(tab.clientHeight).toBeGreaterThanOrEqual(tab.scrollHeight - 1);
      |                              ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
  514 |   }
  515 | });
  516 | 
  517 | test("mobile surface rack stays compact and drawers open above it", async ({ page }) => {
  518 |   await page.setViewportSize({ width: 390, height: 844 });
  519 | 
  520 |   for (const path of ["/", "/updates/", "/operator/"]) {
  521 |     await page.goto(path);
  522 | 
  523 |     const nav = page.getByRole("navigation", { name: "Surface files" });
  524 |     await expect(nav).toBeVisible();
  525 | 
  526 |     const closedRack = await nav.evaluate((node) => {
  527 |       const rect = node.getBoundingClientRect();
  528 |       return { y: rect.y, height: rect.height };
  529 |     });
  530 |     expect(closedRack.height).toBeLessThanOrEqual(60);
  531 |     expect(closedRack.y).toBeGreaterThanOrEqual(780);
  532 | 
  533 |     const tabBoxes = await nav.locator(".surface-tab").evaluateAll((tabs) =>
  534 |       tabs.map((tab) => {
  535 |         const rect = tab.getBoundingClientRect();
  536 |         return {
  537 |           label: tab.querySelector("span")?.textContent?.trim(),
  538 |           width: rect.width,
  539 |           height: rect.height,
  540 |           y: rect.y
  541 |         };
  542 |       })
  543 |     );
  544 | 
  545 |     expect(tabBoxes.length).toBe(path === "/updates/" ? 4 : 3);
  546 |     for (const tab of tabBoxes) {
  547 |       expect(tab.width).toBeGreaterThan(80);
  548 |       expect(tab.height).toBeLessThanOrEqual(56);
  549 |       expect(tab.y).toBeGreaterThanOrEqual(790);
  550 |     }
  551 | 
  552 |     await nav.getByText("REPORTS", { exact: true }).click();
  553 | 
  554 |     const drawer = page.locator("#recovered-reports-drawer");
  555 |     await expect(drawer).toBeVisible();
  556 |     await page.waitForTimeout(300);
  557 | 
  558 |     const { openRack, drawerBox } = await page.evaluate(() => {
  559 |       const rackRect = document.querySelector(".surface-tabs")?.getBoundingClientRect();
  560 |       const drawerRect = document.querySelector("#recovered-reports-drawer")?.getBoundingClientRect();
  561 |       return {
  562 |         openRack: {
  563 |           y: rackRect?.y || 0,
  564 |           height: rackRect?.height || 0
  565 |         },
  566 |         drawerBox: {
  567 |           x: drawerRect?.x || 0,
  568 |           width: drawerRect?.width || 0,
  569 |           y: drawerRect?.y || 0,
  570 |           height: drawerRect?.height || 0
  571 |         }
  572 |       };
  573 |     });
  574 |     expect(openRack.height).toBeLessThanOrEqual(60);
  575 |     expect(drawerBox.x).toBeGreaterThanOrEqual(-1);
  576 |     expect(drawerBox.width).toBeGreaterThanOrEqual(388);
  577 |     expect(drawerBox.y + drawerBox.height).toBeLessThanOrEqual(openRack.y + 2);
  578 |   }
  579 | });
  580 | 
  581 | test("updates drawers open on the same vertical rail as their tabs", async ({ page }) => {
  582 |   await page.setViewportSize({ width: 2600, height: 1000 });
  583 |   await page.goto("/updates/");
  584 | 
  585 |   const checks = [
  586 |     { label: "CASE FILE", drawer: "#casefile-drawer" },
  587 |     { label: "OPERATOR FILE", drawer: "#operator-preview" },
  588 |     { label: "REPORTS", drawer: "#recovered-reports-drawer" }
  589 |   ];
  590 | 
  591 |   for (const check of checks) {
  592 |     await page.getByRole("navigation", { name: "Surface files" }).getByText(check.label).click();
  593 |     await expect(page.locator(check.drawer)).toBeVisible();
  594 | 
  595 |     const rects = await page.evaluate((drawerSelector) => {
  596 |       const tabs = document.querySelector(".surface-tabs")?.getBoundingClientRect();
  597 |       const drawer = document.querySelector(drawerSelector)?.getBoundingClientRect();
  598 |       return {
  599 |         tabTop: tabs?.top || 0,
  600 |         drawerTop: drawer?.top || 0
  601 |       };
  602 |     }, check.drawer);
  603 | 
  604 |     expect(Math.abs(rects.tabTop - rects.drawerTop)).toBeLessThanOrEqual(2);
  605 | 
  606 |     await page.locator(check.drawer).getByRole("link", { name: "Close" }).click();
  607 |     await expect(page.locator(check.drawer)).not.toBeVisible();
  608 |   }
  609 | });
  610 | 
```