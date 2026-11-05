// ============================================================================
//  main_pthreads.cpp  -  Version PARALELA con Pthreads
//
//  Descomposicion estatica por bloques de filas: cada hilo (worker) es
//  responsable de una porcion fija del mundo. Entre pasos se usa una
//  pthread_barrier para que los movimientos que cruzan la frontera entre dos
//  workers sean visibles para el vecino antes de resolver conflictos.
// ============================================================================
#include <pthread.h>

#include <thread>
#include <vector>

#include "cli.hpp"

namespace {

struct Shared {
    eco::Simulation* sim;
    eco::StatsWriter* stats;
    pthread_barrier_t barrier;
    int nthreads;
    bool print_grid;
    std::vector<eco::Counts> partial;  // conteo parcial por hilo
};

struct Worker {
    Shared* sh;
    int id;
};

void* worker_main(void* arg) {
    Worker* w = static_cast<Worker*>(arg);
    Shared& sh = *w->sh;
    eco::Simulation& sim = *sh.sim;
    const int R = sim.p.R;
    // Bloque de filas [r0, r1) de este worker
    const int r0 = static_cast<int>(static_cast<long long>(R) * w->id / sh.nthreads);
    const int r1 = static_cast<int>(static_cast<long long>(R) * (w->id + 1) / sh.nthreads);
    const bool counts = sh.stats->enabled();

    for (int G = 0; G < sim.p.n_gen; ++G) {
        sim.rabbits_decide(G, r0, r1);
        pthread_barrier_wait(&sh.barrier);
        sim.rabbits_resolve(r0, r1);
        pthread_barrier_wait(&sh.barrier);
        sim.foxes_decide(G, r0, r1);
        pthread_barrier_wait(&sh.barrier);
        sim.foxes_resolve(r0, r1);
        if (counts) sh.partial[w->id] = sim.count_rows(r0, r1);
        pthread_barrier_wait(&sh.barrier);

        if ((counts || sh.print_grid) && w->id == 0) {
            if (counts) {
                eco::Counts total;
                for (const eco::Counts& c : sh.partial) {
                    total.rabbits += c.rabbits;
                    total.foxes += c.foxes;
                }
                sh.stats->add(G + 1, total);
            }
            if (sh.print_grid) sim.print_grid(stderr, G + 1);
        }
        // Barrera extra solo si el hilo 0 hace trabajo serial entre generaciones
        if (sh.print_grid) pthread_barrier_wait(&sh.barrier);
    }
    return nullptr;
}

}  // namespace

int main(int argc, char** argv) {
    eco::Options opt = eco::parse_args(argc, argv);
    int T = opt.threads > 0 ? opt.threads
                            : static_cast<int>(std::thread::hardware_concurrency());
    if (T <= 0) T = 1;

    eco::Simulation sim;
    eco::load_or_die(sim);
    if (T > sim.p.R) T = sim.p.R;  // al menos una fila por worker
    eco::StatsWriter stats(opt.stats_file);

    if (opt.print_grid) sim.print_grid(stderr, 0);
    stats.add(0, sim.count());

    Shared sh;
    sh.sim = &sim;
    sh.stats = &stats;
    sh.nthreads = T;
    sh.print_grid = opt.print_grid;
    sh.partial.assign(T, eco::Counts{});
    pthread_barrier_init(&sh.barrier, nullptr, T);

    std::vector<pthread_t> th(T);
    std::vector<Worker> ws(T);

    eco::Timer timer;
    for (int k = 0; k < T; ++k) {
        ws[k] = Worker{&sh, k};
        pthread_create(&th[k], nullptr, worker_main, &ws[k]);
    }
    for (int k = 0; k < T; ++k) pthread_join(th[k], nullptr);
    const double secs = timer.seconds();

    pthread_barrier_destroy(&sh.barrier);
    sim.write(stdout);
    if (opt.time) std::fprintf(stderr, "time %.6f s (pthreads, %d threads)\n", secs, T);
    return 0;
}
