# Annotate

Annotate is a lightweight screen annotation tool for drawing over any screen or window. It is built for presentations, tutorials, demonstrations, and whiteboarding.

## Why this exists

Screen annotation often requires changing windows or using a separate drawing tool.

Annotate keeps the drawing layer directly over the screen.

It provides quick keyboard and mouse controls without getting in the way.

## How it works

```text
User Input
    |
Keyboard / Mouse / CLI
    |
Input Resolution (CommandLine / ShortcutManager / IPC)
    |
Annotation Controller (WindowManager / Annotation state)
    |
Drawing / Pasted Objects (Renderer)
    |
Canvas Renderer
    |
Transparent Overlay
```

The overlay stays above other applications.

The underlying screen is not modified.

Drawing data stays in memory during the session.

## Core Features

- **Overlay:** Draw directly over the current screen.
- **Drawing:** Create smooth freehand strokes with keyboard and mouse controls.
- **Erasing:** Remove parts of existing annotations using Shift hold while drawing.
- **Global Toggle:** Show/hide the overlay with F8; quit with Ctrl+F8.
- **Command line:** Command line interface to basic interaction.
- **Blank Canvas:** Create an independent blank drawing window Ctrl+N.
- **Undo and clear:** Undo the last stroke Ctrl+Z or clear the current draw (Escape).
- **Colors drawing:** Switch between 26 drawing colors using A-Z - R = red.
- **Pasted Objects:** Paste images and text onto the overlay ctrl+v.
- **Cross-Platform:** Desktop (Linux/Windows/macOS) + web/PWA (separate build).

## Requirements

### Functional Requirements

- Draw freehand annotations over the screen.
- Erase existing annotations.
- Undo the last stroke.
- Clear all annotations.
- Select drawing colors via A-Z.
- Paste supported images and text from clipboard.
- Move pasted objects.
- Show and hide the desktop overlay (F8 toggle).
- Create independent blank canvases (Ctrl+N).
- CLI control: quit, hide, show, toggle, run agent.
- Second-instance forwarding: --quit/--toggle forwarded to running instance.
- Support keyboard, mouse, and touch input where available.

### Non-functional Requirements

- Drawing input should feel responsive.
- The desktop overlay should remain above other windows.
- The underlying screen should not be modified.
- Drawing should remain smooth during continuous input.
- Desktop input handling should not block the underlying system unnecessarily.
- The application should use memory efficiently during long sessions.
- Single-instance lock prevents multiple overlays.

### Extended Requirements

- Support Ctrl+N for a new blank canvas.
- Support Linux, Windows, and macOS desktop environments.
- Keep platform-specific behavior isolated from core drawing logic.
- Support global F8 toggle to start and Ctrl+F8 quit on desktop Cross-Platform.
- Provide a browser-based PWA with supported annotation features (separate build).

### Out of Scope

- User accounts.
- Cloud synchronization.
- Online collaboration.
- Screen recording.
- Video recording.
- Image editing.
- Persistent drawing storage.
- Complex graphic-design tools.
- Multi-monitor coordinate mapping.

## UX and UI

**User Flow**

```text
Launch (CLI or shortcut)
            |
Annotation Overlay (transparent, always-on-top)
            |
Draw / Erase / Paste / Undo / Clear / Color select
            |
Hide Overlay (F8) or Quit (Ctrl+F8 / --quit)
            |
Application Running (background) / Exited
```

**New canvas flow**

```text
        Ctrl+N
          |
Choose Background (dialog)
          |
Create Blank Canvas (new window)
          |
Draw / Erase / Paste / Undo / Clear
```

**Web/PWA flow**

```text
  Open web/PWA
      |
Drawing Canvas
      |
Draw / Erase / Paste
      |
Undo / Clear
```

**Foundation Screens**

- **Overlay** — Transparent desktop drawing layer (frameless, always-on-top).
- **Web/PWA Canvas** — Browser-based drawing surface (feature subset).
- **New blank Canvas** — Independent drawing surface with a selected background.

**Discovery Screens**

- **New Canvas Dialog** — Select the background before creating a canvas.
- **Mobile Toolbar** — Touch-friendly for drawing, erasing, colors, undo, and clear.

## Assumptions

**High-level Estimate**

| Resource             | Volume                  | Scale           | Operational |
| :------------------- | :---------------------- | :-------------- | :---------- |
| **Active drawing**   | 1 session/user          | Per application | In memory   |
| **Drawing strokes**  | Hundreds–thousands      | Per session     | In memory   |
| **Pasted objects**   | Tens–hundreds           | Per session     | In memory   |
| **Canvas size**      | Up to screen resolution | Per window      | Local       |
| **Concurrent users** | N/A                     | Desktop/PWA     | No backend  |
| **Data storage**     | 0 persistent records    | Per session     | No database |

