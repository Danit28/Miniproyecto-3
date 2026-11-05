// ============================================================================
//  cli.hpp  -  Utilidades compartidas por los ejecutables
//             (argumentos, lectura de stdin, estadisticas y tiempo)
// ============================================================================
#pragma once

#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <string>

#include "ecosystem.hpp"

#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#endif

namespace eco {

struct Options {
    int threads = 0;            // 0 = valor por defecto de la implementacion
    std::string stats_file;     // CSV con la poblacion por generacion
    bool time = false;          // imprime el tiempo de simulacion en stderr
    bool print_grid = false;    // imprime la matriz en cada generacion (stderr)
};

inline void usage(const char* prog) {
    std::fprintf(stderr,
                 "Uso: %s [opciones] < entrada.txt > salida.txt\n"
                 "  -t, --threads N   numero de hilos (versiones paralelas)\n"
                 "  -s, --stats FILE  guarda la poblacion por generacion en CSV\n"
                 "      --time        muestra el tiempo de simulacion en stderr\n"
                 "  -g, --print-grid  dibuja la matriz en cada generacion (stderr)\n"
                 "  -h, --help        muestra esta ayuda\n",
                 prog);
}

inline Options parse_args(int argc, char** argv) {
#ifdef _WIN32
    // Salida con fin de linea '\n' (igual que en Linux) para poder comparar
    // directamente con los archivos esperados.
    _setmode(_fileno(stdout), _O_BINARY);
#endif
    Options o;
    for (int k = 1; k < argc; ++k) {
        const char* a = argv[k];
        auto need = [&](const char* name) -> const char* {
            if (k + 1 >= argc) {
                std::fprintf(stderr, "Falta el valor de %s\n", name);
                std::exit(2);
            }
            return argv[++k];
        };
        if (!std::strcmp(a, "-t") || !std::strcmp(a, "--threads"))
            o.threads = std::atoi(need(a));
        else if (!std::strcmp(a, "-s") || !std::strcmp(a, "--stats"))
            o.stats_file = need(a);
        else if (!std::strcmp(a, "--time"))
            o.time = true;
        else if (!std::strcmp(a, "-g") || !std::strcmp(a, "--print-grid"))
            o.print_grid = true;
        else if (!std::strcmp(a, "-h") || !std::strcmp(a, "--help")) {
            usage(argv[0]);
            std::exit(0);
        } else {
            std::fprintf(stderr, "Opcion desconocida: %s\n", a);
            usage(argv[0]);
            std::exit(2);
        }
    }
    return o;
}

inline void load_or_die(Simulation& sim) {
    std::ios::sync_with_stdio(false);
    std::string err;
    if (!sim.read(std::cin, &err)) {
        std::fprintf(stderr, "Error leyendo la entrada: %s\n", err.c_str());
        std::exit(1);
    }
}

// Escritor de estadisticas: gen,rabbits,foxes
class StatsWriter {
public:
    explicit StatsWriter(const std::string& path) {
        if (path.empty()) return;
        f_ = std::fopen(path.c_str(), "w");
        if (!f_) {
            std::fprintf(stderr, "No se pudo abrir %s\n", path.c_str());
            std::exit(1);
        }
        std::fprintf(f_, "gen,rabbits,foxes\n");
    }
    ~StatsWriter() {
        if (f_) std::fclose(f_);
    }
    bool enabled() const { return f_ != nullptr; }
    void add(int gen, const Counts& c) {
        if (f_) std::fprintf(f_, "%d,%ld,%ld\n", gen, c.rabbits, c.foxes);
    }

private:
    std::FILE* f_ = nullptr;
};

class Timer {
public:
    Timer() : t0_(std::chrono::steady_clock::now()) {}
    double seconds() const {
        return std::chrono::duration<double>(std::chrono::steady_clock::now() - t0_)
            .count();
    }

private:
    std::chrono::steady_clock::time_point t0_;
};

}  // namespace eco
