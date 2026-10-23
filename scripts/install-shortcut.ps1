# Creates "Pulse Music" shortcuts on the Desktop and in the Start menu that
# open the glass desktop app directly (no console window).
$root = Split-Path -Parent $PSScriptRoot
$electron = Join-Path $root 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path $electron)) { throw "Electron isn't installed yet. Run 'npm install' in $root first." }
$icon = Join-Path $root 'public\pulse.ico'
$shell = New-Object -ComObject WScript.Shell
$places = @(
  [Environment]::GetFolderPath('Desktop'),
  (Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs')
)
foreach ($dir in $places) {
  $path = Join-Path $dir 'Pulse Music.lnk'
  $lnk = $shell.CreateShortcut($path)
  $lnk.TargetPath = $electron
  $lnk.Arguments = "`"$root`""
  $lnk.WorkingDirectory = $root
  $lnk.IconLocation = "$icon,0"
  $lnk.Description = 'Pulse Music'
  $lnk.Save()
  Write-Output "Shortcut created: $path"
}
