#!/usr/bin/env bash
set -euo pipefail

. /usr/local/bin/start-desktop.sh

exec /usr/bin/tini -- "$@"
