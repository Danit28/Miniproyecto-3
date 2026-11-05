// ============================================================================
//  gen_input.cpp  -  Generador de mundos aleatorios en el formato del enunciado
//
//  Uso:
//    gen_input R C N_GEN %ROCKS %RABBITS %FOXES GPR GPF GFF [SEED] > mundo.in
//
//  Los porcentajes son de 0 a 100 y se aplican sobre el total de celdas.
//  Con la misma semilla siempre se genera el mismo mundo.
// ============================================================================
#include <cstdio>
#include <cstdlib>
#include <random>
#include <vector>

int main(int argc, char** argv) {
    if (argc < 10) {
        std::fprintf(stderr,
                     "Uso: %s R C N_GEN %%ROCKS %%RABBITS %%FOXES GPR GPF GFF [SEED]\n",
                     argv[0]);
        return 2;
    }
    const int R = std::atoi(argv[1]);
    const int C = std::atoi(argv[2]);
    const int NG = std::atoi(argv[3]);
    const double pRock = std::atof(argv[4]) / 100.0;
    const double pRab = std::atof(argv[5]) / 100.0;
    const double pFox = std::atof(argv[6]) / 100.0;
    const int gpr = std::atoi(argv[7]);
    const int gpf = std::atoi(argv[8]);
    const int gff = std::atoi(argv[9]);
    const unsigned seed = argc > 10 ? static_cast<unsigned>(std::atoi(argv[10])) : 42u;

    std::mt19937_64 rng(seed);
    std::uniform_real_distribution<double> U(0.0, 1.0);

    // 0 vacio, 1 roca, 2 conejo, 3 zorro
    std::vector<unsigned char> cell(static_cast<size_t>(R) * C, 0);
    long n = 0;
    for (auto& v : cell) {
        const double u = U(rng);
        if (u < pRock) v = 1;
        else if (u < pRock + pRab) v = 2;
        else if (u < pRock + pRab + pFox) v = 3;
        n += v != 0;
    }

    std::printf("%d %d %d %d %d %d %ld\n", gpr, gpf, gff, NG, R, C, n);
    static const char* name[4] = {"", "ROCK", "RABBIT", "FOX"};
    for (int r = 0; r < R; ++r)
        for (int c = 0; c < C; ++c) {
            const unsigned char v = cell[static_cast<size_t>(r) * C + c];
            if (v) std::printf("%s %d %d\n", name[v], r, c);
        }
    return 0;
}
