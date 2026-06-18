#!/usr/bin/env bash
set -euo pipefail

cleanup_profile=0
if [[ -n "${REMOTION_CHROME_USER_DATA_DIR:-}" ]]; then
  profile_dir="${REMOTION_CHROME_USER_DATA_DIR}"
else
  profile_dir="$(mktemp -d /private/tmp/toolreel-remotion-chrome-profile.XXXXXX)"
  cleanup_profile=1
fi

cleanup() {
  if [[ "${cleanup_profile}" == "1" ]]; then
    rm -rf "${profile_dir}"
  fi
}
trap cleanup EXIT

"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --disable-crash-reporter \
  --disable-crashpad \
  --user-data-dir="${profile_dir}" \
  "$@"
