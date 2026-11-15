# Pinterest AXI Manual Verification

Run these checks from the project directory with Node.js 22.18 or later.

## Build and automated checks

- Run `pnpm install --frozen-lockfile` from the repository root and confirm installation completes without errors.
- Run `npm test` and confirm the local suite passes without Pinterest credentials.
- Run `npm run build:skill -- --check` and confirm the skill pointer is current.

## Packaged CLI local check

- Run `npm run verify:package -- --keep` and confirm the package allowlist and installed CLI version and help checks pass.
- Confirm the tarball is written to `dist/pinterest-axi-0.1.0.tgz`.
- In PowerShell, install that tarball into a temporary directory and run the installed command.

```powershell
$testRoot = Join-Path $env:TEMP ("pinterest-axi-local-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $testRoot | Out-Null
$tarball = Get-Item .\dist\pinterest-axi-0.1.0.tgz
npm install --ignore-scripts --prefix $testRoot $tarball.FullName
$axi = Join-Path $testRoot "node_modules\.bin\pinterest-axi.cmd"
& $axi --version
& $axi --help
```

- Confirm the command prints `0.1.0` and help without contacting Pinterest.
- Use a read-only Pinterest command only if you want an authenticated integration check.
- Do not run commands that create or update Pinterest data during the package check.
- Complete and review the local package check before the first npm publication.
