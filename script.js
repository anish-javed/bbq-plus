/* BBQ Plus – all the behaviour of the page.
   Order of this file:
   1. settings + dish list      4. open/closed badge     7. scale
   2. small helpers             5. sparks + smoke        8. order builder
   3. price text                6. scroll animations     9. WhatsApp float
*/
(() => {
  'use strict';

  /* ---------- 1. Settings + dish list ---------- */
  const WA_NUMBER = '923000000000';   // placeholder for 0300 0000000 (change later)
  const OPEN_HOUR = 17;               // 5 PM
  const CLOSE_HOUR = 2;               // 2 AM (next day)

  // Only the price per kg is stored. Every other weight is worked out from it.
  // basis = the weight we show first on the menu.
  const DISHES = [
    { id: 'malai',     name: 'Malai Boti',         perKg: 1400, basis: 250,  img: 'malai-boti.jpg' },
    { id: 'tikka',     name: 'Chicken Thai Tikka', perKg: 1000, basis: 500,  img: 'chicken-tikka.jpg' },
    { id: 'drumstick', name: 'Chicken Drumstick',  perKg: 1000, basis: 500,  img: 'drumstick.jpg' },
    { id: 'nablets',   name: 'Nablets',            perKg: 1400, basis: 250,  img: 'nablets.jpg' },
    { id: 'kabab',     name: 'Chicken Kabab',      perKg: 1400, basis: 250,  img: 'chicken-kabab.jpg' },
    { id: 'fish',      name: 'Grilled Fish (winter)', perKg: 1600, basis: 1000, img: 'grill-fish.jpg' }
  ];
  const WEIGHTS = [
    { g: 250,  short: '1 pao',   long: '1 pao (250 g)' },
    { g: 500,  short: 'Half kg', long: 'Half kg (500 g)' },
    { g: 1000, short: '1 kg',    long: '1 kg (1000 g)' }
  ];
  const BASIS_TEXT = { 250: 'per pao', 500: 'per half kg', 1000: 'per kg' };

  /* ---------- 2. Helpers ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const money = n => 'Rs ' + n.toLocaleString('en-US');
  const priceFor = (dish, grams) => Math.round(dish.perKg * grams / 1000);
  const dishById = id => DISHES.find(d => d.id === id);
  const weightByG = g => WEIGHTS.find(w => w.g === g);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isPhone = () => window.matchMedia('(max-width: 767px)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const animate = hasGsap && !reduceMotion;
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  /* Runs fn(deltaSeconds) on every frame, but only while `el` is on screen. */
  function runWhileVisible(el, fn) {
    let raf = 0, last = 0;
    const tick = t => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      fn(dt);
      raf = requestAnimationFrame(tick);
    };
    new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
      } else if (raf) {
        cancelAnimationFrame(raf); raf = 0;
      }
    }).observe(el);
  }

  /* Fits a canvas to its CSS size (sharp on phones too, but capped to stay light). */
  function fitCanvas(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    return { w: canvas.width, h: canvas.height, dpr };
  }

  /* A soft round glow drawn once, then stamped many times (fast). */
  function makeSprite(size, stops) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([p, col]) => grad.addColorStop(p, col));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }

  /* ---------- 3. Price text on the page ---------- */
  $$('[data-price]').forEach(el => {
    const d = dishById(el.dataset.price);
    el.innerHTML = `${money(priceFor(d, d.basis))} <small>${BASIS_TEXT[d.basis]}</small>`;
  });

  /* ---------- 4. Open now / Closed now ---------- */
  function updateStatus() {
    // Time in Pakistan, no matter where the visitor is.
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Karachi', hour: 'numeric', hour12: false
    }).formatToParts(new Date());
    const hour = parseInt(parts.find(p => p.type === 'hour').value, 10) % 24;
    // Open from 5 PM until 2 AM, so the shift crosses midnight.
    const open = hour >= OPEN_HOUR || hour < CLOSE_HOUR;
    $$('[data-status]').forEach(el => {
      el.classList.toggle('closed', !open);
      $('b', el).textContent = open ? 'Open now · until 2 AM' : 'Closed now · opens at 5 PM';
    });
  }
  updateStatus();
  setInterval(updateStatus, 60000);

  /* ---------- 5a. Hero sparks ---------- */
  const sparksCanvas = $('#sparks');
  if (sparksCanvas && !reduceMotion) {
    const ctx = sparksCanvas.getContext('2d');
    const glow = makeSprite(64, [[0, 'rgba(255,210,140,1)'], [0.25, 'rgba(255,120,30,.8)'], [1, 'rgba(255,80,0,0)']]);
    let size = fitCanvas(sparksCanvas);
    const count = isPhone() ? 22 : 46;
    const sparks = [];
    const spawn = (s, anywhere) => {
      s.x = Math.random() * size.w;
      s.y = anywhere ? Math.random() * size.h : size.h + 20;
      s.r = (1.5 + Math.random() * 4) * size.dpr;
      s.vy = (18 + Math.random() * 45) * size.dpr;      // pixels per second, going up
      s.sway = 10 + Math.random() * 25;
      s.phase = Math.random() * 6.28;
      s.life = 0;
      s.max = 6 + Math.random() * 6;                   // seconds
      return s;
    };
    for (let i = 0; i < count; i++) sparks.push(spawn({}, true));
    window.addEventListener('resize', () => { size = fitCanvas(sparksCanvas); });

    runWhileVisible(sparksCanvas, dt => {
      ctx.clearRect(0, 0, size.w, size.h);
      ctx.globalCompositeOperation = 'lighter';
      for (const s of sparks) {
        s.life += dt;
        s.y -= s.vy * dt;
        const x = s.x + Math.sin(s.life * 1.3 + s.phase) * s.sway * size.dpr;
        const t = s.life / s.max;
        if (t >= 1 || s.y < -20) { spawn(s, false); continue; }
        // fade in quickly, fade out slowly
        ctx.globalAlpha = Math.min(t * 8, 1) * (1 - t) * 0.9;
        const d = s.r * 6;
        ctx.drawImage(glow, x - d / 2, s.y - d / 2, d, d);
      }
      ctx.globalAlpha = 1;
    });
  }

  /* ---------- 5b. Smoke over the spotlight dishes ---------- */
  const spots = $$('[data-spot]');
  if (!reduceMotion) {
    const puff = makeSprite(96, [[0, 'rgba(236,232,226,.9)'], [0.5, 'rgba(236,232,226,.35)'], [1, 'rgba(236,232,226,0)']]);
    spots.forEach(spot => {
      const canvas = $('.smoke', spot);
      const ctx = canvas.getContext('2d');
      let size = fitCanvas(canvas);
      const puffs = [];
      let timer = 0;
      window.addEventListener('resize', () => { size = fitCanvas(canvas); });

      runWhileVisible(canvas, dt => {
        // In the pinned layout, only the dish at the front makes smoke.
        const front = !spot.closest('.pinned') || gsap.getProperty(spot, 'opacity') > 0.3;
        timer -= dt;
        if (front && timer <= 0) {
          timer = isPhone() ? 0.55 : 0.28;
          puffs.push({
            x: size.w * (0.5 + (Math.random() - 0.5) * 0.3),
            y: size.h * 0.98,
            r: size.w * (0.07 + Math.random() * 0.05),
            vy: size.h * (0.12 + Math.random() * 0.08),
            grow: 1.1 + Math.random() * 0.7,
            sway: size.w * (0.02 + Math.random() * 0.04),
            phase: Math.random() * 6.28,
            life: 0,
            max: 4.5 + Math.random() * 2
          });
        }
        ctx.clearRect(0, 0, size.w, size.h);
        for (let i = puffs.length - 1; i >= 0; i--) {
          const p = puffs[i];
          p.life += dt;
          const t = p.life / p.max;
          if (t >= 1) { puffs.splice(i, 1); continue; }
          p.y -= p.vy * dt;
          const r = p.r * (1 + t * 2.4 * p.grow);
          const x = p.x + Math.sin(p.life * 0.9 + p.phase) * p.sway * (0.4 + t);
          ctx.globalAlpha = Math.sin(Math.PI * t) * 0.24;   // see-through: rises, then melts away
          ctx.drawImage(puff, x - r, p.y - r, r * 2, r * 2);
        }
        ctx.globalAlpha = 1;
      });
    });
  }

  /* ---------- 6. Scroll animations (GSAP) ---------- */
  if (animate) {
    /* Hero: headline word by word, then the rest fades up */
    const title = $('#heroTitle');
    const splitWords = node => {
      Array.from(node.childNodes).forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const s = document.createElement('span');
            s.className = 'word'; s.textContent = part;
            frag.appendChild(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) splitWords(n);
      });
    };
    splitWords(title);
    const phone = isPhone();
    const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
    intro
      .from('.hero .status-wrap, .hero .eyebrow', { y: 16, opacity: 0, duration: .7, stagger: .1 })
      .from('#heroTitle .word', { y: phone ? 28 : 50, opacity: 0, duration: .9, stagger: .13 }, '-=.3')
      .from('.hero-sub, .hero .hero-actions', { y: 20, opacity: 0, duration: .8, stagger: .15 }, '-=.4');
    gsap.to('.hero-bg img', {
      scale: 1.16, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });

    /* Labels, prices and photos slide in when they reach the screen */
    const dist = phone ? 30 : 60;
    $$('[data-anim]').forEach(el => {
      const from = { opacity: 0, duration: phone ? .6 : .9, ease: 'power3.out' };
      const dir = el.dataset.anim;
      if (dir === 'left') from.x = -dist;
      else if (dir === 'right') from.x = dist;
      else from.y = dist * .7;
      gsap.from(el, { ...from, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });

    /* "Since 2002": counts up from 1990 and glows once */
    const since = $('#sinceNum');
    const range = { y: +since.dataset.from };
    const to = +since.dataset.to;
    since.textContent = range.y;
    ScrollTrigger.create({
      trigger: since, start: 'top 85%', once: true,
      onEnter: () => {
        gsap.to(range, {
          y: to, duration: 1.6, ease: 'power2.out',
          onUpdate: () => { since.textContent = Math.round(range.y); },
          onComplete: () => since.classList.add('glow')
        });
      }
    });

    /* Spotlight: pinned on desktop, simple fade-ins on phones */
    const mm = gsap.matchMedia();
    mm.add('(min-width: 768px)', () => {
      const section = $('#spotlight');
      section.classList.add('pinned');
      const items = $$('[data-spot]', section);
      gsap.set(items.slice(1), { autoAlpha: 0 });

      const tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        scrollTrigger: {
          trigger: section, start: 'top top',
          end: () => '+=' + Math.round(window.innerHeight * 5),
          pin: '.spot-pin', scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true
        }
      });
      // Malai Boti: comes forward first, and stays the longest (biggest share of the scroll)
      tl.fromTo(items[0], { scale: .86, y: 30 }, { scale: 1, y: 0, duration: 1.2 }, 0)
        .fromTo($('.spot-text', items[0]), { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 1.2 }, 0)
        .to({}, { duration: 2.2 });                                     // hold
      // Drumstick
      tl.to(items[0], { autoAlpha: 0, scale: .9, y: -40, duration: 1 })
        .fromTo(items[1], { autoAlpha: 0, scale: .86, y: 40 }, { autoAlpha: 1, scale: 1, y: 0, duration: 1 }, '<')
        .to({}, { duration: 1.3 });
      // Nablets
      tl.to(items[1], { autoAlpha: 0, scale: .9, y: -40, duration: 1 })
        .fromTo(items[2], { autoAlpha: 0, scale: .86, y: 40 }, { autoAlpha: 1, scale: 1, y: 0, duration: 1 }, '<')
        .to({}, { duration: 1.3 });

      return () => {
        section.classList.remove('pinned');
        gsap.set(items.concat($$('.spot-text', section)), { clearProps: 'all' });
      };
    });
    mm.add('(max-width: 767px)', () => {
      $$('[data-spot]').forEach(spot => {
        gsap.from(spot, {
          y: 40, opacity: 0, duration: .7, ease: 'power2.out',
          scrollTrigger: { trigger: spot, start: 'top 85%', once: true }
        });
      });
    });
  } else {
    // No animation: show the final text for "Since 2002" and keep the page plain.
    const since = $('#sinceNum');
    if (since) since.textContent = since.dataset.to;
  }

  /* ---------- 7. Weighing scale ---------- */
  const dishSelect = $('#scaleDish');
  const needle = $('#needle');
  const ticks = $('#ticks');
  const NS = 'http://www.w3.org/2000/svg';
  const angleFor = g => -90 + (g / 1000) * 180;

  // Draw the tick marks and numbers on the dial
  for (let g = 0; g <= 1000; g += 125) {
    const a = angleFor(g) * Math.PI / 180;
    const major = g % 250 === 0;
    const r1 = 160 - 18, r2 = major ? 160 - 36 : 160 - 28;
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', 200 + r1 * Math.sin(a)); line.setAttribute('y1', 200 - r1 * Math.cos(a));
    line.setAttribute('x2', 200 + r2 * Math.sin(a)); line.setAttribute('y2', 200 - r2 * Math.cos(a));
    line.setAttribute('stroke', major ? '#f6ecd9' : '#8d8071');
    line.setAttribute('stroke-width', major ? 3 : 2);
    ticks.appendChild(line);
    if (major) {
      const t = document.createElementNS(NS, 'text');
      const r3 = 160 - 54;
      t.setAttribute('x', 200 + r3 * Math.sin(a));
      t.setAttribute('y', 200 - r3 * Math.cos(a) + 4);
      t.textContent = g === 1000 ? '1 kg' : g + ' g';
      ticks.appendChild(t);
    }
  }

  DISHES.forEach(d => dishSelect.add(new Option(d.name, d.id)));
  let scaleG = 250;
  const readout = { g: 0, p: 0 };
  let scaleStarted = false;

  function renderReadout() {
    $('#scaleGrams').textContent = Math.round(readout.g) + ' g';
    $('#scalePrice').textContent = money(Math.round(readout.p));
  }
  function setNeedle(angle, swing) {
    if (hasGsap && !reduceMotion) {
      gsap.to(needle, {
        rotation: angle, svgOrigin: '200 200',
        duration: swing ? 1.8 : 1.2, ease: 'elastic.out(1, 0.45)', overwrite: true
      });
    } else if (hasGsap) {
      gsap.set(needle, { rotation: angle, svgOrigin: '200 200' });
    } else {
      needle.setAttribute('transform', `rotate(${angle} 200 200)`);
    }
  }
  function updateScale() {
    const dish = dishById(dishSelect.value);
    const targetP = priceFor(dish, scaleG);
    $('#scaleImg').src = 'images/' + dish.img;
    setNeedle(angleFor(scaleG), true);
    if (hasGsap && !reduceMotion) {
      gsap.to(readout, { g: scaleG, p: targetP, duration: 1, ease: 'power2.out', onUpdate: renderReadout, overwrite: true });
    } else {
      readout.g = scaleG; readout.p = targetP; renderReadout();
    }
  }
  // needle rests at zero until the scale is seen
  if (hasGsap) gsap.set(needle, { rotation: -90, svgOrigin: '200 200' });
  else needle.setAttribute('transform', 'rotate(-90 200 200)');
  renderReadout();

  new IntersectionObserver((entries, obs) => {
    if (entries[0].isIntersecting) { scaleStarted = true; updateScale(); obs.disconnect(); }
  }, { threshold: .4 }).observe($('.scale-box'));

  dishSelect.addEventListener('change', () => { scaleStarted = true; updateScale(); });
  $('#scaleWeights').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    $$('#scaleWeights button').forEach(x => x.classList.toggle('on', x === b));
    scaleG = +b.dataset.w;
    scaleStarted = true;
    updateScale();
  });

  /* ---------- 8. Menu + order builder ---------- */
  const menuList = $('#menuList');
  menuList.innerHTML = DISHES.map(d => `
    <article class="menu-item">
      <div class="thumb"><img src="images/${d.img}" alt="" loading="lazy"></div>
      <div>
        <h4>${d.name}</h4>
        <p class="basis">${money(priceFor(d, d.basis))} ${BASIS_TEXT[d.basis]}</p>
        <div class="row">
          <select aria-label="Weight for ${d.name}" data-weight="${d.id}">
            ${WEIGHTS.map(w => `<option value="${w.g}"${w.g === d.basis ? ' selected' : ''}>${w.short} · ${money(priceFor(d, w.g))}</option>`).join('')}
          </select>
          <button type="button" class="add-btn" data-add="${d.id}">Add</button>
        </div>
      </div>
    </article>`).join('');

  const cart = [];   // { id, g, qty }
  const itemsEl = $('#orderItems');
  const totalEl = $('#orderTotal');
  const emptyEl = $('#orderEmpty');
  const msgEl = $('#orderMsg');

  function renderCart() {
    let total = 0;
    itemsEl.innerHTML = cart.map((it, i) => {
      const d = dishById(it.id);
      const unit = priceFor(d, it.g);
      total += unit * it.qty;
      return `<li>
        <div><b>${d.name}</b><small>${weightByG(it.g).short} · ${money(unit)} each</small></div>
        <span class="line">${money(unit * it.qty)}</span>
        <div class="qty">
          <button type="button" data-act="dec" data-i="${i}" aria-label="Less ${d.name}">−</button>
          <span>${it.qty}</span>
          <button type="button" data-act="inc" data-i="${i}" aria-label="More ${d.name}">+</button>
        </div>
      </li>`;
    }).join('');
    totalEl.textContent = money(total);
    emptyEl.hidden = cart.length > 0;
    return total;
  }

  menuList.addEventListener('click', e => {
    const btn = e.target.closest('[data-add]');
    if (!btn) return;
    const id = btn.dataset.add;
    const g = +$(`[data-weight="${id}"]`, menuList).value;
    const found = cart.find(it => it.id === id && it.g === g);
    if (found) found.qty++; else cart.push({ id, g, qty: 1 });
    renderCart();
    msgEl.textContent = '';
    btn.textContent = 'Added ✓'; btn.classList.add('done');
    setTimeout(() => { btn.textContent = 'Add'; btn.classList.remove('done'); }, 900);
  });

  itemsEl.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const i = +b.dataset.i;
    cart[i].qty += b.dataset.act === 'inc' ? 1 : -1;
    if (cart[i].qty <= 0) cart.splice(i, 1);
    renderCart();
  });

  const addrWrap = $('#addrWrap');
  $$('input[name="mode"]').forEach(r => r.addEventListener('change', () => {
    addrWrap.hidden = $('input[name="mode"]:checked').value !== 'Delivery';
  }));

  $('#sendOrder').addEventListener('click', () => {
    const name = $('#custName').value.trim();
    const mode = $('input[name="mode"]:checked').value;
    const addr = $('#custAddr').value.trim();
    if (!cart.length) { msgEl.textContent = 'Please add at least one dish.'; return; }
    if (!name) { msgEl.textContent = 'Please enter your name.'; $('#custName').focus(); return; }
    if (mode === 'Delivery' && !addr) { msgEl.textContent = 'Please enter your delivery address.'; $('#custAddr').focus(); return; }
    msgEl.textContent = '';

    let total = 0;
    const lines = cart.map(it => {
      const d = dishById(it.id);
      const line = priceFor(d, it.g) * it.qty;
      total += line;
      return `- ${d.name}, ${weightByG(it.g).short} x ${it.qty} = ${money(line)}`;
    });
    const text = [
      'New order - BBQ Plus',
      `Name: ${name}`,
      `Type: ${mode}`,
      mode === 'Delivery' ? `Address: ${addr}` : null,
      '',
      ...lines,
      '',
      `Total: ${money(total)}`
    ].filter(l => l !== null).join('\n');
    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  });
  renderCart();

  /* ---------- 9. Floating WhatsApp ---------- */
  const waFloat = $('#waFloat');
  waFloat.href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('Hello BBQ Plus!')}`;
  // Hide it while the order section is on screen (it has its own WhatsApp button
  // and the floating icon would sit on top of the Add buttons).
  new IntersectionObserver(entries => {
    waFloat.classList.toggle('hide', entries[0].isIntersecting);
  }).observe($('#order'));
})();
