const canvas = document.querySelector('#canvas');
const context = canvas.getContext('2d');
const status = document.querySelector('#status');
const defaultColor = '#00E5FF';
const penSize = 2;
const eraseSize = 28;

const colors = {
  A: '#ff9f1c', B: '#2684ff', C: '#14b8a6', D: '#a855f7', E: '#facc15',
  F: '#ec4899', G: '#22c55e', H: '#38bdf8', I: '#f97316', J: '#8b5cf6',
  K: '#84cc16', L: '#06b6d4', M: '#d946ef', N: '#fb7185', O: '#eab308',
  P: '#6366f1', Q: '#10b981', R: '#ef4444', S: '#78716c', T: '#0ea5e9',
  U: '#c026d3', V: '#65a30d', W: '#f59e0b', X: '#dc2626', Y: '#0891b2', Z: '#a3a3a3',
};

let history = [];
let activeStroke = null;
let drawingEnabled = false;
const heldKeys = new Set();

function resize() {
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * scale);
  canvas.height = Math.round(window.innerHeight * scale);
  context.setTransform(scale, 0, 0, scale, 0, 0);
  render();
}

function renderSegment(stroke, from, to) {
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.lineWidth = stroke.width;
  context.globalCompositeOperation = stroke.type === 'erase' ? 'destination-out' : 'source-over';
  context.strokeStyle = stroke.color;
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.stroke();
  context.restore();
}

function renderStroke(stroke) {
  if (stroke.points.length === 1) {
    const point = stroke.points[0];
    renderSegment(stroke, point, { x: point.x + 0.1, y: point.y + 0.1 });
    return;
  }
  for (let index = 1; index < stroke.points.length; index += 1) {
    renderSegment(stroke, stroke.points[index - 1], stroke.points[index]);
  }
}

function render() {
  context.clearRect(0, 0, window.innerWidth, window.innerHeight);
  history.forEach(renderStroke);
}

function selectedColor() {
  for (const key of heldKeys) if (colors[key]) return colors[key];
  return defaultColor;
}

function position(event) { return { x: event.clientX, y: event.clientY }; }

function eraseRequested(event, isPointerDown = false) {
  return (isPointerDown && event.button === 2) || Boolean(event.buttons & 2) || event.shiftKey || heldKeys.has('SHIFT');
}

function drawRequested(event, isPointerDown = false) {
  return (isPointerDown && event.button === 0)
    || Boolean(event.buttons & 1)
    || event.altKey
    || heldKeys.has('ALT');
}

function startStroke(event, isPointerDown = false) {
  if (!drawingEnabled || (!drawRequested(event, isPointerDown) && !eraseRequested(event, isPointerDown))) return;
  event.preventDefault();
  activeStroke = {
    type: eraseRequested(event, isPointerDown) ? 'erase' : 'draw',
    color: selectedColor(),
    width: eraseRequested(event, isPointerDown) ? eraseSize : penSize,
    points: [position(event)],
  };
  status.textContent = `Pointer · ${activeStroke.type === 'erase' ? 'eraser' : 'cyan pen'} active`;
  if (isPointerDown) canvas.setPointerCapture(event.pointerId);
}

function continueStroke(event) {
  if (!activeStroke) return;
  const point = position(event);
  const previous = activeStroke.points.at(-1);
  activeStroke.points.push(point);
  renderSegment(activeStroke, previous, point);
}

function endStroke(event) {
  if (!activeStroke) return;
  if (activeStroke.points.length === 1) renderStroke(activeStroke);
  history.push(activeStroke);
  activeStroke = null;
  if (event.pointerId !== undefined && canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
}

function undo() { if (history.pop()) render(); }
function clear() { history = []; activeStroke = null; render(); }

function applyDrawingMode(enabled) {
  drawingEnabled = enabled;
  document.body.classList.toggle('drawing-enabled', enabled);
  status.textContent = enabled
    ? 'Drawing on · cyan pen · drag to draw · F9 to disable'
    : 'Drawing off · F9 to enable';
}

canvas.addEventListener('pointerdown', (event) => startStroke(event, true));
canvas.addEventListener('pointermove', (event) => {
  if (!activeStroke && (event.altKey || event.shiftKey || heldKeys.has('ALT') || heldKeys.has('SHIFT'))) {
    startStroke(event);
  } else {
    continueStroke(event);
  }
});
canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', endStroke);
canvas.addEventListener('contextmenu', (event) => event.preventDefault());

window.addEventListener('keydown', (event) => {
  const key = event.key.toUpperCase();
  heldKeys.add(key);
  if (event.ctrlKey && key === 'N') {
    event.preventDefault();
    window.overlay.requestNewCanvas();
    return;
  }
  if (event.key === 'Escape') { event.preventDefault(); clear(); }
  if (event.key === 'Backspace' || (event.ctrlKey && key === 'Z')) { event.preventDefault(); undo(); }
});
window.addEventListener('keyup', (event) => {
  heldKeys.delete(event.key.toUpperCase());
  if ((event.key === 'Alt' || event.key === 'Shift') && activeStroke && !event.buttons) endStroke(event);
});
window.addEventListener('blur', () => heldKeys.clear());
window.addEventListener('resize', resize);
window.overlay.onDrawingMode(applyDrawingMode);
window.overlay.getDrawingMode().then(applyDrawingMode);
window.overlay.getCanvasBackground().then((background) => {
  if (background) document.body.style.backgroundColor = background;
});
resize();
