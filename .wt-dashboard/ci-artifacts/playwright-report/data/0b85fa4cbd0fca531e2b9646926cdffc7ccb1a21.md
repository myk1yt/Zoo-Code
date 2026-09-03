# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: components/dashboard/__tests__/DashboardView.visual.tsx >> renders the dashboard with summary, heatmap, breakdown, and tasks in the VS Code dark theme
- Location: src/components/dashboard/__tests__/DashboardView.visual.tsx:183:1

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#root').locator('internal:control=component')
  2452 pixels (ratio 0.02 of all image pixels) are different.

  Snapshot: dashboard-view-dark.png

Call log:
  - Expect "toHaveScreenshot(dashboard-view-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#root').locator('internal:control=component')
    - locator resolved to <div class="w-[520px] h-[360px] bg-vscode-editor-background text-vscode-foreground overflow-hidden">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 2452 pixels (ratio 0.02 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - waiting for locator('#root').locator('internal:control=component')
    - locator resolved to <div class="w-[520px] h-[360px] bg-vscode-editor-background text-vscode-foreground overflow-hidden">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - captured a stable screenshot
  - 2452 pixels (ratio 0.02 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - generic [ref=e6]:
      - generic [ref=e7]:
        - button "Back" [ref=e8] [cursor=pointer]:
          - img
          - generic [ref=e9]: Back
        - heading "Dashboard" [level=3] [ref=e10]
      - generic [ref=e11]:
        - button "Refresh" [ref=e12] [cursor=pointer]:
          - img
        - button [ref=e13] [cursor=pointer]:
          - img
        - button [ref=e14] [cursor=pointer]:
          - img
    - generic [ref=e15]:
      - button "Today" [ref=e16] [cursor=pointer]
      - button "7 Days" [ref=e17] [cursor=pointer]
      - button "30 Days" [ref=e18] [cursor=pointer]
      - button "Custom" [ref=e19] [cursor=pointer]
      - button "All" [ref=e20] [cursor=pointer]
  - generic [ref=e21]:
    - generic [ref=e22]:
      - generic [ref=e23]:
        - generic [ref=e24]: Total Tokens
        - generic [ref=e25]: 7.5K
      - generic [ref=e26]:
        - generic [ref=e27]: Input Tokens
        - generic [ref=e28]: 5.0K
      - generic [ref=e29]:
        - generic [ref=e30]: Output Tokens
        - generic [ref=e31]: 2.5K
      - generic [ref=e32]:
        - generic [ref=e33]: Cache Tokens
        - generic [ref=e34]: 1.5K
      - generic [ref=e35]:
        - generic [ref=e36]: Cost
        - generic [ref=e37]: $0.15
    - generic [ref=e38]:
      - generic [ref=e39]:
        - heading "Daily Activity" [level=4] [ref=e40]
        - generic [ref=e41]:
          - button "30 Days" [ref=e42] [cursor=pointer]
          - button "60 Days" [ref=e43] [cursor=pointer]
          - button "120 Days" [ref=e44] [cursor=pointer]
          - button "360 Days" [ref=e45] [cursor=pointer]
      - img "Daily Activity" [ref=e46]:
        - 'generic "2026-07-14: 1925 tokens" [ref=e47]'
        - 'generic "2026-07-15: 6568 tokens" [ref=e48]'
        - 'generic "2026-07-16: 7734 tokens" [ref=e49]'
        - 'generic "2026-07-17: 8702 tokens" [ref=e50]'
        - 'generic "2026-07-18: 9394 tokens" [ref=e51]'
        - 'generic "2026-07-19: 9755 tokens" [ref=e52]'
        - 'generic "2026-07-20: 3038 tokens" [ref=e53]'
        - 'generic "2026-07-21: 2948 tokens" [ref=e54]'
        - 'generic "2026-07-22: 8698 tokens" [ref=e55]'
        - 'generic "2026-07-23: 7729 tokens" [ref=e56]'
        - 'generic "2026-07-24: 6563 tokens" [ref=e57]'
        - 'generic "2026-07-25: 5294 tokens" [ref=e58]'
        - 'generic "2026-07-26: 4026 tokens" [ref=e59]'
        - 'generic "2026-07-27: 1315 tokens" [ref=e60]'
        - 'generic "2026-07-28: 1074 tokens" [ref=e61]'
        - 'generic "2026-07-29: 1203 tokens" [ref=e62]'
        - 'generic "2026-07-30: 845 tokens" [ref=e63]'
        - 'generic "2026-07-31: 847 tokens" [ref=e64]'
        - 'generic "2026-08-01: 1211 tokens" [ref=e65]'
        - 'generic "2026-08-02: 1906 tokens" [ref=e66]'
        - 'generic "2026-08-03: 1319 tokens" [ref=e67]'
        - 'generic "2026-08-04: 1611 tokens" [ref=e68]'
        - 'generic "2026-08-05: 5311 tokens" [ref=e69]'
        - 'generic "2026-08-06: 6579 tokens" [ref=e70]'
        - 'generic "2026-08-07: 7743 tokens" [ref=e71]'
        - 'generic "2026-08-08: 8709 tokens" [ref=e72]'
        - 'generic "2026-08-09: 9399 tokens" [ref=e73]'
        - 'generic "2026-08-10: 3039 tokens" [ref=e74]'
        - 'generic "2026-08-11: 3038 tokens" [ref=e75]'
        - 'generic "2026-08-12: 9387 tokens" [ref=e76]'
      - generic [ref=e77]:
        - generic [ref=e78]: Less
        - generic [ref=e85]: More
    - generic [ref=e86]:
      - generic [ref=e87]: Cache ratio for estimation
      - spinbutton "Cache ratio for estimation" [ref=e88]: "94"
      - generic [ref=e89]: "%"
      - generic [ref=e90]: Applied when provider doesn't report cache data
    - generic [ref=e91]:
      - generic [ref=e92]:
        - heading "Breakdown" [level=4] [ref=e93]
        - generic [ref=e94]:
          - button "Model" [ref=e95] [cursor=pointer]
          - button "Provider" [ref=e96] [cursor=pointer]
          - button "Mode" [ref=e97] [cursor=pointer]
      - table [ref=e99]:
        - rowgroup [ref=e100]:
          - row "Model Events Input Output Cache Read Cache Write Reasoning Total Cost" [ref=e101]:
            - columnheader "Model" [ref=e102]
            - columnheader "Events" [ref=e103]
            - columnheader "Input" [ref=e104]
            - columnheader "Output" [ref=e105]
            - columnheader "Cache Read" [ref=e106]
            - columnheader "Cache Write" [ref=e107]
            - columnheader "Reasoning" [ref=e108]
            - columnheader "Total" [ref=e109]
            - columnheader "Cost" [ref=e110]
        - rowgroup [ref=e111]:
          - row "claude-sonnet-4-20250514 6 3.5K 1.5K 800 400 150 5.0K $0.10" [ref=e112]:
            - cell "claude-sonnet-4-20250514" [ref=e113]
            - cell "6" [ref=e114]
            - cell "3.5K" [ref=e115]
            - cell "1.5K" [ref=e116]
            - cell "800" [ref=e117]
            - cell "400" [ref=e118]
            - cell "150" [ref=e119]
            - cell "5.0K" [ref=e120]
            - cell "$0.10" [ref=e121]
          - row "gpt-4o 4 1.5K 1.0K 200 100 50 2.5K $0.05" [ref=e122]:
            - cell "gpt-4o" [ref=e123]
            - cell "4" [ref=e124]
            - cell "1.5K" [ref=e125]
            - cell "1.0K" [ref=e126]
            - cell "200" [ref=e127]
            - cell "100" [ref=e128]
            - cell "50" [ref=e129]
            - cell "2.5K" [ref=e130]
            - cell "$0.05" [ref=e131]
    - generic [ref=e132]:
      - heading "Tasks(3)" [level=4] [ref=e134]:
        - text: Tasks
        - generic [ref=e135]: (3)
      - generic [ref=e139]:
        - 'button "Implement OAuth refresh flow time.minutesAgo · claude-sonnet-4-20250514 · anthropic 4.0K $0.08 · {{count}} calls" [ref=e142] [cursor=pointer]':
          - generic [ref=e143]:
            - img [ref=e144]
            - generic [ref=e146]:
              - generic "Implement OAuth refresh flow" [ref=e147]
              - generic [ref=e148]: time.minutesAgo · claude-sonnet-4-20250514 · anthropic
          - generic [ref=e149]:
            - generic [ref=e150]: 4.0K
            - generic [ref=e151]: "$0.08 · {{count}} calls"
        - 'button "Fix cache ratio bug time.minutesAgo · gpt-4o · openai 2.0K $0.04 · {{count}} calls" [ref=e154] [cursor=pointer]':
          - generic [ref=e155]:
            - img [ref=e156]
            - generic [ref=e158]:
              - generic "Fix cache ratio bug" [ref=e159]
              - generic [ref=e160]: time.minutesAgo · gpt-4o · openai
          - generic [ref=e161]:
            - generic [ref=e162]: 2.0K
            - generic [ref=e163]: "$0.04 · {{count}} calls"
        - 'button "Translate dashboard strings time.hoursAgo · claude-sonnet-4-20250514 · anthropic 1.5K $0.03 · {{count}} calls" [ref=e166] [cursor=pointer]':
          - generic [ref=e167]:
            - img [ref=e168]
            - generic [ref=e170]:
              - generic "Translate dashboard strings" [ref=e171]
              - generic [ref=e172]: time.hoursAgo · claude-sonnet-4-20250514 · anthropic
          - generic [ref=e173]:
            - generic [ref=e174]: 1.5K
            - generic [ref=e175]: "$0.03 · {{count}} calls"
    - generic [ref=e176]:
      - generic [ref=e177]: Data Coverage
      - generic [ref=e178]: "Live from: 8/9/2026, 7:02:51 AM"
      - generic [ref=e179]: "Last Updated: 8/12/2026, 7:02:51 AM"
      - generic [ref=e180]: "Backfilled events: 2"
```

# Test source

```ts
  145 | 					inputTokens: 1400,
  146 | 					outputTokens: 600,
  147 | 					model: "gpt-4o",
  148 | 					provider: "openai",
  149 | 					models: ["gpt-4o"],
  150 | 					modes: ["debug"],
  151 | 					eventCount: 3,
  152 | 					childTaskIds: [],
  153 | 				},
  154 | 				{
  155 | 					taskId: "task-3",
  156 | 					rootTaskId: "task-3",
  157 | 					title: "Translate dashboard strings",
  158 | 					taskTimestamp: now - 3 * 3_600_000,
  159 | 					lastUsageAt: now - 2 * 3_600_000,
  160 | 					totalCost: 0.03,
  161 | 					totalTokens: 1500,
  162 | 					inputTokens: 800,
  163 | 					outputTokens: 700,
  164 | 					model: "claude-sonnet-4-20250514",
  165 | 					provider: "anthropic",
  166 | 					models: ["claude-sonnet-4-20250514"],
  167 | 					modes: ["translate"],
  168 | 					eventCount: 3,
  169 | 					childTaskIds: [],
  170 | 				},
  171 | 			],
  172 | 			childTasks: [],
  173 | 			cursor: undefined,
  174 | 			totalEstimate: 3,
  175 | 		},
  176 | 		heatmap: {
  177 | 			rangeDays: 30,
  178 | 			values: heatmapValues,
  179 | 		},
  180 | 	}
  181 | }
  182 | 
  183 | test("renders the dashboard with summary, heatmap, breakdown, and tasks in the VS Code dark theme", async ({
  184 | 	mount,
  185 | 	page,
  186 | }) => {
  187 | 	// Intercept `console.log` inside the page before the component mounts. The
  188 | 	// vscode browser fallback (`src/utils/vscode.ts`) logs the posted message
  189 | 	// object; we store it on `window` so the test can read the requestId.
  190 | 	await page.evaluate(() => {
  191 | 		const originalLog = window.console.log.bind(window.console)
  192 | 		;(window as unknown as { __dashboardSubscriptions__: unknown[] }).__dashboardSubscriptions__ = []
  193 | 		window.console.log = (...args: unknown[]) => {
  194 | 			const message = args[0]
  195 | 			if (
  196 | 				message &&
  197 | 				typeof message === "object" &&
  198 | 				(message as { type?: string }).type === "subscribeDashboardStats"
  199 | 			) {
  200 | 				;(window as unknown as { __dashboardSubscriptions__: unknown[] }).__dashboardSubscriptions__.push(
  201 | 					message,
  202 | 				)
  203 | 			}
  204 | 			originalLog(...args)
  205 | 		}
  206 | 	})
  207 | 
  208 | 	const component = await mount(<DashboardViewFixture />)
  209 | 
  210 | 	// Wait for the subscription post to be captured, then deliver the snapshot.
  211 | 	const subscription = await page
  212 | 		.waitForFunction(() => {
  213 | 			const subs = (window as unknown as { __dashboardSubscriptions__: unknown[] }).__dashboardSubscriptions__
  214 | 			return subs.length > 0 ? subs[0] : undefined
  215 | 		})
  216 | 		.then((handle) => handle.jsonValue())
  217 | 
  218 | 	const requestId = (subscription as { dashboardStatsSubscription?: { requestId?: string } })
  219 | 		.dashboardStatsSubscription?.requestId
  220 | 	expect(requestId).toBeDefined()
  221 | 
  222 | 	// The stream hook reads `message.dashboardStatsStreamSnapshot` (and checks
  223 | 	// `message.type === "dashboardStatsStreamSnapshot"`), so the snapshot must
  224 | 	// be dispatched inside the standard extension message envelope.
  225 | 	await page.evaluate((snapshot) => {
  226 | 		window.dispatchEvent(
  227 | 			new MessageEvent("message", {
  228 | 				data: { type: "dashboardStatsStreamSnapshot", dashboardStatsStreamSnapshot: snapshot },
  229 | 			}),
  230 | 		)
  231 | 	}, makeFixtureSnapshot(requestId!))
  232 | 
  233 | 	// Data must render: summary cards, heatmap cells, breakdown table rows,
  234 | 	// and task rows are all present (not the loading/empty state).
  235 | 	await expect(component.getByTestId("dashboard-summary")).toBeVisible()
  236 | 	await expect(component.getByTestId("usage-heatmap")).toBeVisible()
  237 | 	await expect(component.getByTestId("dashboard-breakdown")).toBeVisible()
  238 | 	await expect(component.getByTestId("dashboard-task-row").first()).toBeVisible()
  239 | 
  240 | 	await component.evaluate(async () => {
  241 | 		await document.fonts.ready
  242 | 		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  243 | 	})
  244 | 
> 245 | 	await expect(component).toHaveScreenshot("dashboard-view-dark.png")
      |                          ^ Error: expect(locator).toHaveScreenshot(expected) failed
  246 | })
  247 | 
```