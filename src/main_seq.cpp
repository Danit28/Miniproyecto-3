// ============================================================================
//  main_seq.cpp  -  Version SECUENCIAL de la simulacion
// ============================================================================
#include "cli.hpp"

int main(int argc, char** argv) {
    eco::Options opt = eco::parse_args(argc, argv);
    eco::Simulation sim;
    eco::load_or_die(sim);
    eco::StatsWriter stats(opt.stats_file);

    if (opt.print_grid) sim.print_grid(stderr, 0);
    stats.add(0, sim.count());

    eco::Timer timer;
    for (int G = 0; G < sim.p.n_gen; ++G) {
        sim.step_sequential(G);
        if (stats.enabled()) stats.add(G + 1, sim.count());
        if (opt.print_grid) sim.print_grid(stderr, G + 1);
    }
    const double secs = timer.seconds();

    sim.write(stdout);
    if (opt.time) std::fprintf(stderr, "time %.6f s (sequential)\n", secs);
    return 0;
}
