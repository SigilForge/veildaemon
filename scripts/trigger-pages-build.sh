#!/usr/bin/env bash
set -euo pipefail

OWNER="${1:-SigilForge}"
REPO="${2:-veildaemon}"

gh api --method PUT "repos/${OWNER}/${REPO}/pages" \
  -f build_type=legacy \
  -f 'source[branch]=main' \
  -f 'source[path]=/'

gh api --method POST "repos/${OWNER}/${REPO}/pages/builds"
echo "Pages rebuild queued for ${OWNER}/${REPO}. Check Settings → Pages; expect 10–15 minutes."