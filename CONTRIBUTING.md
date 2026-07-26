# Contributing to YukiOS

Check out our [Roadmap](ROADMAP.md)

## How to Contribute

1. **Fork** the repository
2. **Create a branch** for your change
3. **Make your changes** following the guidelines below
4. **Create a pull request** using the PR template

## Development Setup

```bash
git clone <your-fork>
cd yukios/webos-desktop
pnpm install
pnpm run dev     # start dev server
```

## Code Guidelines

### Before submitting

- Run `pnpm build:dev` in `webos-desktop/` - the build must pass
- Run `pnpm test` - all tests must pass

### Style

- **No comments** in CSS, JS, or HTML (JSDoc on complex functions only)
- Use `npm/pnpm format*` before committing.
- Use `src/framework.js` barrel for app imports (`BaseApp`, `os`, `StorageKeys`, `APP_MANIFESTS`)
- Use `os.*` bridge API
- Use `src/shared/domUtils.js` instead of `document.querySelector*` or `document.getElementById`
- Use `os.dialog.*` instead of `alert()`, `confirm()`, `prompt()`
- Use root CSS variables from `src/styles/style.css` - never hardcode colors

### App Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed instructions on creating new apps.

### Architecture

- `src/core/BaseApp.ts` - base class for all apps (TS)
- `src/appLauncher.ts` - central app dispatch (TS)
- `src/windowManager.ts` - window lifecycle (TS)
- `src/apps/` - all applications (each extends `BaseApp`, builds UI imperatively in `open()`)
- `src/os/` - OS bridge API (`window`, `fs`, `notify`, `tray`, etc.)
- `src/shared/` - shared utilities (`domUtils`, `assetResolver`, `contextMenu`)
- `src/registry/AppManifest.js` - app metadata and manifest

## Pull Request Process

1. Fill out the PR template completely
2. Link any related issues
3. Ensure all CI checks pass
4. Request review from a maintainer
5. Address review feedback

## Questions?

Open a [Discussion](https://github.com/Reeyuki/yukios/discussions) or join the [Discord](https://discord.gg/wufbWFwr4G).
