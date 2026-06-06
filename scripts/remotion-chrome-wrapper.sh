#!/usr/bin/env bash
set -euo pipefail

profile_dir="${REMOTION_CHROME_USER_DATA_DIR:-$(mktemp -d /private/tmp/toolreel-remotion-chrome-profile.XXXXXX)}"

exec "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --disable-crash-reporter \
  --disable-crashpad \
  --user-data-dir="${profile_dir}" \
  "$@"
