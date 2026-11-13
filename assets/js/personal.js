(() => {
  const languageLinks = [...document.querySelectorAll('[data-language-link]')];
  const syncLanguageLinks = () => {
    languageLinks.forEach(link => {
      const url = new URL(link.href);
      const activePanel = document.querySelector('[data-game-panel].is-active');
      url.hash = activePanel ? `#${activePanel.id}` : window.location.hash;
      link.href = url.href;
    });
  };
  syncLanguageLinks();
  window.addEventListener('hashchange', syncLanguageLinks);

  const gallery = document.querySelector('[data-game-gallery]');
  if (gallery) {
    const tabList = gallery.querySelector('[data-game-tabs]');
    const tabs = [...gallery.querySelectorAll('[data-game-tab]')];
    const panels = [...gallery.querySelectorAll('[data-game-panel]')];
    const activate = (id, { focus = false, updateHash = false } = {}) => {
      const index = panels.findIndex(panel => panel.id === id);
      if (index < 0) return;
      panels.forEach((panel, i) => {
        panel.hidden = i !== index;
        panel.classList.toggle('is-active', i === index);
      });
      tabs.forEach((tab, i) => {
        tab.setAttribute('aria-selected', String(i === index));
        tab.tabIndex = i === index ? 0 : -1;
      });
      if (focus) tabs[index].focus({ preventScroll: true });
      // Scroll only the horizontal tab strip; keep the page itself stationary.
      if (tabList.scrollWidth > tabList.clientWidth) {
        tabList.scrollLeft = tabs[index].offsetLeft - tabList.offsetLeft
          - (tabList.clientWidth - tabs[index].offsetWidth) / 2;
      }
      if (updateHash) {
        window.history.replaceState(null, '', `#${id}`);
        syncLanguageLinks();
      }
    };
    tabList.setAttribute('role', 'tablist');
    tabs.forEach((tab, index) => {
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', panels[index].id);
      panels[index].setAttribute('role', 'tabpanel');
      panels[index].setAttribute('aria-labelledby', tab.id);
      panels[index].tabIndex = 0;
      tab.addEventListener('click', event => {
        event.preventDefault();
        activate(tab.dataset.gameTab, { updateHash: true });
      });
      tab.addEventListener('keydown', event => {
        if (event.key === ' ') {
          event.preventDefault();
          activate(tab.dataset.gameTab, { updateHash: true });
          return;
        }
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next === undefined) return;
        event.preventDefault();
        activate(tabs[next].dataset.gameTab, { focus: true, updateHash: true });
      });
    });
    const selectedId = window.location.hash.slice(1);
    activate(panels.some(panel => panel.id === selectedId) ? selectedId : panels[0].id);
    gallery.classList.add('is-enhanced');
    window.addEventListener('hashchange', () => activate(window.location.hash.slice(1)));

    const header = document.querySelector('.site-header');
    const selector = gallery.querySelector('.game-selector');
    const activeIndex = () => panels.findIndex(panel => !panel.hidden);
    const atReadingEdge = direction => {
      const panel = panels[activeIndex()];
      const panelRect = panel.getBoundingClientRect();
      const headerBottom = header.getBoundingClientRect().bottom;
      const selectorRect = selector.getBoundingClientRect();
      const selectorAtTop = getComputedStyle(selector).position !== 'fixed';
      const top = selectorAtTop ? Math.max(headerBottom, selectorRect.bottom) : headerBottom;
      const bottom = selectorAtTop ? window.innerHeight : selectorRect.top;
      // Do not take over scrolling once the gallery has left the reading area.
      if (panelRect.bottom <= top || panelRect.top >= bottom) return false;
      if (direction < 0) return panelRect.top >= top - 2;
      return panel.querySelector('.game-info').getBoundingClientRect().bottom <= bottom + 2;
    };
    const hasAdjacentProject = direction => {
      const next = activeIndex() + direction;
      return next >= 0 && next < panels.length;
    };
    const turnProject = direction => {
      const index = activeIndex();
      const next = index + direction;
      if (next < 0 || next >= panels.length) return;
      const panelHadFocus = panels[index].contains(document.activeElement);
      activate(panels[next].id, {
        focus: tabList.contains(document.activeElement),
        updateHash: true,
      });
      if (panelHadFocus) panels[next].focus({ preventScroll: true });
      // Each project starts at its artwork, including after reading a long panel.
      window.scrollTo({
        top: Math.max(0, gallery.getBoundingClientRect().top + window.scrollY
          - header.getBoundingClientRect().height),
        behavior: 'instant',
      });
    };

    let wheelTime = -Infinity;
    let lastTurn = -Infinity;
    let wheelDirection = 0;
    let wheelDistance = 0;
    let wheelEligible = false;
    let wheelConsumed = false;
    gallery.addEventListener('wheel', event => {
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const direction = Math.sign(event.deltaY);
      const now = performance.now();
      const freshGesture = now - wheelTime > 220 || direction !== wheelDirection;
      if (freshGesture) {
        wheelDirection = direction;
        wheelDistance = 0;
        wheelEligible = atReadingEdge(direction) && hasAdjacentProject(direction);
        wheelConsumed = now - lastTurn < 500;
      }
      wheelTime = now;
      // Consume the rest of a trackpad burst, even after its first transition.
      if (wheelConsumed) {
        event.preventDefault();
        return;
      }
      // A gesture begun mid-description remains a native reading scroll.
      if (!wheelEligible) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      wheelDistance += Math.abs(event.deltaY) * unit;
      if (wheelDistance >= 45) {
        turnProject(direction);
        lastTurn = now;
        wheelConsumed = true;
      }
    }, { passive: false });

    let swipe = null;
    gallery.addEventListener('touchstart', event => {
      swipe = null;
      if (event.touches.length !== 1 || tabList.contains(event.target)) return;
      const touch = event.touches[0];
      swipe = {
        x: touch.clientX,
        y: touch.clientY,
        previous: atReadingEdge(-1) && hasAdjacentProject(-1),
        next: atReadingEdge(1) && hasAdjacentProject(1),
        consumed: false,
      };
    }, { passive: true });
    gallery.addEventListener('touchmove', event => {
      if (!swipe || event.touches.length !== 1) {
        swipe = null;
        return;
      }
      if (swipe.consumed) {
        event.preventDefault();
        return;
      }
      const dx = event.touches[0].clientX - swipe.x;
      const dy = swipe.y - event.touches[0].clientY;
      if (Math.abs(dy) < 8 || Math.abs(dy) < Math.abs(dx) * 1.3) return;
      const eligible = dy > 0 ? swipe.next : swipe.previous;
      if (!eligible) return;
      event.preventDefault();
      if (Math.abs(dy) >= 56) {
        turnProject(dy > 0 ? 1 : -1);
        swipe.consumed = true;
      }
    }, { passive: false });
    const finishSwipe = () => { swipe = null; };
    gallery.addEventListener('touchend', finishSwipe, { passive: true });
    gallery.addEventListener('touchcancel', finishSwipe, { passive: true });

    gallery.addEventListener('keydown', event => {
      const direction = event.key === 'PageDown' ? 1 : event.key === 'PageUp' ? -1 : 0;
      if (!direction || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (atReadingEdge(direction) && hasAdjacentProject(direction)) {
        event.preventDefault();
        turnProject(direction);
      }
    });
  }

})();
