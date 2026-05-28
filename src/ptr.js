// ── Pull-to-refresh（上端で引っ張るとリロード） ──
// iOS Safari PWA モード対応：touchstart 時点で「上端にいるか」を判定し、
// 上端にいなければそのターゲットを一切追跡しない。

if ('ontouchstart' in window) {
  const THRESHOLD = 72;
  let startY  = 0;
  let pulling = false;
  let indicator = null;
  let arrow    = null;

  const atTop = () =>
    (window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0) <= 0;

  function getIndicator() {
    if (indicator) return indicator;
    indicator = document.createElement('div');
    indicator.id = 'ptr-indicator';
    indicator.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:99999',
      'display:flex', 'align-items:center', 'justify-content:center',
      'height:0', 'overflow:hidden', 'transition:none',
      'background:var(--surface)', 'pointer-events:none',
    ].join(';');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.style.cssText = 'transition:transform 0.05s linear;color:var(--text2);will-change:transform;';
    svg.innerHTML = `
      <path d="M12 4V1L8 5l4 4V6a6 6 0 1 1-5.66 7.99L4.68 13A8 8 0 1 0 12 4z"
            fill="currentColor"/>`;
    arrow = svg;
    indicator.appendChild(svg);

    if (!document.getElementById('ptr-style')) {
      const st = document.createElement('style');
      st.id = 'ptr-style';
      st.textContent = '@keyframes ptr-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
      document.head.appendChild(st);
    }

    document.body.prepend(indicator);
    return indicator;
  }

  function collapseIndicator() {
    if (!indicator) return;
    indicator.style.transition = 'height 0.2s ease';
    indicator.style.height = '0';
    if (arrow) {
      arrow.style.transition = 'none';
      arrow.style.animation  = 'none';
      arrow.style.transform  = 'rotate(0deg)';
    }
  }

  document.addEventListener('touchstart', e => {
    pulling = atTop();
    startY  = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!pulling) return;
    const delta = e.touches[0].clientY - startY;
    if (delta <= 0) return;
    const ind = getIndicator();
    ind.style.transition = 'none';
    ind.style.height = `${Math.min(delta * 0.55, 56)  }px`;
    const progress = Math.min(delta / THRESHOLD, 1);
    if (arrow) {
      arrow.style.transition = 'none';
      arrow.style.animation  = 'none';
      arrow.style.transform  = `rotate(${Math.round(progress * 360)}deg)`;
      arrow.style.opacity    = 0.4 + progress * 0.6;
      arrow.style.color      = progress >= 1 ? 'var(--accent)' : 'var(--text2)';
    }
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!pulling) return;
    const delta = e.changedTouches[0].clientY - startY;
    pulling = false;
    if (delta >= THRESHOLD) {
      if (arrow) {
        arrow.style.transition = 'none';
        arrow.style.animation  = 'ptr-spin 0.5s linear infinite';
        arrow.style.opacity    = '1';
        arrow.style.color      = 'var(--accent)';
      }
      setTimeout(() => location.reload(), 650);
    } else {
      collapseIndicator();
    }
  }, { passive: true });

  document.addEventListener('touchcancel', () => {
    pulling = false;
    collapseIndicator();
  }, { passive: true });
}
