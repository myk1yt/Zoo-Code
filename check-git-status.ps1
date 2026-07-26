# Check git status for the error-interception-middleware changes
Write-Host "=== Branch ==="
git branch --show-current

Write-Host "`n=== Last 10 commits ==="
git log --oneline -10

Write-Host "`n=== Files changed in last commit ==="
git diff --name-only HEAD~1 HEAD

Write-Host "`n=== Diff of presentAssistantMessage.ts in last 5 commits ==="
git diff --stat HEAD~5..HEAD -- src/core/assistant-message/presentAssistantMessage.ts

Write-Host "`n=== Working tree status ==="
git status --short

Write-Host "`n=== Check if test file exists in tracked src ==="
Test-Path "src/core/assistant-message/__tests__/presentAssistantMessage-error-interception.spec.ts"

Write-Host "`n=== Count cline.say error calls in tracked src ==="
(Select-String -Path "src/core/assistant-message/presentAssistantMessage.ts" -Pattern 'cline\.say\("error"').Count

Write-Host "`n=== Count cline.say error calls in Zoo-Code copy ==="
(Select-String -Path "Zoo-Code/src/core/assistant-message/presentAssistantMessage.ts" -Pattern 'cline\.say\("error"').Count
