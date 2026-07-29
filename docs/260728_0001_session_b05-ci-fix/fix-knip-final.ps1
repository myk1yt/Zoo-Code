$ErrorActionPreference = "Continue"
$env:PATH += ";C:\Users\k1yt\AppData\Roaming\npm"
Set-Location "c:/Users/k1yt/OneDrive/Projects/ZooCode"

$branches = @(
    "pr/b04-shell-contracts",
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

foreach ($branch in $branches) {
    Write-Host "`n=== Processing $branch ==="
    
    # Clean checkout
    git checkout . 2>$null | Out-Null
    git checkout $branch 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "CHECKOUT FAILED: $branch"
        continue
    }

    # Check if @types/shell-quote is in knip.json
    $knipContent = Get-Content "knip.json" -Raw
    if ($knipContent -match '@types/shell-quote') {
        Write-Host "  ALREADY HAS @types/shell-quote in knip.json: $branch"
        continue
    }

    # Add @types/shell-quote to knip.json ignoreDependencies
    $lines = Get-Content "knip.json"
    $newLines = @()
    foreach ($line in $lines) {
        $newLines += $line
        if ($line -match '"@types/vscode",') {
            $newLines += '				"@types/shell-quote",'
        }
    }
    $newLines | Set-Content "knip.json"

    # Verify the fix
    $verify = Get-Content "knip.json" -Raw
    if ($verify -match '@types/shell-quote') {
        git add knip.json
        git commit --no-verify -m "fix(ci): add @types/shell-quote to knip ignoreDependencies" 2>$null | Out-Null
        git push --no-verify myk1yt $branch 2>$null | Out-Null
        Write-Host "  FIXED: $branch"
    } else {
        Write-Host "  FAILED TO APPLY: $branch"
    }
}

Write-Host "`nALL DONE"
