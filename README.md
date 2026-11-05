# Simulación de ecosistema: zorros, conejos y rocas


# IMPORTANTE!!
**EL INFORME QUE MANDAMOS POR EL BRIGHTSPACE NO ESTA ACTUALIZADO, ADJUNTAMOS EL INFORME ACTUALIZADO A ESTE REPOSITORIO DENTRO DE LA CARPETA report EL INFORME SE 
LLAMA INFORME_FINAL.tex**

Proyecto de Computación Paralela. Simulación de un ecosistema depredador–presa sobre una matriz de
`R × C` celdas, con:

- una **versión secuencial** (C++17),
- dos **versiones paralelas de memoria compartida**: **OpenMP** y **Pthreads**,
- un **visualizador web** interactivo (grilla, estadísticas, parámetros ajustables y controles de tiempo),
- pruebas de corrección, scripts de benchmark y un **informe en LaTeX**.

## Estructura del repositorio

```
.
├── src/                    Código fuente C++
│   ├── ecosystem.hpp/.cpp  Núcleo: reglas, E/S y kernels por rango de filas
│   ├── cli.hpp             Argumentos, estadísticas (CSV) y temporizador
│   ├── main_seq.cpp        Versión secuencial
│   ├── main_omp.cpp        Versión paralela OpenMP
│   └── main_pthreads.cpp   Versión paralela Pthreads (bloques estáticos de filas)
├── tools/gen_input.cpp     Generador de mundos aleatorios (formato del enunciado)
├── tests/
│   ├── inputs/             Entradas de prueba (*.in): ejemplo del enunciado + casos oficiales
│   ├── expected/           Salidas esperadas (*.out)
│   └── allgen/             Evolución generación por generación de los casos oficiales
├── ecosistemas/            Casos de prueba oficiales del curso (copia original)
├── scripts/
│   ├── run_tests.sh        Pruebas de corrección (esperado + paralelo vs. secuencial)
│   ├── crosscheck.js       Validación cruzada C++ vs. motor JavaScript independiente
│   ├── benchmark.sh        Medición de tiempos y speedup -> report/data/*.csv
│   └── population.sh       Series de población para el informe -> report/data/pop_*.csv
├── visualizer/             Visualizador web (abrir index.html en el navegador)
├── report/                 Informe LaTeX (main.tex), datos (data/) y figuras (figures/)
├── build.sh / build.ps1    Compilación sin make (Linux/Git Bash / PowerShell)
├── Makefile, CMakeLists.txt
└── README.md
```

## Compilación

Requiere un compilador C++17 con soporte de OpenMP (GCC ≥ 9, MinGW-w64, Clang con libomp).

```bash
make            # Linux / macOS / MSYS2
bash build.sh   # alternativa sin make (también en Git Bash de Windows)
```

```powershell
.\build.ps1     # Windows PowerShell (MinGW-w64 g++ en el PATH)
```

Con CMake: `cmake -B build && cmake --build build`. Los ejecutables quedan en `bin/`.

## Uso

La entrada se lee de la **entrada estándar** y el estado final se escribe en la **salida estándar**,
con el formato del enunciado:

```bash
./bin/ecosystem_seq      < tests/inputs/ex_enunciado.in
./bin/ecosystem_omp -t 8 < tests/inputs/200x200.in
./bin/ecosystem_pthreads -t 8 < tests/inputs/200x200.in
```

Opciones (todas son opcionales y no alteran la salida estándar):

| Opción | Descripción |
|---|---|
| `-t, --threads N` | Número de hilos (versiones paralelas). |
| `-s, --stats FILE` | Guarda la población (`gen,rabbits,foxes`) de cada generación en un CSV. |
| `--time` | Muestra en *stderr* el tiempo de simulación (sin contar la lectura/escritura). |
| `-g, --print-grid` | Dibuja la matriz en cada generación (en *stderr*), como en el enunciado. |

La planificación de OpenMP se elige con `OMP_SCHEDULE` sin recompilar (por defecto `static`):

```bash
OMP_SCHEDULE="dynamic,16" ./bin/ecosystem_omp -t 16 < mundo.in
OMP_SCHEDULE="guided"     ./bin/ecosystem_omp -t 16 < mundo.in
```

