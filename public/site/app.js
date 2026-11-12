(() => {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const body = document.body, wide = () => innerWidth > 860;
  const COLORS = ['#F03D78', '#B04BE0', '#1DB8A8', '#F2B630'];

  /* ---------------- sound: a low hum and soft pings, only after you ask for it ---------------- */
  let ac = null, master = null, soundOn = false;
  function startSound() {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (!master) {
        master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.connect(master);
        [55, 82.4, 110.3].forEach((f, i) => { const o = ac.createOscillator(); o.type = i ? 'sine' : 'triangle'; o.frequency.value = f; o.detune.value = i * 4; const g = ac.createGain(); g.gain.value = .22 / (i + 1); o.connect(g).connect(lp); o.start(); });
      }
      master.gain.linearRampToValueAtTime(.12, ac.currentTime + 1.5); soundOn = true;
    } catch (e) { soundOn = false; }
    paintSound();
  }
  function stopSound() { if (master) master.gain.linearRampToValueAtTime(0, ac.currentTime + .6); soundOn = false; paintSound(); }
  function paintSound() { const b = $('#sound'); b.textContent = soundOn ? 'Sound on' : 'Sound off'; b.setAttribute('aria-pressed', soundOn); }
  function ping(f = 660, d = .35) {
    if (!soundOn || !ac) return;
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(.08, ac.currentTime + .02); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + d);
    o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + d + .05);
  }
  $('#sound').onclick = () => soundOn ? stopSound() : startSound();

  /* ---------------- the universe ---------------- */
  let U = null;
  try {
    if (!window.THREE) throw 0;
    const canvas = $('#gl');
    const renderer = new THREE.WebGLRenderer({canvas, antialias: false, powerPreference: 'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setClearColor(0x04010A, 1);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, .1, 400);
    const rand = (a, b) => a + Math.random() * (b - a);
    const small = innerWidth < 700;

    const VS = `
      attribute vec3 pB; attribute float rnd; attribute float grp;
      uniform float uTime, uMix, uBurst, uSel, uPix, uGlow, uSize, uSpin;
      uniform vec3 uColor, uColor2;
      varying vec3 vCol; varying float vA;
      void main(){
        float m = clamp(uMix * 1.5 - rnd * .5, 0., 1.); m = m*m*(3.-2.*m);
        vec3 p = mix(position, pB, m);
        float fl = sin(m * 3.14159);
        p += normalize(p + .001) * fl * (.5 + rnd);
        float a = uSpin * (1.0 - clamp(length(p.xz) / 4.0, 0., 1.)) ;
        p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
        p += vec3(sin(uTime*.7+rnd*40.), cos(uTime*.6+rnd*30.), sin(uTime*.5+rnd*20.)) * (.025 + fl*.12);
        p *= 1. + uBurst * (.2 + rnd * .6);
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        float sel = uSel < -.5 ? 1. : (abs(grp - uSel) < .5 ? 1.6 : .18);
        float sz = (rnd < .03 ? 3.2 : 1.2 + rnd * 1.4) * uSize;
        gl_PointSize = min(sz * uPix * (16. / -mv.z) * (sel > 1. ? 1.25 : 1.), 14. * uPix);
        vCol = mix(uColor, uColor2, step(.9, rnd) * .65 + uBurst * .4);
        vA = (.45 + rnd * .55) * sel * uGlow * (1. + fl * .5 + uBurst);
      }`;
    const FS = `varying vec3 vCol; varying float vA;
      void main(){ vec2 c = gl_PointCoord - .5; float d = length(c); if (d > .5) discard;
        float g = pow(1. - d * 2., 1.7); gl_FragColor = vec4(vCol * g * vA * 1.5, g * vA); }`;

    function makeCloud(n, gen, genB, color, color2, size) {
      const P = new Float32Array(n * 3), B = new Float32Array(n * 3), R = new Float32Array(n), G = new Float32Array(n);
      for (let i = 0; i < n; i++) { const r = gen(i, n); P.set(r.p, i * 3); G[i] = r.g || 0; R[i] = Math.random(); B.set(genB ? genB(i, n) : r.p, i * 3); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('pB', new THREE.BufferAttribute(B, 3));
      geo.setAttribute('rnd', new THREE.BufferAttribute(R, 1)); geo.setAttribute('grp', new THREE.BufferAttribute(G, 1));
      const u = {uTime: {value: 0}, uMix: {value: 0}, uBurst: {value: 0}, uSel: {value: -1}, uPix: {value: renderer.getPixelRatio()}, uGlow: {value: 1}, uSize: {value: size || 1}, uSpin: {value: 0},
        uColor: {value: new THREE.Color(color)}, uColor2: {value: new THREE.Color(color2 || '#F4EEFF')}};
      const pts = new THREE.Points(geo, new THREE.ShaderMaterial({uniforms: u, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}));
      pts.frustumCulled = false; pts.u = u; return pts;
    }
    const k = small ? .55 : 1;
    // core: debbit
    const core = makeCloud(9000 * k | 0, (i, n) => { const y = 1 - i / (n - 1) * 2, r = Math.sqrt(1 - y * y), t = i * 2.399963, R = 2.6 + (Math.random() < .15 ? rand(-.8, .5) : rand(-.04, .04)); return {p: [Math.cos(t) * r * R, y * R, Math.sin(t) * r * R]}; }, null, '#C9B4FF', '#FF9AD0', 1);
    // GO: torus
    const go = makeCloud(7000 * k | 0, () => { const u = Math.random() * 6.283, v = Math.random() * 6.283, R = 1.9, r = .5 + rand(-.05, .05) + (Math.random() < .08 ? rand(0, .5) : 0); return {p: [(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u)]}; }, null, COLORS[0]);
    // Pro: lattice; grp = which floor (0 top .. 3 bottom)
    const pro = makeCloud(8000 * k | 0, () => { const S = .95, lv = (Math.random() * 4) | 0, g = () => (Math.floor(Math.random() * 4) - 1.5) * S, f = () => rand(-1.5, 1.5) * S, a = (Math.random() * 3) | 0;
      let p; if (a === 1) { p = [g(), f(), g()]; } else { const y = (1.5 - lv) * S; p = a === 0 ? [f(), y, g()] : [g(), y, f()]; }
      const grp = Math.min(3, Math.max(0, Math.round(1.5 - p[1] / S)));
      return {p: [p[0] + rand(-.02, .02), p[1] + rand(-.02, .02), p[2] + rand(-.02, .02)], g: grp}; }, null, COLORS[1]);
    // X: helix; grp = which third (step)
    const xw = makeCloud(7000 * k | 0, () => { const t = rand(-1, 1), ang = t * Math.PI * 3, s = Math.random(); let x, z, y = t * 2.6;
      if (s < .42) { x = Math.cos(ang) * 1.1; z = Math.sin(ang) * 1.1; } else if (s < .84) { x = Math.cos(ang + Math.PI) * 1.1; z = Math.sin(ang + Math.PI) * 1.1; }
      else { const q = rand(-1, 1), rung = Math.round(t * 12) / 12, ra = rung * Math.PI * 3; y = rung * 2.6; x = Math.cos(ra) * 1.1 * q; z = Math.sin(ra) * 1.1 * q; }
      return {p: [x + rand(-.05, .05), y + rand(-.05, .05), z + rand(-.05, .05)], g: y > .87 ? 0 : y > -.87 ? 1 : 2}; }, null, COLORS[2]);
    // Next: galaxy that becomes a city
    const BL = []; for (let i = 0; i < 40; i++) BL.push({x: (i % 7 - 3) * .62 + rand(-.1, .1), z: (Math.floor(i / 7) - 2.5) * .62 + rand(-.1, .1), h: .3 + Math.pow(Math.random(), 2) * 2.6, w: rand(.18, .26)});
    const nx = makeCloud(9000 * k | 0, i => { const arm = i % 4, d = Math.pow(Math.random(), .6) * 3.2, core = Math.random() < .12, dd = core ? Math.random() * .45 : d, a = arm * Math.PI / 2 + dd * 1.3 + rand(-.25, .25) * (1 + dd * .2);
      return {p: [Math.cos(a) * dd, rand(-.1, .1) * (core ? 2.5 : 1), Math.sin(a) * dd]}; },
      () => { const b = BL[(Math.random() * BL.length) | 0], f = (Math.random() * 3) | 0, y = Math.random() * b.h - 1.2;
        let x = b.x + rand(-b.w, b.w), z = b.z + rand(-b.w, b.w);
        if (f === 0) x = b.x + (Math.random() < .5 ? -b.w : b.w); else if (f === 1) z = b.z + (Math.random() < .5 ? -b.w : b.w);
        const top = Math.random() < .15; return [x, top ? b.h - 1.2 : y, z]; }, COLORS[3]);

    const worlds = [go, pro, xw, nx];
    const R0 = 11;
    const POS = [[R0, .6, 0], [0, -.8, R0], [-R0, .9, 0], [0, -.4, -R0]].map(a => new THREE.Vector3(...a));
    const holders = worlds.map((w, i) => { const g = new THREE.Group(); g.add(w); g.position.copy(POS[i]); scene.add(g); return g; });
    const coreG = new THREE.Group(); coreG.add(core); scene.add(coreG);

    // orbit rings and light threads from core to each world
    const ringGeo = new THREE.BufferGeometry().setFromPoints([...Array(257)].map((_, i) => { const a = i / 256 * 6.283; return new THREE.Vector3(Math.cos(a) * R0, 0, Math.sin(a) * R0); }));
    scene.add(new THREE.Line(ringGeo, new THREE.LineBasicMaterial({color: 0x6f5a96, transparent: true, opacity: .28})));
    const threads = POS.map((p, i) => { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), p]); const l = new THREE.Line(g, new THREE.LineBasicMaterial({color: COLORS[i], transparent: true, opacity: .12, blending: THREE.AdditiveBlending})); scene.add(l); return l; });
    // pulses travelling along threads: little bright packets of "data"
    const PK = 48, pkPos = new Float32Array(PK * 3), pkCol = new Float32Array(PK * 3), pk = [];
    for (let i = 0; i < PK; i++) { const w = i % 4; pk.push({w, t: Math.random(), s: rand(.15, .35), dir: Math.random() < .5 ? 1 : -1}); const c = new THREE.Color(COLORS[w]); pkCol.set([c.r, c.g, c.b], i * 3); }
    const pkGeo = new THREE.BufferGeometry(); pkGeo.setAttribute('position', new THREE.BufferAttribute(pkPos, 3)); pkGeo.setAttribute('color', new THREE.BufferAttribute(pkCol, 3));
    const dotC = document.createElement('canvas'); dotC.width = dotC.height = 64; { const x = dotC.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }
    const packets = new THREE.Points(pkGeo, new THREE.PointsMaterial({size: .45, map: new THREE.CanvasTexture(dotC), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}));
    packets.frustumCulled = false; scene.add(packets);
    // stars
    const SN = 3000, sp = new Float32Array(SN * 3); for (let i = 0; i < SN; i++) { const r = rand(60, 160), a = Math.random() * 6.283, b = Math.acos(rand(-1, 1)); sp.set([r * Math.sin(b) * Math.cos(a), r * Math.cos(b), r * Math.sin(b) * Math.sin(a)], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({color: 0x9b88bd, size: .35, transparent: true, opacity: .8, depthWrite: false})); scene.add(stars);

    // camera rig
    let theta = .6, phi = 1.12, dist = 30, vT = 0, vP = 0;
    const camPos = new THREE.Vector3(0, 0, 4), look = new THREE.Vector3(), wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
    let focus = -1, intro = 0, introStart = 0;
    const cw = () => canvas.clientWidth || innerWidth, ch = () => canvas.clientHeight || innerHeight;
    function size() { renderer.setSize(cw(), ch(), false); camera.aspect = cw() / ch(); camera.updateProjectionMatrix(); }
    size(); addEventListener('resize', size);

    // pointer: drag to orbit, click to pick
    let down = null, moved = 0, hover = -1;
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    function pick(e) {
      const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height * 2 - 1)); ray.setFromCamera(ndc, camera);
      let best = -1, bd = 1e9; holders.forEach((h, i) => { const s = new THREE.Sphere(h.position, 2.9); const hit = ray.ray.intersectSphere(s, new THREE.Vector3()); if (hit) { const d = hit.distanceTo(camera.position); if (d < bd) { bd = d; best = i; } } });
      return best;
    }
    canvas.addEventListener('pointerdown', e => { down = {x: e.clientX, y: e.clientY}; moved = 0; canvas.setPointerCapture(e.pointerId); canvas.classList.add('drag'); });
    canvas.addEventListener('pointermove', e => {
      if (down) { const dx = e.clientX - down.x, dy = e.clientY - down.y; moved += Math.abs(dx) + Math.abs(dy); down = {x: e.clientX, y: e.clientY}; if (focus < 0) { vT -= dx * .0035; vP -= dy * .0025; } }
      else if (body.classList.contains('live')) { hover = focus < 0 ? pick(e) : -1; canvas.classList.toggle('hover', hover >= 0); $$('.tag').forEach((t, i) => t.classList.toggle('hot', i === hover)); }
    });
    canvas.addEventListener('pointerup', e => { canvas.classList.remove('drag'); if (down && moved < 8 && body.classList.contains('live')) { const w = pick(e); if (w >= 0) open(w); else if (focus >= 0) close(); else core.u.uBurst.value = 1; } down = null; });

    const tags = $$('.tag'), tmp = new THREE.Vector3();
    const t0 = performance.now(); let last = t0;
    U = {
      start() { introStart = performance.now(); if (still) intro = 1; },
      focus(i) { focus = i; },
      burst(i, v = 1) { (i < 0 ? core : worlds[i]).u.uBurst.value = v; },
      sel(i, v) { worlds[i].u.uSel.value = v; },
      build(v) { nx.u.uMix.value = v; },
      buildTarget: 0, spinTarget: 0,
      frame() {
        const now = performance.now(), t = (now - t0) / 1000, dt = Math.min(.05, (now - last) / 1000); last = now;
        if (introStart && intro < 1) intro = Math.min(1, (now - introStart) / 2600);
        const e = 1 - Math.pow(1 - intro, 3);
        // intro: everything grows out of a single point while the camera pulls back
        coreG.scale.setScalar(introStart ? .05 + .95 * e : .05 + Math.sin(t * 2) * .006);
        holders.forEach((h, i) => { const ei = Math.max(0, Math.min(1, (intro - .25 - i * .1) / .5)); const s = 1 - Math.pow(1 - ei, 3); h.scale.setScalar(.001 + s); h.position.copy(POS[i]).multiplyScalar(.2 + .8 * s); h.rotation.y = t * (.15 + i * .04) * (still ? 0 : 1); });
        threads.forEach((l, i) => l.material.opacity = .12 * e * (focus < 0 || focus === i ? 1 : .3));
        coreG.rotation.y = still ? 0 : t * .08;
        // packets
        for (let i = 0; i < PK; i++) { const q = pk[i]; q.t += q.s * dt * q.dir; if (q.t > 1) q.t = 0; if (q.t < 0) q.t = 1; tmp.copy(holders[q.w].position).multiplyScalar(q.t); pkPos.set([tmp.x, tmp.y, tmp.z], i * 3); }
        pkGeo.attributes.position.needsUpdate = true; packets.material.opacity = e;
        // uniforms
        [core, ...worlds].forEach((w, i) => { w.u.uTime.value = still ? 0 : t; w.u.uBurst.value *= .93; w.u.uGlow.value += (((focus < 0 || focus === i - 1 || i === 0) ? 1 : .35) - w.u.uGlow.value) * .08; });
        nx.u.uMix.value += (U.buildTarget - nx.u.uMix.value) * .025; nx.u.uSpin.value += (U.spinTarget - nx.u.uSpin.value) * .05;
        // camera
        if (focus < 0) {
          if (!still && !down) vT += .00045;
          theta += vT; phi = Math.max(.35, Math.min(1.45, phi + vP)); vT *= .92; vP *= .9;
          const d = introStart ? 4 + (dist - 4) * e : 4;
          wantPos.set(Math.sin(phi) * Math.sin(theta) * d, Math.cos(phi) * d, Math.sin(phi) * Math.cos(theta) * d); wantLook.set(0, 0, 0);
          if (!wide()) wantLook.y = -1.5;
        } else {
          const P = holders[focus].position, out = tmp.copy(P).setY(0).normalize();
          const tan = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), out);
          wantPos.copy(P).addScaledVector(out, wide() ? 8.6 : 10.5).addScaledVector(tan, 4.2).add(new THREE.Vector3(0, focus === 3 ? 1.1 : 2.6, 0));
          const fwd = new THREE.Vector3().subVectors(P, wantPos).normalize(), right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
          wantLook.copy(P);
          if (wide()) wantLook.addScaledVector(right, -3.1); else wantLook.y -= 3.2;
        }
        const k2 = still ? 1 : (focus < 0 && intro < 1 ? .2 : .045);
        camPos.lerp(wantPos, k2); look.lerp(wantLook, k2);
        camera.position.copy(camPos); camera.lookAt(look);
        stars.rotation.y = t * .004;
        renderer.render(scene, camera);
        // labels
        tags.forEach((tg, i) => { tmp.copy(holders[i].position); tmp.y += 3.1 * holders[i].scale.x; tmp.project(camera); const vis = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;
          tg.classList.toggle('vis', vis && intro > .7); tg.style.transform = `translate(${(tmp.x * .5 + .5) * cw()}px,${(-tmp.y * .5 + .5) * ch()}px) translate(-50%,-50%)`; });
      }
    };
  } catch (e) { U = null; body.classList.add('flat'); }

  /* ---------------- flow: enter, fly to a world, come back ---------------- */
  function enter(withSound) {
    $('#intro').classList.add('gone'); body.classList.add('live');
    if (withSound) startSound();
    U && U.start(); ping(330, 1.2);
  }
  $('#enter').onclick = () => enter(false);
  $('#enter-sound').onclick = () => enter(true);
  if (!U) { enter(false); }

  const panels = $$('.panel'), wbtn = $$('.worlds button');
  function open(i) {
    if (!body.classList.contains('live')) enter(false);
    panels.forEach((p, k) => p.classList.toggle('open', k === i));
    wbtn.forEach((b, k) => b.classList.toggle('on', k === i));
    body.classList.add('focus'); U && U.focus(i); ping([523, 587, 659, 784][i], .6);
    $('#where').innerHTML = '<i class="lg lg-' + ['go', 'pro', 'x', 'next'][i] + '" role="img" aria-label="' + ['debbitGO', 'debbitPro', 'debbitX', 'debbitNext'][i] + '"></i>';
    if (i === 1) setRole(curRole);
    if (i === 2) setStep(curStep);
  }
  function close() {
    panels.forEach(p => p.classList.remove('open')); wbtn.forEach(b => b.classList.remove('on'));
    body.classList.remove('focus'); U && U.focus(-1); ping(392, .5);
    $('#where').textContent = 'Drag to look around. Click a world to fly there.';
  }
  window.open3 = open;
  wbtn.forEach(b => b.onclick = () => open(+b.dataset.w));
  $$('.panel .back').forEach(b => b.onclick = close);
  $('#home').onclick = e => { e.preventDefault(); close(); };
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') { if (e.key === 'Escape') e.target.blur(); return; }
    if (!body.classList.contains('live')) { if (e.key === 'Enter' && (!window.__uniVisible || window.__uniVisible())) enter(false); return; }
    if (e.key === 'Escape') close();
    if ('1234'.includes(e.key) && (!window.__uniVisible || window.__uniVisible())) open(+e.key - 1);
  });

  /* ---------------- debbitGO: ring up a sale ---------------- */
  const MENU = [['Kopi O', 3.50, 1], ['Teh tarik', 2.50, 1], ['Roti canai', 1.50, 0], ['Nasi lemak', 5.50, 0], ['Milo ais', 3.00, 1], ['Kaya toast', 4.00, 0]];
  let goSub = 0, goTax = 0, cups = 120;
  const money = v => 'RM ' + v.toLocaleString('en-MY', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  $('#ring').onclick = () => {
    const [name, price, cup] = MENU[(Math.random() * MENU.length) | 0], qty = 1 + ((Math.random() * 3) | 0);
    const sub = Math.round(price * qty * 100) / 100, tax = Math.round(sub * 6) / 100;
    goSub += sub + tax; goTax += tax; if (cup) cups = Math.max(0, cups - qty);
    $('#goSales').textContent = money(goSub); $('#goTax').textContent = money(goTax); $('#goStock').textContent = cups;
    const row = document.createElement('div'); row.innerHTML = '<span></span><b class="num"></b>';
    row.firstChild.textContent = qty + ' ' + name; row.lastChild.textContent = money(sub + tax);
    const r = $('#rcpt'); r.prepend(row); while (r.children.length > 3) r.lastChild.remove();
    U && U.burst(0, 1); ping(880 + Math.random() * 200, .25);
  };

  /* ---------------- debbitPro: who sees what ---------------- */
  const ROLES = [
    ['Profit and cash, every branch', 'Approvals waiting for you', 'Payroll totals', 'Every report'],
    ['Full accounts and the general ledger', 'Tax returns and e-invoices', 'Bank matching', 'Month-end close'],
    ['Stock and purchase orders', "The team's rota", 'Branch sales', 'Supplier bills to check'],
    ['The till', 'Their own shift', 'Returns, with a manager\'s OK']
  ];
  let curRole = 0;
  function setRole(r) {
    curRole = r; $$('.seg button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.r === r));
    const ul = $('#sees'); ul.innerHTML = ''; ROLES[r].forEach((s, i) => { const li = document.createElement('li'); li.textContent = s; li.style.animationDelay = i * 60 + 'ms'; ul.appendChild(li); });
    U && U.sel(1, r === 0 ? -1 : r); ping(440 + r * 110, .3);
  }
  $$('.seg button').forEach(b => b.onclick = () => setRole(+b.dataset.r));

  /* ---------------- debbitX: the three steps ---------------- */
  let curStep = 0;
  function setStep(s) { curStep = s; $$('#xsteps button').forEach(b => b.setAttribute('aria-expanded', +b.dataset.s === s)); U && U.sel(2, s); U && U.burst(2, .5); ping(587 + s * 98, .35); }
  $$('#xsteps button').forEach(b => b.onclick = () => setStep(+b.dataset.s));

  /* ---------------- debbitNext: type a business, the galaxy becomes a city ---------------- */
  let building = false;
  function build(idea) {
    idea = (idea || '').trim().slice(0, 80); if (!idea) return;
    open(3); $('#nIn').value = idea;
    const head = $('#bpHead'); head.textContent = ''; head.append('Building: '); const b = document.createElement('b'); b.textContent = idea; head.append(b);
    const cards = $$('#bp div'); cards.forEach(c => { c.classList.add('wait'); c.classList.remove('lit'); });
    if (U) { U.buildTarget = 0; U.spinTarget = 9; }
    if (building) return; building = true;
    setTimeout(() => { if (U) { U.spinTarget = 0; U.buildTarget = 1; } }, still ? 0 : 1300);
    cards.forEach((c, k) => setTimeout(() => { c.classList.remove('wait'); c.classList.add('lit'); ping(660 + k * 80, .4); if (k === cards.length - 1) building = false; }, (still ? 0 : 1500) + k * 380));
  }
  $('#askForm').onsubmit = e => { e.preventDefault(); const v = $('#askIn').value; $('#askIn').value = ''; build(v || 'A kopitiam in Bangsar'); };
  $('#nForm').onsubmit = e => { e.preventDefault(); build($('#nIn').value || 'A kopitiam in Bangsar'); };
  $$('#chips button').forEach(b => b.onclick = () => build(b.textContent));


  /* ================= below the universe ================= */
  // nav that appears once you leave the universe
  const nav = $('#siteNav'), uni = $('#universe');
  let uniVisible = true;
  addEventListener('scroll', () => nav.classList.toggle('show', scrollY > innerHeight * .75), {passive: true});
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { uniVisible = es[0].isIntersecting; }, {threshold: 0}).observe(uni);
  window.__uniVisible = () => uniVisible;

  // product chooser
  const tabs = $$('.chooser button'), details = $$('.pdetail');
  function choose(i, scroll) {
    tabs.forEach((t, k) => t.setAttribute('aria-selected', k === i));
    details.forEach((d, k) => d.classList.toggle('on', k === i));
    if (scroll) $('#products').scrollIntoView({behavior: still ? 'auto' : 'smooth'});
  }
  tabs.forEach(t => t.onclick = () => choose(+t.dataset.p));
  $$('[data-go]').forEach(a => a.onclick = () => choose(+a.dataset.go));
  // each world in the universe links down to its full details
  $$('.panel').forEach((p, i) => { const c = p.querySelector('.cta'); const a = document.createElement('a'); a.className = 'btn btn-ghost'; a.href = '#products'; a.textContent = 'Full details'; a.onclick = e => { e.preventDefault(); choose(i, true); }; c.appendChild(a); });
  $$('.pcta [data-prod]').forEach(a => a.addEventListener('click', () => { const v = a.dataset.prod === 'debbitNext' ? 'debbitNext waitlist' : a.dataset.prod; $('#cfProd').value = v; }));
  $('#tryNext').onclick = e => { e.preventDefault(); scrollTo({top: 0, behavior: still ? 'auto' : 'smooth'}); setTimeout(() => open(3), 500); };

  // countries
  const C = [
    ['Algeria', 28, 2, 'Africa'], ['Benin', 9.3, 2.3, 'Africa'], ['Burkina Faso', 12.2, -1.6, 'Africa'], ['Burundi', -3.4, 29.9, 'Africa'], ['Cameroon', 5.7, 12.4, 'Africa'],
    ['Central African Republic', 6.6, 20.9, 'Africa'], ['Chad', 15.4, 18.7, 'Africa'], ['Comoros', -11.7, 43.3, 'Africa'], ['Republic of the Congo', -0.7, 15.2, 'Africa'],
    ['Democratic Republic of the Congo', -2.9, 23.6, 'Africa'], ["Côte d'Ivoire", 7.5, -5.5, 'Africa'], ['Egypt', 26.8, 30.8, 'Africa'], ['Equatorial Guinea', 1.6, 10.3, 'Africa'],
    ['Gabon', -0.8, 11.6, 'Africa'], ['Guinea', 9.9, -9.7, 'Africa'], ['Guinea-Bissau', 11.8, -15.2, 'Africa'], ['Kenya', 0.2, 37.9, 'Africa'], ['Mali', 17.6, -4, 'Africa'],
    ['Niger', 17.6, 8.1, 'Africa'], ['Nigeria', 9.1, 8.7, 'Africa'], ['Senegal', 14.5, -14.5, 'Africa'], ['South Africa', -30.6, 22.9, 'Africa'], ['Tanzania', -6.4, 34.9, 'Africa'],
    ['Togo', 8.6, 0.8, 'Africa'], ['Uganda', 1.4, 32.3, 'Africa'], ['Zambia', -13.1, 27.8, 'Africa'],
    ['Argentina', -34, -64, 'Americas'], ['Brazil', -10, -52, 'Americas'], ['Canada', 56, -106, 'Americas'], ['Colombia', 4.6, -74.1, 'Americas'], ['Ecuador', -1.8, -78.2, 'Americas'],
    ['El Salvador', 13.8, -88.9, 'Americas'], ['Guatemala', 15.8, -90.2, 'Americas'], ['Mexico', 23.6, -102.5, 'Americas'], ['Nicaragua', 12.9, -85.2, 'Americas'], ['United States', 39.8, -98.6, 'Americas'],
    ['Australia', -25, 134, 'Asia and Pacific'], ['Bangladesh', 23.7, 90.4, 'Asia and Pacific'], ['India', 21, 78, 'Asia and Pacific'], ['Indonesia', -2.5, 118, 'Asia and Pacific'],
    ['Malaysia', 4.2, 102, 'Asia and Pacific'], ['Singapore', 1.35, 103.8, 'Asia and Pacific'], ['Sri Lanka', 7.9, 80.8, 'Asia and Pacific'], ['Taiwan', 23.7, 121, 'Asia and Pacific'], ['Thailand', 15.9, 100.9, 'Asia and Pacific'],
    ['France', 46.6, 2.2, 'Europe'], ['Germany', 51.2, 10.4, 'Europe'], ['Hungary', 47.2, 19.5, 'Europe'], ['Italy', 42.8, 12.6, 'Europe'], ['Netherlands', 52.1, 5.3, 'Europe'],
    ['Portugal', 39.4, -8.2, 'Europe'], ['Spain', 40.5, -3.7, 'Europe'], ['Sweden', 60.1, 18.6, 'Europe'], ['Switzerland', 46.8, 8.2, 'Europe'], ['United Kingdom', 55.4, -3.4, 'Europe'],
    ['Saudi Arabia', 23.9, 45.1, 'Middle East'], ['Turkey', 39, 35.2, 'Middle East'], ['United Arab Emirates', 23.4, 53.8, 'Middle East']
  ].sort((a, b) => a[0].localeCompare(b[0]));
  const RC = {'Africa': '#F2B630', 'Americas': '#F03D78', 'Asia and Pacific': '#1DB8A8', 'Europe': '#B04BE0', 'Middle East': '#7FB2FF'};
  let region = 'All', query = '', picked = -1;
  const regBox = $('#regions');
  ['All', ...Object.keys(RC)].forEach(r => { const b = document.createElement('button'); b.type = 'button'; b.textContent = r === 'All' ? 'All regions' : r; b.setAttribute('aria-pressed', r === region); b.onclick = () => { region = r; $$('#regions button').forEach(x => x.setAttribute('aria-pressed', x === b)); list(); }; regBox.appendChild(b); });
  const sel = $('#cfCountry'); sel.innerHTML = '<option value="">Choose a country</option>' + C.map(c => `<option value="${c[0]}">${c[0]}</option>`).join('') + '<option value="other">Somewhere else</option>';
  function list() {
    const ul = $('#clist'); ul.innerHTML = '';
    const q = query.trim().toLowerCase();
    const rows = C.map((c, i) => [c, i]).filter(([c]) => (region === 'All' || c[3] === region) && (!q || c[0].toLowerCase().includes(q) || (window.__t && __t(c[0]).toLowerCase().includes(q))));
    $('#ccount').textContent = rows.length;
    if (!rows.length) { const li = document.createElement('li'); li.className = 'none'; li.textContent = 'Not on the list yet. Tell us where you trade in the form below.'; ul.appendChild(li); return; }
    rows.forEach(([c, i]) => { const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button'; b.textContent = c[0]; b.style.setProperty('--rc', RC[c[3]]); b.classList.toggle('on', i === picked);
      b.onclick = () => focusCountry(i); b.onmouseenter = () => { hoverC = i; }; b.onmouseleave = () => { hoverC = -1; }; li.appendChild(b); ul.appendChild(li); });
  }
  $('#cq').oninput = e => { query = e.target.value; list(); };

  // the globe: a turning sphere of dots with the countries lit, and arcs of light between them
  const gc = $('#globe'), gx = gc.getContext('2d');
  let rotL = -20, rotP = 18, vL = .12, dragG = null, tgtL = null, tgtP = null, hoverC = -1, gw = 0, gr = 0;
  const DOTS = []; for (let i = 0; i < 2200; i++) { const y = 1 - i / 2199 * 2, r = Math.sqrt(1 - y * y), t = i * 2.399963; DOTS.push([Math.asin(y) * 180 / Math.PI, Math.atan2(Math.sin(t) * r, Math.cos(t) * r) * 180 / Math.PI]); }
  const ARCS = []; for (let i = 0; i < 26; i++) { const a = (Math.random() * C.length) | 0, b = (Math.random() * C.length) | 0; if (a !== b) ARCS.push([a, b, Math.random()]); }
  function gsize() { const r = gc.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); gc.width = r.width * d; gc.height = r.height * d; gx.setTransform(d, 0, 0, d, 0, 0); gw = r.width; gr = r.width * .44; }
  function proj(lat, lon) {
    const la = lat * Math.PI / 180, lo = (lon + rotL) * Math.PI / 180, p = rotP * Math.PI / 180;
    const x = Math.cos(la) * Math.sin(lo), y0 = Math.sin(la), z0 = Math.cos(la) * Math.cos(lo);
    const y = y0 * Math.cos(p) - z0 * Math.sin(p), z = y0 * Math.sin(p) + z0 * Math.cos(p);
    return [gw / 2 + x * gr, gw / 2 - y * gr, z];
  }
  function slerp(a, b, t) { // great-circle point between two countries, lifted into an arc
    const toV = (lat, lon) => { const la = lat * Math.PI / 180, lo = lon * Math.PI / 180; return [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)]; };
    const A = toV(a[1], a[2]), B = toV(b[1], b[2]); const d = Math.acos(Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])));
    const s = Math.sin(d) || 1, k1 = Math.sin((1 - t) * d) / s, k2 = Math.sin(t * d) / s; const v = [A[0] * k1 + B[0] * k2, A[1] * k1 + B[1] * k2, A[2] * k1 + B[2] * k2];
    const h = 1 + Math.sin(t * Math.PI) * d * .18; return [Math.asin(v[1] / Math.hypot(...v)) * 180 / Math.PI, Math.atan2(v[2], v[0]) * 180 / Math.PI, h];
  }
  function gframe(t) {
    if (!gw) gsize();
    gx.clearRect(0, 0, gw, gw);
    const halo = gx.createRadialGradient(gw / 2, gw / 2, gr * .6, gw / 2, gw / 2, gr * 1.25); halo.addColorStop(0, 'rgba(164,107,255,.10)'); halo.addColorStop(.8, 'rgba(164,107,255,.05)'); halo.addColorStop(1, 'rgba(164,107,255,0)');
    gx.fillStyle = halo; gx.beginPath(); gx.arc(gw / 2, gw / 2, gr * 1.25, 0, 7); gx.fill();
    gx.strokeStyle = 'rgba(241,235,250,.12)'; gx.lineWidth = 1; gx.beginPath(); gx.arc(gw / 2, gw / 2, gr, 0, 7); gx.stroke();
    for (const d of DOTS) { const p = proj(d[0], d[1]); if (p[2] < 0) continue; gx.fillStyle = `rgba(201,180,255,${.08 + p[2] * .3})`; gx.fillRect(p[0] - .7, p[1] - .7, 1.4, 1.4); }
    gx.globalCompositeOperation = 'lighter';
    for (const [a, b, o] of ARCS) {
      const ph = ((t / 4000 + o) % 1); gx.beginPath(); let started = false;
      for (let s = 0; s <= 24; s++) { const q = slerp(C[a], C[b], s / 24), la = q[0], lo = q[1], h = q[2]; let p = proj(la, lo); if (p[2] < -.05) { started = false; continue; } p = [gw / 2 + (p[0] - gw / 2) * h, gw / 2 + (p[1] - gw / 2) * h]; started ? gx.lineTo(p[0], p[1]) : gx.moveTo(p[0], p[1]); started = true; }
      gx.strokeStyle = 'rgba(164,107,255,.18)'; gx.stroke();
      const q = slerp(C[a], C[b], ph); const p = proj(q[0], q[1]); if (p[2] > 0) { const x = gw / 2 + (p[0] - gw / 2) * q[2], y = gw / 2 + (p[1] - gw / 2) * q[2]; gx.fillStyle = 'rgba(255,207,110,.9)'; gx.beginPath(); gx.arc(x, y, 1.8, 0, 7); gx.fill(); }
    }
    C.forEach((c, i) => { const p = proj(c[1], c[2]); if (p[2] < 0) return; const hot = i === hoverC || i === picked, col = RC[c[3]];
      const pulse = hot ? 6 + Math.sin(t / 200) * 2 : 3; const g = gx.createRadialGradient(p[0], p[1], 0, p[0], p[1], pulse * 3); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      gx.globalAlpha = .35 + p[2] * .65; gx.fillStyle = g; gx.beginPath(); gx.arc(p[0], p[1], pulse * 3, 0, 7); gx.fill(); gx.fillStyle = '#fff'; gx.beginPath(); gx.arc(p[0], p[1], hot ? 2.6 : 1.6, 0, 7); gx.fill(); gx.globalAlpha = 1;
      if (hot) { gx.globalCompositeOperation = 'source-over'; gx.font = '600 13px Figtree, sans-serif'; gx.fillStyle = '#F1EBFA'; gx.textAlign = 'center'; gx.fillText(c[0], p[0], p[1] - 14); gx.globalCompositeOperation = 'lighter'; } });
    gx.globalCompositeOperation = 'source-over';
  }
  function focusCountry(i) { picked = i; tgtL = -C[i][2]; tgtP = C[i][1]; vL = 0; $('#gtip').innerHTML = (window.__t ? __t('{country}: talk to us about {debbit} there', {country: '<b>' + __t(C[i][0]) + '</b>', debbit: '<span class="lg lg-debbit dw" role="img" aria-label="debbit"></span>'}) : C[i][0]); $('#cfCountry').value = C[i][0]; list(); }
  gc.addEventListener('pointerdown', e => { dragG = {x: e.clientX, y: e.clientY}; tgtL = tgtP = null; gc.setPointerCapture(e.pointerId); });
  gc.addEventListener('pointermove', e => { if (!dragG) return; rotL += (e.clientX - dragG.x) * .4; rotP = Math.max(-70, Math.min(70, rotP + (e.clientY - dragG.y) * .3)); vL = (e.clientX - dragG.x) * .4; dragG = {x: e.clientX, y: e.clientY}; });
  gc.addEventListener('pointerup', () => { dragG = null; });
  addEventListener('resize', () => { gw = 0; });
  let globeOn = false;
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { globeOn = es[0].isIntersecting; }, {threshold: 0}).observe(gc); else globeOn = true;
  (function gl2(t) {
    if (globeOn) {
      if (tgtL !== null) { let d = ((tgtL - rotL + 540) % 360) - 180; rotL += d * .08; rotP += (tgtP - rotP) * .08; }
      else if (!dragG && !still) { rotL += vL; vL += (.12 - vL) * .02; }
      gframe(t || 0);
    }
    requestAnimationFrame(gl2);
  })();
  list();

  // contact form: a concept, so it says plainly that nothing was sent
  $('#cform').onsubmit = e => {
    e.preventDefault(); const out = $('#cfOut'), n = $('#cfName').value.trim(), em = $('#cfEmail').value.trim();
    if (!n) { out.style.color = 'var(--go)'; out.textContent = 'Add your name so we know who to reply to.'; $('#cfName').focus(); return; }
    if (!/^\S+@\S+\.\S+$/.test(em)) { out.style.color = 'var(--go)'; out.textContent = 'Add an email address we can reply to, like name@business.com.'; $('#cfEmail').focus(); return; }
    const btn = $('#cform button[type=submit]'), T = (k, v) => window.__t ? __t(k, v) : k.replace('{n}', n);
    const body = {name: n, business: $('#cfBiz').value.trim(), email: em, country: $('#cfCountry').value, product: $('#cfProd').value, message: $('#cfMsg').value.trim(), website: ($('#cfWebsite') || {}).value || '', lang: window.__lang ? __lang() : 'en'};
    btn.disabled = true; out.style.color = 'var(--haze)'; out.textContent = T('Sending…');
    fetch('/api/contact', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})
      .then(r => r.json().catch(() => ({})).then(j => { if (!r.ok || !j.ok) throw new Error(j.error || 'failed'); }))
      .then(() => { out.style.color = 'var(--x)'; out.textContent = T("Thanks, {n}. We've got your message and will reply soon.", {n}); $('#cform').reset(); })
      .catch(() => { out.style.color = 'var(--go)'; out.textContent = T("Sorry, that didn't send. Please try again, or book a call instead."); })
      .finally(() => { btn.disabled = false; });
  };

  /* ---------------- run ---------------- */
  if (U) { if (still) { U.frame(); setInterval(U.frame, 250); } else (function loop() { if (!window.__uniVisible || window.__uniVisible()) U.frame(); requestAnimationFrame(loop); })(); }
})();
