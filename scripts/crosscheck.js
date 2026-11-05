// ============================================================================
//  crosscheck.js - Validacion cruzada entre el motor JavaScript (visualizador)
//  y el ejecutable C++ secuencial. Ambas implementaciones fueron escritas de
//  forma independiente (push vs. pull); si coinciden en muchos mundos
//  aleatorios, las reglas estan implementadas igual en ambas.
//
//  Uso:  node scripts/crosscheck.js [num_mundos]
// ============================================================================
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const Ecosystem = require("../visualizer/ecosystem.js");

const root = path.join(__dirname, "..");
const exe = path.join(root, "bin", process.platform === "win32" ? "ecosystem_seq.exe" : "ecosystem_seq");
if (!fs.existsSync(exe)) {
  console.error("Compile primero el proyecto (falta " + exe + ")");
  process.exit(1);
}

const norm = (s) => s.replace(/\r/g, "").trim();
let ok = 0, bad = 0;

// 1) Ejemplo del enunciado
const exIn = fs.readFileSync(path.join(root, "tests/inputs/ex_enunciado.in"), "utf8");
const exOut = fs.readFileSync(path.join(root, "tests/expected/ex_enunciado.out"), "utf8");
const e0 = Ecosystem.parse(exIn);
for (let g = 0; g < e0.p.nGen; g++) e0.step();
if (norm(e0.toText()) === norm(exOut)) ok++; else { bad++; console.log("FALLO: ejemplo del enunciado (JS)"); }

// 2) Mundos aleatorios
const N = parseInt(process.argv[2] || "60", 10);
for (let k = 0; k < N; k++) {
  const R = 1 + (k * 7) % 40, C = 1 + (k * 13) % 50;
  const p = { gpr: 1 + k % 5, gpf: 2 + k % 9, gff: 1 + k % 7, nGen: 20 + (k * 11) % 120, R, C };
  const w = Ecosystem.random(p, k % 15, 10 + (k * 3) % 50, 5 + (k * 5) % 25, 1000 + k);
  const input = w.toText(p.nGen);
  for (let g = 0; g < p.nGen; g++) w.step();
  const js = norm(w.toText());
  const cpp = norm(execFileSync(exe, [], { input }).toString());
  if (js === cpp) ok++;
  else { bad++; console.log(`FALLO: mundo ${k} (${R}x${C}, ${p.nGen} gen)`); }
}
console.log(`Validacion cruzada JS vs C++: ${ok} coinciden, ${bad} difieren`);
process.exit(bad ? 1 : 0);
