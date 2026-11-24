# Screen Draw (MVP)

A lightweight Electron overlay for drawing directly over a Linux desktop.

## Run

```bash
bun install
bun run start
```

## Available shortcuts

| Input                      | Action                                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| `F9`                       | Toggle drawing mode, when GNOME has not reserved the key.                                                 |
| `Ctrl + Alt + D`           | Toggle drawing mode; use this when `F9` is unavailable.                                                   |
| `Ctrl + N`                 | Choose a white or black background for a separate blank drawing window. Use while drawing mode is active. |
| Left mouse drag            | Draw using the current colour.                                                                            |
| `Alt` + mouse move         | Draw using the current colour.                                                                            |
| Right mouse drag           | Erase.                                                                                                    |
| `Shift` + mouse move       | Erase.                                                                                                    |
| Hold `A`–`Z` while drawing | Select a predefined colour (`R`, `G`, and `B` are red, green, and blue).                                  |
| No colour key              | Draw with the default cyan pen: `#00E5FF`.                                                                |
| `Backspace` or `Ctrl + Z`  | Undo the latest stroke.                                                                                   |
| `Esc`                      | Clear the current canvas.                                                                                 |

Each overlay or canvas window keeps its own drawing history in memory. Nothing is saved to disk.

When drawing mode is off, the overlay deliberately passes mouse input through to the desktop. Press `F9`; the small status label in the bottom-right should change to “Drawing on” before you drag.

If `F9` is intercepted by a desktop shortcut, verify the drawing surface directly with:

```bash
bun run start -- --drawing-on
```

This starts the overlay in drawing mode; use a normal left mouse drag to test the cyan pen.

For maintainers, `bun run start -- --self-test` runs an automated Electron canvas-stroke check and exits with a pass/fail result.

## Linux note

This is an Electron proof of concept. GNOME Wayland restricts always-on-top desktop overlays, so the drawing canvas can work there but may not stay above every other application. For the full desktop-wide overlay behavior, use a GNOME on Xorg session or add a GNOME Shell extension/native compositor integration in a future phase.
