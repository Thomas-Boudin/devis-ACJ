(() => {
  const app = document.getElementById('app');
  if (!app) return;
  const datebar = app.querySelector('.datebar');
  const editable = 'textarea, input:not([type="button"]):not([type="submit"]), [contenteditable]:not([contenteditable="false"])';
  let gesture = null, blockedClickUntil = 0;

  const style = document.createElement('style');
  style.id = 'acj-planning-swipe-css';
  style.textContent = 'html.acj-day-swipe,html.acj-day-swipe body{touch-action:pan-y pinch-zoom}#app{min-height:100dvh}';
  document.head.appendChild(style);

  function available() {
    return !app.hidden && datebar?.isConnected && !datebar.closest('[hidden]')
      && !document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]:not([hidden]), #acjPlanningSheet')
      && typeof window.setDate === 'function' && typeof window.plus === 'function';
  }
  function syncMode() {
    const active = !app.hidden && !!datebar && !datebar.closest('[hidden]');
    if (document.documentElement.classList.contains('acj-day-swipe') !== active)
      document.documentElement.classList.toggle('acj-day-swipe', active);
    if (!active) gesture = null;
  }
  new MutationObserver(syncMode).observe(app, { attributes: true, attributeFilter: ['hidden'], subtree: true });
  syncMode();
  function start(point, target, id) {
    gesture = null;
    blockedClickUntil = 0;
    if (!available() || !(target instanceof Element) || target.closest('[hidden]') || target.closest(editable)) return;
    gesture = {
      id, x: point.clientX, y: point.clientY, axis: null,
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
    if (gesture?.axis === 'horizontal') {
      blockedClickUntil = Date.now() + 700;
      if (event.cancelable) event.preventDefault();
    }
  }
  function finish(point, event) {
    const current = gesture;
    gesture = null;
    if (!current || !available()
        || current.date !== document.getElementById('datePicker').value
        || current.employee !== document.getElementById('employee').value) return;
    const dx = point.clientX - current.x, dy = point.clientY - current.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    blockedClickUntil = Date.now() + 700;
    if (event.cancelable) event.preventDefault();
    window.setDate(window.plus(current.date, dx < 0 ? 1 : -1));
  }
  const cancel = () => { gesture = null; };
  // A drag can start over a button or link, but must never activate it afterwards.
  document.addEventListener('click', event => {
    if (event.detail === 0 || Date.now() > blockedClickUntil) return;
    blockedClickUntil = 0;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true });
  if (window.PointerEvent) {
    document.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse') { blockedClickUntil = 0; return; }
      if (event.isPrimary === false) { cancel(); return; }
      start(event, event.target, event.pointerId);
    }, { capture: true });
    document.addEventListener('pointermove', event => {
      if (gesture?.id === event.pointerId) move(event, event);
    }, { passive: false });
    document.addEventListener('pointerup', event => {
      if (gesture?.id === event.pointerId) finish(event, event);
    }, { passive: false });
    document.addEventListener('pointercancel', cancel);
  } else {
    document.addEventListener('touchstart', event => {
      if (event.touches.length !== 1) { cancel(); return; }
      const point = event.touches[0];
      start(point, event.target, point.identifier);
    }, { passive: true, capture: true });
    document.addEventListener('touchmove', event => {
      if (event.touches.length !== 1) { cancel(); return; }
      const point = event.touches[0];
      if (gesture?.id === point.identifier) move(point, event);
    }, { passive: false });
    document.addEventListener('touchend', event => {
      const point = Array.from(event.changedTouches).find(touch => touch.identifier === gesture?.id);
      if (point) finish(point, event);
    }, { passive: false });
    document.addEventListener('touchcancel', cancel);
  }
  window.addEventListener('blur', cancel);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
})();
