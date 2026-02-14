# Push release to ProjectOmen-Releases repo
$version = "0.0.7"
$releaseRepo = "D:\Omen\ProjectOmen-Releases"
$setupFile = "D:\Omen\rpr-parser-editor\release\Project Omen Setup $version.exe"
$blockmap = "D:\Omen\rpr-parser-editor\release\Project Omen Setup $version.exe.blockmap"
$latestYml = "D:\Omen\rpr-parser-editor\release\latest.yml"

Write-Host "Checking if releases repo exists..." -ForegroundColor Cyan

if (-not (Test-Path $releaseRepo)) {
    Write-Host "Cloning releases repository..." -ForegroundColor Yellow
    Set-Location "D:\Omen"
    git clone https://github.com/michaelaaron81/ProjectOmen-Releases.git
}

Set-Location $releaseRepo
git pull origin main

Write-Host "Copying release files..." -ForegroundColor Cyan
Copy-Item $setupFile -Destination $releaseRepo -Force
Copy-Item $blockmap -Destination $releaseRepo -Force
Copy-Item $latestYml -Destination $releaseRepo -Force

Write-Host "Committing and pushing..." -ForegroundColor Cyan
git add "Project Omen Setup $version.exe"
git add "Project Omen Setup $version.exe.blockmap"
git add "latest.yml"
git commit -m "Release v$version"
git push origin main

Write-Host "`nRelease files pushed successfully!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Go to https://github.com/michaelaaron81/ProjectOmen-Releases/releases/new"
Write-Host "2. Create new release with tag: v$version"
Write-Host "3. Title: Project Omen v$version"
Write-Host "4. Attach the setup file from the repo"
Write-Host "5. Publish release"