## Data Layer

Annotate uses in-memory application state rather than persistent storage.

- **Storage:** In-memory (renderer process state + IPC to main for clipboard)
- **Data:** Drawing strokes, colors, pasted objects, canvas state, and undo history
- **Lifetime:** Active application or canvas session
- **Persistence:** None (settings stored in `userData/config.json`)

**Data Considerations**

- **Consistency:** Single-process in-memory state (renderer).
- **Scaling:** Not applicable.
- **Retention:** Cleared when the application or canvas is closed.
- **Privacy:** Drawing data is not persisted or uploaded.

## API Layer

**Desktop APIs**

- **Global Shortcut** — Register and handle system-wide global keyboard shortcuts.
- **Window API** — Create, show, hide, and manage transparent application windows.
- **Clipboard API** — Read supported clipboard content for paste operations.
- **Input API** — Receive keyboard and pointer events from the application and system.
- **Single-instance Lock** — Prevent multiple overlay instances; forward CLI args.

**Browser APIs**

- **Canvas API** — Render strokes and pasted objects.
- **Clipboard API** — Read supported clipboard content.
- **Pointer Events API** — Handle mouse, pen, and touch input.
- **Keyboard Events API** — Handle keyboard interactions.
- **Fullscreen API** — Provide a full-screen drawing experience where supported.
- **Storage APIs** — Not required for the current implementation.

**Application Interface (IPC)**

- **app-config** — Provide the application configuration (e.g. window title) to the renderer.
- **create-new-window** — Request creation of a new blank canvas.
- **clipboard-content** — Transfer clipboard content to the annotation layer.
- **window-visibility** — Notify renderer of overlay show/hide.

**API Considerations**

- Keep platform-specific APIs behind application abstractions.
- Use browser APIs for web/mobile functionality.
- Use native/system APIs only where desktop functionality requires them.
- Avoid coupling core drawing logic to a specific platform API.

## Architecture

### Core Components

- **Application** — App lifecycle, CLI parsing, single-instance lock, command dispatch.
- **CommandLine** — Command line argument parsing, command registry, execution.
- **ShortcutManager** — Registers and manages platform-specific global shortcuts.
- **WindowManager** — Creates, tracks, and manages windows and their lifecycle.
- **IpcServer** — Handles create-new-window, clipboard-content, window-visibility.
- **ClipboardService** — Bridges renderer clipboard reads to main process.
- **Renderer/Annotation** — Manages the annotation UI and handles drawing interactions.
- **Logger** — Provides structured console and file logging using `loggest`.

### High-Level Design

```text
CLI / Shortcut / IPC
      |
Application
      |
Command / Shortcut / IPC Handler
      |
Window Manager
      |
Annotation State
      |
Canvas Renderer
      |
Draw / Erase / Paste
      |
Undo / Clear
```

The **Window Manager** handles desktop window behavior separately from drawing logic.
The **Shortcut Manager** isolates platform-specific global shortcut registration.

### Detailed Design

## Trade-offs

- Keeps the system simple and responsive, but drawings are lost when the session ends.
- Provides system-level annotation but requires platform-specific window and input.
- Enables native desktop behavior but adds platform integration work.
- Keeps annotation fast but provides fewer editing and customization features.
- Works on X11/Win/macOS instantly; on Wayland only GNOME dconf fallback works.

## Bottlenecks

### Identify bottlenecks

- Rapid mouse movement can produce many points and affect drawing smoothness.
- Large canvases can increase rendering work during continuous drawing.
- Finding and updating affected strokes can become expensive as annotations grow.
- Desktop shortcut handling differs across systems; Wayland blocks direct grabs.
- Window behavior varies between desktop environments and display systems.
- Screen coordinates must be mapped correctly across displays (not implemented).
- Vulkan/Wayland compatibility can crash the GPU process.

### Resolved bottlenecks

- Store strokes instead of capturing the full screen.
- Interpolate pointer movement and avoid unnecessary rendering work.
- Keep only drawing state required for the active session.
- Isolate window and shortcut handling behind platform-specific components.
- Use native transparent windows and keep overlay separate from drawing logic.
- Forward `--quit`/`--toggle` to running instance via single-instance lock.

## Performance

### Performance Considerations

- **Input latency** — Drawing should respond immediately to pointer movement.
- **Rendering** — Avoid unnecessary full-canvas redraws during continuous drawing.
- **Memory usage** — Keep stroke and pasted-object data compact.
- **Large sessions** — Performance should remain usable as annotations increase.

### Target Benchmarks

- **Input response** — No noticeable delay during drawing.
- **Drawing smoothness** — Maintain smooth rendering during rapid pointer movement.
- **Memory growth** — No excessive growth during a normal drawing session.

**Target Benchmarks**

The initial benchmarks focus on identifying and improving drawing bottlenecks.

