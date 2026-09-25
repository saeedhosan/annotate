# Contributing

Thanks for helping out. This page is short on purpose.

## Getting set up

You need [Bun](https://bun.sh) 1.4 or newer. It runs the scripts and the tests.

```bash
bun install
bun run dev
```

`bun run dev` starts three watchers. Vite builds the renderer, tsc builds the main process, and Electron restarts when both are ready. You need a display on X11 or Wayland to run the app.

## Before you open a pull request

```bash
bun run test:lint    # eslint and prettier
bun run test:tsc     # tsc for the renderer and the main process
bun run test:unit    # unit, feature and command line tests
```

`bun run lint:write` fixes what it can, so run it if either of the first two complains.

The end to end tests drive a real window, so they need a display:

```bash
bun run test:e2e
```

`bun run test` runs all four in order, types and lint first, then the unit tests, then the end to end tests.

Add a test for anything you change. Drawing and paste logic goes in `tests/*.test.ts` with no Electron needed.

## Code style

Prettier and eslint already decide most of it. Four spaces, single quotes, 100 columns.

Keep these three rules, they are the ones a linter cannot check:

- `src/shared` and `src/config` run in Node and in the browser. No Electron imports, no DOM.
- Platform code lives in `src/main`. Windows, X11, Wayland, GNOME and macOS handling stays there.
- The renderer talks to the main process only through the preload bridge in `src/main/preload.cts`. No direct Electron calls from `src/renderer`.

## Where things live

| Path           | What goes there                             |
| -------------- | ------------------------------------------- |
| `src/shared`   | Drawing model, no platform code, no DOM     |
| `src/config`   | App name, colors, shortcut table            |
| `src/main`     | Windows, shortcuts, IPC, command line       |
| `src/renderer` | Canvas UI, toolbar, paste, PWA assets       |
| `tests`        | Unit, feature and end to end tests          |
| `docs`         | Notes you update when you change a contract |

## Commits and pull requests

- Small commits with one idea each.
- Say what changed and why in the description.
- Add a screenshot for anything you can see.
- Open one pull request per topic.

## Reporting a bug

Open an issue with your OS, your desktop setup (X11 or Wayland, GNOME or other), how you installed it, and how to reproduce it. A screen recording of a drawing problem is worth a lot.
