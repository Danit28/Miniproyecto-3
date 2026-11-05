// ============================================================================
//  main_omp.cpp  -  Version PARALELA con OpenMP (memoria compartida)
//
//  - Una sola region paralela para toda la simulacion (los hilos se crean
//    una vez, no en cada generacion).
//  - Cada paso (decidir / resolver) es un "omp for" sobre las filas; la
//    barrera implicita al final de cada "omp for" sincroniza los pasos.
//  - schedule(runtime): la planificacion se elige con la variable de entorno
//    OMP_SCHEDULE (static, dynamic,k, guided,k) sin recompilar. Las
//    planificaciones dynamic/guided reparten las filas de forma adaptativa
//    para balancear la carga entre hilos.
// ============================================================================
#include <omp.h>

#include "cli.hpp"

int main(int argc, char** argv) {
    eco::Options opt = eco::parse_args(argc, argv);
    if (opt.threads > 0) omp_set_num_threads(opt.threads);
    // Si OMP_SCHEDULE no esta definida, libgomp usaria "dynamic,1" (un reparto
    // atomico por fila), que tiene mucho overhead: por defecto usamos static.
    if (!std::getenv("OMP_SCHEDULE")) omp_set_schedule(omp_sched_static, 0);

    eco::Simulation sim;
    eco::load_or_die(sim);
    eco::StatsWriter stats(opt.stats_file);
    const bool want_counts = stats.enabled();
    const int R = sim.p.R;
    const int NG = sim.p.n_gen;

    if (opt.print_grid) sim.print_grid(stderr, 0);
    stats.add(0, sim.count());

    long rabbits = 0, foxes = 0;
    int nthreads = 1;
    eco::Timer timer;

#pragma omp parallel
    {
#pragma omp single
        nthreads = omp_get_num_threads();

        for (int G = 0; G < NG; ++G) {
#pragma omp for schedule(runtime)
            for (int r = 0; r < R; ++r) sim.rabbits_decide(G, r, r + 1);

#pragma omp for schedule(runtime)
            for (int r = 0; r < R; ++r) sim.rabbits_resolve(r, r + 1);

#pragma omp for schedule(runtime)
            for (int r = 0; r < R; ++r) sim.foxes_decide(G, r, r + 1);

#pragma omp for schedule(runtime)
            for (int r = 0; r < R; ++r) sim.foxes_resolve(r, r + 1);

            if (want_counts) {
#pragma omp single
                rabbits = foxes = 0;  // barrera implicita al final del single

#pragma omp for schedule(static) reduction(+ : rabbits, foxes)
                for (int r = 0; r < R; ++r) {
                    const eco::Counts c = sim.count_rows(r, r + 1);
                    rabbits += c.rabbits;
                    foxes += c.foxes;
                }

#pragma omp single
                {
                    eco::Counts c;
                    c.rabbits = rabbits;
                    c.foxes = foxes;
                    stats.add(G + 1, c);
                }
            }
            if (opt.print_grid) {
#pragma omp single
                sim.print_grid(stderr, G + 1);
            }
        }
    }
    const double secs = timer.seconds();

    sim.write(stdout);
    if (opt.time)
        std::fprintf(stderr, "time %.6f s (openmp, %d threads)\n", secs, nthreads);
    return 0;
}
