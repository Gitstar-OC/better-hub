# better-hub CLI

A tiny CLI to configure Git URL rewrites so vanity Better Hub clone links can resolve to GitHub.

## Usage

```bash
npx better-hub init
```

This command adds rewrite rules to your global Git config:

- `https://better-hub.com/...` -> `https://github.com/...`
- `https://www.better-hub.com/...` -> `https://github.com/...`

## Options

- `--host <domain>`: Rewrite source domain (default `better-hub.com`)
- `--target <url>`: Rewrite target Git base URL (default `https://github.com/`)
- `--local`: Write to local repo config instead of global config
- `--dry-run`: Show commands without writing changes
- `--no-www`: Do not add `www.<domain>` rewrite

## Verify

```bash
git config --global --get-regexp '^url\..*insteadOf$'
```
