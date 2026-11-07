# Contributing to tttui-axi

Thank you for your interest in contributing to `tttui-axi`!

## Getting Started

1. **Fork and clone:**
   ```bash
   git clone https://github.com/bytesbybrandon/tttui.git
   cd tttui
   ```

2. **Zero Dependency Setup:**
   This project relies entirely on modern standard Node.js (v18+). No external production dependencies are required.

3. **Run the game locally:**
   ```bash
   node bin/ttt.js
   # Or link globally:
   npm link
   tttui
   ```

4. **Run the automated test suite:**
   ```bash
   npm test
   # Or:
   node --test
   ```

## Development Guidelines

- **Zero Runtime Dependencies**: Keep core modules dependency-free (rely only on standard Node.js standard library `node:*`).
- **Dual-Mode Ergonomics**: Keep the visual TUI responsive for humans and the AXI interface token-efficient in TOON format for AI agents.
- **Test-Driven**: All new game mechanics, key mappings, or CLI commands must include automated unit/integration tests under `test/`.
- **Clean Invariants**: Maintain 100% test pass rate and clean execution.
- **Commit Messages**: Follow Conventional Commits (`feat: ...`, `fix: ...`, `docs: ...`, `test: ...`).

## Submitting Pull Requests

1. Create a feature branch: `git checkout -b feat/your-feature-name`.
2. Commit your changes: `git commit -m "feat(scope): concise description"`.
3. Verify test suite: `npm test`.
4. Verify hygiene: Ensure no hardcoded absolute machine paths or secret tokens are present.
5. Push to your fork: `git push origin feat/your-feature-name`.
6. Open a Pull Request detailing what changed and including test verification output.
