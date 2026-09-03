# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: components/dashboard/__tests__/UsageHeatmap.visual.tsx >> renders the 60-day usage heatmap in the VS Code dark theme
- Location: src/components/dashboard/__tests__/UsageHeatmap.visual.tsx:11:1

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#root').locator('internal:control=component')
  1571 pixels (ratio 0.02 of all image pixels) are different.

  Snapshot: usage-heatmap-dark.png

Call log:
  - Expect "toHaveScreenshot(usage-heatmap-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#root').locator('internal:control=component')
    - locator resolved to <div class="w-[520px] bg-vscode-editor-background p-4 text-vscode-foreground">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 1571 pixels (ratio 0.02 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - waiting for locator('#root').locator('internal:control=component')
    - locator resolved to <div class="w-[520px] bg-vscode-editor-background p-4 text-vscode-foreground">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - captured a stable screenshot
  - 1571 pixels (ratio 0.02 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - heading "Daily Activity" [level=4] [ref=e6]
    - generic [ref=e7]:
      - button "30 Days" [ref=e8] [cursor=pointer]
      - button "60 Days" [ref=e9] [cursor=pointer]
      - button "120 Days" [ref=e10] [cursor=pointer]
      - button "360 Days" [ref=e11] [cursor=pointer]
  - img "Daily Activity" [ref=e12]:
    - 'generic "2026-06-14: 1500 tokens" [ref=e13]'
    - 'generic "2026-06-15: 6737 tokens" [ref=e14]'
    - 'generic "2026-06-16: 7897 tokens" [ref=e15]'
    - 'generic "2026-06-17: 8908 tokens" [ref=e16]'
    - 'generic "2026-06-18: 9707 tokens" [ref=e17]'
    - 'generic "2026-06-19: 10245 tokens" [ref=e18]'
    - 'generic "2026-06-20: 2497 tokens" [ref=e19]'
    - 'generic "2026-06-21: 2484 tokens" [ref=e20]'
    - 'generic "2026-06-22: 10046 tokens" [ref=e21]'
    - 'generic "2026-06-23: 9390 tokens" [ref=e22]'
    - 'generic "2026-06-24: 8492 tokens" [ref=e23]'
    - 'generic "2026-06-25: 7408 tokens" [ref=e24]'
    - 'generic "2026-06-26: 6206 tokens" [ref=e25]'
    - 'generic "2026-06-27: 1392 tokens" [ref=e26]'
    - 'generic "2026-06-28: 1149 tokens" [ref=e27]'
    - 'generic "2026-06-29: 2642 tokens" [ref=e28]'
    - 'generic "2026-06-30: 1716 tokens" [ref=e29]'
    - 'generic "2026-07-01: 1025 tokens" [ref=e30]'
    - 'generic "2026-07-02: 612 tokens" [ref=e31]'
    - 'generic "2026-07-03: 504 tokens" [ref=e32]'
    - 'generic "2026-07-04: 541 tokens" [ref=e33]'
    - 'generic "2026-07-05: 641 tokens" [ref=e34]'
    - 'generic "2026-07-06: 1972 tokens" [ref=e35]'
    - 'generic "2026-07-07: 2959 tokens" [ref=e36]'
    - 'generic "2026-07-08: 4103 tokens" [ref=e37]'
    - 'generic "2026-07-09: 5334 tokens" [ref=e38]'
    - 'generic "2026-07-10: 6576 tokens" [ref=e39]'
    - 'generic "2026-07-11: 1950 tokens" [ref=e40]'
    - 'generic "2026-07-12: 2157 tokens" [ref=e41]'
    - 'generic "2026-07-13: 9615 tokens" [ref=e42]'
    - 'generic "2026-07-14: 10190 tokens" [ref=e43]'
    - 'generic "2026-07-15: 10473 tokens" [ref=e44]'
    - 'generic "2026-07-16: 10447 tokens" [ref=e45]'
    - 'generic "2026-07-17: 10113 tokens" [ref=e46]'
    - 'generic "2026-07-18: 2298 tokens" [ref=e47]'
    - 'generic "2026-07-19: 2125 tokens" [ref=e48]'
    - 'generic "2026-07-20: 7561 tokens" [ref=e49]'
    - 'generic "2026-07-21: 6369 tokens" [ref=e50]'
    - 'generic "2026-07-22: 5124 tokens" [ref=e51]'
    - 'generic "2026-07-23: 3902 tokens" [ref=e52]'
    - 'generic "2026-07-24: 2780 tokens" [ref=e53]'
    - 'generic "2026-07-25: 765 tokens" [ref=e54]'
    - 'generic "2026-07-26: 620 tokens" [ref=e55]'
    - 'generic "2026-07-27: 650 tokens" [ref=e56]'
    - 'generic "2026-07-28: 500 tokens" [ref=e57]'
    - 'generic "2026-07-29: 661 tokens" [ref=e58]'
    - 'generic "2026-07-30: 1123 tokens" [ref=e59]'
    - 'generic "2026-07-31: 1857 tokens" [ref=e60]'
    - 'generic "2026-08-01: 963 tokens" [ref=e61]'
    - 'generic "2026-08-02: 1189 tokens" [ref=e62]'
    - 'generic "2026-08-03: 5168 tokens" [ref=e63]'
    - 'generic "2026-08-04: 6413 tokens" [ref=e64]'
    - 'generic "2026-08-05: 7601 tokens" [ref=e65]'
    - 'generic "2026-08-06: 8658 tokens" [ref=e66]'
    - 'generic "2026-08-07: 9519 tokens" [ref=e67]'
    - 'generic "2026-08-08: 2426 tokens" [ref=e68]'
    - 'generic "2026-08-09: 2491 tokens" [ref=e69]'
    - 'generic "2026-08-10: 10468 tokens" [ref=e70]'
    - 'generic "2026-08-11: 10174 tokens" [ref=e71]'
    - 'generic "2026-08-12: 9590 tokens" [ref=e72]'
  - generic [ref=e73]:
    - generic [ref=e74]: Less
    - generic [ref=e81]: More
```

# Test source

```ts
  1  | /* v8 ignore file -- Playwright component visual test. */
  2  | import React from "react"
  3  | 
  4  | import { expect, test } from "../../../../playwright/coverage-fixture"
  5  | 
  6  | import { UsageHeatmapFixture } from "./UsageHeatmap.visual.fixture"
  7  | 
  8  | // Visual coverage for the GitHub-style activity heatmap with the 60-day range
  9  | // active. A non-empty `values` array guarantees the grid + legend render
  10 | // instead of the "no activity" empty state.
  11 | test("renders the 60-day usage heatmap in the VS Code dark theme", async ({ mount }) => {
  12 | 	const component = await mount(<UsageHeatmapFixture />)
  13 | 
  14 | 	await component.evaluate(async () => {
  15 | 		await document.fonts.ready
  16 | 		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  17 | 	})
  18 | 
  19 | 	// The heatmap grid must render (not the "no activity" empty state).
  20 | 	await expect(component.getByRole("img", { name: "Daily Activity" })).toBeVisible()
  21 | 
> 22 | 	await expect(component).toHaveScreenshot("usage-heatmap-dark.png")
     |                          ^ Error: expect(locator).toHaveScreenshot(expected) failed
  23 | })
  24 | 
```