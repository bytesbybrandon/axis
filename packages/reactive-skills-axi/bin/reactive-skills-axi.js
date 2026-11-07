#!/usr/bin/env node
// Forwards to the official CLI. This package exists so that `npx reactive-skills-axi`
// always resolves to the Reactive Skills project's own code.
await import('@reactive-skills/axi/dist/cli/index.js');
