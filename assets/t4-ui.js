(() => {
  'use strict';

  const onReady = callback => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once:true });
    else callback();
  };

  const isVisible = element => {
    if (!element) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
  };

  const animateView = root => {
    if (!root || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    root.classList.remove('t4-view-enter');
    void root.offsetWidth;
    root.classList.add('t4-view-enter');
  };

  const syncNavigationA11y = () => {
    document.querySelectorAll('.nav-item,.sb-item').forEach(item => {
      if (!item.hasAttribute('role')) item.setAttribute('role', 'button');
      if (!item.hasAttribute('tabindex')) item.tabIndex = 0;
      if (item.classList.contains('active')) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  };

  const installNetworkStatus = () => {
    const badge = document.createElement('div');
    badge.className = 't4-network-state';
    badge.setAttribute('role', 'status');
    badge.setAttribute('aria-live', 'polite');
    document.body.appendChild(badge);
    let timer = 0;
    const update = online => {
      clearTimeout(timer);
      badge.classList.toggle('online', online);
      badge.textContent = online ? 'Conexão restabelecida' : 'Sem conexão — alterações podem não ser sincronizadas';
      badge.classList.add('show');
      if (online) timer = setTimeout(() => badge.classList.remove('show'), 2600);
    };
    window.addEventListener('offline', () => update(false));
    window.addEventListener('online', () => update(true));
    if (!navigator.onLine) update(false);
  };

  const installSearchShortcut = () => {
    document.addEventListener('keydown', event => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
      const candidates = [
        '#global-search', '#filter-q', '#nlp-search', '#op-search', '#emp-search',
        'input[type="search"]', '.search-wrap input', '.search input'
      ];
      const target = candidates.flatMap(selector => [...document.querySelectorAll(selector)]).find(isVisible);
      if (!target) return;
      event.preventDefault();
      target.focus();
      if (typeof target.select === 'function') target.select();
    });
  };

  const installSyncTimestamp = () => {
    document.querySelectorAll('#sync-lbl,#sync-label').forEach(label => {
      const stamp = () => {
        const value = label.textContent.toLowerCase();
        if (!value.includes('sincronizado') || value.includes('não')) return;
        const time = new Intl.DateTimeFormat('pt-BR', { hour:'2-digit', minute:'2-digit' }).format(new Date());
        label.title = `Última confirmação às ${time}`;
      };
      new MutationObserver(stamp).observe(label, { childList:true, characterData:true, subtree:true });
      stamp();
    });
  };

  onReady(() => {
    document.body.classList.add('t4-ui-ready');

    const mainTarget = document.getElementById('content')
      || document.getElementById('view-root')
      || document.getElementById('main')
      || document.querySelector('main,.main');
    if (mainTarget && !mainTarget.id) mainTarget.id = 't4-main-content';
    const skip = document.createElement('a');
    skip.className = 't4-skip-link';
    skip.href = mainTarget?.id ? `#${mainTarget.id}` : '#';
    skip.textContent = 'Ir para o conteúdo';
    document.body.prepend(skip);

    document.querySelectorAll('button:not([type])').forEach(button => button.type = 'button');
    syncNavigationA11y();

    document.addEventListener('keydown', event => {
      const item = event.target.closest?.('.nav-item,.sb-item');
      if (!item || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      item.click();
    });

    const roots = ['content', 'view-root'].map(id => document.getElementById(id)).filter(Boolean);
    roots.forEach(root => new MutationObserver(() => animateView(root)).observe(root, { childList:true }));

    const navObserver = new MutationObserver(records => {
      syncNavigationA11y();
      records.forEach(record => {
        if (record.target.matches?.('.page.active')) animateView(record.target);
      });
    });
    document.querySelectorAll('.nav-item,.sb-item,.page').forEach(item => navObserver.observe(item, { attributes:true, attributeFilter:['class'] }));

    installNetworkStatus();
    installSearchShortcut();
    installSyncTimestamp();
  });
})();
