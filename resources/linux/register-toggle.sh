#!/bin/bash
# Register (or refresh) a GNOME custom keybinding that toggles Annotate.
# Usage: register-toggle.sh <binary-path> [binding-key]
set -euo pipefail

# Fixed install path from package.json build config
INSTALLED="/opt/Screen Annotate"
PKG_FILE="$INSTALLED/package.json"

if [ ! -f "$PKG_FILE" ]; then
    echo "package.json not found at $PKG_FILE" >&2
    exit 1
fi

EXECUTABLE_NAME=$(jq -r '.build.executableName' "$PKG_FILE")
PRODUCT_NAME=$(jq -r '.build.productName' "$PKG_FILE")
SLUG=$(echo "$PRODUCT_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
SYMLINK="/usr/bin/$EXECUTABLE_NAME"

BIN="${1:-}"
[ -x "$BIN" ] || { echo "toggle binary not found: $BIN" >&2; exit 0; }
command -v gsettings >/dev/null 2>&1 || { echo "gsettings not available; skipping" >&2; exit 0; }

BINDING="${2:-F8}"

# Prefer the no-space /usr/bin launcher so GNOME's whitespace-split command
# parsing works; fall back to the real binary otherwise.
LAUNCH="$BIN"
if [ -x "$SYMLINK" ] && [ "$(readlink -f "$SYMLINK")" = "$(readlink -f "$BIN")" ]; then
  LAUNCH="$SYMLINK"
fi
CMD="$LAUNCH --toggle"
SCHEMA="org.gnome.settings-daemon.plugins.media-keys"
KEYPATH="/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/$SLUG/"
ID="$KEYPATH"

gsettings set "$SCHEMA.custom-keybinding:$KEYPATH" name "$PRODUCT_NAME toggle" 2>/dev/null || true
gsettings set "$SCHEMA.custom-keybinding:$KEYPATH" command "$CMD" 2>/dev/null || true
gsettings set "$SCHEMA.custom-keybinding:$KEYPATH" binding "$BINDING" 2>/dev/null || true

LIST="$(gsettings get "$SCHEMA" custom-keybindings 2>/dev/null || true)"
LIST="${LIST#@as }"
case "$LIST" in
  "[]"|"") gsettings set "$SCHEMA" custom-keybindings "[$ID]" 2>/dev/null || true ;;
  *"$ID"*) : ;;
  *) gsettings set "$SCHEMA" custom-keybindings "$(printf '%s' "$LIST" | sed "s|]|, $ID]|")" 2>/dev/null || true ;;
esac

gsettings get "$SCHEMA" custom-keybindings 2>/dev/null | grep -q "$ID" || echo "registration did not take effect" >&2

echo "registered $BINDING -> $CMD" >&2