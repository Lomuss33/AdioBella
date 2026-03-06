# Remove BOM using .NET which is more reliable

Write-Host "Removing BOM from Java files using .NET..."
Write-Host ""

$filesToFix = @(
    "engine\src\main\java\controllers\ZvanjeService.java",
    "engine\src\main\java\test\MatchInstantiationTest.java"
)

foreach ($filePath in $filesToFix) {
    if (Test-Path $filePath) {
        Write-Host "Fixing: $filePath"
        
        # Read the file
        $content = [System.IO.File]::ReadAllText($filePath)
        
        # Remove BOM character if it exists
        if ($content.StartsWith([char]0xFEFF)) {
            $content = $content.Substring(1)
            Write-Host "  ✓ BOM removed"
        }
        
        # Write back without BOM using UTF8 encoding without preamble
        $Utf8NoBomEncoding = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($filePath, $content, $Utf8NoBomEncoding)
        
        Write-Host "  ✓ File saved"
    } else {
        Write-Host "✗ Not found: $filePath"
    }
}

Write-Host ""
Write-Host "============================================"
Write-Host "Done! BOM removed from all files."
Write-Host "Now run: gradle clean engine:test"
Write-Host "============================================"