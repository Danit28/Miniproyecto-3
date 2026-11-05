// ============================================================================
//  ecosystem.js - Motor de la simulacion para el visualizador web.
//
//  Implementacion INDEPENDIENTE de la version C++ (estilo "push": cada animal
//  escribe en su celda destino y los conflictos se resuelven al llegar). Se
//  usa tambien desde Node (scripts/crosscheck.js) para validar que ambas
//  implementaciones producen exactamente el mismo resultado.
// ============================================================================
(function (root) {
  "use strict";

  const EMPTY = 0, ROCK = 1, RABBIT = 2, FOX = 3;
  const DR = [-1, 0, 1, 0]; // N, E, S, O (orden horario)
  const DC = [0, 1, 0, -1];
  const NAMES = ["", "ROCK", "RABBIT", "FOX"];

  class Ecosystem {
    /**
     * @param {object} p {gpr, gpf, gff, nGen, R, C}
     * @param {Array<[number,number,number]>} objects lista [tipo, x, y]
     */
    constructor(p, objects) {
      this.p = Object.assign({}, p);
      const n = p.R * p.C;
      this.type = new Uint8Array(n);
      this.age = new Int32Array(n);
      this.hunger = new Int32Array(n);
      this.gen = 0;
      for (const [t, x, y] of objects || []) {
        this.type[x * p.C + y] = t;
      }
    }

    // ---- utilidades -------------------------------------------------------
    static parse(text) {
      const tok = text.split(/\s+/).filter(Boolean);
      let k = 0;
      const num = () => {
        const v = parseInt(tok[k++], 10);
        if (Number.isNaN(v)) throw new Error("Formato invalido cerca del token " + k);
        return v;
      };
      const p = { gpr: num(), gpf: num(), gff: num(), nGen: num(), R: num(), C: num() };
      const n = num();
      if (p.R <= 0 || p.C <= 0) throw new Error("Dimensiones invalidas");
      const objs = [];
      for (let i = 0; i < n; i++) {
        const name = tok[k++];
        const t = NAMES.indexOf(name);
        if (t <= 0) throw new Error("Objeto desconocido: " + name);
        const x = num(), y = num();
        if (x < 0 || x >= p.R || y < 0 || y >= p.C) throw new Error("Objeto fuera del mundo: " + name + " " + x + " " + y);
        objs.push([t, x, y]);
      }
      return new Ecosystem(p, objs);
    }

    // Mundo aleatorio con porcentajes (0..100) y semilla reproducible
    static random(p, pctRock, pctRabbit, pctFox, seed) {
      let s = (seed >>> 0) || 1;
      const rnd = () => { // mulberry32
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      const objs = [];
      const a = pctRock / 100, b = a + pctRabbit / 100, c = b + pctFox / 100;
      for (let x = 0; x < p.R; x++)
        for (let y = 0; y < p.C; y++) {
          const u = rnd();
          if (u < a) objs.push([ROCK, x, y]);
          else if (u < b) objs.push([RABBIT, x, y]);
          else if (u < c) objs.push([FOX, x, y]);
        }
      return new Ecosystem(p, objs);
    }

    counts() {
      let rabbits = 0, foxes = 0, rocks = 0;
      for (let i = 0; i < this.type.length; i++) {
        const t = this.type[i];
        if (t === RABBIT) rabbits++;
        else if (t === FOX) foxes++;
        else if (t === ROCK) rocks++;
      }
      return { rabbits, foxes, rocks };
    }

    // Estado en el formato del enunciado. remaining = generaciones restantes.
    toText(remaining = 0) {
      const { R, C, gpr, gpf, gff } = this.p;
      const lines = [];
      for (let x = 0; x < R; x++)
        for (let y = 0; y < C; y++) {
          const t = this.type[x * C + y];
          if (t) lines.push(NAMES[t] + " " + x + " " + y);
        }
      return [gpr, gpf, gff, remaining, R, C, lines.length].join(" ") + "\n" +
        lines.join("\n") + (lines.length ? "\n" : "");
    }

    // ---- una generacion ---------------------------------------------------
    step() {
      const G = this.gen;
      const { R, C } = this.p;
      const inside = (x, y) => x >= 0 && x < R && y >= 0 && y < C;

      // ---------- conejos ----------
      {
        const oT = this.type, oA = this.age, oH = this.hunger;
        const nT = new Uint8Array(oT), nA = new Int32Array(oA), nH = new Int32Array(oH);
        for (let i = 0; i < nT.length; i++) if (nT[i] === RABBIT) { nT[i] = EMPTY; nA[i] = 0; }

        for (let x = 0; x < R; x++)
          for (let y = 0; y < C; y++) {
            const i = x * C + y;
            if (oT[i] !== RABBIT) continue;
            const age = oA[i] + 1;
            const opts = [];
            for (let d = 0; d < 4; d++) {
              const a = x + DR[d], b = y + DC[d];
              if (inside(a, b) && oT[a * C + b] === EMPTY) opts.push(a * C + b);
            }
            if (opts.length === 0) { // se queda
              nT[i] = RABBIT; nA[i] = age;
              continue;
            }
            const dst = opts[(G + x + y) % opts.length];
            let carried = age;
            if (age > this.p.gpr) { // procrea: deja una cria
              nT[i] = RABBIT; nA[i] = 0; carried = 0;
            }
            if (nT[dst] === RABBIT) { // conflicto: gana la mayor edad
              if (carried > nA[dst]) nA[dst] = carried;
            } else {
              nT[dst] = RABBIT; nA[dst] = carried;
            }
          }
        this.type = nT; this.age = nA; this.hunger = nH;
      }

      // ---------- zorros ----------
      {
        const oT = this.type, oA = this.age, oH = this.hunger;
        const nT = new Uint8Array(oT), nA = new Int32Array(oA), nH = new Int32Array(oH);
        for (let i = 0; i < nT.length; i++) if (nT[i] === FOX) { nT[i] = EMPTY; nA[i] = 0; nH[i] = 0; }

        const put = (dst, age, hun) => {
          if (nT[dst] === FOX) { // conflicto: mayor edad, luego menos hambre
            if (age > nA[dst] || (age === nA[dst] && hun < nH[dst])) { nA[dst] = age; nH[dst] = hun; }
          } else { // vacia o conejo (se lo come)
            nT[dst] = FOX; nA[dst] = age; nH[dst] = hun;
          }
        };

        for (let x = 0; x < R; x++)
          for (let y = 0; y < C; y++) {
            const i = x * C + y;
            if (oT[i] !== FOX) continue;
            const age = oA[i] + 1;
            let hun = oH[i] + 1;
            const rab = [], emp = [];
            for (let d = 0; d < 4; d++) {
              const a = x + DR[d], b = y + DC[d];
              if (!inside(a, b)) continue;
              const t = oT[a * C + b];
              if (t === RABBIT) rab.push(a * C + b);
              else if (t === EMPTY) emp.push(a * C + b);
            }
            let dst;
            if (rab.length) { dst = rab[(G + x + y) % rab.length]; hun = 0; }
            else if (hun >= this.p.gff) continue; // muere de hambre
            else if (emp.length) dst = emp[(G + x + y) % emp.length];
            else { put(i, age, hun); continue; } // se queda

            let carried = age;
            if (age > this.p.gpf) { // procrea
              nT[i] = FOX; nA[i] = 0; nH[i] = 0; carried = 0;
            }
            put(dst, carried, hun);
          }
        this.type = nT; this.age = nA; this.hunger = nH;
      }
      this.gen++;
    }
  }

  Ecosystem.EMPTY = EMPTY;
  Ecosystem.ROCK = ROCK;
  Ecosystem.RABBIT = RABBIT;
  Ecosystem.FOX = FOX;

  if (typeof module !== "undefined" && module.exports) module.exports = Ecosystem;
  else root.Ecosystem = Ecosystem;
})(typeof self !== "undefined" ? self : this);
