#!/usr/bin/env bash
set -euo pipefail

ROOT="/root/.openclaw/workspace"
PUB="$ROOT/public/bort-bundle"

# Refresh + export latest bundle
$ROOT/scripts/export-bort-source.sh

# Copy current project_source files into public dir
FILES=(
  FILE_INDEX.md
  SYSTEM_CONTEXT.md
  STATE_OF_BORT.md
  PROMPT_TEMPLATES.md
  HAT_STATE.md
  ARCHITECTURE_SUMMARY.md
  ROUTING_STATE.md
  OPERATIONS_STATE.md
  CHANGELOG_AUTOGEN.md
  SKILL_REGISTRY.md
  PROJECTS_ACTIVE.md
  PROMPT_ANTIPATTERNS.md
  HAT_OS_RESOLUTION.md
  CLAUDE_SESSION_OPENER.md
  EXPORT_LATEST.md
)

for f in "${FILES[@]}"; do
  cp -f "$ROOT/project_source/$f" "$PUB/$f"
done

# Remove tgz bundle from public dir (flat file listing only)
rm -f "$PUB/bort_source_bundle.tgz"

# Create zip bundle of all files
rm -f "$PUB/bort-bundle.zip"
(
  cd "$PUB"
  zip -q "bort-bundle.zip" "${FILES[@]}"
)

# Write minimal index.html with zip link
{
  echo '<!doctype html>'
  echo '<html><head><meta charset="utf-8"><title>Bort Project Source</title></head><body>'
  echo '<h1>Bort Project Source</h1>'
  echo '<p><a href="bort-bundle.zip">⬇ Download all files (bort-bundle.zip)</a></p>'
  for f in "${FILES[@]}"; do
    echo "<a href=\"$f\">$f</a><br/>"
  done
  echo '</body></html>'
} > "$PUB/index.html"

# Touch marker
date -u +"%Y-%m-%d %H:%M:%S UTC" > "$PUB/LAST_UPDATED.txt"
