$ErrorActionPreference = "Continue"
$env:PATH += ";C:\Users\k1yt\AppData\Roaming\npm"
Set-Location "c:/Users/k1yt/OneDrive/Projects/ZooCode"

$branches = @(
    "pr/b02-error-runtime",
    "pr/b04-shell-contracts",
    "pr/b03-error-integration",
    "pr/b06-terminal-lifecycle",
    "pr/b08-task-persistence",
    "pr/b11-mimo-capability",
    "pr/b13-usage-store",
    "pr/b07-shell-integration",
    "pr/b09-task-org-ipc",
    "pr/b10-task-org-ui",
    "pr/b12-mimo-enforcement",
    "pr/b14-usage-aggregation",
    "pr/b17-provider-cost",
    "pr/b15-usage-capture",
    "pr/b16-stats-ui"
)

foreach ($branch in $branches) {
    Write-Host "`n=== Processing $branch ==="
    git checkout $branch 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "CHECKOUT FAILED: $branch"
        continue
    }

    # Check if @types/shell-quote already exists
    $hasTypes = Select-String -Path "src/package.json" -Pattern "@types/shell-quote" -Quiet
    if ($hasTypes) {
        Write-Host "ALREADY HAS @types/shell-quote: $branch"
        continue
    }

    # Apply the fix using git cherry-pick from b01
    git cherry-pick 82faf0b51 --no-commit 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        git commit --no-verify -m "fix(ci): resolve check-types failure - add @types/shell-quote" 2>$null | Out-Null
        git push --no-verify myk1yt $branch 2>$null | Out-Null
        Write-Host "FIXED: $branch"
    } else {
        # Manual fix if cherry-pick fails
        $content = Get-Content "src/package.json" -Raw
        $content = $content -replace '("@types/semver-compare": "1.0.3",)', '$1' + "`n`t`t`"@types/shell-quote`": `"1.7.5`","
        $content | Set-Content "src/package.json" -NoNewline
        pnpm install 2>$null | Out-Null
        git add -A
        git commit --no-verify -m "fix(ci): resolve check-types failure - add @types/shell-quote" 2>$null | Out-Null
        git push --no-verify myk1yt $branch 2>$null | Out-Null
        Write-Host "MANUAL FIX: $branch"
    }
}

Write-Host "`nALL DONE"
