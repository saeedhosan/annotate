#!/bin/bash
# Routed through dpkg postrm. Removes the /usr/bin launcher we created so we
# never leave a dangling symlink behind.
set -euo pipefail

# Use fixed values from package.json build config (since package.json may be removed)
EXECUTABLE_NAME="annotate"
SYMLINK_PATH="/usr/bin/$EXECUTABLE_NAME"
BIN_PATH="/opt/Screen Annotate/$EXECUTABLE_NAME"

if [ -L "$SYMLINK_PATH" ] && [ "$(readlink -f "$SYMLINK_PATH")" = "$BIN_PATH" ]; then
  rm -f "$SYMLINK_PATH"
fi
exit 0