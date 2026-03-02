#!/usr/bin/env bash
set -euo pipefail

APP_USER="${APP_USER:-openclaw}"
APP_GROUP="${APP_GROUP:-openclaw}"

# Shared writable-dir setup + optional non-root preinstalls/bootstrap.
. /usr/local/bin/prestart-common.sh
prestart_common

exec gosu "${APP_USER}:${APP_GROUP}" "$@"
