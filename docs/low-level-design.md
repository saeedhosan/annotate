# Annotate — Low-Level Design

## Table of Contents

- [Application](#application)
- [ApplicationConfig](#applicationconfig)
- [CommandLine](#commandline)
- [PlatformConfigure](#platformconfigure)
- [OperatingSystemInformation](#operatingsysteminformation)
- [WindowManager](#windowmanager)
- [IpcServer](#ipcserver)
- [ClipboardService](#clipboardservice)
- [IPC Channel Contracts](#ipc-channel-contracts)
- [ShortcutManager](#shortcutmanager)
- [AnnotationApp](#annotationapp)
- [Annotate](#annotate)
- [Drawing](#drawing)
- [PastedObjectStore](#pastedobjectstore)
- [Accelerator](#accelerator)
- [Modifier](#modifier)
- [Renderer](#renderer)
- [PasteService](#pasteservice)
- [HtmlSanitizer](#htmlsanitizer)
- [Toast](#toast)
- [Toolbar](#toolbar)
- [Logger](#logger)
- [Open Discussion](#open-discussion)

---

## Purpose

This document defines the internal design of Annotate, including components, responsibilities, interfaces, data structures, error handling, and test boundaries.

## Application

The composition root for the Electron main process.

- `os(): OperatingSystemInformation` — Get operating system information.
- `env(): string` — Get the application env.
- `name(): string` — Get the application name.
- `title(): string` — Get the application title.
- `version(): string` — Get the application version.
- `config(): ApplicationConfig` — Get application configuration.
- `theme(): Theme` — Get the current application theme.
- `colors(): ColorPalette` — Get application colors.
- `about(): ApplicationInfo` — Get application information.
- `appPath(): string` — Get the application code path.
- `binaryPath(): string` — Get the application binary path.
- `executablePath(): string` — Get the resolved application executable path.
- `configure(): Application` — Configure application settings.
- `register(): Application` — Register services, drivers, and dependencies.
- `bootstrap(): Application` — Initialize registered services.
- `boot(): Application` — Boot the application after initialization.
- `start(): void` — Start application services.
- `stop(): void` — Stop application services.
- `quit(): void` — Shut down the application.
- `withEnv(env:EnvEnum): Application` — Configure application env.
- `withConfig(config: ApplicationConfig): Application` — Configure settings.
- `withTheme(theme: Theme): Application` — Configure the application theme.
- `withCommands(): Application` — Register application commands.
- `withKeyBindings(): Application` — Register keyboard bindings.
- `withServices(): Application` — Register application services.
- `withDrivers(): Application` — Register platform drivers.
- `isRunning(): boolean` — Check whether the application is running.
- `isCommandLine(): boolean` — Check whether the application is running command line.
- `isRunningTests(): boolean` — Check whether the application is running tests.
- `handleSecondInstance(argv: string[]): void` — Handle another launch of the application.
- `handleReady(): void` — Handle application readiness.
- `handleActivate(): void` — Handle application activation.
- `handleBeforeQuit(): void` — Handle shutdown preparation.
- `handleWindowAllClosed(): void` — Handle all application windows closing.
- `isReady(): boolean` — Check whether the application is ready.
- `windows(): BrowserWindow[]` — Get active application windows.

A typical lifecycle is:

```text
configure()
    |
register()
    |
bootstrap()
    |
boot()
    |
start()
```

## ApplicationConfig

Defines application-wide configuration used during application initialization.

```text
constructor(
    name: string,
    version: string,
    theme: Theme,
    colors: ColorPalette,
    commands: Command[],
    keyBindings: KeyBinding[]
)
```

- `name(): string` — Returns the application name.
- `version(): string` — Returns the application version.
- `theme(): Theme` — Returns the configured theme.
- `colors(): ColorPalette` — Returns the configured color palette.
- `commands(): Command[]` — Returns configured commands.
- `keyBindings(): KeyBinding[]` — Returns configured keyboard bindings.

**Validation**

Configuration should be validated when created.

- Name must not be empty.
- Version must be present.
- Required theme and color configuration must be provided.
- Commands must be valid command instances.
- Key bindings must be valid and non-conflicting.

**Unit Tests**

- Creates valid configuration successfully.
- Returns the correct name and version.
- Returns configured theme and colors.
- Returns configured commands and key bindings.
- Rejects an empty application name.
- Rejects invalid required configuration.
- Preserves configured command and key-binding definitions.

## CommandLine

Provides the command-line interface for launching and controlling Annotate.

**Command**

Defines the contract for an application command.

- `name(): string` — Return the command name.
- `description(): string` — Return the command description.
- `execute(args: CommandArguments): any` — Execute the command.

**CommandLine**

Parses command-line input and dispatches registered commands.

```text
constructor()
```

- `isRunningAgentMode():bool` — Check whether the system was launched in agent mode.
- `register(command: Command): CommandLine` — Register a command.
- `registerMany(commands: Command[]): CommandLine` — Register multiple commands.
- `commands(): Command[]` — Return registered commands.
- `parse(argv: string[]): CommandInput` — Parse process arguments.
- `resolve(input: CommandInput): Command | null` — Resolve the requested command.
- `execute(input: CommandInput): any` — Execute the resolved command.
- `help(): string` — Generate command help.
- `has(name: string): boolean` — Check whether a command is registered.

### Built-in Commands

**ShowApplicationCommand**

Shows the application window or overlay.

- `name(): string` — Returns `show`.
- `description(): string` — Returns the command description.
- `execute(args: CommandArguments): any` — Requests the application to become visible.

**HideApplicationCommand**

Hides the application window or overlay.

- `name(): string` — Returns `hide`.
- `description(): string` — Returns the command description.
- `execute(args: CommandArguments): any` — Requests the application to become hidden.

**ToggleApplicationCommand**

Toggles application visibility.

- `name(): string` — Returns `toggle`.
- `description(): string` — Returns the command description.
- `execute(args: CommandArguments): any` — Toggles application visibility.

**QuitApplicationCommand**

Quits the application.

- `name(): string` — Returns `quit`.
- `description(): string` — Returns the command description.
- `execute(args: CommandArguments): any` — Requests application shutdown.

**Command Dependencies**

Each application command receives the service required to perform its operation.

```text
ShowApplicationCommand   => WindowManager
HideApplicationCommand   => WindowManager
ToggleApplicationCommand => WindowManager
QuitApplicationCommand   => Application
```

> Commands should not access `process`, Electron APIs, or other infrastructure directly when an application service already provides the required behavior.

**Data Interface**

_CommandInput_ — Represents parsed command-line input.

- `name: string | null`
- `arguments: string[]`
- `options: Record<string, string | boolean>`

_CommandArguments_ — Arguments passed to a command during execution.

- `arguments: string[]`
- `options: Record<string, string | boolean>`

_CommandResult_ — Represents the outcome of command execution.

- `success: boolean`
- `message?: string`
- `code: number`

**Registration**

Commands are registered during application configuration.

```text
Application
    |
CommandLine.registerMany()
    |— show
    |— hide
    |— toggle
    |— quit
```

**Execution Flow**

```text
process.argv
    |
CommandLine.parse()
    |
CommandInput
    |
CommandLine.resolve()
    |
Command
    |
Command.execute()
    |
CommandResult
```

**Error Handling**

- Unknown commands return a failed `CommandResult`.
- Invalid arguments are rejected before execution when possible.
- Duplicate command names are rejected.
- Empty input resolves to no command.
- Command failures are converted to a controlled `CommandResult`.
- Help requests return command usage without executing a command.

**Design Boundary**

`CommandLine` owns command-line parsing, registration, resolution, and dispatch.

`Command` implementations own individual command behavior.

They do not:

- Manage application lifecycle directly.
- Implement window behavior.
- Register global shortcuts.
- Access renderer state.
- Parse command-line arguments inside individual commands.

**Unit Tests**

- Parses supported commands.
- Parses command arguments and options.
- Detects help and agent flags.
- Resolves registered commands.
- Rejects unknown commands.
- Rejects duplicate command names.
- Executes the resolved command.
- Returns a controlled result for command failures.
- Generates help from registered commands.
- Detects agent mode correctly.

## PlatformConfigure

Applies platform-specific Electron configuration before the application starts. Implemented in `src/main/PlatformConfigure.ts`.

```text
constructor(os: OperatingSystemInformation)
```

- `apply(): void` — Apply all required platform configuration.
- `applyWayland(): void` — Apply Wayland-specific Electron configuration.
- `applyX11(): void` — Apply X11-specific configuration when required.
- `applyWindows(): void` — Apply Windows-specific configuration when required.
- `applyMacOS(): void` — Apply macOS-specific configuration when required.
- `isWayland(): boolean` — Check whether the current session uses Wayland.
- `isX11(): boolean` — Check whether the current session uses X11.
- `isWindows(): boolean` — Check whether the application is running on Windows.
- `isMacOS(): boolean` — Check whether the application is running on macOS.

**Configuration Flow**

```text
OperatingSystemInformation
    |
PlatformConfigure
    |
Detect Platform
    /     |      \
Wayland  X11  Windows/macOS
    |      |        |
Apply   Apply    Apply
```

**Design Boundary**

`PlatformConfigure` only handles **platform configuration**.

It does not manage windows, shortcuts, drawing, or application lifecycle.

**Error Handling**

- Unsupported platform configuration is skipped safely.
- Optional configuration failures should not prevent system startup unless required.
- Invalid platform information falls back to the default Electron configuration.

**Unit Tests**

- Applies the correct configuration for Wayland.
- Applies the correct configuration for Windows.
- Applies the correct configuration for macOS.
- Does not apply unrelated platform options.
- Handles unknown platform information safely.

## OperatingSystemInformation

Represents the operating system and desktop runtime environment detected by the application.

```text
constructor(
    platform: string,
    name: string,
    version: string,
    release: string,
    architecture: string,
    session: string | null,
    desktopEnvironment: string | null,
    displayServer: string | null
)
```

- `platform: string` — Runtime platform identifier.
- `name: string` — Operating system name.
- `version: string` — Operating system version.
- `release: string` — Operating system release.
- `architecture: string` — System architecture.
- `session: string | null` — Desktop session type.
- `desktopEnvironment: string | null` — Desktop environment when available.
- `displayServer: string | null` — Display server when available.
- `fromRuntime(): OperatingSystemInformation` — Contains the platform detection logic.
- `isLinux(): boolean` — Check whether the platform is Linux.
- `isWindows(): boolean` — Check whether the platform is Windows.
- `isMacOS(): boolean` — Check whether the platform is macOS.
- `isWayland(): boolean` — Check whether the display server is Wayland.

**Unit Tests**

- Detects Linux correctly.
- Detects Windows correctly.
- Detects macOS correctly.
- Detects Wayland sessions.
- Handles unavailable desktop environment information.
- Handles unknown platform information safely.

## WindowManager

Manages the lifecycle, visibility, and configuration of application windows.

```text
constructor(config: Partial<WindowConfig> = {})
```

- `createOverlay(): BrowserWindow` — Create and register the transparent overlay.
- `createBlankWindow(background = 'transparent'): BrowserWindow` — Create and register a blank canvas window.
- `setVisible(visible: boolean): void` — Show or hide the annotation overlay.
- `isVisible(): boolean` — Check whether the annotation overlay is visible.
- `revealOverlay(): void` — Show the overlay and make it available for interaction.
- `focusOverlay(): void` — Focus the overlay when interaction requires it.
- `promptForNewCanvas(parent?: BrowserWindow): Promise<void>` — Request creation of a new blank canvas.
- `track(window: BrowserWindow): void` — Register an window for lifecycle management.
- `windows(): BrowserWindow[]` — Return the currently tracked application windows.
- `load(window?: BrowserWindow, background?: string): void` — Load renderer content into a window.
- `close(window: BrowserWindow): void` — Remove and close a tracked window.
- `closeAll(): void` — Close all tracked application windows.

**Window Types**

_Overlay Window_ — The main annotation surface.

- Transparent.
- Always on top.
- Covers the available screen area.
- Hosts the annotation renderer.
- Can be shown or hidden without destroying the window.

_Blank Canvas Window_ — An independent drawing window.

- Uses a selectable background.
- Hosts the annotation renderer.
- Has its own drawing session.
- Is managed independently from the overlay.

**Data Interface**

_WindowConfig_

- `width: number`
- `height: number`
- `transparent: boolean`
- `alwaysOnTop: boolean`
- `resizable: boolean`
- `backgroundColor?: string`
- `show: boolean`

_WindowState_

- `overlay: BrowserWindow | null`
- `windows: Set<BrowserWindow>`
- `visible: boolean`

**Lifecycle**

```text
Application
    |
WindowManager
    |
Create Window
    |
Configure Window
    |
Load Renderer
    |
Track Window
    |
Manage Visibility / Lifecycle
```

**Window Creation Flow**

```text
createOverlay()
    |
Create BrowserWindow
    |
Apply WindowConfig
    |
Load Renderer
    |
Track Window
    |
Return BrowserWindow
```

**New Canvas Flow**

```text
promptForNewCanvas()
    |
createBlankWindow()
    |
Configure background
    |
Load Renderer
    |
Track Window
```

**Error Handling**

- Window creation failures should be reported to the application.
- Loading failures should not leave invalid windows tracked.
- Closing an untracked window should be a safe no-op.
- Recreating an existing overlay should be prevented or return the existing instance.
- Window cleanup should remove closed windows from the tracked collection.

**Design Boundary**

`WindowManager` owns window lifecycle and desktop window behavior.

It does not:

- Handle drawing or erasing.
- Store annotation strokes.
- Resolve keyboard or pointer gestures.
- Implement global shortcuts.
- Manage application lifecycle.

**Unit Tests**

- Creates the overlay with the correct configuration.
- Creates a blank canvas with the correct configuration.
- Tracks created windows.
- Removes closed windows from tracking.
- Shows and hides the overlay correctly.
- Returns the correct visibility state.
- Prevents duplicate overlay creation.
- Handles window creation failures safely.

**Feature Tests**

- Overlay starts transparent and always on top.
- F8 visibility changes affect the overlay.
- A new canvas creates an independent window.
- Closing a canvas removes it from the manager.
- Renderer content loads correctly in each window.

**Design Considerations**

- Keep Electron-specific window APIs inside `WindowManager`.
- Keep window configuration separate from annotation state.
- Treat each blank canvas as an independent window and drawing session.
- Avoid exposing Electron internals to the rest of the application where possible.

## IpcServer

Provides the controlled interface between the renderer process and the Electron main process.

```text
constructor(windowManager: WindowManager, clipboard: ClipboardService)
```

- `register(): void` — Register all supported IPC handlers.
- `unregister(): void` — Remove registered IPC handlers during shutdown.
- `createNewWindow(): Promise<void>` — Handle a renderer request to create a new canvas window.
- `clipboardContent(): Promise<ClipboardContent>` — Provide supported clipboard content to the renderer.

**create-new-window**

Requests the main process to create a new blank canvas.

```text
Renderer
    |
    | create-new-window
    |
IpcServer
    |
WindowManager
    |
Blank Canvas
```

**clipboard-content**

Provides supported clipboard content from the main process.

```text
Renderer
   |
   | clipboard-content
   |
IpcServer
   |
ClipboardService
```

**Data Structures**

_ClipboardContent_ — Represents supported clipboard data.

- `type: ClipboardContentType`
- `text: string | null`
- `html: string | null`
- `image: ClipboardImage | null`

_ClipboardContentType_

- `text`
- `html`
- `image`
- `empty`

**Error Handling**

- Reject unsupported IPC channels.
- Validate IPC request arguments before processing them.
- Handle unavailable clipboard content safely.
- Do not expose privileged Electron APIs directly to the renderer.
- Prevent invalid requests from reaching privileged services.
- Return controlled errors instead of exposing internal exceptions.

**Security Boundary**

```text
Renderer
    |
    | IPC
    |
IpcServer
    |
    ├── Validate request
    |
    ├── Resolve operation
    |
Application Service
```

The renderer can only access operations explicitly exposed by `IpcServer`.

**Design Boundary**

`IpcServer` owns the IPC boundary and request validation.

It does not:

- Create windows directly.
- Access Electron window APIs outside `WindowManager`.
- Implement clipboard logic.
- Manage drawing state.
- Handle application lifecycle.

`IpcServer` delegates operations to application services.

**Unit Tests**

- Registers all expected IPC handlers.
- Unregisters handlers correctly.
- Handles valid `create-new-window` requests.
- Handles valid clipboard requests.
- Rejects unsupported channels.
- Rejects invalid request arguments.
- Handles unavailable clipboard content safely.

**Feature Tests**

- Renderer can request a new canvas.
- Renderer receives supported clipboard content.
- Invalid renderer requests cannot access privileged operations.
- IPC failures do not crash the main process.

## ClipboardService

Reads supported clipboard content from the operating system for the renderer to paste.

```text
constructor()
```

- `clipboardContent(): Promise<ClipboardContent>` — Resolve the current clipboard contents into a supported `ClipboardContent`.

**Resolution Order**

```text
Clipboard Items
    |
Has image/* type?  ──> image content
    |
Has text/html?     ──> html content
    |
Clipboard readText ──> text content
    |
else               ──> empty content
```

**Empty Result**

- When clipboard content is unavailable, the service resolves to `{ type: 'empty', text: null, html: null, image: null }` instead of throwing.

**Design Boundary**

`ClipboardService` owns clipboard reads only.

It does not:

- Manage windows.
- Handle paste placement.
- Store clipboard history.
- Modify clipboard contents.

It is used by `IpcServer` for the `clipboard-content` channel.

**Unit Tests**

- Resolves image clipboard content.
- Resolves html clipboard content.
- Resolves plain text clipboard content.
- Resolves empty clipboard content safely.

## IPC Channel Contracts

Defines the channels, payloads, and return values exchanged between the renderer and Electron main process.

**Channel Naming**

Use explicit, action-oriented channel names.

```text
app-config
create-new-window
clipboard-content
window-kind
```

The renderer can only communicate through registered channels.

**app-config**

Provides the application configuration to the renderer.

- **Direction** — `Renderer --> Main`
- **Request** — `app-config`
- **Response** — `{ title: string }`

**create-new-window**

Requests the main process to create a new blank canvas window.

No payload is required.

- **Direction** — `Renderer --> Main`
- **Request** — `create-new-window`
- **Response** — `void`

**clipboard-content**

Requests supported clipboard content from the main process.

No payload is required.

- **Direction** — `Renderer --> Main`
- **Request** — `clipboard-content`
- **Response** — `ClipboardContent`

_ClipboardContent_

```text
{
    type: ClipboardContentType
    text: string | null
    html: string | null
    image: ClipboardImage | null
}
```

_ClipboardContentType_ — `text, html, image, empty`
_ClipboardImage_ — `{data: string, width: number, height: number, mimeType: string}`

**window-kind**

Notifies the renderer whether its window is an overlay or a blank canvas.

- **Direction** — `Main --> Renderer`
- **Trigger** — When a window is loaded.
- **Request** — `window-kind`
- **Response** — `'overlay' | 'blank'`

**Contract Rules**

- Channel names are constants rather than inline strings.
- Request payloads must be validated at the IPC boundary.
- Only explicitly registered channels are available to the renderer.
- Renderer requests must not directly access Electron privileged APIs.

**Contract Registry**

```text
IpcChannels

appConfig = "app-config"
createNewWindow = "create-new-window"
clipboardContent = "clipboard-content"
windowKind = "window-kind"
```

```text
Renderer
   |
   ├── app-config —— Main (configuration)
   |
   ├── create-new-window —— IpcServer
   |                            |
   |                       WindowManager
   |
   ├── clipboard-content —— IpcServer
   |                            |
   |                        ClipboardService
   |
   └── window-kind —— Main (window type)
```

**Design Boundary**

IPC channel contracts define what can cross the renderer/main-process boundary.
IpcServer defines how those contracts are registered and handled.
Application services define how the requested operation is performed.

## ShortcutManager

Manages global desktop keyboard shortcuts and platform-specific shortcut registration.

```text
constructor(
    windowManager: WindowManager,
    config: ShortcutConfig,
    os: OperatingSystemInformation,
    onQuit?: () => void
)
```

- `register(): void` — Register all configured global shortcuts.
- `unregister(): void` — Unregister registered global shortcuts.
- `registerToggleShortcut(): void` — Register the overlay toggle and quit shortcuts.
- `registerNewCanvas(): void` — Register the new canvas shortcut.
- `unregisterToggleShortcut(): void` — Remove the overlay toggle and quit shortcuts.
- `unregisterNewCanvas(): void` — Remove the new canvas shortcut.
- `runAgent(): void` — Start the system-wide shortcut agent when required.
- `usesPathShim(): boolean` — Check whether the system requires the shortcut path shim (`/usr/bin/<slug>` resolving to the running binary).
- `registerDconf(name: string, binding: string, command: string): void` — Register a GNOME custom keybinding for a dconf path.
- `ensureDconfIds(ids: string[]): void` — Append the dconf custom-keybinding ids to the active shortcut list.
- `toGnomeBinding(binding: string): string` — Convert an accelerator binding to GNOME syntax.
- `launch(args: string[]): void` — Spawns the application detached with the given arguments.

**Shortcuts**

- `F8` - **Toggle Overlay** - Toggles the visibility of the annotation overlay.
- `Ctrl+N` - **New Canvas** - Requests creation of a new blank canvas.
- `Ctrl+F8` - **Quit** - Quits the application.

**Shortcut Flow**

```text
register()
    |
Toggling
    |
Try Direct O/S Shortcut (globalShortcut) ——> success: use direct bindings
    |
    | failure (e.g. Wayland grab unavailable)
    |
Fallback: Platform Shortcut
    |
Windows/macOS  ── register login agent (`--agent`) with the toggle binding
    |
GNOME/Linux    ── dconf custom keybindings invoking `<binary> [<app path>] --toggle|--quit`
    |
Non-GNOME      ── toggle shortcut cannot be registered
```

```text
Global Shortcut (O/S or dconf)
    |
ShortcutManager / Agent
    |
Resolve Action
    |
WindowManager / Application
    |
Overlay / New Canvas / Quit
```

**Registration Details**

- Direct `globalShortcut` first; on failure fall back to GNOME dconf custom keybindings (`annotate`/`annotate-quit`, dev: `annotate-dev`/`annotate-quit-dev`).
- `Ctrl+F8` quit is wired the same way via `onQuit`.
- `APPIMAGE` and non-GNOME environments skip dconf registration.
- Invocations are forwarded to the running instance through the single-instance lock.

**Data Structures**

_ShortcutConfig_

- `toggle: string`
- `newCanvas: string`

### Platform Handling

Shortcut registration may differ between operating systems and desktop environments.

`ShortcutManager` isolates these differences from the rest of the application.

```text
OperatingSystemInformation
        |
ShortcutManager
    /   |     \
Linux Windows macOS
```

Platform-specific integration should only be used when required by the target environment.

**Error Handling**

- Handle shortcut registration failures safely.
- Detect shortcuts that are already registered by another application.
- Do not crash the application when an optional shortcut cannot be registered.
- Prevent duplicate registration.
- Clean up registered shortcuts during application shutdown.
- Report platform-specific registration failures clearly.

**Design Boundary**

`ShortcutManager` owns global shortcut registration.

It does not:

- Implement drawing behavior.
- Manage application lifecycle.
- Create windows directly.
- Resolve pointer input.
- Contain platform-specific drawing logic.

Shortcut callbacks should delegate actions to application services such as `WindowManager`.

**Unit Tests**

- Registers the F8 toggle and quit shortcut.
- Registers the new canvas shortcut.
- Unregisters registered shortcuts.
- Prevents duplicate registration.
- Handles shortcut conflicts safely.
- Registers dconf keybindings on GNOME when direct shortcut registration is unavailable.
- Appends dconf keybinding ids to the active shortcut list during fallback registration.
- Handles unsupported platform configuration safely.

**Feature Tests**

- Pressing F8 toggles the annotation overlay.
- Pressing Ctrl+N creates a new canvas.
- Pressing Ctrl+F8 quits the application.
- Registered shortcuts work when another application has focus.
- Toggling works from the system shortcut on a GNOME Wayland session.
- Shortcut registration is cleaned up when the application exits.

## AnnotationApp

The renderer composition root for the annotation interface.

It initializes renderer services, connects browser events, and coordinates the annotation UI.

```text
constructor(canvas: HTMLCanvasElement)
```

It constructs its own `Accelerator`, `Annotate`, `Renderer`, `PasteService`, and `Toast`.

- `bootstrap(): void` — Initialize the renderer and annotation interface.
- `wireEvents(): void` — Connect keyboard, pointer, clipboard, and window events.
- `installToolbar(): void` — Install renderer controls and toolbar actions.
- `redraw(): void` — Redraw the current annotation state.
- `clearAll(): void` — Clear the annotation layer and update the renderer.
- `eraseAt(point: Point): void` — Erase annotations at the specified position.
- `input(): void` — Process renderer input.
- `point(): Point` — Resolve the current pointer position relative to the canvas.
- `onPointerDown(event: PointerEvent): void` — Handle pointer start.
- `onPointerMove(event: PointerEvent): void` — Handle pointer movement.
- `onPointerEnd(event: PointerEvent): void` — Handle pointer release.
- `onKeyDown(event: KeyboardEvent): void` — Handle keyboard input.
- `onKeyUp(event: KeyboardEvent): void` — Handle keyboard release.
- `keyLetter(key: string): void` — Process a letter-key color selection.
- `requestNewWindow(): void` — Request creation of a new canvas via the main process.
- `webState(): WebState` — Return the current renderer environment state.

**Initialization Flow**

```text
AnnotationApp
        |
   bootstrap()
        |
  Initialize
   ├── Renderer
   ├── Annotate
   ├── PasteService
   ├── Toolbar
   └── Events
```

**Input Flow**

```text
Browser Event
    |
AnnotationApp
    |
Input Resolution
    |
Annotate
    |
Drawing / Pasted Objects
    |
Renderer
```

**Data Structures**

_WebState_

Represents the renderer environment.

- `width: number`
- `height: number`
- `devicePixelRatio: number`
- `isFullscreen: boolean`
- `isFocused: boolean`

**Error Handling**

- Handle missing or invalid canvas elements safely.
- Prevent event handlers from being registered more than once.
- Handle renderer initialization failures without leaving a partially initialized interface.
- Handle clipboard and IPC failures without crashing the renderer.
- Ignore unsupported input events safely.

**Design Boundary**

`AnnotationApp` owns renderer composition and browser event wiring.

It does not:

- Own drawing state.
- Implement stroke or erase algorithms.
- Manage Electron windows.
- Register global desktop shortcuts.
- Implement platform-specific behavior.

`Annotate` owns annotation behavior.
`Renderer` owns canvas rendering.
`PasteService` owns clipboard and pasted-content processing.

**Unit Tests**

- Initializes renderer dependencies correctly.
- Wires supported events.
- Resolves pointer coordinates correctly.
- Processes keyboard events correctly.
- Requests a new canvas correctly.
- Returns the current web state.
- Prevents duplicate event registration.

**Feature Tests**

- Pointer input creates and updates a stroke.
- Pointer release completes a stroke.
- Keyboard shortcuts trigger the correct annotation action.
- A-Z keys change the drawing color.
- Clear removes all visible annotations.
- New canvas requests are sent to the main process.
- Pasted content is rendered correctly.

## Annotate

Coordinates annotation input and manages the current annotation state.

It translates renderer input into annotation intents and delegates drawing and pasted-object operations to their respective components.

### Constructor

```text
constructor(
    drawing: Drawing,
    pastedObjects: PastedObjectStore,
    accelerator?: Accelerator
)
```

- `selectedColor(): Color` — Return the currently selected drawing color.
- `setColor(color: Color): void` — Change the selected drawing color.
- `currentMode(): Mode` — Return the current interaction mode.
- `currentTrigger(): Trigger` — Return the active input trigger.
- `intentFor(input: Input): Intent` — Resolve raw input into an annotation intent.
- `drawTrigger(): Trigger` — Return the configured drawing trigger.
- `eraseTrigger(): Trigger` — Return the configured erasing trigger.
- `beginStroke(point: Point): void` — Start a new stroke.
- `extendStroke(point: Point): void` — Add a point to the active stroke.
- `endGesture(): void` — Finish the active drawing or erasing gesture.
- `undo(): void` — Undo the latest annotation action.
- `clear(): void` — Clear the current annotation state.
- `beginErase(point: Point): void` — Start an erase gesture.
- `eraseAt(point: Point): void` — Erase annotations at the specified position.
- `startDrag(object: PastedObject): void` — Start moving a pasted object.
- `dragTo(point: Point): void` — Move the active pasted object.
- `isDragging(): boolean` — Check whether an object is currently being moved.
- `endDrag(): void` — Finish the current object movement.
- `addPasted(object: PastedObject): void` — Add a pasted object to the annotation.
- `snapshot(): AnnotationSnapshot` — Return the current annotation state.

**Interaction Flow**

```text
  Input
    |
intentFor()
    |
Intent
    |— Draw  => Drawing
    |— Erase => Drawing
    |— Undo  => Drawing
    |— Clear => Drawing
    |_ Drag  => PastedObjectStore
```

**Data Structures**

_AnnotationSnapshot_ — Represents the current annotation state.

- `strokes: Stroke[]`
- `objects: PastedObject[]`
- `selectedColor: Color`

`Annotate` maintains only coordination state.

- Selected color.
- Current interaction mode.
- Active input trigger.
- Active gesture.
- Active dragged object.

Persistent annotation collections remain owned by `Drawing` and `PastedObjectStore`.

**Error Handling**

- Ignore invalid or unsupported input safely.
- Prevent extending a stroke when no stroke is active.
- Prevent erasing when no annotation is available.
- Prevent dragging an object that is no longer registered.
- Safely end an incomplete gesture.
- Keep invalid state transitions from corrupting annotation data.

**Design Boundary**

`Annotate` owns annotation interaction and coordination.

It does not:

- Render directly to the canvas.
- Manage Electron windows.
- Handle global desktop shortcuts.
- Directly manipulate stroke collections.
- Parse or sanitize clipboard content.

`Drawing` owns stroke state and operations.
`PastedObjectStore` owns pasted-object state and operations.
`AnnotationApp` owns renderer event handling.

**Unit Tests**

- Resolves drawing input correctly.
- Resolves erasing input correctly.
- Changes the selected color.
- Starts and extends a stroke correctly.
- Starts and ends an erase gesture correctly.
- Ends an active gesture safely.
- Undoes the latest action.
- Clears annotation state.
- Starts and completes object dragging.
- Returns the correct annotation snapshot.

**Feature Tests**

- Draw using the configured input trigger.
- Erase an existing annotation.
- Undo the latest stroke.
- Clear all annotations.
- Change the drawing color.
- Paste and move an object.

## Drawing

Stores and manages freehand drawing strokes.

It owns the stroke collection and provides operations for creating, updating, undoing, clearing, and erasing strokes.

```text
constructor()
```

- `startStroke(point: Point, color: Color): Stroke` — Create and store a new stroke.
- `addPoint(stroke: Stroke, point: Point): void` — Add a point to an existing stroke.
- `undo(): void` — Remove the latest stroke.
- `clear(): void` — Remove all strokes.
- `eraseAt(point: Point): void` — Remove or update strokes affected by the eraser.
- `strokes(): Stroke[]` — Return the current strokes.

**Data Structures**

_Stroke_ — Represents one freehand drawing stroke.

- `points: Point[]` — Points that form the stroke path.
- `color: Color` — Stroke color.
- `width: number` — Stroke width.

_Point_ — Represents a position on the drawing surface.

- `x: number`
- `y: number`

**Stroke Lifecycle**

```text
startStroke()
     |
   Stroke
     |
addPoint()
     |
addPoint()
     |
end gesture
     |
Stored Stroke
```

**Erase Behavior**

The eraser checks the erase position against stored stroke geometry.

```text
Eraser Point
     |
Find affected strokes
     |
Remove / update affected geometry
     |
Updated stroke collection
```

The exact intersection and splitting algorithm is an implementation detail and can be changed without affecting the public interface.

**States**

```text
strokes: Stroke[]
```

The drawing owns the stroke collection for the current canvas session.

**Error Handling**

- Ignore invalid points.
- Do not add points to an unknown stroke.
- `undo()` is a safe no-op when there are no strokes.
- `clear()` is a safe no-op when the drawing is empty.
- Erasing an empty drawing is a safe no-op.

**Design Boundary**

`Drawing` owns stroke data and stroke operations.

It does not:

- Render strokes.
- Handle keyboard or pointer events.
- Manage colors selected by the user.
- Manage pasted objects.
- Manage windows or canvases.
- Persist drawing data.

`Annotate` coordinates drawing interactions.
`Renderer` renders the resulting strokes.

**Unit Tests**

- Creates a stroke with the correct properties.
- Adds points in the correct order.
- Stores multiple strokes independently.
- Undoes the latest stroke.
- Does nothing when undoing an empty drawing.
- Clears all strokes.
- Erases affected strokes.
- Ignores invalid points safely.

**Feature Tests**

- Creates a complete freehand stroke.
- Adds continuous pointer points to a stroke.
- Undoes the latest stroke without affecting previous strokes.
- Clears the current drawing.
- Erases an existing annotation.

## PastedObjectStore

Stores and manages pasted image and text objects for the current annotation session.

It owns the object collection and provides lookup, movement, removal, and clearing operations.

```text
constructor()
```

- `add(object: PastedObject): void` — Add a pasted object to the store.
- `objectAt(point: Point): PastedObject | null` — Find the topmost object at a position.
- `eraseAt(point: Point): void` — Remove the object at a position.
- `move(object: PastedObject, point: Point): void` — Move an object to a new position.
- `clear(): void` — Remove all stored objects.
- `objects(): PastedObject[]` — Return the current pasted objects.

**Data Structures**

_PastedObject_ — Represents a pasted image or text object.

- `id: string` — Unique object identifier.
- `type: PastedObjectType` — Type of pasted content.
- `position: Point` — Top-left position of the object.
- `size: Size` — Rendered object dimensions.
- `content: string | ImageData` — Object content.

**Size**

- `width: number`
- `height: number`

**Object Lookup**

`objectAt()` uses the object's position and size to determine whether the pointer is inside its bounds.

When objects overlap, the topmost object should be returned.

```text
Point
    |
Check objects from top → bottom
    |
First matching object
    |
PastedObject | null
```

**Object Lifecycle**

```text
PasteService
    |
add()
    |
PastedObjectStore
    |
objectAt()
    |
startDrag()
    |
move()
    |
eraseAt() / clear()
```

**States**

```text
objects: PastedObject[]
```

The store owns pasted objects for the current canvas session.

**Error Handling**

- Ignore invalid objects.
- Prevent duplicate object identifiers.
- Return `null` when no object exists at a position.
- Moving an unknown object is a safe no-op.
- Removing from an empty store is a safe no-op.
- Clearing an empty store is a safe no-op.

**Design Boundary**

`PastedObjectStore` owns pasted-object state and spatial operations.

It does not:

- Read from the system clipboard.
- Sanitize HTML.
- Decode clipboard data.
- Render objects.
- Handle pointer or keyboard events.
- Manage window state.
- Persist objects.

`PasteService` handles clipboard processing.
`Annotate` coordinates object interaction.
`Renderer` renders the objects.

**Unit Tests**

- Adds an object correctly.
- Rejects invalid objects.
- Prevents duplicate identifiers.
- Finds an object by position.
- Returns the topmost overlapping object.
- Returns `null` when no object matches.
- Moves an object correctly.
- Removes an object at a position.
- Clears all objects.

**Feature Tests**

- Pasted text can be stored and retrieved.
- Pasted images can be stored and retrieved.
- An object can be selected and moved.
- An object can be removed by erasing it.
- Overlapping objects select the topmost object.

## Accelerator

Represents and matches keyboard accelerator definitions (`src/main/Accelerator.ts`).

It parses accelerator strings into a normalized representation and provides platform-specific conversions when required.

```text
constructor(
    key: string,
    modifiers: Modifier[]
)
```

- `parse(value: string): Accelerator` — Parse an accelerator definition into an `Accelerator`.
- `matches(input: KeyboardInput): boolean` — Check whether keyboard input matches the accelerator.
- `modifierName(): string` — Return the platform-appropriate modifier name.
- `isModifierKey(): boolean` — Check whether the configured key is itself a modifier.
- `isActive(): boolean` — Check whether the accelerator has a valid key and modifier combination.
- `toGnomeBinding(): string` — Convert the accelerator to a GNOME-compatible key binding.

**Data Structures**

_Accelerator_

- `key: string` — Primary keyboard key.
- `modifiers: Modifier[]` — Required modifier keys.

_Modifier_ — `Control`, `Alt`, `Shift`, `Meta`, `CommandOrControl`

_KeyboardInput_

- `key: string`
- `ctrlKey: boolean`
- `altKey: boolean`
- `shiftKey: boolean`
- `metaKey: boolean`

_Parsing_

Supported accelerator definitions may include: F8, Ctrl+N, CommandOrControl+N, Ctrl+Shift+Z, Alt+Space

The parser normalizes equivalent definitions into the same internal representation.

```text
"CommandOrControl+N"
    |
Accelerator
  key: N
  modifiers: [CommandOrControl]
```

**Matching**

```text
KeyboardInput
      ↓
   matches()
      ↓
Compare key
      +
Compare modifiers
      ↓
true / false
```

The match must require the configured key and modifier state.

**Platform Conversion**

`toGnomeBinding()` converts the accelerator into GNOME desktop shortcut configuration.

Platform-specific conversion should not change the internal accelerator representation.

**Error Handling**

- Reject unsupported accelerator formats.
- Reject accelerators without a valid key.
- Reject duplicate modifiers.
- Normalize modifier order consistently.

**Renderer Utility**

The renderer uses a separate stateless `Accelerator` utility (`src/shared/Accelerator.ts`):

- `parseAccelerator(value): { mods: Modifiers; key: string }` — Parse into a normalized modifier record and key.
- `matches(event: KeyboardEvent, accelerator): boolean` — Match a DOM keyboard event against an accelerator string.
- `modifierName(accelerator): ModifierName | undefined` — Return the primary modifier of an accelerator string.
- `isModifierKey(event, mod)` / `isActive(event, mod, held)` — Modifier-state helpers.
- `toGnomeBinding(accelerator): string` — Convert an accelerator string to a GNOME binding.

**Design Boundary**

`Accelerator` owns accelerator parsing, representation, matching, and conversion.

It does not:

- Register global shortcuts.
- Listen for keyboard events.
- Execute shortcut actions.
- Manage application state.
- Configure desktop shortcuts directly.

`ShortcutManager` owns shortcut registration and lifecycle.

**Unit Tests**

- Parses supported accelerator formats.
- Parses accelerators with multiple modifiers.
- Normalizes modifier order.
- Matches the correct keyboard combination.
- Rejects incorrect combinations.
- Rejects unsupported accelerator formats.
- Identifies modifier keys correctly.
- Converts supported accelerators to GNOME bindings.
- Handles inactive accelerators safely.
- Parses supported accelerator formats.
- Matches the correct keyboard combination.
- Rejects incorrect combinations.

## Modifier

Models keyboard modifiers used by accelerators (`src/main/Modifier.ts`).

The internal model is platform-independent. Platform-specific key names are resolved only when a modifier is converted for a platform.

**Values and Meaning**

- `Control` — Control key.
- `Alt` — Alt key.
- `Shift` — Shift key.
- `Meta` — Meta/Windows/Command key.
- `CommandOrControl` — Control on Windows/Linux and Command on macOS.

**Modifier**

```text
enum Modifier { Control, Alt, Shift, Meta, CommandOrControl }
```

**Functions**

- `isModifier(value: string): value is Modifier` — Check whether a value is a supported modifier.
- `modifierMatches(modifier: Modifier, input: KeyboardInput): boolean` — Check whether the modifier is active in the keyboard input.
- `isModifierPlatformIndependent(modifier: Modifier): boolean` — Check whether the modifier has the same meaning across supported platforms.
- `resolveModifier(modifier: Modifier, os: OperatingSystemInformation): ModifierKey` — Resolve the modifier to the platform-specific key.

**Data Structures**

_KeyboardInput_ — Represents the modifier state of a keyboard event.

- `key: string`
- `ctrlKey: boolean`
- `altKey: boolean`
- `shiftKey: boolean`
- `metaKey: boolean`

_ModifierKey_ - Represents the resolved platform-specific modifier.

- `name: string`
- `code: string`

Examples: `CommandOrControl + Windows -> Control`, `CommandOrControl + Linux -> Control`, `CommandOrControl + macOS -> Command`

**Design Rules**

- Keep modifier definitions platform-independent.
- Do not store Electron-specific accelerator names in the model.
- CommandOrControl should be resolved only when platform information is available.
- Modifier comparison should be deterministic and case-insensitive where applicable.
- Duplicate modifiers should not be allowed in a single accelerator.

**Unit Tests**

- Matches each supported modifier correctly.
- Resolves CommandOrControl on Windows.
- Resolves CommandOrControl on Linux.
- Resolves CommandOrControl on macOS.
- Rejects duplicate modifiers.
- Handles unsupported modifier values safely.

## Renderer

Renders annotation strokes and pasted objects onto the canvas.

It converts annotation state into visual output and provides measurement utilities for text and rich content.

```text
constructor(canvas: HTMLCanvasElement)
```

- `resize(): void` — Resize the canvas to match the current rendering area.
- `render(state: AnnotationSnapshot): void` — Render the complete annotation state.
- `measureText(text: string): Size` — Measure plain text content.
- `clearRich(): void` — Clear the current rich-content rendering surface.
- `removeRich(): void` — Remove the current rich-content element.
- `measureRich(): Size` — Measure the current rich-content element.

**Rendering Flow**

```text
AnnotationSnapshot
        |
     Renderer
        |
   Canvas / DOM
        |
  Visible Annotation
```

**Rendered Content**

The renderer handles:

- **Strokes** — Draw stroke paths using their color and width.
- **Text objects** — Render text at the object's position and size.
- **Image objects** — Render pasted images at their position and size.
- **Canvas state** — Resize and clear the rendering surface when required.

**Measurement**

Text and rich content may require measurement before a `PastedObject` is created or positioned.

```text
Content
    |
measureText() / measureRich()
    |
  Size
    |
PastedObject
```

**Error Handling**

- Ignore invalid or empty annotation state safely.
- Handle zero-sized canvas dimensions safely.
- Avoid rendering invalid stroke points.
- Handle unavailable rich-content elements without throwing.
- Clear stale rich content when it is no longer required.

**Design Boundary**

`Renderer` owns visual output and content measurement.

It does not:

- Own annotation state.
- Create or modify strokes.
- Manage pasted-object state.
- Process keyboard or pointer input.
- Read the system clipboard.
- Manage Electron windows.
- Register global shortcuts.

`Drawing` and `PastedObjectStore` own annotation data.
`AnnotationApp` coordinates renderer events.
`PasteService` handles clipboard content.

**Unit Tests**

- Renders strokes correctly.
- Renders pasted text correctly.
- Renders pasted images correctly.
- Resizes the canvas correctly.
- Measures plain text correctly.
- Measures rich content correctly.
- Clears rich content correctly.
- Handles invalid rendering state safely.

**Feature Tests**

- A drawing snapshot is rendered correctly.
- Multiple strokes render with their individual colors and widths.
- Pasted objects appear at their stored positions.
- Canvas resizing preserves the expected rendering scale.
- Text and rich content measurements produce usable object sizes.

## PasteService

Coordinates clipboard operations and converts supported clipboard content into annotation objects.

It reads clipboard data, sanitizes unsafe content, measures content when required, and delegates the resulting object to `Annotate`.

```text
constructor(
    annotate: Annotate,
    renderer: Renderer,
    sanitizer: HtmlSanitizer,
    onChanged: () => void,
    onMessage: (message: string, duration?: number) => void,
    clipboard: ClipboardPort = systemClipboard
)
```

- `paste(at: Point, plain: boolean): Promise<void>` — Read and process the current clipboard content at the given point; `plain` forces plain-text paste.

**Paste Flow**

```text
Clipboard
    |
PasteService
    |
Detect Content
    |
Text / HTML / Image
    |
Process / Sanitize
    |
Create Object
    |
Annotate
```

**Content Handling**

_Plain Text_

- Read clipboard text.
- Measure the text using `Renderer`.
- Create a text `PastedObject`.
- Add it through `Annotate`.

_Rich Text_

- Read clipboard HTML.
- Sanitize the HTML using `HtmlSanitizer`.
- Measure the resulting content.
- Create a rich-text `PastedObject`.
- Add it through `Annotate`.

_Image_

- Read clipboard image data.
- Determine its dimensions.
- Create an image `PastedObject`.
- Add it through `Annotate`.

**Data Structures**

_ClipboardPort_

Provides the clipboard data required by the service.

- `readBrowser(): Promise<ClipboardItemLike[]>` — Read items from the browser clipboard API when available.
- `readNative(): Promise<{ image: string; text: string }>` — Read clipboard content through the Electron `clipboard-content` IPC channel.

```text
ClipboardPort

systemClipboard -- navigator.clipboard.read() + window.screenAnnotate.clipboardContent()
```

The implementation may use browser or Electron clipboard APIs, but `PasteService` does not depend directly on either implementation.

_PastedObject_

Created from supported clipboard content and passed to `Annotate`.

**Error Handling**

- Handle clipboard read failures safely.
- Ignore unsupported clipboard content.
- Reject empty clipboard content.
- Reject unsafe or invalid HTML after sanitization.
- Handle invalid image data safely.
- Do not allow clipboard processing errors to crash the renderer.

**Security Boundary**

Clipboard content is untrusted input.

```text
Clipboard
    |
ClipboardPort
    |
PasteService
    |
HtmlSanitizer
    |
PastedObject
    |
Annotate
```

> HTML must be sanitized before it is rendered or stored.

**Design Boundary**

`PasteService` coordinates the paste workflow.

It does not:

- Own pasted-object state.
- Implement clipboard access directly.
- Implement HTML sanitization.
- Render content directly.
- Handle pointer or keyboard events.

`ClipboardPort` owns clipboard access.
`HtmlSanitizer` owns HTML sanitization.
`Annotate` owns annotation state.
`Renderer` owns rendering and measurement.

**Unit Tests**

- Reads plain text from the clipboard.
- Reads rich HTML content.
- Reads image content.
- Creates the correct pasted object type.
- Sanitizes HTML before creating the object.
- Handles empty clipboard content.
- Handles unsupported clipboard content.
- Handles clipboard read failures.

**Feature Tests**

- Paste plain text onto the canvas.
- Paste rich text onto the canvas.
- Paste an image onto the canvas.
- Unsafe HTML is sanitized before rendering.
- Unsupported clipboard content is rejected safely.

## HtmlSanitizer

Sanitizes pasted HTML before it is rendered or stored.

It removes unsafe or unsupported content while preserving the formatting supported by Annotate.

_No dependencies are required_

- `sanitize(html: string): string` — Remove unsafe and unsupported HTML content and return sanitized HTML.

**Sanitization Rules**

The sanitizer should:

- Remove executable content.
- Remove unsafe elements and attributes.
- Remove event-handler attributes such as `onclick`.
- Remove unsupported embedded content.
- Preserve supported text formatting.
- Preserve safe links when supported.
- Normalize malformed HTML where possible.

**Supported Formatting**

The supported HTML subset should remain intentionally small.

Examples may include:`<strong> <em> <u> <s> <p> <br> <ul> <ol> <li> <a>`

The exact supported subset can be expanded as the renderer evolves.

**Error Handling**

- Empty input returns an empty string.
- Malformed HTML should be handled safely.
- Unsupported elements are removed or reduced to their safe text conte

## Toast

Displays short-lived feedback messages to the user.

```text
constructor(container: HTMLElement)
```

- `show(message: string): void` — Display a temporary feedback message.
- `hide(): void` — Remove the currently displayed message.

**Behavior**

```text
show(message)
    |
Create / update toast
    |
Display message
    |
Wait for lifetime
    |
hide()
```

A new message replaces the currently displayed message when only one toast is active.

**Data Structures**

_ToastState_

- `message: string`
- `visible: boolean`
- `timer: Timer | null`

*_Error Handling_

- Ignore empty messages.
- Safely handle a missing or unavailable container.
- Clear an existing timer before displaying a new message.
- Do not allow multiple timers to remove a newer message.

*_Design Boundary_

`Toast` owns only the display lifecycle of temporary feedback.

It does not:

- Decide when a message should be shown.
- Manage application state.
- Handle annotation behavior.
- Perform logging or error reporting.
- Communicate with the Electron main process.

Calling components decide the message and when to display it.

**Unit Tests**

- Displays the supplied message.
- Replaces an existing message correctly.
- Hides the message after its lifetime.
- Clears the previous timer when a new message is shown.
- Ignores empty messages.

## Toolbar

Provides renderer controls and displays short user feedback.

It connects toolbar interactions to application actions without owning annotation state or business logic.

```text
constructor(
    actions: ToolbarActions,
    onMessage: (message: string, duration?: number) => void
)
```

- `install(): void` — Create and register the supported toolbar controls.

**Data Structures**

_ToolbarActions_ - Defines the actions available to toolbar controls.

```text
{
    clear(): void
    undo(): void
    newCanvas(): void
    setColor(color: Color): void
}
```

The action set can be extended as additional toolbar controls are introduced.

The message handler receives feedback messages that should be displayed to the user.

*_Installation Flow_

```text
Toolbar
    |
install()
    |
Create Controls
    |
Bind Events
    |
Toolbar Ready
```

**Interaction Flow**

```text
User
  |
Toolbar Control
  |
Toolbar
  |
ToolbarActions
  |
Application Behavior
```

The toolbar does not implement the action itself.

**Error Handling**

- Prevent duplicate installation.
- Ignore unsupported actions safely.
- Avoid registering duplicate event listeners.
- Handle invalid color values without modifying application state.

**Design Boundary**

`Toolbar` owns toolbar UI and event binding.

It does not:

- Own annotation state.
- Implement drawing or erasing.
- Manage windows.
- Process clipboard content.
- Manage application lifecycle.
- Decide application behavior.

`AnnotationApp` provides the actions.
`Toast` or another feedback component displays user messages.

**Unit Tests**

- Installs supported controls.
- Binds each control to the correct action.
- Sends the correct action when a control is used.
- Registers message callbacks correctly.
- Prevents duplicate installation.
- Displays feedback through the registered message handler.

**Feature Tests**

- Clear control clears annotations.
- Undo control undoes the latest annotation.
- New canvas control requests a new canvas.
- Color controls change the selected color.
- Toolbar feedback is displayed correctly.

## Logger

Provides structured console and rotating file logging built on `loggest`.

- `FileSystemLogger` writing to `<logs>/[app_name].log`.
- Context — Every record carries meta data and a per-launch `loggerId`.
- Format — Records are stamped with ISO time and stringified sink values.
- Modes — `production`, `development`, `testing`, and `test` are detected.
- Quiet — When `NODE_ENV === 'test'` (Bun) the logger filters output out entirely.

**Design Boundary**

Logger owns process logging only.

It does not:

- Handle application lifecycle.
- Write annotation or clipboard data.
- Replace Electron's own error logging.

> Logger should not crash the main application

## Open Discussion

**Questions**

- Should users be able to customize the global shortcut?
- Should annotations support exporting or saving in a future release?
- Should the PWA support persistent local drawing data?

**Answers**

- Not decided yet.
- Not part of the current scope.
- Not part of the current scope; drawing data remains session-based.
