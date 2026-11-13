(() => {
  const hero = document.querySelector('[data-personal-hero]');
  const orbit = hero?.querySelector('.hero-orbit');
  if (!hero || !orbit) return;

  const motion = window.matchMedia('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)');
  let frame = 0;
  let x = 0;
  let y = 0;
  const reset = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    x = y = 0;
    ['--orbit-x', '--orbit-y', '--orbit-rx', '--orbit-ry'].forEach(name => orbit.style.removeProperty(name));
  };
  const paint = () => {
    frame = 0;
    if (!motion.matches || document.hidden) return;
    orbit.style.setProperty('--orbit-x', `${(x * 6).toFixed(2)}px`);
    orbit.style.setProperty('--orbit-y', `${(y * 5).toFixed(2)}px`);
    orbit.style.setProperty('--orbit-rx', `${(-y * 2).toFixed(2)}deg`);
    orbit.style.setProperty('--orbit-ry', `${(x * 2).toFixed(2)}deg`);
  };
  hero.addEventListener('pointermove', event => {
    if (!motion.matches || event.pointerType !== 'mouse') return;
    const rect = hero.getBoundingClientRect();
    x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
    y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
    if (!frame) frame = requestAnimationFrame(paint);
  }, { passive: true });
  hero.addEventListener('pointerleave', reset);
  motion.addEventListener('change', reset);
  document.addEventListener('visibilitychange', reset);
})();
