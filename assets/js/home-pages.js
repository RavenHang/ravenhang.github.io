(() => {
  const panels = [...document.querySelectorAll('[data-home-panel]')];
  if (panels.length < 2) return;

  const header = document.querySelector('.site-header');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const controls = 'a,button,input,textarea,select,summary,[contenteditable]:not([contenteditable="false"]),[role="button"],[role="tab"],[role="slider"]';
  const editable = 'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="slider"]';
  const edgeTolerance = 3;
  const transitionDuration = 650;
  let lockedUntil = 0;
  let transitionTimer = 0;
  let lastWheel = -Infinity;
  let wheelDirection = 0;
  let wheelDistance = 0;
  let wheelEligible = false;
  let wheelConsumed = false;
  let swipe = null;

  const readingTop = () => Math.max(0, header?.getBoundingClientRect().bottom || 0);
  const targetElement = target => target instanceof Element ? target : target?.parentElement;
  const modalOpen = () => Boolean(document.querySelector('dialog[open], [aria-modal="true"]:not([hidden])'));

  function readingPanel() {
    const top = readingTop();
    // Keep reading a long panel until its bottom reaches the viewport edge.
    // Unmarked content between panels retains the browser's normal scrolling.
    return panels.findIndex(panel => {
      const rect = panel.getBoundingClientRect();
      return rect.top <= top + edgeTolerance && rect.bottom > top + edgeTolerance;
    });
  }

  function adjacentPanel(direction) {
    const index = readingPanel();
    if (index < 0 || index + direction < 0 || index + direction >= panels.length) return null;
    const rect = panels[index].getBoundingClientRect();
    const atEdge = direction > 0
      ? rect.bottom <= window.innerHeight + edgeTolerance
      : rect.top >= readingTop() - edgeTolerance;
    return atEdge ? panels[index + direction] : null;
  }

  function keepNative(target, direction, keyboard = false) {
    const element = targetElement(target);
    if (!element || modalOpen() || element.closest(keyboard ? controls : editable)) return true;
    // Horizontal certificate strips retain their gestures, including diagonal swipes.
    if (element.closest('.research-gallery-track,[data-gallery-track],[data-home-scroll-native]')) return true;
    for (let node = element; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
      if (node.scrollHeight <= node.clientHeight + edgeTolerance) continue;
      const style = getComputedStyle(node);
      if (!/(auto|scroll|overlay)/.test(style.overflowY)) continue;
      if (/(contain|none)/.test(style.overscrollBehaviorY)) return true;
      if (direction < 0 ? node.scrollTop > 0 : node.scrollTop + node.clientHeight < node.scrollHeight - 1) return true;
    }
    return false;
  }

  function turnPage(direction) {
    const next = adjacentPanel(direction);
    if (!next) return false;
    lockedUntil = performance.now() + transitionDuration;
    document.body.dataset.homeTurning = 'true';
    clearTimeout(transitionTimer);
    transitionTimer = setTimeout(() => { delete document.body.dataset.homeTurning; }, transitionDuration);
    const top = next.getBoundingClientRect().top + window.scrollY - readingTop();
    window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    return true;
  }

  window.addEventListener('wheel', event => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || !event.deltaY
      || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    const direction = Math.sign(event.deltaY);
    if (keepNative(event.target, direction)) return;
    const now = performance.now();
    const freshGesture = now - lastWheel > 220;
    if (freshGesture) {
      wheelDirection = direction;
      wheelDistance = 0;
      wheelEligible = Boolean(adjacentPanel(direction));
      wheelConsumed = now < lockedUntil;
    } else if (direction !== wheelDirection) {
      wheelDirection = direction;
      wheelDistance = 0;
    }
    lastWheel = now;
    // Inertial trackpad events belong to the same gesture, even after animation ends.
    if (wheelConsumed || now < lockedUntil) {
      if (event.cancelable) event.preventDefault();
      wheelConsumed = true;
      return;
    }
    // A gesture that starts within a long panel remains a native reading scroll.
    if (!wheelEligible || !event.cancelable) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    wheelDistance += Math.abs(event.deltaY) * unit;
    if (wheelDistance >= 45 && turnPage(direction)) wheelConsumed = true;
  }, { passive: false });

  window.addEventListener('touchstart', event => {
    swipe = null;
    if (event.touches.length !== 1 || event.defaultPrevented) return;
    const element = targetElement(event.target);
    // The Bot is keyboard-accessible as a button, while vertical touch swipes
    // on its canvas still belong to full-page navigation.
    if (!element || modalOpen() || (element.closest(controls) && !element.closest('[data-hero-scene] canvas'))
      || element.closest('.research-gallery-track,[data-gallery-track],[data-home-scroll-native]')) return;
    const touch = event.touches[0];
    swipe = {
      x: touch.clientX,
      y: touch.clientY,
      target: element,
      previous: Boolean(adjacentPanel(-1)) && !keepNative(element, -1),
      next: Boolean(adjacentPanel(1)) && !keepNative(element, 1),
      horizontal: false,
      consumed: performance.now() < lockedUntil,
    };
  }, { passive: true });

  window.addEventListener('touchmove', event => {
    if (!swipe || event.touches.length !== 1 || event.defaultPrevented || !event.cancelable) return;
    const dx = event.touches[0].clientX - swipe.x;
    const dy = swipe.y - event.touches[0].clientY;
    if (swipe.horizontal) return;
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      // A horizontal drag belongs to the 3D canvas or browser, never to paging.
      swipe.horizontal = true;
      return;
    }
    if (Math.abs(dy) < 8 || Math.abs(dy) < Math.abs(dx) * 1.3) return;
    if (swipe.consumed) {
      event.preventDefault();
      return;
    }
    const direction = dy > 0 ? 1 : -1;
    if (!(direction > 0 ? swipe.next : swipe.previous)) return;
    event.preventDefault();
    if (Math.abs(dy) >= 56 && turnPage(direction)) swipe.consumed = true;
  }, { passive: false });
  window.addEventListener('touchend', () => { swipe = null; }, { passive: true });
  window.addEventListener('touchcancel', () => { swipe = null; }, { passive: true });

  window.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const space = event.key === ' ' || event.key === 'Spacebar';
    const direction = event.key === 'PageDown' || (space && !event.shiftKey) ? 1
      : event.key === 'PageUp' || (space && event.shiftKey) ? -1 : 0;
    if (!direction || (!space && event.shiftKey) || keepNative(event.target, direction, true)) return;
    if (performance.now() < lockedUntil) {
      event.preventDefault();
      return;
    }
    if (adjacentPanel(direction)) {
      event.preventDefault();
      turnPage(direction);
    }
  });

  // Anchors, history, and resize retain their normal browser behavior.
  window.addEventListener('hashchange', () => {
    swipe = null;
    lastWheel = -Infinity;
    wheelConsumed = false;
    lockedUntil = 0;
    clearTimeout(transitionTimer);
    delete document.body.dataset.homeTurning;
  });
})();
