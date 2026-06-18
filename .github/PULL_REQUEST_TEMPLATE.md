## Description

<!-- Briefly describe what this PR does and why it's needed -->

## Related Issue

<!-- Link to any related issues: Fixes #123, Closes #456 -->

## Type of Change

<!-- Mark with an `x` -->

- [ ] Bug fix
- [ ] New feature
- [ ] New app
- [ ] Refactor / code quality
- [ ] Documentation
- [ ] Testing
- [ ] Build / CI

## Testing

- [ ] `pnpm build:dev` passes
- [ ] `pnpm test` passes (all 90+ tests)
- [ ] Manual testing performed (describe below)

## Checklist

- [ ] Import changes use `src/framework.js` barrel where applicable
- [ ] No hardcoded CSS colors — uses CSS variables
- [ ] No `alert()`, `confirm()`, or `prompt()` — uses `os.dialog`
- [ ] No `document.querySelector* or document.getElementById or document.createElement` — uses `src/shared/domUtils.js`
- [ ] Run pnpm format
- [ ] New apps registered in `src/registry/AppManifest.js` and `src/AppLoader.js`