- **Rapid drawing test** — No visible stuttering during continuous input.
- **Large stroke test** — Remain responsive with thousands of stored points.
- **Long session test** — No abnormal memory growth during extended use.
- **Erase test** — Erasing remains responsive as stroke count increases.

## Testing

### Unit Tests

Test the core application logic independently of Electron, the browser, or the operating system.

**Drawing**

- Create a stroke from pointer points.
- Add points to an existing stroke.
- Remove the last stroke with undo.
- Clear all strokes.
- Store and retrieve stroke properties such as color and points.

**Pasted Objects**

- Add an image or text object.
- Move a pasted object.
- Remove an object when required.
- Preserve object data in the current session.

**Annotation State**

- Add and remove drawing strokes.
- Change drawing color.
- Track pasted objects.
- Reset annotation state.

**CommandLine**

- Parse supported commands and arguments.
- Resolve a command from the command registry.
- Execute the correct command.
- Reject unknown commands or invalid arguments.

**Command Handling**

- `show` changes application visibility to shown.
- `hide` changes application visibility to hidden.
- `toggle` switches the current visibility state.
- `quit` requests application shutdown.

### Feature Tests

Test the interaction between the main application components.

**Global Shortcut**

- F8 toggles the overlay visibility.
- Ctrl+F8 requests application quit.
- Shortcuts are registered and released correctly.

**Window Management**

- Application creates the annotation window.
- Overlay can be shown and hidden.
- New blank canvas creates an independent window.
- Window state is tracked correctly.

**IPC**

- `create-new-window` creates a new canvas.
- `clipboard-content` transfers supported clipboard data.
- `window-visibility` updates renderer visibility state.
- Invalid IPC requests are rejected safely.

**Clipboard**

- Supported image content can be pasted.
- Supported text content can be pasted.
- Unsupported clipboard content is ignored or rejected safely.

**Single Instance**

- Starting a second application instance does not create another overlay.
- CLI commands from the second instance are forwarded to the running instance.

**Command line**

- `--show` shows the application.
- `--hide` hides the application.
- `--toggle` toggles visibility.
- `--quit` exits the running instance.

### End-to-End Tests

Test the main user workflows through the actual application.

**Basic Annotation**

- Launch Annotate.
- Show the overlay.
- Draw several strokes.
- Change color.
- Erase part of the drawing.
- Undo the last stroke.
- Clear the canvas.

**Paste Workflow**

- Copy an image or text.
- Paste it onto the overlay.
- Verify the object appears correctly.
- Move the pasted object.

**Overlay Workflow**

- Launch the application.
- Toggle the overlay with F8.
- Verify the overlay appears and disappears.
- Verify the underlying application remains unchanged.

**New Canvas Workflow**

- Press Ctrl+N.
- Select a background.
- Create a blank canvas.
- Draw and edit on the new canvas.
- Verify the original overlay remains independent.

**Command line Workflow**

- Launch Annotate.
- Execute `--hide`, `--show`, and `--toggle`.
- Verify the running application responds correctly.
- Execute `--quit`.
- Verify the application exits.

**Second Instance Workflow**

- Start Annotate.
- Start Annotate again with `--toggle` or `--quit`.
- Verify the second process forwards the command.
- Verify only one application instance remains active.

**Session Data**

- Draw strokes and paste objects.
- Close the application.
- Relaunch Annotate.
- Verify previous drawing data is not restored.

## Release

Annotate has two release targets:

- **Desktop** — Packaged as native applications for Linux, Windows, and macOS.
- **PWA** — Built as a browser application and installable from supported browsers.

**Release Flow**

```text
Source
   |
Gith Push (CI/CD disptachs)
   |
Tests (unit + feature)
   |
Build App (tsc + vite)
   |
Desktop Build / web+PWA Build
   |
Package / Web Deploy
   |
App Distribution / Browser / PWA
```

**Desktop Packaging**

- **Linux** — `.deb` and `.AppImage` (dconf skipped).
- **Windows** — NSIS installer and portable `.exe`.
- **macOS** — `.dmg` and `.zip` (`productName` = executableName).

Desktop builds include native window, global shortcut (F8/Ctrl+F8), overlay, and platform-specific integration.

**Web/PWA Packaging**

- Build the browser application as static web assets (vite build).
- Deploy the web application to a web host.
- Provide a web manifest & service worker to install and offline support if applicable.
- PWA functionality is limited to browser-supported annotation features.

### Rollout

- Test desktop packages on their target platforms before release.
- Deploy the PWA after browser and responsive behavior are verified.
- Release both from the same version when their functionality is aligned.

### Rollback

- **Desktop** — Re-publish the previous stable package.
- **PWA** — Deploy the previous stable web build.
- No database rollback is required because Annotate has no persistent backend data.
