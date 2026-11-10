// The slice of `process` that tttui-axi reads when it is handed arguments directly.
const shim = { argv: ['node', 'tttui'], cwd: () => '/', env: {} as Record<string, string>, stdout: { isTTY: false } };
(globalThis as unknown as { process: typeof shim }).process = shim;
