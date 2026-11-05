#!/usr/bin/env bash
# ============================================================================
#  run_tests.sh - Pruebas de correccion
#   1. Cada archivo tests/inputs/X.in con tests/expected/X.out se compara
#      con la salida de las tres versiones.
#   2. Mundos aleatorios: las versiones paralelas (con 1..N hilos y distintas
#      planificaciones OpenMP) deben producir exactamente la misma salida que
#      la version secuencial.
# ============================================================================
set -u
cd "$(dirname "$0")/.."
BIN=bin
pass=0; fail=0

check() {  # check <descripcion> <archivo_obtenido> <archivo_esperado>
    if diff -q --strip-trailing-cr "$2" "$3" > /dev/null; then
        pass=$((pass + 1))
    else
        fail=$((fail + 1)); echo "FALLO: $1"
    fi
}

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "== Casos con salida esperada =="
for in in tests/inputs/*.in; do
    name=$(basename "$in" .in)
    exp="tests/expected/$name.out"
    [ -f "$exp" ] || continue
    "$BIN/ecosystem_seq" < "$in" > "$TMP/seq.out";               check "$name seq" "$TMP/seq.out" "$exp"
    for t in 1 2 3 4 8; do
        "$BIN/ecosystem_omp" -t $t < "$in" > "$TMP/omp.out";      check "$name omp t=$t" "$TMP/omp.out" "$exp"
        "$BIN/ecosystem_pthreads" -t $t < "$in" > "$TMP/pth.out"; check "$name pthreads t=$t" "$TMP/pth.out" "$exp"
    done
    echo "  $name"
done

echo "== Mundos aleatorios: paralelo vs secuencial =="
#        R    C   NG  %roca %conejo %zorro GPR GPF GFF semilla
CASES=(
  "  10   10   50    5     30     10     2   4   3   1"
  "  37   53  200   10     25     10     3   8   4   2"
  " 100  100  300    3     40      5     2   6   5   3"
  " 200  150  500    8     20     20     4  10   6   4"
  "   1  300  100    0     50     20     1   3   2   5"
  " 300    1  100    0     50     20     1   3   2   6"
)
for c in "${CASES[@]}"; do
    set -- $c
    "$BIN/gen_input" $1 $2 $3 $4 $5 $6 $7 $8 $9 ${10} > "$TMP/w.in"
    "$BIN/ecosystem_seq" < "$TMP/w.in" > "$TMP/seq.out"
    for t in 1 2 3 5 8 16; do
        for sched in static "dynamic,1" "guided,4"; do
            OMP_SCHEDULE=$sched "$BIN/ecosystem_omp" -t $t < "$TMP/w.in" > "$TMP/omp.out"
            check "random($c) omp t=$t $sched" "$TMP/omp.out" "$TMP/seq.out"
        done
        "$BIN/ecosystem_pthreads" -t $t < "$TMP/w.in" > "$TMP/pth.out"
        check "random($c) pthreads t=$t" "$TMP/pth.out" "$TMP/seq.out"
    done
    echo "  ${1}x${2}, ${3} generaciones"
done

echo
echo "Pruebas superadas: $pass   Fallidas: $fail"
[ "$fail" -eq 0 ]
