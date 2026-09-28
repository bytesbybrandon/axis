# Honcho AXI Manual Verification

Run these checks from the project directory with Node.js 22.18 or later.

## Build and automated checks

- Run `npm ci` and confirm installation completes without errors.
- Run `npm test` and confirm the local suite passes without Honcho credentials.
- Run `npm run build:skill -- --check` and confirm the skill pointer is current.

## Packaged CLI local check

- Run `npm run verify:package -- --keep` and confirm the package allowlist and installed CLI version and help checks pass.
- Confirm the tarball is written to `dist/honcho-axi-0.1.0.tgz`.
- In PowerShell, install that tarball into a temporary directory and run the installed command.

```powershell
$testRoot = Join-Path $env:TEMP ("honcho-axi-local-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $testRoot | Out-Null
$tarball = Get-Item .\dist\honcho-axi-0.1.0.tgz
npm install --ignore-scripts --prefix $testRoot $tarball.FullName
$axi = Join-Path $testRoot "node_modules\.bin\honcho-axi.cmd"
& $axi --version
& $axi --help
```

- Confirm the command prints `0.1.0` and help without contacting Honcho.
- Use a read-only Honcho command only if you want an authenticated integration check.
- Do not run commands that create or update Honcho data during the package check.
- Complete and review the local package check before the first npm publication.