### Generar mundos grandes

```bash
# gen_input R C N_GEN %ROCAS %CONEJOS %ZORROS GEN_PROC_RABBITS GEN_PROC_FOXES GEN_FOOD_FOXES [SEMILLA]
./bin/gen_input 1000 1000 500 5 30 5 5 12 12 7 > mundo.in
```

## Pruebas

```bash
bash scripts/run_tests.sh      # 232 comprobaciones
node scripts/crosscheck.js     # C++ vs. implementación JavaScript independiente
```

`run_tests.sh` compara las tres versiones con las salidas esperadas: el ejemplo del enunciado y los 7 casos
oficiales (5×5, 10×10, 20×20, 100×100, dos 100×100 desbalanceados y 200×200). Además, verifica que las
versiones paralelas (1–16 hilos; planificaciones `static`, `dynamic` y `guided`) producen **exactamente** la
misma salida que la secuencial en mundos aleatorios. Para añadir un caso, coloque `X.in` en `tests/inputs/` y
`X.out` en `tests/expected/`.

## Visualizador

Abra `visualizer/index.html` en cualquier navegador moderno (no requiere servidor ni conexión a Internet).

- **Grilla** con todas las entidades. Al pasar el ratón sobre una celda se muestran su edad y su hambre.
- **Estadísticas**: contadores, gráfica de población por generación (con cursor) y tabla.
- **Parámetros ajustables**: tamaño, porcentajes iniciales de rocas, conejos y zorros, semilla, y las tasas
  `GEN_PROC_RABBITS`, `GEN_PROC_FOXES` y `GEN_FOOD_FOXES`, que también se pueden aplicar *en caliente*.
- **Controles de tiempo**: reproducir/pausar, paso a paso, más lento/más rápido, reiniciar.
  Atajos: `Espacio`, `→`, `+`, `−`, `R`.
- **Archivos**: cargar una entrada (por ejemplo, `ecosistemas/input100x100`), descargar el estado actual
  (mismo formato) y las estadísticas en CSV.

El motor del visualizador (`visualizer/ecosystem.js`) es una implementación independiente de las reglas.
`scripts/crosscheck.js` comprueba que coincide con la versión C++.

## Benchmark e informe

```bash
bash scripts/benchmark.sh 3    # 3 repeticiones por punto; resultados en report/data/
bash scripts/population.sh     # series de población para el informe
```

El informe está en `report/main.tex`. Las tablas y gráficas se generan con `pgfplots` directamente
a partir de los CSV de `report/data/`, de modo que, si se vuelve a ejecutar el benchmark, basta con
recompilar el informe:

```bash
cd report && pdflatex main.tex && pdflatex main.tex
```

(También se puede subir la carpeta `report/` completa a Overleaf.)

## Interpretación de las reglas

Las siguientes decisiones reproducen exactamente el ejemplo del enunciado y los 7 casos oficiales:

- En cada generación se mueven primero todos los conejos y luego todos los zorros. Dentro de cada sub-fase,
  todas las decisiones se toman sobre la instantánea del mundo al inicio de la sub-fase (movimiento simultáneo).
- `X` es la fila e `Y` la columna. Las celdas candidatas se numeran en orden horario N, E, S, O, y se elige la
  `(G + X + Y) mod P`.
- Al inicio de su sub-fase, cada animal incrementa su edad de procreación (y el zorro, su hambre).
- Un animal procrea si **se mueve** y su edad es `> GEN_PROC_*`. La cría queda en la celda de origen, y
  ambos quedan con edad 0.
- Si un zorro no tiene un conejo adyacente y su hambre es `>= GEN_FOOD_FOXES`, muere antes de moverse.
  Al comer, su hambre vuelve a 0.
- En los conflictos se comparan los valores con los que cada animal llegaría a la celda (es decir, después de
  aplicar el reinicio por procreación o por comida). Gana la mayor edad de procreación y, entre zorros con la
  misma edad, el menos hambriento.
- La salida tiene el mismo formato que la entrada, con `N_GEN = 0` y los objetos en orden de fila.
