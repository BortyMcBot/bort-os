#!/usr/bin/env bash
set -euo pipefail

ROOT="/root/.openclaw/workspace"
PUB="$ROOT/public/bort-bundle"

# Refresh + export latest bundle
$ROOT/scripts/export-bort-source.sh

# Copy into public dir
cp -f "$ROOT/project_source/EXPORT_LATEST.md" "$PUB/EXPORT_LATEST.md"
cp -f "$ROOT/dist/bort_source_bundle.tgz" "$PUB/bort_source_bundle.tgz"

# Touch marker
date -u +"%Y-%m-%d %H:%M:%S UTC" > "$PUB/LAST_UPDATED.txt"
