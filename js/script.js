/* =========================================================
   MoveX Cargo — main script
   Modules (order matters):
     1. Theme system (light/dark + localStorage)
     2. Navbar (hamburger, smooth scroll, active link)
     3. Submissions store (invisible — no UI)
     4. Validation helpers
     5. Quote / Fare calculator
     6. Contact form
     7. Footer year
   ========================================================= */
(function () {
  'use strict';

  /* =========================================================
     1. THEME SYSTEM
     ========================================================= */
  (function themeModule() {
    const STORAGE_KEY = 'movex-theme';
    const root = document.documentElement;

    function getInitialTheme() {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;

      const prefersDark = window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'dark' : 'light';
    }

    function applyTheme(theme) {
      root.setAttribute('data-theme', theme);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute('content', theme === 'dark' ? '#0a1220' : '#ffffff');
      }
    }

    applyTheme(getInitialTheme());

    window.MoveXTheme = {
      toggle() {
        const current = root.getAttribute('data-theme') || 'light';
        const next = current === 'light' ? 'dark' : 'light';
        applyTheme(next);
        localStorage.setItem(STORAGE_KEY, next);
      },
      get current() {
        return root.getAttribute('data-theme') || 'light';
      }
    };

    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener?.('change', (e) => {
        if (!localStorage.getItem(STORAGE_KEY)) {
          applyTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  })();

  /* =========================================================
     2. NAVBAR
     ========================================================= */
  (function navbarModule() {
    const header    = document.getElementById('site-header');
    const nav       = document.getElementById('primary-nav');
    const navToggle = document.getElementById('nav-toggle');
    const themeBtn  = document.getElementById('theme-toggle');

    if (!header || !nav || !navToggle) return;

    /* Hamburger toggle */
    function setNavOpen(open) {
      nav.classList.toggle('is-open', open);
      navToggle.classList.toggle('is-open', open);
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }

    navToggle.addEventListener('click', () => {
      setNavOpen(!nav.classList.contains('is-open'));
    });

    /* Close on nav link click */
    nav.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', () => setNavOpen(false));
    });

    /* Close on Escape */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setNavOpen(false);
        navToggle.focus();
      }
    });

    /* Close on outside click */
    document.addEventListener('click', (e) => {
      if (!nav.classList.contains('is-open')) return;
      if (nav.contains(e.target) || navToggle.contains(e.target)) return;
      setNavOpen(false);
    });

    /* Reset when crossing the desktop breakpoint (matches CSS 1100px) */
    const mqDesktop = window.matchMedia('(min-width: 1101px)');
    mqDesktop.addEventListener?.('change', (e) => {
      if (e.matches) setNavOpen(false);
    });

    /* Sticky shadow */
    const onScroll = () => {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    /* Smooth scroll with sticky-header offset */
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      const href = link.getAttribute('href');
      if (!href || href === '#' || href.length < 2) return;

      link.addEventListener('click', (e) => {
        const target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();

        const headerH = header.offsetHeight;
        const top = target.getBoundingClientRect().top + window.scrollY - headerH + 1;
        window.scrollTo({ top, behavior: 'smooth' });

        history.replaceState(null, '', href);
      });
    });

    /* Active link highlighting */
    const navLinks = Array.from(nav.querySelectorAll('.nav__link'));
    const sections = navLinks
      .map((l) => document.querySelector(l.getAttribute('href')))
      .filter(Boolean);

    if ('IntersectionObserver' in window && sections.length) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const id = '#' + entry.target.id;
            navLinks.forEach((l) => l.classList.toggle('is-active',
              l.getAttribute('href') === id));
          });
        },
        {
          rootMargin: `-${header.offsetHeight + 20}px 0px -60% 0px`,
          threshold: 0
        }
      );
      sections.forEach((s) => io.observe(s));
    }

    /* Theme toggle button */
    if (themeBtn && window.MoveXTheme) {
      const syncPressed = () => {
        const dark = window.MoveXTheme.current === 'dark';
        themeBtn.setAttribute('aria-pressed', String(dark));
        themeBtn.setAttribute('aria-label',
          dark ? 'Switch to light mode' : 'Switch to dark mode');
      };
      syncPressed();

      themeBtn.addEventListener('click', () => {
        window.MoveXTheme.toggle();
        syncPressed();
      });
    }
  })();

  /* =========================================================
     3. SUBMISSIONS STORE (no UI — invisible to visitors)
     Data is kept in memory and mirrored to localStorage so
     you can inspect it in DevTools. To send submissions to a
     real backend later, add a fetch() inside .add() below.
     ========================================================= */
  const Submissions = (function () {
    const STORAGE_KEY = 'movex-submissions';

    function load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { quotes: [], contacts: [] };
        const data = JSON.parse(raw);
        return {
          quotes: Array.isArray(data.quotes) ? data.quotes : [],
          contacts: Array.isArray(data.contacts) ? data.contacts : []
        };
      } catch {
        return { quotes: [], contacts: [] };
      }
    }

    let state = load();

    function persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch { /* quota / private mode — ignore */ }
    }

    return {
      get state() { return state; },
      add(type, payload) {
        const key = type === 'quote' ? 'quotes' : 'contacts';
        const entry = {
          id: 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          createdAt: new Date().toISOString(),
          data: payload
        };
        state = { ...state, [key]: [entry, ...state[key]] };
        persist();

        /* ---------------------------------------------------
           INTEGRATION POINT
           To send submissions to your inbox, uncomment and
           replace the URL with your own endpoint:

           fetch('https://formspree.io/f/YOUR_FORM_ID', {
             method: 'POST',
             headers: {
               'Content-Type': 'application/json',
               'Accept': 'application/json'
             },
             body: JSON.stringify({ formType: type, ...payload })
           }).catch((err) => console.warn('Submission error:', err));
           --------------------------------------------------- */

        return entry;
      }
    };
  })();

  /* =========================================================
     4. FORM VALIDATION HELPERS
     ========================================================= */
  function setFieldError(field, message) {
    if (!field) return;
    const wrap = field.closest('.field');
    const errorEl = wrap && wrap.querySelector('.field__error');
    if (message) {
      wrap?.classList.add('is-invalid');
      if (errorEl) errorEl.textContent = message;
      field.setAttribute('aria-invalid', 'true');
    } else {
      wrap?.classList.remove('is-invalid');
      if (errorEl) errorEl.textContent = '';
      field.removeAttribute('aria-invalid');
    }
  }

  function clearErrors(form) {
    form.querySelectorAll('.field').forEach((wrap) => {
      wrap.classList.remove('is-invalid');
      const err = wrap.querySelector('.field__error');
      if (err) err.textContent = '';
    });
    form.querySelectorAll('[aria-invalid]').forEach((el) =>
      el.removeAttribute('aria-invalid'));
  }

  function validateEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function validatePhone(value) {
    if (!value) return true; // optional
    return /^[+\d][\d\s\-()]{6,}$/.test(value);
  }

  /* Blur-time feedback (fires once the user leaves a field) */
  function attachLiveValidation(form) {
    form.querySelectorAll('input, select, textarea').forEach((field) => {
      field.addEventListener('blur', () => {
        const name = field.name;
        const value = (field.value || '').trim();

        if (field.required && !value) {
          setFieldError(field, 'This field is required.');
          return;
        }
        if (name === 'email' && value && !validateEmail(value)) {
          setFieldError(field, 'Enter a valid email address.');
          return;
        }
        if (name === 'phone' && value && !validatePhone(value)) {
          setFieldError(field, 'Enter a valid phone number.');
          return;
        }
        if ((name === 'weight') && value && parseFloat(value) <= 0) {
          setFieldError(field, 'Weight must be greater than 0.');
          return;
        }
        setFieldError(field, '');
      });
      field.addEventListener('input', () => {
        if (field.closest('.field')?.classList.contains('is-invalid')) {
          setFieldError(field, '');
        }
      });
    });
  }

  /* =========================================================
     5. FARE CALCULATOR (Quote form)
     ========================================================= */
  (function quoteModule() {
    const form    = document.getElementById('quote-form');
    if (!form) return;

    const emptyEl = document.getElementById('quote-empty');
    const filledEl= document.getElementById('quote-filled');
    const fareEl  = document.getElementById('quote-fare-value');
    const breakEl = document.getElementById('quote-breakdown');
    const submitBtn = document.getElementById('quote-submit');
    const editBtn   = document.getElementById('quote-edit');

    let lastQuote = null;

    /* Pricing model — tweak numbers as needed. */
    const PRICING = {
      base: {
        air: 1000,   /* PKR per kg for air */
        sea: 450     /* PKR per kg for sea (min 5 kg billing) */
      },
      destination: {
        uk: 1.00,
        usa: 1.15,
        canada: 1.15,
        europe: 1.05,
        uae: 0.85,
        ksa: 0.85,
        qatar: 0.85,
        oman: 0.85
      },
      cargoSurcharge: {
        documents: 0,
        general: 0,
        clothes: 0,
        electronics: 300,
        household: 500,
        food: 400
      },
      handlingFlat: 500,
      insuranceRate: 0.01
    };

    function fmt(n) {
      return new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 })
        .format(Math.round(n));
    }

    function calculateQuote(data) {
      const weight = Math.max(0.1, parseFloat(data.weight) || 0);
      const mode = data.mode;
      const dest = data.destination;
      const cargo = data.cargo;

      const billedWeight = mode === 'sea' ? Math.max(weight, 5) : weight;
      const perKg = PRICING.base[mode] ?? PRICING.base.air;
      const destMul = PRICING.destination[dest] ?? 1;
      const cargoFee = PRICING.cargoSurcharge[cargo] ?? 0;

      const freight = billedWeight * perKg * destMul;
      const handling = PRICING.handlingFlat + cargoFee;
      const subtotal = freight + handling;
      const insurance = subtotal * PRICING.insuranceRate;
      const total = subtotal + insurance;

      return {
        billedWeight,
        perKg,
        destMul,
        freight,
        handling,
        cargoFee,
        insurance,
        total
      };
    }

    function readForm() {
      const fd = new FormData(form);
      return {
        pickup: (fd.get('pickup') || '').toString().trim(),
        destination: (fd.get('destination') || '').toString().trim(),
        weight: (fd.get('weight') || '').toString().trim(),
        mode: (fd.get('mode') || '').toString().trim(),
        cargo: (fd.get('cargo') || '').toString().trim(),
        notes: (fd.get('notes') || '').toString().trim()
      };
    }

    function validate(data) {
      clearErrors(form);
      let ok = true;

      const req = [
        ['q-pickup', data.pickup],
        ['q-destination', data.destination],
        ['q-mode', data.mode],
        ['q-cargo', data.cargo]
      ];
      req.forEach(([id, value]) => {
        if (!value) {
          setFieldError(document.getElementById(id), 'Please select an option.');
          ok = false;
        }
      });

      const weightField = document.getElementById('q-weight');
      const w = parseFloat(data.weight);
      if (!data.weight) {
        setFieldError(weightField, 'Please enter a weight.');
        ok = false;
      } else if (isNaN(w) || w <= 0) {
        setFieldError(weightField, 'Weight must be greater than 0.');
        ok = false;
      }
      return ok;
    }

    function labelForDestination(key) {
      const map = {
        uk: 'United Kingdom',
        usa: 'United States',
        canada: 'Canada',
        europe: 'Europe',
        uae: 'UAE',
        ksa: 'Saudi Arabia',
        qatar: 'Qatar',
        oman: 'Oman'
      };
      return map[key] || key;
    }

    function renderResult(q, data) {
      if (emptyEl) emptyEl.hidden = true;
      if (filledEl) filledEl.hidden = false;

      fareEl.textContent = fmt(q.total);

      const rows = [
        ['Freight',          `${fmt(q.freight)} PKR`],
        ['Handling & docs',  `${fmt(q.handling)} PKR`],
        ['Insurance (1%)',   `${fmt(q.insurance)} PKR`],
        ['Billed weight',    `${q.billedWeight.toFixed(1)} kg`],
        ['Rate per kg',      `${fmt(q.perKg * q.destMul)} PKR`],
        ['Destination',      labelForDestination(data.destination)],
        ['Mode',             data.mode === 'air' ? 'Air parcel' : 'Sea cargo']
      ];

      breakEl.innerHTML = rows.map(([dt, dd]) =>
        `<dt>${dt}</dt><dd>${dd}</dd>`
      ).join('');

      lastQuote = { ...data, estimate: q };
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = readForm();
      if (!validate(data)) {
        form.querySelector('.field.is-invalid input, .field.is-invalid select')?.focus();
        return;
      }
      const q = calculateQuote(data);
      renderResult(q, data);

      if (window.matchMedia('(max-width: 960px)').matches) {
        filledEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    form.addEventListener('reset', () => {
      clearErrors(form);
      lastQuote = null;
      if (emptyEl) emptyEl.hidden = false;
      if (filledEl) filledEl.hidden = true;
    });

    editBtn?.addEventListener('click', () => {
      form.querySelector('input, select, textarea')?.focus();
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    /* "Send this to MoveX" — captures the quote silently */
    submitBtn?.addEventListener('click', () => {
      if (!lastQuote) return;

      Submissions.add('quote', {
        pickup: lastQuote.pickup,
        destination: labelForDestination(lastQuote.destination),
        weight: lastQuote.weight + ' kg',
        mode: lastQuote.mode === 'air' ? 'Air parcel' : 'Sea cargo',
        cargo: lastQuote.cargo,
        estimate: 'PKR ' + fmt(lastQuote.estimate.total),
        notes: lastQuote.notes || '—'
      });

      submitBtn.disabled = true;
      submitBtn.textContent = 'Sent to MoveX';

      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML =
          'Send this to MoveX <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg>';
      }, 2200);
    });

    attachLiveValidation(form);
  })();

  /* =========================================================
     6. CONTACT FORM
     ========================================================= */
  (function contactModule() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    function readForm() {
      const fd = new FormData(form);
      return {
        name: (fd.get('name') || '').toString().trim(),
        email: (fd.get('email') || '').toString().trim(),
        phone: (fd.get('phone') || '').toString().trim(),
        subject: (fd.get('subject') || '').toString().trim(),
        message: (fd.get('message') || '').toString().trim()
      };
    }

    function validate(data) {
      clearErrors(form);
      let ok = true;

      const nameF = document.getElementById('c-name');
      const emailF = document.getElementById('c-email');
      const phoneF = document.getElementById('c-phone');
      const subjF = document.getElementById('c-subject');
      const msgF = document.getElementById('c-message');

      if (!data.name) { setFieldError(nameF, 'Please enter your name.'); ok = false; }
      if (!data.email) {
        setFieldError(emailF, 'Please enter your email.');
        ok = false;
      } else if (!validateEmail(data.email)) {
        setFieldError(emailF, 'Enter a valid email address.');
        ok = false;
      }
      if (data.phone && !validatePhone(data.phone)) {
        setFieldError(phoneF, 'Enter a valid phone number.');
        ok = false;
      }
      if (!data.subject) {
        setFieldError(subjF, 'Please select a subject.');
        ok = false;
      }
      if (!data.message || data.message.length < 10) {
        setFieldError(msgF, 'Please write at least a short message.');
        ok = false;
      }
      return ok;
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = readForm();
      if (!validate(data)) {
        form.querySelector('.field.is-invalid input, .field.is-invalid select, .field.is-invalid textarea')?.focus();
        return;
      }

      Submissions.add('contact', {
        name: data.name,
        email: data.email,
        phone: data.phone || '—',
        subject: data.subject,
        message: data.message
      });

      const btn = form.querySelector('button[type="submit"]');
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.textContent = 'Message sent';
      form.reset();

      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = original;
      }, 2400);
    });

    attachLiveValidation(form);
  })();

  /* =========================================================
     7. FOOTER YEAR
     ========================================================= */
  (function footerYear() {
    const el = document.getElementById('footer-year');
    if (el) el.textContent = new Date().getFullYear();
  })();

})();

  /* =========================================================
     9. FLOATING ACTIONS — back-to-top visibility + click
     ========================================================= */
  (function floatingActions() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;

    const SHOW_AFTER = 500; /* px scrolled before the button appears */

    const onScroll = () => {
      const show = window.scrollY > SHOW_AFTER;
      if (show && btn.hidden) {
        btn.hidden = false;
        btn.classList.add('is-visible');
      } else if (!show && !btn.hidden) {
        btn.hidden = true;
        btn.classList.remove('is-visible');
      }
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  })();