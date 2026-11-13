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
  }

  const copyButton = document.querySelector('[data-copy-email]');
  const status = document.querySelector('.copy-status');
  if (copyButton && status && navigator.clipboard?.writeText) {
    copyButton.hidden = false;
    let clearStatus;
    copyButton.addEventListener('click', async () => {
      clearTimeout(clearStatus);
      try {
        await navigator.clipboard.writeText(copyButton.dataset.copyEmail);
        status.textContent = copyButton.dataset.copySuccess;
      } catch {
        status.textContent = copyButton.dataset.copyFailure;
      }
      clearStatus = setTimeout(() => { status.textContent = ''; }, 6000);
    });
  }
})();
