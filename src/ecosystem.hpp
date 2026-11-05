// ============================================================================
//  ecosystem.hpp  -  Nucleo comun de la simulacion de ecosistema
//                    (zorros, conejos y rocas)
//
//  Diseno: cada generacion se divide en dos sub-fases (conejos y zorros).
//  Cada sub-fase tiene dos pasos que se ejecutan sobre un rango de filas:
//
//    1. decide  : cada animal calcula, a partir de la instantanea (snapshot)
//                 del mundo, hacia donde se mueve, si come o si muere.
//                 Escribe SOLO en su propia celda del arreglo auxiliar mv.
//    2. resolve : cada celda destino "recoge" (gather/pull) a los animales
//                 vecinos que decidieron moverse hacia ella y aplica las
//                 reglas de resolucion de conflictos. Escribe SOLO su propia
//                 celda del buffer siguiente.
//
//  Como cada celda es escrita por un unico hilo en cada paso, los kernels no
//  necesitan locks ni operaciones atomicas: basta una barrera entre pasos.
//  El resultado es determinista e independiente del numero de hilos.
// ============================================================================
#pragma once

#include <cstdint>
#include <cstdio>
#include <iostream>
#include <string>
#include <vector>

namespace eco {

enum : uint8_t { EMPTY = 0, ROCK = 1, RABBIT = 2, FOX = 3 };

// Codigos de decision (arreglo mv)
constexpr int8_t MV_DIE  = -2;  // el zorro muere de hambre
constexpr int8_t MV_STAY = -1;  // el animal no se mueve
// 0..3 = direccion N, E, S, O (orden horario)

constexpr int OPP[4] = {2, 3, 0, 1};  // direccion opuesta

struct Params {
    int gen_proc_rabbits = 0;
    int gen_proc_foxes = 0;
    int gen_food_foxes = 0;
    int n_gen = 0;
    int R = 0;
    int C = 0;
};

// Estado de un mundo (Structure of Arrays para buena localidad de cache)
// Edades almacenadas en 16 bits (con saturacion en AGE_MAX) para reducir el
// trafico de memoria por celda: 1 + 2 + 2 = 5 bytes por celda y buffer.
using age_t = uint16_t;
constexpr int AGE_MAX = 65535;
inline age_t inc(int v) { return static_cast<age_t>(v < AGE_MAX ? v + 1 : AGE_MAX); }

// Estado de un mundo (Structure of Arrays para buena localidad de cache)
struct Grid {
    std::vector<uint8_t> type;
    std::vector<age_t> age;     // edad de procreacion
    std::vector<age_t> hunger;  // generaciones desde la ultima comida (zorros)

    void resize(size_t n) {
        type.assign(n, EMPTY);
        age.assign(n, 0);
        hunger.assign(n, 0);
    }
};

struct Counts {
    long rabbits = 0, foxes = 0, rocks = 0;
};

class Simulation {
public:
    Params p;

    // Lee el formato del enunciado desde un stream. Devuelve false si falla.
    bool read(std::istream& in, std::string* err = nullptr);
    // Escribe el estado final en el formato del enunciado (N_GEN = 0).
    void write(std::FILE* out) const;
    // Dibuja la matriz como en el enunciado (para depuracion / --print-grid).
    void print_grid(std::FILE* out, int gen) const;

    Counts count() const;

    // ---- kernels por rango de filas [r0, r1) ------------------------------
    void rabbits_decide(int G, int r0, int r1);
    void rabbits_resolve(int r0, int r1);
    void foxes_decide(int G, int r0, int r1);
    void foxes_resolve(int r0, int r1);

    // Conteo parcial de un rango de filas (para estadisticas en paralelo).
    Counts count_rows(int r0, int r1) const;

    // Ejecuta una generacion completa de forma secuencial.
    void step_sequential(int G) {
        rabbits_decide(G, 0, p.R);
        rabbits_resolve(0, p.R);
        foxes_decide(G, 0, p.R);
        foxes_resolve(0, p.R);
    }

private:
    // buf_[0] = estado al inicio/final de la generacion (A)
    // buf_[1] = estado intermedio, despues de mover los conejos (B)
    // Conejos: A -> B, Zorros: B -> A. No hace falta intercambiar punteros.
    Grid buf_[2];
    std::vector<int8_t> mv_;  // decision de cada animal (unico dato auxiliar)

    inline int idx(int r, int c) const { return r * p.C + c; }
    inline bool inside(int r, int c) const {
        return r >= 0 && r < p.R && c >= 0 && c < p.C;
    }
    // Indices de los vecinos N, E, S, O de la celda i=(r,c); -1 si estan fuera
    inline void neighbors(int r, int c, int i, int nb[4]) const {
        nb[0] = r > 0 ? i - p.C : -1;
        nb[1] = c + 1 < p.C ? i + 1 : -1;
        nb[2] = r + 1 < p.R ? i + p.C : -1;
        nb[3] = c > 0 ? i - 1 : -1;
    }
};

}  // namespace eco
