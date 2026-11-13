(() => {
  const galleries = [...document.querySelectorAll('[data-research-gallery]')];
  if (!galleries.length) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const dialog = document.querySelector('[data-gallery-dialog]');
  const viewerImage = dialog?.querySelector('[data-viewer-image]');
  const viewerCaption = dialog?.querySelector('[data-viewer-caption]');
  const viewerPosition = dialog?.querySelector('[data-viewer-position]');
  const viewerPrevious = dialog?.querySelector('[data-viewer-prev]');
  const viewerNext = dialog?.querySelector('[data-viewer-next]');
  const viewerClose = dialog?.querySelector('[data-viewer-close]');
  const viewerOriginal = dialog?.querySelector('[data-viewer-original]');
  const canPreview = typeof dialog?.showModal === 'function'
    && viewerImage && viewerCaption && viewerPosition
    && viewerPrevious && viewerNext && viewerClose && viewerOriginal;
  let activeImages = [];
  let activeIndex = 0;
  let trigger = null;
  let pagePosition = null;

  const showImage = index => {
    activeIndex = (index + activeImages.length) % activeImages.length;
    const link = activeImages[activeIndex];
    viewerImage.src = link.href;
    viewerImage.alt = link.querySelector('img')?.alt || link.dataset.caption || '';
    viewerCaption.textContent = link.dataset.caption || viewerImage.alt;
    viewerPosition.textContent = `${activeIndex + 1} / ${activeImages.length}`;
    viewerOriginal.href = link.href;
    viewerPrevious.disabled = viewerNext.disabled = activeImages.length < 2;
  };

  if (canPreview) {
    viewerPrevious.addEventListener('click', () => showImage(activeIndex - 1));
    viewerNext.addEventListener('click', () => showImage(activeIndex + 1));
    viewerClose.addEventListener('click', () => dialog.close());
    dialog.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      showImage(activeIndex + (event.key === 'ArrowRight' ? 1 : -1));
    });
    // Native dialog cancellation handles Escape, while close covers every exit.
    dialog.addEventListener('close', () => {
      document.documentElement.classList.remove('has-image-viewer');
      trigger?.focus({ preventScroll: true });
      if (pagePosition) {
        window.scrollTo({ ...pagePosition, behavior: 'instant' });
      }
      activeImages = [];
      trigger = null;
      pagePosition = null;
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right
        || event.clientY < rect.top || event.clientY > rect.bottom) {
        dialog.close();
      }
    });
  }

  galleries.forEach(gallery => {
    const track = gallery.querySelector('[data-gallery-track]');
    const images = [...gallery.querySelectorAll('[data-gallery-image]')];
    const previous = gallery.querySelector('[data-gallery-prev]');
    const next = gallery.querySelector('[data-gallery-next]');
    const position = gallery.querySelector('[data-gallery-position]');
    const controls = gallery.querySelector('[data-gallery-controls]');
    if (!track || !images.length || !previous || !next || !position || !controls) return;

    let requestedIndex = null;
    let scrollFrame = 0;
    let scrollTimer = 0;
    const scrollPositions = () => {
      const firstLeft = images[0].getBoundingClientRect().left;
      const limit = Math.max(0, track.scrollWidth - track.clientWidth);
      return images.map(image => Math.min(limit, image.getBoundingClientRect().left - firstLeft));
    };
    const currentIndex = positions => {
      const limit = Math.max(0, track.scrollWidth - track.clientWidth);
      if (limit < 2) return 0;
      if (track.scrollLeft >= limit - 2) return images.length - 1;
      return positions.reduce((nearest, left, index) =>
        Math.abs(left - track.scrollLeft) < Math.abs(positions[nearest] - track.scrollLeft)
          ? index : nearest, 0);
    };
    const syncControls = () => {
      const positions = scrollPositions();
      const index = requestedIndex ?? currentIndex(positions);
      const fits = track.scrollWidth - track.clientWidth < 2;
      position.textContent = `${index + 1} / ${images.length}`;
      previous.disabled = fits || index === 0;
      next.disabled = fits || index === images.length - 1;
    };
    const move = direction => {
      const positions = scrollPositions();
      const from = requestedIndex ?? currentIndex(positions);
      requestedIndex = Math.max(0, Math.min(images.length - 1, from + direction));
      track.scrollTo({
        left: positions[requestedIndex],
        behavior: reducedMotion.matches ? 'auto' : 'smooth',
      });
      syncControls();
    };
    previous.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    track.addEventListener('scroll', () => {
      if (!scrollFrame) {
        scrollFrame = window.requestAnimationFrame(() => {
          scrollFrame = 0;
          syncControls();
        });
      }
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        requestedIndex = null;
        syncControls();
      }, 120);
    }, { passive: true });
    // Let a manual gesture interrupt an in-flight button scroll naturally.
    const manualScroll = () => { requestedIndex = null; };
    track.addEventListener('pointerdown', manualScroll, { passive: true });
    track.addEventListener('touchstart', manualScroll, { passive: true });
    track.addEventListener('wheel', manualScroll, { passive: true });
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(() => {
        requestedIndex = null;
        syncControls();
      }).observe(track);
    } else {
      window.addEventListener('resize', syncControls);
    }
    controls.hidden = false;
    syncControls();

    if (!canPreview) return;
    images.forEach((link, index) => {
      link.addEventListener('click', event => {
        if (event.defaultPrevented || event.button !== 0
          || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        event.preventDefault();
        activeImages = images;
        trigger = link;
        pagePosition = { left: window.scrollX, top: window.scrollY };
        showImage(index);
        dialog.showModal();
        document.documentElement.classList.add('has-image-viewer');
        viewerClose.focus({ preventScroll: true });
      });
    });
  });
})();
