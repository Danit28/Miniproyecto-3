#!/usr/bin/env bash
# ============================================================================
#  population.sh - Genera las series de poblacion usadas en el informe
#  (report/data/pop_*.csv) variando un parametro a la vez.
# ============================================================================
set -eu
cd "$(dirname "$0")/.."
OUT=report/data
mkdir -p "$OUT"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

R=200; C=200; NG=${NG:-1500}
# nombre               GPR GPF GFF
RUNS=(
  "ciclos               5  15  10"
  "gff6                 5  15   6"
  "gff16                5  15  16"
  "gpr2                 2  15  10"
  "gpr9                 9  15  10"
)
for run in "${RUNS[@]}"; do
    set -- $run
    bin/gen_input $R $C $NG 5 30 5 "$2" "$3" "$4" 7 > "$TMP/w.in"
    bin/ecosystem_omp -s "$TMP/raw.csv" < "$TMP/w.in" > /dev/null
    # Agrega una media movil de 12 generaciones (suaviza la oscilacion corta
    # de periodo ~6 debida a los nacimientos sincronizados de los conejos)
    awk -F, -v W=12 'NR==1{print $0",rabbits_avg,foxes_avg"; next}
        {k=NR-2; r[k]=$2; f[k]=$3; sr+=$2; sf+=$3;
         if (k>=W){sr-=r[k-W]; sf-=f[k-W]}
         n=(k+1<W)?k+1:W; printf "%s,%.1f,%.1f\n", $0, sr/n, sf/n}' "$TMP/raw.csv" > "$OUT/pop_$1.csv"
    echo "pop_$1.csv: $(tail -1 "$OUT/pop_$1.csv")"
done
