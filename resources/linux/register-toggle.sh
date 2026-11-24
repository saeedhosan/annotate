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
case "$EXECUTABLE_NAME" in
    ''|.*|*[!A-Za-z0-9._-]*|.|..)
        echo "invalid executableName in $PKG_FILE" >&2
        exit 1
        ;;
esac
case "$PRODUCT_NAME" in
    ''|*[!A-Za-z0-9\ ._-]*)
        echo "invalid productName in $PKG_FILE" >&2
        exit 1
        ;;
esac
SLUG=$(echo "$PRODUCT_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
case "$SLUG" in
    ''|*[!a-z0-9-]*)
        echo "invalid slug derived from productName" >&2
        exit 1
        ;;
esac

SYMLINK="/usr/bin/$EXECUTABLE_NAME"

BIN="${1:-}"
[ -x "$BIN" ] || { echo "toggle binary not found: $BIN" >&2; exit 0; }
case "$BIN" in
    /*) ;;
    *)
        echo "binary path must be absolute: $BIN" >&2
        exit 1
        ;;
esac
case "$BIN" in
    *[!A-Za-z0-9._/\ -]*)
        echo "unsafe binary path: $BIN" >&2
        exit 1
        ;;
esac

command -v gsettings >/dev/null 2>&1 || { echo "gsettings not available; skipping" >&2; exit 0; }

BINDING="${2:-F8}"
case "$BINDING" in
    *[!A-Za-z0-9\<\>_-]*|'')
        echo "invalid binding key: $BINDING" >&2
        exit 1
        ;;
esac
case "$BINDING" in
    F[1-9]|F1[0-9]|F2[0-4]|*'<Primary>'*|*'<Alt>'*|*'<Super>'*|*'<Shift>'*|*'<Control>'*|*'<Mod'*|*'<Meta>'*) ;;
    *)
        echo "unsupported binding key: $BINDING" >&2
        exit 1
        ;;
esac

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
if [[ "$LIST" != *"'$KEYPATH'"* ]]; then
    if command -v python3 >/dev/null 2>&1; then
        python3 - "$LIST" "$KEYPATH" <<'PY'
import ast
import subprocess
import sys

raw = sys.argv[1].strip() or "[]"
path = sys.argv[2]
try:
    value = ast.literal_eval(raw)
except Exception:
    value = []
if not isinstance(value, list):
    value = []
items = [str(item) for item in value]
if path not in items:
    items.append(path)
formatted = "[" + ", ".join("'" + item.replace("'", "\\'") + "'" for item in items) + "]"
subprocess.run(
    [
        "gsettings",
        "set",
        "org.gnome.settings-daemon.plugins.media-keys",
        "custom-keybindings",
        formatted,
    ],
    check=False,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
PY
    else
        case "$LIST" in
          "[]"|"") gsettings set "$SCHEMA" custom-keybindings "['$KEYPATH']" 2>/dev/null || true ;;
          *) gsettings set "$SCHEMA" custom-keybindings "$(printf '%s' "$LIST" | sed "s|]|, '$KEYPATH']|")" 2>/dev/null || true ;;
        esac
    fi
fi

gsettings get "$SCHEMA" custom-keybindings 2>/dev/null | grep -q "$ID" || echo "registration did not take effect" >&2

echo "registered $BINDING -> $CMD" >&2