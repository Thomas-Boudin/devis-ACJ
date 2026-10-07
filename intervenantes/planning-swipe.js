(() => {
  const app = document.getElementById('app');
  if (!app) return;
  const surfaces = '.datebar, .dayStrip, .summary, #list';
  const controls = 'button, a, input, select, textarea, [contenteditable], [role="button"]';
  let gesture = null;

  const style = document.createElement('style');
  style.id = 'acj-planning-swipe-css';
  style.textContent = `${surfaces}{touch-action:pan-y pinch-zoom}`;
  document.head.appendChild(style);

  function available(surface) {
    return !app.hidden && surface?.isConnected && !surface.closest('[hidden]')
      && !document.querySelector('dialog[open]')
      && typeof window.setDate === 'function' && typeof window.plus === 'function';
  }
  function start(point, target, id) {
    gesture = null;
    const surface = target instanceof Element ? target.closest(surfaces) : null;
    if (!available(surface) || target.closest(controls)) return;
    gesture = {
      id, surface, x: point.clientX, y: point.clientY, axis: null,
      date: document.getElementById('datePicker').value,
      employee: document.getElementById('employee').value
    };
  }
  function move(point, event) {
    if (!gesture) return;
    const dx = Math.abs(point.clientX - gesture.x), dy = Math.abs(point.clientY - gesture.y);
    if (!gesture.axis && Math.max(dx, dy) >= 10) {
      if (dy > dx * 1.25) { gesture = null; return; }
      if (dx > dy * 1.25) gesture.axis = 'horizontal';
    }
    if (gesture?.axis === 'horizontal' && event.cancelable) event.preventDefault();
  }
  function finish(point, event) {
    const current = gesture;
    gesture = null;
    if (!current || !available(current.surface)
        || current.date !== document.getElementById('datePicker').value
        || current.employee !== document.getElementById('employee').value) return;
    const dx = point.clientX - current.x, dy = point.clientY - current.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (event.cancelable) event.preventDefault();
    window.setDate(window.plus(current.date, dx < 0 ? 1 : -1));
  }
  const cancel = () => { gesture = null; };
  if (window.PointerEvent) {
    app.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse') return;
      if (event.isPrimary === false) { cancel(); return; }
      start(event, event.target, event.pointerId);
    });
    document.addEventListener('pointermove', event => {
      if (gesture?.id === event.pointerId) move(event, event);
    }, { passive: false });
    document.addEventListener('pointerup', event => {
      if (gesture?.id === event.pointerId) finish(event, event);
    }, { passive: false });
    document.addEventListener('pointercancel', cancel);
  } else {
    app.addEventListener('touchstart', event => {
      if (event.touches.length !== 1) { cancel(); return; }
      const point = event.touches[0];
      start(point, event.target, point.identifier);
    }, { passive: true });
    document.addEventListener('touchmove', event => {
      if (event.touches.length !== 1) { cancel(); return; }
      const point = event.touches[0];
      if (gesture?.id === point.identifier) move(point, event);
    }, { passive: false });
    document.addEventListener('touchend', event => {
      const point = [...event.changedTouches].find(touch => touch.identifier === gesture?.id);
      if (point) finish(point, event);
    }, { passive: false });
    document.addEventListener('touchcancel', cancel);
  }
  window.addEventListener('blur', cancel);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
})();
