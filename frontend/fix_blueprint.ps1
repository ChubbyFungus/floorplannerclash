$content = Get-Content -Path "src/components/editor/Blueprint3D.js" 
$fixedContent = @()

$inDebounceFunc = $false
foreach ($line in $content) {
    # Check if we're entering the debounce function
    if ($line -match "^function debounce\(func, wait\)") {
        $inDebounceFunc = $true
        continue
    }
    
    # Check if we're exiting the debounce function
    if ($inDebounceFunc -and $line -match "^\}") {
        $inDebounceFunc = $false
        continue
    }
    
    # Skip lines inside the debounce function
    if ($inDebounceFunc) {
        continue
    }
    
    # Add all other lines to the output
    $fixedContent += $line
}

Set-Content -Path "src/components/editor/Blueprint3D.js.fixed" -Value $fixedContent
Write-Host "Fixed file created at src/components/editor/Blueprint3D.js.fixed" 