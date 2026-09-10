/* =========================================================================
   FINSERV — Core interactions
   Theme · Nav · Reveal · Micro-interactions · Showcase · Forms
   ========================================================================= */

(() => {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------------
     Theme — applied pre-paint in <head>, wired up here
     --------------------------------------------------------------------- */
  const initTheme = () => {
    const htmlEl = document.documentElement;
    const toggles = $$('.theme-toggle');

    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      htmlEl.setAttribute('data-theme', 'dark');
    } else if (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      htmlEl.setAttribute('data-theme', 'dark');
    }

    const syncIcons = () => {
      const isDark = htmlEl.getAttribute('data-theme') === 'dark';
      toggles.forEach(t => {
        t.innerHTML = isDark ? '<i class="ph ph-sun"></i>' : '<i class="ph ph-moon"></i>';
        t.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      });
    };
    syncIcons();

    toggles.forEach(t => t.addEventListener('click', () => {
      const isDark = htmlEl.getAttribute('data-theme') === 'dark';
      if (isDark) {
        htmlEl.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
      } else {
        htmlEl.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
      }
      syncIcons();
      document.dispatchEvent(new CustomEvent('themechange'));
    }));
  };

  /* ---------------------------------------------------------------------
     Navbar — frosted-on-scroll + reading progress
     --------------------------------------------------------------------- */
  const initNavbar = () => {
    const nav = $('header.navbar');
    if (!nav) return;

    let bar = $('.scroll-progress', nav);
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'scroll-progress';
      nav.appendChild(bar);
    }

    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      nav.classList.toggle('scrolled', y > 12);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (max > 0 ? Math.min(100, (y / max) * 100) : 0) + '%';
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  };

  /* ---------------------------------------------------------------------
     Mobile drawer
     --------------------------------------------------------------------- */
  const initDrawer = () => {
    const drawer = $('.mobile-drawer');
    const overlay = $('.drawer-overlay');
    if (!drawer || !overlay) return;

    const open = () => {
      drawer.classList.add('open');
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      const first = $('a, button', drawer);
      if (first) first.focus({ preventScroll: true });
    };
    const close = () => {
      drawer.classList.remove('open');
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    };

    const burger = $('.hamburger');
    if (burger) burger.addEventListener('click', open);
    const closeBtn = $('.close-drawer');
    if (closeBtn) closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', close);
    $$('.drawer-links a', drawer).forEach(a => a.addEventListener('click', close));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && drawer.classList.contains('open')) close();
    });

    // Mark the current page in the drawer
    const page = location.pathname.split('/').pop() || 'index.html';
    $$('.drawer-links a', drawer).forEach(a => {
      if (a.getAttribute('href') === page) a.classList.add('active');
    });
  };

  /* ---------------------------------------------------------------------
     Scroll reveal — auto-tagged, staggered per group
     --------------------------------------------------------------------- */
  const initReveal = () => {
    const AUTO = '.section-header, .card, .step-card, .value-card, .team-card, .stat-card, .compare-box, .accordion-item, .comparison-wrapper, .showcase-shell, .calc-shell, .map-placeholder';

    $$(AUTO).forEach(el => {
      if (el.closest('.hero') || el.hasAttribute('data-reveal')) return;
      el.setAttribute('data-reveal', '');
    });

    // Stagger siblings inside each grid
    $$('.card-grid, .step-grid, .stat-grid, .team-grid, .calc-compare-grid, .accordion').forEach(grid => {
      $$('[data-reveal]', grid).forEach((el, i) => {
        el.style.setProperty('--reveal-delay', Math.min(i * 0.09, 0.45) + 's');
      });
    });

    const targets = $$('[data-reveal]');
    if (!targets.length) return;

    if (prefersReduced || !('IntersectionObserver' in window)) {
      targets.forEach(el => el.classList.add('revealed'));
      return;
    }

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    targets.forEach(el => io.observe(el));
  };

  /* ---------------------------------------------------------------------
     Cursor spotlight on cards
     --------------------------------------------------------------------- */
  const initSpotlight = () => {
    if (prefersReduced || !window.matchMedia('(hover: hover)').matches) return;
    $$('.card').forEach(card => {
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((e.clientX - r.left) / r.width) * 100 + '%');
        card.style.setProperty('--my', ((e.clientY - r.top) / r.height) * 100 + '%');
      });
    });
  };

  /* ---------------------------------------------------------------------
     3D tilt for the hero credit card
     --------------------------------------------------------------------- */
  const initTilt = () => {
    const card = $('[data-tilt]');
    if (!card || prefersReduced || !window.matchMedia('(hover: hover)').matches) return;
    const zone = card.closest('.hero-visual') || card.parentElement;
    const floater = card.closest('.card-float');

    zone.addEventListener('pointermove', e => {
      const r = zone.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.transform =
        `rotateY(${(px - 0.5) * 18}deg) rotateX(${(0.5 - py) * 14}deg) translateZ(24px)`;
      card.style.setProperty('--cx', px * 100 + '%');
      card.style.setProperty('--cy', py * 100 + '%');
      if (floater) floater.style.animationPlayState = 'paused';
    });

    zone.addEventListener('pointerleave', () => {
      card.style.transform = '';
      card.style.setProperty('--cx', '50%');
      card.style.setProperty('--cy', '0%');
      if (floater) floater.style.animationPlayState = 'running';
    });
  };

  /* ---------------------------------------------------------------------
     Count-up numbers — [data-count-to], optional data-prefix/suffix/decimals
     --------------------------------------------------------------------- */
  const runCount = el => {
    const to = parseFloat(el.dataset.countTo);
    if (isNaN(to)) return;
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const dur = parseInt(el.dataset.duration || '1600', 10);

    const render = v => {
      el.textContent = prefix + v.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }) + suffix;
    };

    if (prefersReduced) { render(to); return; }

    const start = performance.now();
    const step = now => {
      const p = Math.min((now - start) / dur, 1);
      render(to * (1 - Math.pow(1 - p, 3)));   // easeOutCubic
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const initCounters = () => {
    const nums = $$('[data-count-to]');
    if (!nums.length) return;

    if (!('IntersectionObserver' in window)) { nums.forEach(runCount); return; }

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { runCount(entry.target); obs.unobserve(entry.target); }
      });
    }, { threshold: 0.5 });

    nums.forEach(n => io.observe(n));
  };

  /* ---------------------------------------------------------------------
     Interactive product showcase (index)
     --------------------------------------------------------------------- */
  const initShowcase = () => {
    const shell = $('.showcase-shell');
    if (!shell) return;

    const tabs = $$('.tab-btn', shell);
    const panels = $$('.panel', shell);
    if (!tabs.length) return;

    const activate = (index, focus = false) => {
      tabs.forEach((t, i) => {
        const on = i === index;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      panels.forEach((p, i) => p.classList.toggle('active', i === index));

      const panel = panels[index];
      if (!panel) return;

      // Re-run the balance count-up and re-grow the bars
      const balance = $('[data-count-to]', panel);
      if (balance) runCount(balance);

      $$('.spark-bar', panel).forEach((bar, i) => {
        bar.style.animation = 'none';
        void bar.offsetWidth;                       // force reflow
        bar.style.animation = `growBar 0.65s ${i * 0.045}s var(--ease-out) both`;
      });

      if (focus) tabs[index].focus();
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => activate(i));
      tab.addEventListener('keydown', e => {
        const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
        if (keys[e.key]) {
          e.preventDefault();
          activate((i + keys[e.key] + tabs.length) % tabs.length, true);
        }
      });
    });

    // Kick off the first panel once it scrolls into view
    const start = () => activate(Math.max(0, tabs.findIndex(t => t.classList.contains('active'))));
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries, obs) => {
        entries.forEach(e => { if (e.isIntersecting) { start(); obs.disconnect(); } });
      }, { threshold: 0.25 });
      io.observe(shell);
    } else {
      start();
    }
  };

  /* ---------------------------------------------------------------------
     Account filters
     --------------------------------------------------------------------- */
  const initFilters = () => {
    const btns = $$('.filter-btn');
    const cards = $$('.account-card');
    if (!btns.length) return;

    btns.forEach(btn => btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;
      cards.forEach(card => {
        const show = filter === 'all' || card.dataset.category === filter;
        card.style.display = show ? 'flex' : 'none';
        if (show) {
          card.style.animation = 'none';
          void card.offsetWidth;
          card.style.animation = 'slideUp 0.5s var(--ease-out) both';
        }
      });
    }));
  };

  /* ---------------------------------------------------------------------
     Accordions
     --------------------------------------------------------------------- */
  const initAccordions = () => {
    $$('.accordion-header').forEach(header => {
      const item = header.parentElement;
      header.setAttribute('aria-expanded', String(item.classList.contains('active')));

      header.addEventListener('click', () => {
        const wasOpen = item.classList.contains('active');
        const group = item.closest('.accordion');

        if (group) {
          $$('.accordion-item', group).forEach(other => {
            if (other !== item) {
              other.classList.remove('active');
              const h = $('.accordion-header', other);
              if (h) h.setAttribute('aria-expanded', 'false');
            }
          });
        }

        item.classList.toggle('active', !wasOpen);
        header.setAttribute('aria-expanded', String(!wasOpen));
      });
    });
  };

  /* ---------------------------------------------------------------------
     Form validation
     --------------------------------------------------------------------- */
  const initForms = () => {
    const isEmail = v => /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(String(v).trim());
    // Digits with the usual separators; needs at least 7 digits to pass.
    const isPhone = v => /^[+]?[\d\s().-]{7,20}$/.test(String(v).trim()) && (String(v).match(/\d/g) || []).length >= 7;

    const checkField = input => {
      const group = input.closest('.form-group');
      if (!group) return true;
      const errorEl = $('.form-error', group);
      const setError = msg => {
        group.classList.add('has-error');
        group.classList.remove('has-success');
        if (errorEl) errorEl.textContent = msg;
      };

      group.classList.remove('has-error', 'has-success');

      if (!input.value.trim()) { setError('This field is required'); return false; }
      if (input.type === 'email' && !isEmail(input.value)) { setError('Please enter a valid email address'); return false; }
      if (input.type === 'tel' && !isPhone(input.value)) { setError('Please enter a valid phone number'); return false; }
      if (input.type === 'password' && input.name === 'password' && input.value.length < 8) {
        setError('Password must be at least 8 characters'); return false;
      }
      group.classList.add('has-success');
      return true;
    };

    $$('.validate-form').forEach(form => {
      const required = $$('input[required], textarea[required]', form);

      // Re-validate a field once it has been touched
      required.forEach(input => {
        input.addEventListener('blur', () => { if (input.value.trim()) checkField(input); });
        input.addEventListener('input', () => {
          const group = input.closest('.form-group');
          if (group && group.classList.contains('has-error')) checkField(input);
        });
      });

      form.addEventListener('submit', e => {
        e.preventDefault();
        let valid = required.map(checkField).every(Boolean);

        const pwd = $('input[name="password"]', form);
        const confirm = $('input[name="confirm_password"]', form);
        if (pwd && confirm && pwd.value !== confirm.value) {
          valid = false;
          const group = confirm.closest('.form-group');
          if (group) {
            group.classList.remove('has-success');
            group.classList.add('has-error');
            const err = $('.form-error', group);
            if (err) err.textContent = 'Passwords do not match';
          }
        }

        const terms = $('input[name="terms"]', form);
        if (terms && !terms.checked) {
          valid = false;
          const label = terms.closest('.checkbox-label');
          if (label) {
            label.style.color = 'var(--error-color)';
            setTimeout(() => { label.style.color = ''; }, 2200);
          }
        }

        if (!valid) {
          const firstBad = $('.has-error .form-control', form);
          if (firstBad) firstBad.focus();
          return;
        }

        const btn = $('button[type="submit"]', form);
        if (!btn) return;
        const original = btn.innerHTML;
        btn.innerHTML = '<i class="ph-fill ph-check-circle"></i> Success';
        btn.classList.add('btn-success');
        btn.disabled = true;

        setTimeout(() => {
          btn.innerHTML = original;
          btn.classList.remove('btn-success');
          btn.disabled = false;
          form.reset();
          $$('.form-group', form).forEach(g => g.classList.remove('has-success', 'has-error'));
        }, 2600);
      });
    });
  };

  /* ---------------------------------------------------------------------
     Auth — show / hide password
     --------------------------------------------------------------------- */
  const initPasswordToggles = () => {
    $$('[data-pw-toggle]').forEach(btn => {
      const field = btn.closest('.pw-field');
      const input = field && $('input', field);
      if (!input) return;

      btn.addEventListener('click', () => {
        const hidden = input.type === 'password';
        input.type = hidden ? 'text' : 'password';
        btn.innerHTML = hidden ? '<i class="ph ph-eye-slash"></i>' : '<i class="ph ph-eye"></i>';
        btn.setAttribute('aria-label', hidden ? 'Hide password' : 'Show password');
        input.focus({ preventScroll: true });
      });
    });
  };


  /* ---------------------------------------------------------------------
     Back to top — injected so every page gets it without extra markup
     --------------------------------------------------------------------- */
  const initBackToTop = () => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'back-to-top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML = '<i class="ph-bold ph-arrow-up"></i>';
    document.body.appendChild(btn);

    let ticking = false;
    const update = () => {
      btn.classList.toggle('visible', window.scrollY > 500);
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' });
    });
  };
  /* --------------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initNavbar();
    initDrawer();
    initReveal();
    initSpotlight();
    initTilt();
    initCounters();
    initShowcase();
    initFilters();
    initAccordions();
    initForms();
    initPasswordToggles();
    initBackToTop();
  });

  // Shared with calculator.js
  window.FINSERV = { $, $$, runCount, prefersReduced };
})();
