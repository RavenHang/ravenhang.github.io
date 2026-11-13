(() => {
  const copyButton = document.querySelector('[data-copy-email]');
  const status = document.querySelector('.copy-status');
  if (!copyButton || !status || !navigator.clipboard?.writeText) return;

  copyButton.hidden = false;
  let clearStatus;
  copyButton.addEventListener('click', async () => {
    clearTimeout(clearStatus);
    try {
      await navigator.clipboard.writeText(copyButton.dataset.copyEmail);
      status.textContent = '邮箱已复制';
    } catch {
      status.textContent = '复制未成功，请点击上方邮箱联系或手动复制。';
    }
    clearStatus = setTimeout(() => { status.textContent = ''; }, 6000);
  });
})();
