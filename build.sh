#!/usr/bin/env bash
# Compila todos los ejecutables en bin/ (Linux, macOS, Git Bash, MSYS2)
set -e
cd "$(dirname "$0")"
CXX=${CXX:-g++}
FLAGS="-O3 -march=native -std=c++17 -Wall -Wextra"
mkdir -p bin
$CXX $FLAGS src/main_seq.cpp src/ecosystem.cpp -o bin/ecosystem_seq
$CXX $FLAGS -fopenmp src/main_omp.cpp src/ecosystem.cpp -o bin/ecosystem_omp
$CXX $FLAGS -pthread src/main_pthreads.cpp src/ecosystem.cpp -o bin/ecosystem_pthreads
$CXX -O2 -std=c++17 tools/gen_input.cpp -o bin/gen_input
echo "Compilacion completa: bin/"
