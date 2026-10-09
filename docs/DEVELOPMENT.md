# Development

## Setup

```bash
git clone https://github.com/kabartay/citewatch.git
cd citewatch
npm install
```

Node 22 is what CI uses.

## Commands

| Command | Does |
| --- | --- |
| `npm run compile` | Builds `src/` into `out/` |
| `npm run typecheck` | `tsc --noEmit`, strict |
| `npm run lint` | ESLint with type-aware rules and the layer boundaries |
| `npm test` | Compiles, then runs every `out/test/**/*.test.js` with `node:test` |
| `npm run check` | All three: run before every commit |
| `npm run package` | Builds `citewatch-<version>.vsix`; run it before a release, since `vsce` refuses some README images |

Press **F5** in VS Code to run the extension in a development host.

## Tests

`src/test/` mirrors the layers. Domain and application tests are pure, with in-memory fakes;
the infrastructure tests run both clients against a real local server, including Zenodo's page
size limit and a same-titled record by another creator.

## Releasing

1. Make sure Zenodo is switched on for the repository; Citewatch's own status bar says so.
2. Run **Citewatch: Set Version Everywhere** and move the `Unreleased` notes in `CHANGELOG.md`
   under the new version.
3. `npm run check`, `npm run package`, commit, push, wait for CI.
4. `git tag vX.Y.Z && git push origin vX.Y.Z`. The release workflow builds the `.vsix` and
   attaches it to a GitHub Release; Zenodo archives it.
5. Replace the generated notes with written ones: unwrapped Markdown, one paragraph per line.

## Dependabot

Dependabot opens monthly PRs. Never merge them on GitHub; see `CLAUDE.md`.
