#!/usr/bin/env bash
set -euo pipefail

exec "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --disable-crash-reporter \
  --disable-crashpad \
  --user-data-dir="${REMOTION_CHROME_USER_DATA_DIR:-/private/tmp/toolreel-remotion-chrome-profile}" \
  "$@"
