/* ============================================================
   Virtish Visva R — Coming Soon
   main.js
   ────────────────────────────────────────────────────────────
   Modules
     1. Aurora   — canvas-based drifting colour clouds
     2. Parallax — diamond tracks mouse gently
     3. Form     — validates + POSTs to Google Apps Script
   ============================================================ */


/* ── 1. AURORA ──────────────────────────────────────────────────
   Four elliptical radial-gradient "clouds" painted onto a canvas,
   each drifting along an independent sinusoidal path.

   Colour families:
     Orange : rgb(215,115,48) / rgb(220,130,60)   warm amber-orange
     Red    : rgb(191, 70,70) / rgb(200, 90,80)   muted crimson

   Opacity:  5–9 %   (extremely subtle)
   Periods: 38 s / 52 s / 45 s / 60 s  (very slow movement)
─────────────────────────────────────────────────────────────── */
(function aurora() {

  const canvas = document.getElementById('aurora');
  const ctx    = canvas.getContext('2d');

  /* Fit canvas to viewport */
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  /*
    Cloud definition properties
    ───────────────────────────
    cx, cy    normalised centre position (0–1)
    rx, ry    normalised radii (0–1 of viewport dimension)
    color     [r, g, b]
    alpha     peak opacity
    period    full drift cycle in seconds
    phaseX/Y  starting phase offset (radians) — keeps clouds de-synced
    ampX/Y    drift amplitude as a fraction of viewport
  */
  const clouds = [
    /* 1 — large orange, top-left → drifts right */
    {
      cx: 0.12, cy: 0.18,
      rx: 0.72, ry: 0.55,
      color: [215, 115, 48],
      alpha: 0.08,
      period: 52,
      phaseX: 0,             phaseY: 0,
      ampX:   0.18,          ampY:   0.10,
    },
    /* 2 — medium orange, centre-right */
    {
      cx: 0.70, cy: 0.42,
      rx: 0.55, ry: 0.42,
      color: [220, 130, 60],
      alpha: 0.06,
      period: 38,
      phaseX: Math.PI * 0.6, phaseY: Math.PI * 0.9,
      ampX:   0.14,          ampY:   0.14,
    },
    /* 3 — large red, bottom-right → drifts left */
    {
      cx: 0.85, cy: 0.75,
      rx: 0.68, ry: 0.50,
      color: [191, 70, 70],
      alpha: 0.07,
      period: 60,
      phaseX: Math.PI,       phaseY: Math.PI * 0.4,
      ampX:   0.20,          ampY:   0.12,
    },
    /* 4 — small red accent, mid-left */
    {
      cx: 0.22, cy: 0.68,
      rx: 0.42, ry: 0.32,
      color: [200, 90, 80],
      alpha: 0.055,
      period: 45,
      phaseX: Math.PI * 1.3, phaseY: Math.PI * 0.7,
      ampX:   0.12,          ampY:   0.16,
    },
  ];

  /* Draw one cloud as a stretched radial gradient ellipse */
  function drawCloud(cloud, t) {
    const W = canvas.width;
    const H = canvas.height;

    const omega = (2 * Math.PI) / cloud.period;
    const x  = (cloud.cx + Math.sin(omega * t + cloud.phaseX) * cloud.ampX) * W;
    const y  = (cloud.cy + Math.cos(omega * t + cloud.phaseY) * cloud.ampY) * H;
    const rX = cloud.rx * W;
    const rY = cloud.ry * H;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, rY / rX);   /* stretch circle into ellipse */

    const [r, g, b] = cloud.color;
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rX);
    grad.addColorStop(0,    `rgba(${r},${g},${b},${cloud.alpha})`);
    grad.addColorStop(0.45, `rgba(${r},${g},${b},${cloud.alpha * 0.55})`);
    grad.addColorStop(1,    `rgba(${r},${g},${b},0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, rX, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* Render loop */
  let startTime = null;

  function render(timestamp) {
    if (!startTime) startTime = timestamp;
    const t = (timestamp - startTime) / 1000;   /* elapsed seconds */

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    /* Cream base fill */
    ctx.fillStyle = '#EDDCC6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    /* Paint clouds back-to-front */
    ctx.globalCompositeOperation = 'source-over';
    clouds.forEach(c => drawCloud(c, t));

    requestAnimationFrame(render);
  }

  /* Respect prefers-reduced-motion */
  if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) {
    ctx.fillStyle = '#EDDCC6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    clouds.forEach(c => drawCloud(c, 0));
  } else {
    requestAnimationFrame(render);
  }

})();


/* ── 2. PARALLAX ────────────────────────────────────────────────
   The rotating diamond subtly follows the mouse on desktop.
   Fine-pointer + no-reduced-motion guard keeps it off mobile/a11y.
─────────────────────────────────────────────────────────────── */
(function parallax() {

  const noMotion    = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  const finePointer = window.matchMedia('(pointer:fine)').matches;
  if (noMotion || !finePointer) return;

  const diamond = document.getElementById('diamond');
  let ticking = false;

  window.addEventListener('mousemove', e => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const x = e.clientX / window.innerWidth  - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      diamond.style.transform =
        `translate(calc(-50% + ${x * 14}px), calc(-50% + ${y * 14}px))`;
      ticking = false;
    });
  });

})();


/* ── 3. FORM + BUTTON MICRO-INTERACTION ────────────────────────
   Animation: press → dot → pulse → ring → spinner → checkmark
   → success card → 15s countdown → reset
─────────────────────────────────────────────────────────────── */
(function form() {

  /* ▼ PASTE YOUR APPS SCRIPT WEB APP URL HERE ▼ */
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby2VXozGN8NUwbmri-FIX2XtOAcw1ar4vpFoDGd2QNHn2DLkLidvsru6T1DTeCPKEc/exec';
  /* ▲ ─────────────────────────────────────── ▲ */

  const ACCENT      = '#BF4646';
  const CIRC        = 2 * Math.PI * 19;
  const CHECK_LEN   = 42;
  const RESET_DELAY = 3;
  const E           = 'cubic-bezier(0.22,1,0.36,1)';

  const signupForm  = document.getElementById('signupForm');
  const nameInput   = document.getElementById('nameInput');
  const emailInput  = document.getElementById('emailInput');
  const formMessage = document.getElementById('formMessage');
  const btn         = document.getElementById('submitBtn');
  const btnSVG      = document.getElementById('btnSVG');
  const scName      = document.getElementById('scName');
  const scTimer     = document.getElementById('scTimer');
  const scCountFill = document.getElementById('scCountdownFill');

  let resetTimeout  = null;
  let timerInterval = null;

  const wait = ms => new Promise(r => setTimeout(r, ms));

  /* ── Helpers ─────────────────────────────────────────────── */
  function setMessage(text, isError = false) {
    formMessage.textContent = text;
    formMessage.style.color = isError ? '#8B3030' : 'var(--accent)';
    formMessage.classList.add('visible');
  }

  function setSVG(html) { btnSVG.innerHTML = html; }

  function mkCircle(r, fill, stroke, sw, dash, style) {
    return `<circle cx="24" cy="24" r="${r}"
      fill="${fill||'none'}" stroke="${stroke||'none'}"
      stroke-width="${sw||0}" stroke-linecap="round"
      ${dash ? `stroke-dasharray="${dash}"` : ''}
      style="transform-origin:24px 24px;${style||''}"/>`;
  }

  function mkCheck(style) {
    return `<path d="M 11 25 L 21 35 L 37 13"
      fill="none" stroke="${ACCENT}" stroke-width="1.5"
      stroke-linecap="round" stroke-linejoin="round"
      stroke-dasharray="${CHECK_LEN}"
      style="${style||''}"/>`;
  }

  /* ── Button micro-animation (runs during API call) ───────── */
  async function runBtnAnimation(apiCall) {
    /* 1. PRESS */
    btn.disabled = true;
    btn.style.transform = 'scale(0.98)';
    await wait(120);

    /* 2. Transition button to outlined ring, show SVG layer */
    btn.style.transform = '';
    btn.classList.add('btn-animating');

    /* 3. DOT APPEAR */
    setSVG(mkCircle(5, ACCENT, 'none', 0, '',
      `animation:_btnDotIn 80ms ${E} both`));
    await wait(80);

    /* 4. DOT PULSE — 100% → 120% → 100% */
    setSVG(mkCircle(5, ACCENT, 'none', 0, '',
      `animation:_btnPulse 180ms ${E} both`));
    await wait(180);

    /* 5. DOT EXPAND → ring grows from dot's position */
    setSVG(
      mkCircle(5, ACCENT, 'none', 0, '',
        `animation:_btnBurst 300ms ${E} both`) +
      mkCircle(19, 'none', ACCENT, 1.5, CIRC.toFixed(1),
        `animation:_btnRingIn 300ms ${E} both`)
    );
    await wait(300);

    /* 6. LOADING — partial arc spins while API executes */
    setSVG(mkCircle(19, 'none', ACCENT, 1.5,
      `85 ${(CIRC - 85).toFixed(1)}`,
      `animation:_btnSpin 1s linear infinite`));

    await apiCall(); /* actual fetch happens here */

    /* 7. MORPH — ring fades, checkmark strokes in */
    setSVG(
      mkCircle(19, 'none', ACCENT, 1.5,
        `85 ${(CIRC - 85).toFixed(1)}`,
        `opacity:0;transition:opacity 150ms ease`) +
      mkCheck(`animation:_btnCheck 250ms ${E} 80ms both`)
    );
    await wait(340);
    /* checkmark holds — success card now takes over */
  }

  /* ── Success card entrance ───────────────────────────────── */
  function showSuccess(firstName) {
    scName.textContent = `Thank you, ${firstName}.`;
    signupForm.classList.add('success');

    setTimeout(() => {
      scCountFill.style.transition = `transform ${RESET_DELAY}s linear`;
      scCountFill.style.transform  = 'scaleX(0)';
    }, 1650);

    let remaining = RESET_DELAY;
    if (scTimer) scTimer.textContent = remaining;
    timerInterval = setInterval(() => {
      remaining -= 1;
      if (scTimer) scTimer.textContent = Math.max(remaining, 0);
      if (remaining <= 0) clearInterval(timerInterval);
    }, 1000);

    resetTimeout = setTimeout(resetForm, RESET_DELAY * 1000);
  }

  /* ── Reset back to form ──────────────────────────────────── */
  function resetForm() {
    clearTimeout(resetTimeout);
    clearInterval(timerInterval);
    signupForm.classList.add('resetting');

    setTimeout(() => {
      signupForm.classList.remove('success', 'resetting');
      nameInput.value  = '';
      emailInput.value = '';
      formMessage.classList.remove('visible');
      formMessage.textContent = '';

      setSVG('');
      btn.classList.remove('btn-animating');
      btn.style.transform = '';
      btn.disabled = false;

      scCountFill.style.transition = 'none';
      scCountFill.style.transform  = 'scaleX(1)';
      if (scTimer) scTimer.textContent = RESET_DELAY;
      if (scName)  scName.textContent  = '';
    }, 950);
  }

  /* ── Email validation — strict multi-rule check ─────────────
     Blocks: missing @, missing TLD, consecutive dots,
             dots at start/end, invalid characters,
             TLD under 2 chars, domain with no dot.
  ─────────────────────────────────────────────────────────── */
  function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;

    /* Must have exactly one @ */
    const parts = email.split('@');
    if (parts.length !== 2) return false;

    const [local, domain] = parts;

    /* ── Local part (before @) ── */
    if (!local || local.length < 1 || local.length > 64)   return false;
    if (local.startsWith('.') || local.endsWith('.'))       return false;
    if (local.includes('..'))                               return false;
    if (!/^[a-zA-Z0-9._%+\-]+$/.test(local))               return false;

    /* ── Domain part (after @) ── */
    if (!domain || domain.length < 4 || domain.length > 255) return false;
    if (domain.startsWith('.') || domain.endsWith('.'))       return false;
    if (domain.startsWith('-') || domain.endsWith('-'))       return false;
    if (domain.includes('..'))                                return false;
    if (!/^[a-zA-Z0-9.\-]+$/.test(domain))                   return false;

    /* Must have at least one dot in domain */
    const domainParts = domain.split('.');
    if (domainParts.length < 2) return false;

    /* TLD must be 2–24 letters only (no numbers) */
    const tld = domainParts[domainParts.length - 1];
    if (!/^[a-zA-Z]{2,24}$/.test(tld)) return false;

    /* Domain label before TLD must exist and be non-empty */
    const domainLabel = domainParts[domainParts.length - 2];
    if (!domainLabel || domainLabel.length < 1) return false;

    return true;
  }
  /* ── Disposable email domain list ───────────────────────────
     Background check — invisible to visitor until blocked.
     Friendly error shown if a temp/throwaway domain is used.
  ─────────────────────────────────────────────────────────── */
  const DISPOSABLE = new Set([
    'mailinator.com','guerrillamail.com','guerrillamail.net','guerrillamail.org',
    'guerrillamail.de','guerrillamail.info','guerrillamail.biz','grr.la',
    'sharklasers.com','spam4.me','yopmail.com','yopmail.fr','cool.fr.nf',
    'jetable.fr.nf','nospam.ze.tc','nomail.xl.cx','mega.zik.dj','speed.1s.fr',
    'courriel.fr.nf','moncourrier.fr.nf','monemail.fr.nf','monmail.fr.nf',
    'tempmail.com','temp-mail.org','temp-mail.io','tempmail.net','tempmail.org',
    'tempmail.de','tempmail.it','tempmail.plus','throwam.com','throwam.net',
    '10minutemail.com','10minutemail.net','10minutemail.org','10minutemail.co.uk',
    '10minutemail.de','10minutemail.ru','10minutemail.be','10minutemail.cf',
    'trashmail.com','trashmail.net','trashmail.org','trashmail.at','trashmail.me',
    'trashmail.io','trashmail.xyz','trashmail.de','trash-mail.at','trashmail2.com',
    'dispostable.com','discard.email','spamgourmet.com','spamgourmet.net',
    'spamgourmet.org','mailnull.com','spam.la','maildrop.cc','mailnesia.com',
    'fakeinbox.com','pookmail.com','spamfree24.org','spamfree24.de','spamfree24.eu',
    'spamfree24.info','spamfree24.net','mailscrap.com','inboxclean.com',
    'junk1.com','spamcero.com','spamboy.com','tempr.email','tempr.email',
    'disbox.net','disbox.org','discardmail.com','discardmail.de',
    'wegwerfmail.de','wegwerfmail.net','wegwerfmail.org','wegwerfemail.de',
    'filzmail.com','emailtemporario.com.br','mailexpire.com','spamherelots.com',
    'spamhereplease.com','jetable.com','jetable.net','jetable.org','jetable.pp.ua',
    'nomail.xl.cx','nospamfor.us','anonbox.net','anonymbox.com',
    'throwaway.email','throwam.com','spamgrap.com','spamevader.com',
    'mailtemp.net','mailtemp.org','getnada.com','meltmail.com',
    'deadaddress.com','getonemail.com','getonemail.net','haltospam.com',
    'incognitomail.com','incognitomail.net','incognitomail.org',
    'mailzilla.com','mailzilla.org','nwldx.com','objectmail.com',
    'obobbo.com','odnorazovoe.ru','oneoffmail.com','online.ms',
    'pjjkp.com','plexolan.de','politikerclub.de','poofy.org',
    'rklips.com','rmqkr.net','rppkn.com','rtrtr.com',
    's0ny.net','safetypost.de','sandelf.de','saynotospams.com',
    'schachrol.com','sdfghyj.tk','selfdestructingmail.com',
    'sendspamhere.com','shiftmail.com','shitmail.me','shitmail.org',
    'skeefmail.com','slopsbox.com','smellfear.com','snakemail.com',
    'sneakemail.com','sofimail.com','sofort-mail.de','spamavert.com',
    'spambob.com','spambob.net','spambob.org','spambog.com',
    'spambog.de','spambog.ru','spambox.us','spamcannon.com',
    'spamcannon.net','spamcon.org','spamcorptastic.com',
    'spamex.com','spamfree.eu','spamgoes.in','spamherelots.com',
    'yopmail.com','mailnull.com','spamgourmet.com','mailexpire.com'
  ]);

  function isDisposable(email) {
    const domain = email.split('@')[1]?.toLowerCase().trim();
    return domain ? DISPOSABLE.has(domain) : false;
  }

  /* ── DNS domain existence check ─────────────────────────────
     Uses Google's free public DNS API — no API key needed.
     Catches real typos like gmoil.vpm that pass format checks
     but don't actually exist as mail domains.
  ─────────────────────────────────────────────────────────── */
  async function checkEmailDomain(email) {
    const domain = email.split('@')[1];
    /* Timeout after 5s — if DNS is slow, allow it through */
    const timeout = new Promise(resolve => setTimeout(() => resolve(true), 5000));
    try {
      const dnsCheck = fetch(
        `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`
      )
      .then(r => r.json())
      .then(data => {
        /* Status 3 = NXDOMAIN — domain does not exist */
        if (data.Status === 3) return false;
        /* Status 0 = domain exists */
        return data.Status === 0;
      });
      return await Promise.race([dnsCheck, timeout]);
    } catch {
      return true; /* network error → don't block the user */
    }
  }
  signupForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (btn.disabled) return;
    formMessage.classList.remove('visible');
    clearTimeout(resetTimeout);
    clearInterval(timerInterval);

    const name     = nameInput.value.trim();
    const email    = emailInput.value.trim();
    const isValid  = isValidEmail(email);

    /* ── Validation chain ────────────────────────────────── */
    if (!name) {
      setMessage('Please enter your name.', true);
      return;
    }
    if (!isValid) {
      setMessage('Please enter a valid email address.', true);
      return;
    }
    if (isDisposable(email)) {
      setMessage('Please use a valid personal or business email address.', true);
      return;
    }

    /* ── DNS domain check (async) ────────────────────────────
       Verifies the domain actually exists — catches typos
       like gmoil.vpm, yahooo.cm, gmail.con etc.
    ─────────────────────────────────────────────────────── */
    setMessage('Verifying email…');
    const domainExists = await checkEmailDomain(email);
    formMessage.classList.remove('visible');
    formMessage.textContent = '';

    if (!domainExists) {
      setMessage('This email domain doesn\'t exist. Did you make a typo?', true);
      return;
    }

    const apiCall = (!SCRIPT_URL || SCRIPT_URL === 'YOUR_APPS_SCRIPT_URL')
      ? () => wait(1800)
      : () => fetch(SCRIPT_URL, {
            method : 'POST',
            mode   : 'no-cors',
            body   : new URLSearchParams({ name, email }),
          });

    try {
      await runBtnAnimation(apiCall);
      showSuccess(name.split(' ')[0]);
    } catch (err) {
      setSVG('');
      btn.classList.remove('btn-animating');
      btn.style.transform = '';
      btn.disabled = false;
      setMessage('Something went wrong. Please try again.', true);
      console.error('[Waitlist]', err);
    }
  });

})();