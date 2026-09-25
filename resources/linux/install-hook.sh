#!/bin/bash
# Routed through dpkg postinst. Creates the /usr/bin launcher and best-effort
# F8 registration for the session user. Failures are non-fatal (the app
# re-registers on launch).
set -euo pipefail

# Fixed install path from package.json build config
INSTALLED="/opt/Screen Annotate"
PKG_FILE="$INSTALLED/package.json"

if [ ! -f "$PKG_FILE" ]; then
    echo "package.json not found at $PKG_FILE" >&2
    exit 1
fi

PRODUCT_NAME=$(jq -r '.build.productName' "$PKG_FILE")
EXECUTABLE_NAME=$(jq -r '.build.executableName' "$PKG_FILE")
BIN_PATH="$INSTALLED/$EXECUTABLE_NAME"
SYMLINK_PATH="/usr/bin/$EXECUTABLE_NAME"

[ -x "$BIN_PATH" ] || exit 0
ln -sf "$BIN_PATH" "$SYMLINK_PATH"

REG="$INSTALLED/resources/register-toggle.sh"
[ -x "$REG" ] || exit 0

USER_NAME="${SUDO_USER:-${LOGNAME:-}}"

if [ -z "$USER_NAME" ] || [ "$USER_NAME" = root ]; then
  USER_NAME="$(ls /home 2>/dev/null | head -1 || true)"
fi
id -u "$USER_NAME" >/dev/null 2>&1 || exit 0

UID_NR="$(id -u "$USER_NAME")"
export HOME="/home/$USER_NAME"
export XDG_RUNTIME_DIR="/run/user/$UID_NR"

SESSION_PID="$(pgrep -u "$USER_NAME" -f 'gnome-shell|plasmashell|cinnamon|xfce4-session|mutter' 2>/dev/null | head -1 || true)"
if [ -n "$SESSION_PID" ]; then
  BUS_ADDR="$(tr '\0' '\n' < "/proc/$SESSION_PID/environ" 2>/dev/null | grep '^DBUS_SESSION_BUS_ADDRESS=' | cut -d= -f2- || true)"
fi
export DBUS_SESSION_BUS_ADDRESS="${BUS_ADDR:-unix:path=$XDG_RUNTIME_DIR/bus}"
export DISPLAY="${DISPLAY:-:0}"
export WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}"

runuser -u "$USER_NAME" -- "$REG" "$BIN_PATH" 2>/dev/null || true
exit 0