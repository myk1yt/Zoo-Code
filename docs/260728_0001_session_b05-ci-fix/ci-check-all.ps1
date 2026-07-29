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
    "pr/b12-mimo-enforcement",
    "pr/b14-usage-aggregation",
    "pr/b17-provider-cost",
    "pr/b15-usage-capture",
    "pr/b16-stats-ui"
)

$logFile = "docs/260728_0001_session_b05-ci-fix/ci-results-final.log"
"" | Out-File -FilePath $logFile -Encoding utf8

foreach ($branch in $branches) {
    $lint = "-"; $types = "-"; $knip = "-"; $trans = "-"
    git checkout . 2>$null | Out-Null
    git checkout $branch 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        $line = "$branch|CHECKOUT_FAIL|-|-|-|-"
        $line | Out-File -FilePath $logFile -Append -Encoding utf8
        Write-Host "[$branch] CHECKOUT FAILED"
        continue
    }

    pnpm lint *> $null
    $lint = if ($LASTEXITCODE -eq 0) { "PASS" } else { "FAIL" }

    pnpm check-types *> $null
    $types = if ($LASTEXITCODE -eq 0) { "PASS" } else { "FAIL" }

    pnpm knip *> $null
    $knip = if ($LASTEXITCODE -eq 0) { "PASS" } else { "FAIL" }

    node scripts/find-missing-translations.js *> $null
    $trans = if ($LASTEXITCODE -eq 0) { "PASS" } else { "FAIL" }

    $line = "$branch|$lint|$types|$knip|$trans"
    $line | Out-File -FilePath $logFile -Append -Encoding utf8
    Write-Host "[$branch] lint=$lint types=$types knip=$knip trans=$trans"
}

Write-Host "ALL DONE"
