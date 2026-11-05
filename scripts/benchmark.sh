#!/usr/bin/env bash
# ============================================================================
#  benchmark.sh - Mide tiempos de la version secuencial y las paralelas.
#
#  Genera, para cada tamano de mundo, dos archivos en report/data/:
#    times_<R>x<C>.csv    tiempo (s) por numero de hilos y version
#    speedup_<R>x<C>.csv  speedup = T_secuencial / T_paralelo
#  y ademas pop_<R>x<C>.csv con la poblacion por generacion.
#
#  Uso: bash scripts/benchmark.sh [repeticiones]   (por defecto 3, se toma el minimo)
#  Variables: THREADS="1 2 4 8 16 32"  SIZES="1000x1000:500 2000x2000:200"
# ============================================================================
set -eu
cd "$(dirname "$0")/.."
BIN=bin
OUT=report/data
REPS=${1:-3}
THREADS=${THREADS:-"1 2 4 8 12 16 24 32"}
SIZES=${SIZES:-"500x500:1000 1000x1000:500 2000x2000:200"}
# Parametros del mundo: %roca %conejo %zorro GPR GPF GFF semilla
WORLD=${WORLD:-"5 30 5 5 12 12 7"}
mkdir -p "$OUT"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Ejecuta "$@" REPS veces y devuelve el menor tiempo reportado con --time
best_time() {
    local best=""
    for ((k = 0; k < REPS; k++)); do
        local t
        t=$("$@" --time < "$TMP/w.in" 2>&1 >/dev/null | awk '/^time/{print $2}')
        if [ -z "$best" ] || awk "BEGIN{exit !($t < $best)}"; then best=$t; fi
    done
    echo "$best"
}

for spec in $SIZES; do
    size=${spec%%:*}; NG=${spec##*:}
    R=${size%%x*}; C=${size##*x}
    set -- $WORLD
    "$BIN/gen_input" "$R" "$C" "$NG" "$@" > "$TMP/w.in"
    echo "== Mundo ${R}x${C}, $NG generaciones =="

    "$BIN/ecosystem_seq" -s "$OUT/pop_${size}.csv" < "$TMP/w.in" > /dev/null
    tseq=$(best_time "$BIN/ecosystem_seq")
    echo "  secuencial: $tseq s"

    times="$OUT/times_${size}.csv"
    speed="$OUT/speedup_${size}.csv"
    echo "threads,seq,omp_static,omp_dynamic,omp_guided,pthreads" > "$times"
    echo "threads,ideal,omp_static,omp_dynamic,omp_guided,pthreads" > "$speed"
    for t in $THREADS; do
        ts=$(OMP_SCHEDULE=static     best_time "$BIN/ecosystem_omp" -t "$t")
        td=$(OMP_SCHEDULE=dynamic,16 best_time "$BIN/ecosystem_omp" -t "$t")
        tg=$(OMP_SCHEDULE=guided     best_time "$BIN/ecosystem_omp" -t "$t")
        tp=$(best_time "$BIN/ecosystem_pthreads" -t "$t")
        echo "$t,$tseq,$ts,$td,$tg,$tp" >> "$times"
        awk -v t="$t" -v s="$tseq" -v a="$ts" -v b="$td" -v c="$tg" -v d="$tp" \
            'BEGIN{printf "%d,%d,%.3f,%.3f,%.3f,%.3f\n", t, t, s/a, s/b, s/c, s/d}' >> "$speed"
        echo "  t=$t  static=$ts  dynamic=$td  guided=$tg  pthreads=$tp"
    done
done
echo "Resultados en $OUT/"
