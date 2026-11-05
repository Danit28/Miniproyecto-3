// ============================================================================
//  app.js - Interfaz del visualizador (grilla, estadisticas, controles)
// ============================================================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const E = window.Ecosystem;

  const EXAMPLE = `2 4 3 6 5 5 9
ROCK 0 0
RABBIT 0 2
FOX 0 4
FOX 1 0
FOX 1 4
ROCK 2 4
RABBIT 3 0
RABBIT 4 0
FOX 4 4
`;

  // Velocidades disponibles (generaciones por segundo); Infinity = maximo
  const SPEEDS = [1, 2, 3, 5, 8, 10, 15, 24, 30, 60, Infinity];

  const state = {
    sim: null,
    initialText: "",   // estado inicial (para reiniciar)
    history: [],       // [{gen, rabbits, foxes}]
    playing: false,
    speedIdx: 5,
    lastTick: 0,
    acc: 0,
    hoverGen: null,
  };

  // ---------------------------------------------------------------- colores
  let colors = {};
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    const g = (n) => cs.getPropertyValue(n).trim();
    colors = {
      empty: g("--empty"), rock: g("--rock"), rabbit: g("--rabbit"), fox: g("--fox"),
      text2: g("--text-2"), muted: g("--muted"), grid: g("--grid"), surface: g("--surface"),
    };
    colors.rgb = [colors.empty, colors.rock, colors.rabbit, colors.fox].map(hexToRgb);
  }
  function hexToRgb(h) {
    h = h.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // ---------------------------------------------------------------- mundo
  const worldCanvas = $("world");
  const worldCtx = worldCanvas.getContext("2d");
  const off = document.createElement("canvas");
  const offCtx = off.getContext("2d");
  let img = null;
  let cellPx = 1;

  function layoutWorld() {
    const s = state.sim;
    if (!s) return;
    const wrap = $("worldWrap").getBoundingClientRect();
    // tamano de celda: entero si cabe al menos 1 px (pixeles nitidos)
    cellPx = Math.min((wrap.width - 2) / s.p.C, (wrap.height - 2) / s.p.R);
    if (cellPx >= 1) cellPx = Math.floor(cellPx);
    worldCanvas.style.width = s.p.C * cellPx + "px";
    worldCanvas.style.height = s.p.R * cellPx + "px";
    const dpr = window.devicePixelRatio || 1;
    worldCanvas.width = Math.round(s.p.C * cellPx * dpr);
    worldCanvas.height = Math.round(s.p.R * cellPx * dpr);
    off.width = s.p.C;
    off.height = s.p.R;
    img = offCtx.createImageData(s.p.C, s.p.R);
    drawWorld();
  }

  function drawWorld() {
    const s = state.sim;
    if (!s || !img) return;
    const d = img.data, t = s.type, rgb = colors.rgb;
    for (let i = 0, j = 0; i < t.length; i++, j += 4) {
      const c = rgb[t[i]];
      d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = 255;
    }
    offCtx.putImageData(img, 0, 0);
    worldCtx.imageSmoothingEnabled = false;
    worldCtx.drawImage(off, 0, 0, worldCanvas.width, worldCanvas.height);
    // lineas de cuadricula cuando las celdas son grandes
    const px = worldCanvas.width / s.p.C;
    if (px >= 10) {
      worldCtx.strokeStyle = colors.grid;
      worldCtx.lineWidth = 1;
      worldCtx.beginPath();
      for (let c = 1; c < s.p.C; c++) { const x = Math.round(c * px) + 0.5; worldCtx.moveTo(x, 0); worldCtx.lineTo(x, worldCanvas.height); }
      for (let r = 1; r < s.p.R; r++) { const y = Math.round(r * px) + 0.5; worldCtx.moveTo(0, y); worldCtx.lineTo(worldCanvas.width, y); }
      worldCtx.stroke();
    }
  }

  worldCanvas.addEventListener("mousemove", (ev) => {
    const s = state.sim;
    if (!s) return;
    const rect = worldCanvas.getBoundingClientRect();
    const y = Math.floor((ev.clientX - rect.left) / (rect.width / s.p.C));
    const x = Math.floor((ev.clientY - rect.top) / (rect.height / s.p.R));
    if (x < 0 || y < 0 || x >= s.p.R || y >= s.p.C) return hideTip($("cellTip"));
    const i = x * s.p.C + y, t = s.type[i];
    const name = ["Vacío", "Roca", "Conejo", "Zorro"][t];
    let html = `<b>${name}</b> (${x}, ${y})`;
    if (t === E.RABBIT) html += `<br>edad de procreación: ${s.age[i]}`;
    if (t === E.FOX) html += `<br>edad de procreación: ${s.age[i]}<br>hambre: ${s.hunger[i]}`;
    showTip($("cellTip"), $("worldWrap"), ev, html);
  });
  worldCanvas.addEventListener("mouseleave", () => hideTip($("cellTip")));

  function showTip(tip, wrap, ev, html) {
    tip.innerHTML = html;
    tip.hidden = false;
    const r = wrap.getBoundingClientRect();
    let lx = ev.clientX - r.left + 14, ly = ev.clientY - r.top + 14;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    if (lx + tw > r.width) lx = ev.clientX - r.left - tw - 14;
    if (ly + th > r.height) ly = ev.clientY - r.top - th - 14;
    tip.style.left = Math.max(0, lx) + "px";
    tip.style.top = Math.max(0, ly) + "px";
  }
  function hideTip(tip) { tip.hidden = true; }

  // ---------------------------------------------------------------- grafica
  const chart = $("chart");
  const cctx = chart.getContext("2d");
  const PAD = { l: 52, r: 16, t: 10, b: 28 };

  function niceStep(max, ticks) {
    const raw = max / ticks;
    const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const m = raw / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  }
  const fmt = (n) => n.toLocaleString("es");

  function chartGeom() {
    const h = state.history;
    const W = chart.clientWidth, H = chart.clientHeight;
    const g0 = h.length ? h[0].gen : 0;
    const g1 = Math.max(g0 + 1, h.length ? h[h.length - 1].gen : 1);
    let ymax = 1;
    for (const e of h) ymax = Math.max(ymax, e.rabbits, e.foxes);
    const step = niceStep(ymax, 4);
    ymax = Math.ceil(ymax / step) * step;
    const sx = (g) => PAD.l + ((g - g0) / (g1 - g0)) * (W - PAD.l - PAD.r);
    const sy = (v) => PAD.t + (1 - v / ymax) * (H - PAD.t - PAD.b);
    return { W, H, g0, g1, ymax, step, sx, sy };
  }

  function drawChart() {
    const dpr = window.devicePixelRatio || 1;
    const W = chart.clientWidth, H = chart.clientHeight;
    if (chart.width !== Math.round(W * dpr) || chart.height !== Math.round(H * dpr)) {
      chart.width = Math.round(W * dpr);
      chart.height = Math.round(H * dpr);
    }
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cctx.clearRect(0, 0, W, H);
    const h = state.history;
    const G = chartGeom();

    // grilla y eje Y
    cctx.font = "11px system-ui, sans-serif";
    cctx.fillStyle = colors.muted;
    cctx.strokeStyle = colors.grid;
    cctx.lineWidth = 1;
    cctx.textAlign = "right";
    cctx.textBaseline = "middle";
    for (let v = 0; v <= G.ymax; v += G.step) {
      const y = Math.round(G.sy(v)) + 0.5;
      cctx.beginPath(); cctx.moveTo(PAD.l, y); cctx.lineTo(W - PAD.r, y); cctx.stroke();
      cctx.fillText(fmt(v), PAD.l - 6, y);
    }
    // eje X
    cctx.textAlign = "center";
    cctx.textBaseline = "top";
    const xs = niceStep(G.g1 - G.g0, 5);
    for (let g = Math.ceil(G.g0 / xs) * xs; g <= G.g1; g += xs) {
      cctx.fillText(fmt(g), G.sx(g), H - PAD.b + 8);
    }
    if (!h.length) return;

    // series. Con mas generaciones que pixeles se dibuja la envolvente
    // min/max de cada columna de pixeles (evita aliasing de las oscilaciones).
    const plotW = W - PAD.l - PAD.r;
    const dense = h.length > plotW;
    for (const [key, col] of [["rabbits", colors.rabbit], ["foxes", colors.fox]]) {
      cctx.strokeStyle = col;
      cctx.lineWidth = dense ? 1 : 2;
      cctx.lineJoin = "round";
      cctx.beginPath();
      if (!dense) {
        for (let i = 0; i < h.length; i++) {
          const x = G.sx(h[i].gen), y = G.sy(h[i][key]);
          i ? cctx.lineTo(x, y) : cctx.moveTo(x, y);
        }
      } else {
        let px = -1, lo = 0, hi = 0;
        const flush = () => {
          cctx.moveTo(px + 0.5, G.sy(lo));
          cctx.lineTo(px + 0.5, G.sy(hi) - 0.5);
        };
        for (let i = 0; i < h.length; i++) {
          const x = Math.floor(G.sx(h[i].gen)), v = h[i][key];
          if (x !== px) {
            if (px >= 0) flush();
            px = x; lo = hi = v;
          } else {
            lo = Math.min(lo, v); hi = Math.max(hi, v);
          }
        }
        flush();
      }
      cctx.stroke();
    }

    // cruz de seleccion (hover)
    if (state.hoverGen !== null) {
      const e = h.find((q) => q.gen === state.hoverGen);
      if (e) {
        const x = Math.round(G.sx(e.gen)) + 0.5;
        cctx.strokeStyle = colors.muted;
        cctx.lineWidth = 1;
        cctx.beginPath(); cctx.moveTo(x, PAD.t); cctx.lineTo(x, H - PAD.b); cctx.stroke();
        for (const [key, col] of [["rabbits", colors.rabbit], ["foxes", colors.fox]]) {
          cctx.fillStyle = col;
          cctx.strokeStyle = colors.surface;
          cctx.lineWidth = 2;
          cctx.beginPath(); cctx.arc(x, G.sy(e[key]), 4.5, 0, Math.PI * 2); cctx.fill(); cctx.stroke();
        }
      }
    }
  }

  chart.addEventListener("mousemove", (ev) => {
    const h = state.history;
    if (!h.length) return;
    const G = chartGeom();
    const rect = chart.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const g = Math.round(G.g0 + ((mx - PAD.l) / (G.W - PAD.l - PAD.r)) * (G.g1 - G.g0));
    const gg = Math.min(Math.max(g, h[0].gen), h[h.length - 1].gen);
    const e = h[gg - h[0].gen];
    if (!e) return;
    state.hoverGen = e.gen;
    drawChart();
    showTip($("chartTip"), $("chartWrap"), ev,
      `<b>Generación ${fmt(e.gen)}</b><br>` +
      `<i class="sw rabbit"></i>Conejos: ${fmt(e.rabbits)}<br>` +
      `<i class="sw fox"></i>Zorros: ${fmt(e.foxes)}`);
  });
  chart.addEventListener("mouseleave", () => {
    state.hoverGen = null;
    hideTip($("chartTip"));
    drawChart();
  });

  // ---------------------------------------------------------------- estado
  function record() {
    const c = state.sim.counts();
    state.history.push({ gen: state.sim.gen, rabbits: c.rabbits, foxes: c.foxes });
    return c;
  }

  function updateStats(c) {
    c = c || state.sim.counts();
    $("tGen").textContent = fmt(state.sim.gen);
    $("tRab").textContent = fmt(c.rabbits);
    $("tFox").textContent = fmt(c.foxes);
    $("tRock").textContent = fmt(c.rocks);
    const rows = state.history.slice(-20).reverse()
      .map((e) => `<tr><td>${e.gen}</td><td>${fmt(e.rabbits)}</td><td>${fmt(e.foxes)}</td></tr>`);
    $("tbody").innerHTML = rows.join("");
  }

  function render(c) {
    drawWorld();
    drawChart();
    updateStats(c);
  }

  function load(sim, keepInputs) {
    state.sim = sim;
    state.initialText = sim.toText(sim.p.nGen);
    state.history = [];
    if (!keepInputs) {
      $("pR").value = sim.p.R; $("pC").value = sim.p.C;
      $("pGPR").value = sim.p.gpr; $("pGPF").value = sim.p.gpf;
      $("pGFF").value = sim.p.gff; $("pNG").value = sim.p.nGen;
    }
    const c = record();
    layoutWorld();
    render(c);
  }

  function readParams() {
    const v = (id) => Number($(id).value);
    return {
      gpr: Math.max(0, v("pGPR") | 0), gpf: Math.max(0, v("pGPF") | 0),
      gff: Math.max(1, v("pGFF") | 0), nGen: Math.max(0, v("pNG") | 0),
      R: Math.min(1000, Math.max(1, v("pR") | 0)), C: Math.min(1000, Math.max(1, v("pC") | 0)),
    };
  }

  function message(t) { $("msg").textContent = t; }

  function generate() {
    const p = readParams();
    setPlaying(false);
    load(E.random(p, Number($("pRock").value), Number($("pRab").value), Number($("pFox").value), Number($("pSeed").value) || 1), true);
    message(`Mundo ${p.R}×${p.C} generado.`);
  }

  function step(n) {
    const s = state.sim;
    let c = null;
    for (let k = 0; k < n; k++) {
      if (s.p.nGen > 0 && s.gen >= s.p.nGen) { setPlaying(false); message(`Se alcanzó N_GEN = ${s.p.nGen}.`); break; }
      s.step();
      c = record();
    }
    if (c) render(c);
  }

  // ---------------------------------------------------------------- tiempo
  function setPlaying(on) {
    state.playing = on;
    $("btnPlay").textContent = on ? "⏸ Pausar" : "▶ Reproducir";
    if (on) { state.lastTick = performance.now(); state.acc = 0; requestAnimationFrame(loop); }
  }

  function loop(now) {
    if (!state.playing) return;
    const sp = SPEEDS[state.speedIdx];
    if (sp === Infinity) {
      // tantas generaciones como quepan en ~14 ms
      const t0 = performance.now();
      let n = 0;
      do { step(1); n++; } while (state.playing && performance.now() - t0 < 14 && n < 500);
    } else {
      state.acc += (now - state.lastTick) / 1000;
      const n = Math.floor(state.acc * sp);
      if (n > 0) { state.acc -= n / sp; step(Math.min(n, 50)); }
    }
    state.lastTick = now;
    requestAnimationFrame(loop);
  }

  function setSpeed(i) {
    state.speedIdx = Math.max(0, Math.min(SPEEDS.length - 1, i));
    $("speed").value = state.speedIdx;
    const sp = SPEEDS[state.speedIdx];
    $("speedLabel").textContent = sp === Infinity ? "máx." : sp + " gen/s";
  }

  // ---------------------------------------------------------------- archivos
  function download(name, text) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function loadText(text, label) {
    try {
      setPlaying(false);
      load(E.parse(text), false);
      message(`Cargado: ${label}`);
    } catch (err) {
      message("Error: " + err.message);
    }
  }

  // ---------------------------------------------------------------- eventos
  $("btnPlay").onclick = () => setPlaying(!state.playing);
  $("btnStep").onclick = () => { setPlaying(false); step(1); };
  $("btnReset").onclick = () => { setPlaying(false); load(E.parse(state.initialText), true); message("Reiniciado al estado inicial."); };
  $("btnSlower").onclick = () => setSpeed(state.speedIdx - 1);
  $("btnFaster").onclick = () => setSpeed(state.speedIdx + 1);
  $("speed").oninput = (e) => setSpeed(Number(e.target.value));
  $("btnGenerate").onclick = generate;
  $("btnApply").onclick = () => {
    const p = readParams();
    Object.assign(state.sim.p, { gpr: p.gpr, gpf: p.gpf, gff: p.gff, nGen: p.nGen });
    message("Tasas aplicadas a la simulación en curso.");
  };
  $("btnExample").onclick = () => loadText(EXAMPLE, "ejemplo del enunciado");
  $("fileIn").onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then((t) => loadText(t, f.name));
    e.target.value = "";
  };
  $("btnSaveState").onclick = () => {
    const s = state.sim;
    const rem = s.p.nGen > 0 ? Math.max(0, s.p.nGen - s.gen) : 0;
    download(`estado_gen${s.gen}.txt`, s.toText(rem));
  };
  $("btnSaveCsv").onclick = () => {
    download("poblacion.csv", "gen,rabbits,foxes\n" +
      state.history.map((e) => `${e.gen},${e.rabbits},${e.foxes}`).join("\n") + "\n");
  };

  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if (e.code === "Space") { e.preventDefault(); setPlaying(!state.playing); }
    else if (e.key === "ArrowRight") { setPlaying(false); step(1); }
    else if (e.key === "+" || e.key === "=") setSpeed(state.speedIdx + 1);
    else if (e.key === "-") setSpeed(state.speedIdx - 1);
    else if (e.key === "r" || e.key === "R") $("btnReset").click();
  });

  window.addEventListener("resize", () => { layoutWorld(); drawChart(); });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readColors(); render(); });

  // ---------------------------------------------------------------- inicio
  // index.html#light fuerza el tema claro, #dark el oscuro;
  // index.html#play inicia automaticamente a velocidad maxima (demostraciones)
  const hash = location.hash;
  if (hash.includes("light")) document.documentElement.dataset.theme = "light";
  else if (hash.includes("dark")) document.documentElement.dataset.theme = "dark";
  readColors();
  setSpeed(state.speedIdx);
  generate();
  if (hash.includes("play")) { setSpeed(SPEEDS.length - 1); setPlaying(true); }
})();
