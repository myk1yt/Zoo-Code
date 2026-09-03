param([string]$LineRange = "105-105")

$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot/src"

$env:STRYKER_VitestPlaceholder = $null
