/* Guess Who component. API: GW.mount(root,cfg) GW.timing GW.draw(k,l) GW.hideAll() GW.play(k,from,to)->Promise. Styles: gw.css
   cfg.students[i] = {name, then, now, pos, hint?, photos?}  photos = 2-3 child photos that cross-fade before the flip (then = fallback).
   Everything animated is transform/opacity, and a pure function of (k,l). */
(function () {
  const bez = (x1, y1, x2, y2) => t => {
    if (t <= 0 || t >= 1) return Math.max(0, Math.min(1, t));
    let u = t; for (let i = 0; i < 8; i++) { const x = 3 * (1 - u) ** 2 * u * x1 + 3 * (1 - u) * u * u * x2 + u ** 3 - t, d = 3 * (1 - u) ** 2 * x1 + 6 * (1 - u) * u * (x2 - x1) + 3 * u * u * (1 - x2); if (Math.abs(d) < 1e-6) break; u -= x / d; }
    return 3 * (1 - u) ** 2 * u * y1 + 3 * (1 - u) * u * u * y2 + u ** 3;
  };
  const E = bez(.22, 1, .36, 1), IO = bez(.65, 0, .35, 1);
  const cl = v => Math.max(0, Math.min(1, v)), ph = (t, a, d) => cl((t - a) / d);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const GW = window.GW = { timing: { enter: .9, flip: 1.1, exit: .7, guessHold: 6, revealHold: 3, tFlip: 6.9, tExit: 11, ROUND: 11.7 } };
  let S = [], blobs = [], bgK = -1;
  const DR = [[150, 90], [-130, 110], [170, -80], [120, 100]]; // blob drift amplitude px

  GW.mount = function (root, cfg) {
    const d = { enter: .9, flip: 1.1, exit: .7, guessHold: 6, revealHold: 3 }, tm = {};
    for (const key in d) tm[key] = cfg.timing && cfg.timing[key] != null ? cfg.timing[key] : d[key];
    tm.guessHold = Math.min(10, tm.guessHold);   // the guess timer is never longer than 10 s
    const tFlip = tm.enter + tm.guessHold, tExit = tFlip + tm.flip + tm.revealHold;
    Object.assign(GW.timing, tm, { tFlip, tExit, ROUND: tExit + tm.exit });
    root.classList.add('gw');
    root.innerHTML = '<div class="gw-bg"><i class="gw-blob gw-b1"></i><i class="gw-blob gw-b2"></i><i class="gw-blob gw-b3"></i><i class="gw-blob gw-b4"></i></div>';
    blobs = [...root.querySelectorAll('.gw-blob')]; bgK = -1;
    S = cfg.students.map(s => {
      const pos = esc(s.pos || '50% 28%'), photos = (s.photos && s.photos.length ? s.photos : [s.then]).slice(0, 3);
      const el = document.createElement('div'); el.className = 'gw-slot';
      const lays = photos.map(p => `<div class="gw-lay"><img class="gw-soft" src="${esc(p)}" style="object-position:${pos}" alt=""><img class="gw-sharp" src="${esc(p)}" style="object-position:${pos}" alt=""></div>`).join('');
      const chars = [...s.name].map(c => `<span class="gw-c">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('');
      const fs = s.name.length > 14 ? Math.max(36, Math.floor(60 * 14 / s.name.length)) : 60;
      el.innerHTML = `<div class="gw-glow"></div><div class="gw-card"><div class="gw-flip">
        <div class="gw-face gw-then"><div class="gw-frame"><div class="gw-ph"><div class="gw-kb">${lays}</div><div class="gw-tint"></div><div class="gw-sheen"></div></div></div></div>
        <div class="gw-face gw-now"><div class="gw-frame"><div class="gw-ph"><div class="gw-kb"><img src="${esc(s.now)}" style="object-position:${pos}" alt="${esc(s.name)}"></div><div class="gw-tint"></div><div class="gw-sheen"></div></div></div></div>
      </div></div>
      <div class="gw-timer"><div class="gw-tdisc"><svg viewBox="0 0 120 120"><circle class="gw-tbase" cx="60" cy="60" r="50" pathLength="100"/><circle class="gw-tring" cx="60" cy="60" r="50" pathLength="100"/></svg><b class="gw-tn">10</b></div><span class="gw-tcap">think!</span></div>
      <div class="gw-plate"><div class="gw-pt">Guess who<i>?</i></div><div class="gw-pn"><b style="font-size:${fs}px">${chars}</b>${cfg.tag ? `<span class="gw-tag">${esc(cfg.tag)}</span>` : ''}</div></div>
      ${s.hint ? `<div class="gw-hint">${esc(s.hint)}</div>` : ''}`;
      root.appendChild(el);
      const q = x => el.querySelector(x);
      return { el, timer: q('.gw-timer'), tring: q('.gw-tring'), tn: q('.gw-tn'), tcap: q('.gw-tcap'), glow: q('.gw-glow'), card: q('.gw-card'), flip: q('.gw-flip'), plate: q('.gw-plate'), pt: q('.gw-pt'), tag: q('.gw-tag'), hint: q('.gw-hint'), chars: [...el.querySelectorAll('.gw-c')],
        lays: [...el.querySelectorAll('.gw-lay')], sharps: [...el.querySelectorAll('.gw-sharp')], kbT: q('.gw-then .gw-kb'), kbN: q('.gw-now .gw-kb'), shT: q('.gw-then .gw-sheen'), shN: q('.gw-now .gw-sheen'), imgs: [...el.querySelectorAll('img')] };
    });
    // resolves when all photos are decoded; GW.ready is the same promise
    return GW.ready = Promise.all(S.flatMap(o => o.imgs).map(i => i.decode().catch(() => { i.style.visibility = 'hidden'; })));
  };

  // aurora drift: envelope sin^2 is 0 (with zero slope) at l=0 and l=ROUND, so every round starts/ends on the identical calm frame
  function bg(l, R) {
    const env = l == null ? 0 : Math.sin(Math.PI * cl(l / R)) ** 2;
    blobs.forEach((b, i) => b.style.transform = `translate3d(${Math.sin((l || 0) * .38 + i * 1.7) * DR[i][0] * env}px,${Math.cos((l || 0) * .31 + i * 2.1) * DR[i][1] * env}px,0) scale(${1 + .06 * env * Math.sin((l || 0) * .4 + i)})`);
  }

  GW.hideAll = () => { S.forEach(o => { o.el.style.visibility = 'hidden'; }); bg(null); bgK = -1; };

  GW.draw = function (k, l) {
    const o = S[k], C = GW.timing, tFlip = C.tFlip, tExit = C.tExit;
    if (!o) return;
    if (l < 0 || l > C.ROUND) { o.el.style.visibility = 'hidden'; if (bgK === k) { bg(null); bgK = -1; } return; }
    o.el.style.visibility = 'visible'; bgK = k; bg(l, C.ROUND);
    const p = E(ph(l, 0, C.enter)), pp = E(ph(l, .12, C.enter)), q = IO(ph(l, tExit, C.exit));
    const fade = ph(l, 0, C.enter * .6) * (1 - ph(l, tExit + C.exit * .15, C.exit * .7));
    const fadeP = ph(l, .12, C.enter * .6) * (1 - ph(l, tExit, C.exit * .6));
    o.card.style.opacity = fade;
    o.card.style.transform = `translate3d(0,${(1 - p) * 46 - q * 30}px,0) scale(${.955 + .045 * p - .03 * q})`;
    // warm glow behind the card: swells in with the card, one pulse on the reveal
    o.glow.style.opacity = fade * (.62 + .38 * Math.sin(Math.PI * ph(l, tFlip, C.flip + 1)));
    o.glow.style.transform = `scale(${.9 + .1 * p + .05 * Math.sin(Math.PI * ph(l, tFlip, C.flip + 1))})`;
    o.plate.style.opacity = fadeP;
    o.plate.style.transform = `translate3d(0,${(1 - pp) * 40 - q * 24}px,0)`;
    const f = IO(ph(l, tFlip, C.flip));
    o.flip.style.transform = `scale(${1 + .035 * Math.sin(Math.PI * f)}) rotateY(${f * 180}deg)`;
    // mystery photos: cross-fade through 1-3 layers, each pulls soft -> sharp as it arrives
    const n = o.lays.length, G = tFlip - C.enter;
    o.lays.forEach((ly, i) => {
      const b = C.enter + i * G / n;
      ly.style.opacity = i ? ph(l, b - .4, .8) : 1;
      o.sharps[i].style.opacity = n === 1 ? IO(ph(l, C.enter * .5, C.enter + C.guessHold - 1.2)) : IO(ph(l, i ? b - .4 : C.enter * .5, 1.6));
    });
    o.kbT.style.transform = `scale(${1 + .05 * ph(l, 0, tFlip + C.flip * .5)})`;
    const cyc = ((l - C.enter - .4) % 3.4 + 3.4) % 3.4 / 3.4, u = l > C.enter && l < tFlip - .6 ? cl(cyc / .42) : 0;
    o.shT.style.opacity = Math.sin(Math.PI * u) * .9; o.shT.style.transform = `translate3d(${u * 1000}px,0,0) skewX(-16deg)`;
    o.kbN.style.transform = `scale(${1.06 - .06 * E(ph(l, tFlip + C.flip * .35, 2.2))})`;
    const us = ph(l, tFlip + C.flip * .75, 1.3);
    o.shN.style.opacity = Math.sin(Math.PI * us) * .75; o.shN.style.transform = `translate3d(${us * 1000}px,0,0) skewX(-16deg)`;
    // plate: prompt out, name types in letter by letter (opacity + rise), then the tag
    const a = ph(l, tFlip + .1, .4), t0 = tFlip + C.flip * .38, st = Math.min(.05, .9 / o.chars.length);
    o.pt.style.opacity = 1 - a; o.pt.style.transform = `translate3d(0,${-12 * a}px,0)`;
    o.chars.forEach((c, i) => { const e = E(ph(l, t0 + i * st, .45)); c.style.opacity = e; c.style.transform = `translate3d(0,${(1 - e) * 26}px,0)`; });
    if (o.tag) { const e = E(ph(l, t0 + o.chars.length * st + .1, .5)); o.tag.style.opacity = e; o.tag.style.transform = `translate3d(${(1 - e) * 14}px,0,0)`; }
    // playful guess timer (10 s max): sticker pops in beside the card, number bounces each second, ring drains, colour warms up, wobbles, shakes in the last third, pops out on the flip
    {
      const G2 = tFlip - C.enter, e = Math.max(0, Math.min(G2, l - C.enter)), n2 = Math.ceil(G2 - e - 1e-6), frac = e - Math.floor(e);
      const tin = ph(l, C.enter - .1, .5), tout = ph(l, tFlip, .35), over = (1 - tin) * Math.sin((1 - tin) * 2.6), late = n2 <= G2 / 3 && n2 > 0 && l < tFlip;
      const bounce = l >= C.enter && l < tFlip ? Math.exp(-frac * 9) * .26 * Math.cos(frac * 11) : 0;
      o.timer.style.opacity = tin * (1 - tout);
      o.timer.style.transform = `translate3d(${late ? Math.sin(l * 60) * 3 : 0}px,${(1 - tin) * 40}px,0) scale(${(.5 + .5 * tin - over * .35 + bounce * .6) * (1 - .35 * tout)}) rotate(${-9 + 4 * Math.sin(l * 2.4) + (late ? Math.sin(l * 55) * 2.5 : 0) + 25 * (1 - tin)}deg)`;
      o.tring.style.strokeDashoffset = (100 * e / G2).toFixed(2);
      o.tring.style.stroke = n2 <= G2 / 3 ? '#ff4d4d' : n2 <= G2 * 2 / 3 ? '#ff8a1c' : '#ffd23f';
      const tx = String(Math.max(0, n2)), cap = n2 <= 0 ? "time's up!" : n2 <= G2 / 3 ? 'hurry!' : n2 <= G2 * 2 / 3 ? 'hmm...' : 'think!';
      if (o.tn.textContent !== tx) o.tn.textContent = tx;
      if (o.tcap.textContent !== cap) o.tcap.textContent = cap;
    }
    // hint: only in the last part of the guess, gone as the flip starts (never a timer)
    if (o.hint) { const h = E(ph(l, tFlip - 2.4, .7)) * (1 - ph(l, tFlip, .3)); o.hint.style.opacity = h * fadeP; o.hint.style.transform = `translate3d(0,${(1 - h) * 14}px,0)`; }
  };

  // rAF-timestamp driven (never Date.now) so CDP virtual time works; leaves the last frame drawn
  GW.play = (k, from, to) => new Promise(res => {
    let t0 = null;
    GW.draw(k, from);
    requestAnimationFrame(function f(ts) {
      if (t0 == null) t0 = ts;
      const l = from + (ts - t0) / 1000;
      if (l >= to) { GW.draw(k, to); res(); return; }
      GW.draw(k, l); requestAnimationFrame(f);
    });
  });
})();
