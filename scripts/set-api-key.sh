#!/bin/sh
# Saves your OpenRouter API key (OPENROUTER_API_KEY) into .env without showing it on screen or in shell history.
# Usage (from the project folder): sh scripts/set-api-key.sh   (or: npm run set-key)
set -e
cd "$(dirname "$0")/.."
[ -f .env ] || cp .env.example .env

printf "Paste your OpenRouter API key (input hidden), then press Enter: "
stty -echo 2>/dev/null || true
IFS= read -r key
stty echo 2>/dev/null || true
printf "\n"

case "$key" in
  sk-or-*) ;;
  *) echo "That doesn't look like an OpenRouter API key (it should start with sk-or-). Nothing changed."; exit 1 ;;
esac

tmp=$(mktemp)
grep -v '^OPENROUTER_API_KEY=' .env > "$tmp" || true
printf 'OPENROUTER_API_KEY="%s"\n' "$key" >> "$tmp"
mv "$tmp" .env
key=""
echo "Saved to .env. Restart npm run dev to pick it up."
