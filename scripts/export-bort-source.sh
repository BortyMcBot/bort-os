#!/usr/bin/env bash
set -euo pipefail

# Always refresh generated docs before export.
node /root/.openclaw/workspace/scripts/refresh-project-source.mjs

# Then produce upload artifacts.
node /root/.openclaw/workspace/scripts/export-project-source.mjs --force

echo "Done:"
echo "- /root/.openclaw/workspace/project_source/EXPORT_LATEST.md"
echo "- /root/.openclaw/workspace/dist/bort_source_bundle.tgz"
