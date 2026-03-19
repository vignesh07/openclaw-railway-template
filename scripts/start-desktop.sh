#!/usr/bin/env bash
set -euo pipefail

: "${DISPLAY:=:99}"
: "${XVFB_WHD:=1280x800x24}"
: "${XDG_RUNTIME_DIR:=/tmp/xdg-runtime}"
: "${XDG_CURRENT_DESKTOP:=XFCE}"
: "${XDG_SESSION_DESKTOP:=xfce}"
: "${DESKTOP_SESSION:=xfce}"
: "${NO_AT_BRIDGE:=0}"
: "${GTK_MODULES:=gail:atk-bridge}"

mkdir -p "${XDG_RUNTIME_DIR}"
chmod 700 "${XDG_RUNTIME_DIR}"

Xvfb "${DISPLAY}" -screen 0 "${XVFB_WHD}" -ac +extension RANDR >/tmp/xvfb.log 2>&1 &

for _ in $(seq 1 50); do
  if xdpyinfo -display "${DISPLAY}" >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-$(dbus-daemon --session --fork --print-address)}"
export DISPLAY XVFB_WHD XDG_RUNTIME_DIR XDG_CURRENT_DESKTOP XDG_SESSION_DESKTOP DESKTOP_SESSION NO_AT_BRIDGE GTK_MODULES

{
  printf 'export DISPLAY=%q\n' "${DISPLAY}"
  printf 'export XDG_RUNTIME_DIR=%q\n' "${XDG_RUNTIME_DIR}"
  printf 'export DBUS_SESSION_BUS_ADDRESS=%q\n' "${DBUS_SESSION_BUS_ADDRESS}"
  printf 'export XDG_CURRENT_DESKTOP=%q\n' "${XDG_CURRENT_DESKTOP}"
  printf 'export XDG_SESSION_DESKTOP=%q\n' "${XDG_SESSION_DESKTOP}"
  printf 'export DESKTOP_SESSION=%q\n' "${DESKTOP_SESSION}"
  printf 'export NO_AT_BRIDGE=%q\n' "${NO_AT_BRIDGE}"
  printf 'export GTK_MODULES=%q\n' "${GTK_MODULES}"
} > /tmp/desktop-session.env

startxfce4 >/tmp/xfce.log 2>&1 &
