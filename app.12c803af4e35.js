(() => {
  'use strict';
  function initNavigation() {
    const header = document.querySelector('.header');
    const menu = header?.querySelector('.menu-toggle');
    const nav = header?.querySelector('#navigation');
    if (!header || !menu || !nav || typeof matchMedia !== 'function') return;
    const mobile = matchMedia('(max-width:820px)');
    const openLabel = menu.getAttribute('aria-label') || 'Open navigation';
    const closeLabel = menu.dataset.closeLabel || 'Close navigation';
    function close(restoreFocus = false) {
      const wasOpen = nav.classList.contains('open');
      nav.classList.remove('open');
      menu.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-label', openLabel);
      if (restoreFocus && wasOpen && mobile.matches) menu.focus();
    }
    menu.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      menu.setAttribute('aria-expanded', String(isOpen));
      menu.setAttribute('aria-label', isOpen ? closeLabel : openLabel);
    });
    nav.addEventListener('click', event => {
      if (event.target.closest('a')) close();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && nav.classList.contains('open')) {
        event.preventDefault();
        close(true);
      }
    });
    document.addEventListener('click', event => {
      if (!header.contains(event.target)) close();
    });
    header.addEventListener('focusout', event => {
      if (!header.contains(event.relatedTarget)) close();
    });
    mobile.addEventListener('change', () => {
      const hiddenFocus = !mobile.matches && document.activeElement === menu;
      const navFocus = mobile.matches && nav.contains(document.activeElement);
      close();
      if (hiddenFocus) nav.querySelector('[aria-current="page"],a')?.focus();
      if (navFocus) menu.focus();
    });
    header.classList.add('menu-enhanced');
    menu.hidden = false;
  }

  function initLanguageSwitch() {
    const link = document.querySelector('[data-language-switch]');
    if (!link) return;
    const base = link.getAttribute('href');
    // Corresponding pages use shared section IDs. Ordinary links work without JS;
    // this optional enhancement retains the currently selected section as well.
    const sync = () => { link.setAttribute('href', base + location.hash); };
    window.addEventListener('hashchange', sync);
    sync();
  }

  function initServices() {
    const details = [...document.querySelectorAll('.service-detail')];
    if (!details.length || typeof matchMedia !== 'function') return;
    const compact = matchMedia('(max-width:560px)');
    const jump = document.querySelector('#service-jump');
    const expand = document.querySelector('#expand-services');
    const tools = document.querySelector('.mobile-service-tools');
    function sync() {
      const all = details.every(detail => detail.open);
      if (expand) {
        expand.textContent = all ? (expand.dataset.collapseLabel || 'Collapse all') : (expand.dataset.expandLabel || 'Expand all');
        expand.setAttribute('aria-pressed', String(all));
      }
    }
    function openService(id, scroll = true) {
      const target = document.getElementById(id);
      if (!target) return;
      const detail = target.querySelector('.service-detail');
      if (compact.matches && detail) details.forEach(item => { item.open = item === detail; });
      if (jump && [...jump.options].some(option => option.value === id)) jump.value = id;
      sync();
      if (scroll) requestAnimationFrame(() => target.scrollIntoView({ block:'start', behavior:'instant' }));
    }
    function setLayout() {
      if (compact.matches) {
        const hash = location.hash.slice(1);
        const selected = document.getElementById(hash)?.querySelector('.service-detail') || details[0];
        details.forEach(detail => { detail.open = detail === selected; });
        if (jump) jump.value = selected.closest('.scope-card')?.id || '';
        if (hash) openService(hash);
      } else details.forEach(detail => { detail.open = true; });
      sync();
    }
    details.forEach(detail => {
      detail.querySelector('summary')?.addEventListener('click', event => {
        if (!compact.matches) return;
        event.preventDefault();
        const open = !detail.open;
        details.forEach(item => { item.open = item === detail && open; });
        if (jump) jump.value = open ? detail.closest('.scope-card')?.id || '' : '';
        sync();
      });
      detail.addEventListener('toggle', sync);
    });
    jump?.addEventListener('change', () => {
      if (!jump.value) return;
      if (location.hash.slice(1) === jump.value) openService(jump.value);
      else location.hash = jump.value;
    });
    expand?.addEventListener('click', () => {
      const open = !details.every(detail => detail.open);
      details.forEach(detail => { detail.open = open; });
      sync();
    });
    window.addEventListener('hashchange', () => openService(location.hash.slice(1)));
    compact.addEventListener('change', setLayout);
    document.body.classList.add('services-enhanced');
    if (tools) tools.hidden = false;
    setLayout();
  }

  function initForm() {
    // No endpoint, persistence, email, or success state is enabled in Phase 3.
    const form = document.querySelector('#assessment-form[data-integration="disabled"]');
    if (!form) return;
    form.addEventListener('submit', event => event.preventDefault());
    form.querySelectorAll('input,select,textarea').forEach(field => {
      // Translate existing browser constraints without introducing form delivery.
      field.addEventListener('invalid', () => {
        field.setCustomValidity('');
        const state = field.validity;
        if (state.valueMissing) field.setCustomValidity(form.dataset.requiredMessage || 'Please complete this field.');
        else if (state.typeMismatch) field.setCustomValidity(form.dataset.emailMessage || 'Please enter a valid email address.');
        else if (state.tooLong) field.setCustomValidity(form.dataset.lengthMessage || 'Please shorten this entry to the allowed length.');
      });
      field.addEventListener('input', () => field.setCustomValidity(''));
      field.addEventListener('change', () => field.setCustomValidity(''));
    });
  }

  function initReveal() {
    if (typeof IntersectionObserver !== 'function' || typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {threshold:.08, rootMargin:'0px 0px -35px 0px'});
    document.querySelectorAll('.intro,.section-head,.service-card,.why-visual,.why-copy,.steps article,.cta').forEach(element => {
      element.classList.add('reveal');
      observer.observe(element);
    });
    document.documentElement.classList.add('reveal-ready');
  }
  initNavigation();
  initLanguageSwitch();
  initServices();
  initForm();
  initReveal();
})();
