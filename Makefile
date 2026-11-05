# Makefile - Simulacion de ecosistema (Linux / macOS / MSYS2)
CXX      ?= g++
CXXFLAGS ?= -O3 -march=native -std=c++17 -Wall -Wextra
BIN      := bin

all: $(BIN)/ecosystem_seq $(BIN)/ecosystem_omp $(BIN)/ecosystem_pthreads $(BIN)/gen_input

$(BIN):
	mkdir -p $(BIN)

$(BIN)/ecosystem_seq: src/main_seq.cpp src/ecosystem.cpp src/ecosystem.hpp src/cli.hpp | $(BIN)
	$(CXX) $(CXXFLAGS) src/main_seq.cpp src/ecosystem.cpp -o $@

$(BIN)/ecosystem_omp: src/main_omp.cpp src/ecosystem.cpp src/ecosystem.hpp src/cli.hpp | $(BIN)
	$(CXX) $(CXXFLAGS) -fopenmp src/main_omp.cpp src/ecosystem.cpp -o $@

$(BIN)/ecosystem_pthreads: src/main_pthreads.cpp src/ecosystem.cpp src/ecosystem.hpp src/cli.hpp | $(BIN)
	$(CXX) $(CXXFLAGS) -pthread src/main_pthreads.cpp src/ecosystem.cpp -o $@

$(BIN)/gen_input: tools/gen_input.cpp | $(BIN)
	$(CXX) -O2 -std=c++17 tools/gen_input.cpp -o $@

test: all
	bash scripts/run_tests.sh

bench: all
	bash scripts/benchmark.sh

clean:
	rm -rf $(BIN)

.PHONY: all test bench clean
