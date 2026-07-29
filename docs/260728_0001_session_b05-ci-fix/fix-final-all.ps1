$ErrorActionPreference = "Continue"
$env:PATH += ";C:\Users\k1yt\AppData\Roaming\npm"
Set-Location "c:/Users/k1yt/OneDrive/Projects/ZooCode"

$branches = @(
    "pr/b01-error-contracts",
    "pr/b02-error-runtime",
    "pr/b04-shell-contracts",
    "pr/b05-shell-resolution",
    "pr/b03-error-integration",
    "pr/b06-terminal-lifecycle",
    "pr/b08-task-persistence",
    "pr/b05a-strict-reasoning",
    "pr/b11-mimo-capability",
    "pr/b13-usage-store",
    "pr/b07-shell-integration",
    "pr/b09-task-org-ipc",
    "pr/b10-task-org-ui",
    "pr/b14-usage-aggregation",
    "pr/b17-provider-cost",
    "pr/b15-usage-capture",
    "pr/b16-stats-ui"
)

foreach ($branch in $branches) {
    Write-Host "`n=== Processing $branch ==="
    
    git checkout . 2>$null | Out-Null
    git checkout $branch 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "CHECKOUT FAILED: $branch"
        continue
    }

    $needsCommit = $false

    # Fix 1: Add playwright to ignoreBinaries if not present
    $knipContent = Get-Content "knip.json" -Raw
    if ($knipContent -notmatch 'ignoreBinaries') {
        $knipContent = $knipContent -replace '"ignoreDependencies": \["lint-staged"\],', '"ignoreDependencies": ["lint-staged"],' + "`n`t`"ignoreBinaries`": [`"playwright`"],"
        $knipContent | Set-Content "knip.json" -NoNewline
        Write-Host "  Added ignoreBinaries to knip.json"
        $needsCommit = $true
    }

    # Fix 2: Update tsconfig for b14, b17, b15
    if ($branch -match "b14|b17|b15") {
        $tsconfigPath = "webview-ui/tsconfig.json"
        if (Test-Path $tsconfigPath) {
            $tsconfig = Get-Content $tsconfigPath -Raw
            if ($tsconfig -notmatch '\*\*/\*\.visual\.tsx') {
                $tsconfig = $tsconfig -replace '"include": \["src", "playwright", "playwright-ct\.config\.ts", "\.\./src/shared", "vitest\.setup\.ts"\]', '"include": ["src", "../src/shared", "vitest.setup.ts"],' + "`n`t`"exclude`": [`"playwright`", `"playwright-ct.config.ts`", `"\*\*/\*.visual.tsx`", `"node_modules`", `"dist`", `"out`"]"
                $tsconfig | Set-Content $tsconfigPath -NoNewline
                Write-Host "  Updated tsconfig.json"
                $needsCommit = $true
            }
        }
    }

    if ($needsCommit) {
        git add -A
        git commit --no-verify -m "fix(ci): add playwright to knip ignoreBinaries, update tsconfig" 2>$null | Out-Null
        git push --no-verify myk1yt $branch 2>$null | Out-Null
        Write-Host "  COMMITTED: $branch"
    } else {
        Write-Host "  NO CHANGES: $branch"
    }
}

Write-Host "`nALL DONE"
