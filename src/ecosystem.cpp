// ============================================================================
//  ecosystem.cpp  -  Implementacion de las reglas del ecosistema
// ============================================================================
#include "ecosystem.hpp"

#include <sstream>

namespace eco {

// ----------------------------------------------------------------------------
//  Entrada / salida
// ----------------------------------------------------------------------------
bool Simulation::read(std::istream& in, std::string* err) {
    long n = 0;
    if (!(in >> p.gen_proc_rabbits >> p.gen_proc_foxes >> p.gen_food_foxes >>
          p.n_gen >> p.R >> p.C >> n)) {
        if (err) *err = "no se pudo leer la linea de parametros";
        return false;
    }
    if (p.R <= 0 || p.C <= 0 || n < 0) {
        if (err) *err = "dimensiones o numero de objetos invalidos";
        return false;
    }
    const size_t cells = static_cast<size_t>(p.R) * p.C;
    buf_[0].resize(cells);
    buf_[1].resize(cells);
    mv_.assign(cells, MV_STAY);

    Grid& g = buf_[0];
    std::string kind;
    int x, y;
    for (long k = 0; k < n; ++k) {
        if (!(in >> kind >> x >> y)) {
            if (err) {
                std::ostringstream os;
                os << "objeto " << k << " incompleto";
                *err = os.str();
            }
            return false;
        }
        if (!inside(x, y)) {
            if (err) {
                std::ostringstream os;
                os << "objeto fuera del mundo: " << kind << " " << x << " " << y;
                *err = os.str();
            }
            return false;
        }
        uint8_t t;
        if (kind == "ROCK") t = ROCK;
        else if (kind == "RABBIT") t = RABBIT;
        else if (kind == "FOX") t = FOX;
        else {
            if (err) *err = "tipo de objeto desconocido: " + kind;
            return false;
        }
        const int i = idx(x, y);
        g.type[i] = t;
        g.age[i] = 0;
        g.hunger[i] = 0;
    }
    return true;
}

void Simulation::write(std::FILE* out) const {
    const Grid& g = buf_[0];
    const Counts c = count();
    std::fprintf(out, "%d %d %d %d %d %d %ld\n", p.gen_proc_rabbits,
                 p.gen_proc_foxes, p.gen_food_foxes, 0, p.R, p.C,
                 c.rabbits + c.foxes + c.rocks);
    for (int r = 0; r < p.R; ++r)
        for (int col = 0; col < p.C; ++col) {
            switch (g.type[idx(r, col)]) {
                case ROCK: std::fprintf(out, "ROCK %d %d\n", r, col); break;
                case RABBIT: std::fprintf(out, "RABBIT %d %d\n", r, col); break;
                case FOX: std::fprintf(out, "FOX %d %d\n", r, col); break;
                default: break;
            }
        }
}

void Simulation::print_grid(std::FILE* out, int gen) const {
    const Grid& g = buf_[0];
    std::fprintf(out, "Gen %d\n", gen);
    std::string line(p.C + 2, '-');
    std::fprintf(out, "%s\n", line.c_str());
    for (int r = 0; r < p.R; ++r) {
        std::fputc('|', out);
        for (int c = 0; c < p.C; ++c) {
            static const char sym[4] = {' ', '*', 'R', 'F'};
            std::fputc(sym[g.type[idx(r, c)]], out);
        }
        std::fputs("|\n", out);
    }
    std::fprintf(out, "%s\n", line.c_str());
}

Counts Simulation::count_rows(int r0, int r1) const {
    Counts c;
    const Grid& g = buf_[0];
    for (int i = r0 * p.C, e = r1 * p.C; i < e; ++i) {
        c.rabbits += g.type[i] == RABBIT;
        c.foxes += g.type[i] == FOX;
        c.rocks += g.type[i] == ROCK;
    }
    return c;
}

Counts Simulation::count() const { return count_rows(0, p.R); }

// ----------------------------------------------------------------------------
//  Sub-fase de conejos:  A (buf_[0]) -> B (buf_[1])
//
//  La edad nueva de cada animal (edad + 1) y su hambre nueva se derivan en el
//  paso "resolve" a partir de la instantanea, de modo que el unico dato
//  auxiliar que se comunica entre pasos es la decision mv_ (1 byte/celda).
// ----------------------------------------------------------------------------
void Simulation::rabbits_decide(int G, int r0, int r1) {
    const Grid& a = buf_[0];
    for (int r = r0; r < r1; ++r) {
        for (int c = 0; c < p.C; ++c) {
            const int i = idx(r, c);
            if (a.type[i] != RABBIT) continue;
            // Celdas vacias adyacentes, numeradas en orden horario N, E, S, O
            int dirs[4], P = 0;
            if (r > 0 && a.type[i - p.C] == EMPTY) dirs[P++] = 0;
            if (c + 1 < p.C && a.type[i + 1] == EMPTY) dirs[P++] = 1;
            if (r + 1 < p.R && a.type[i + p.C] == EMPTY) dirs[P++] = 2;
            if (c > 0 && a.type[i - 1] == EMPTY) dirs[P++] = 3;
            mv_[i] = P ? static_cast<int8_t>(dirs[(G + r + c) % P]) : MV_STAY;
        }
    }
}

void Simulation::rabbits_resolve(int r0, int r1) {
    const Grid& a = buf_[0];
    Grid& b = buf_[1];
    const int GP = p.gen_proc_rabbits;
    for (int r = r0; r < r1; ++r) {
        for (int c = 0; c < p.C; ++c) {
            const int i = idx(r, c);
            const uint8_t t = a.type[i];
            b.type[i] = t;
            b.age[i] = a.age[i];
            b.hunger[i] = a.hunger[i];
            if (t == ROCK || t == FOX) continue;  // no cambian en esta fase

            if (t == RABBIT) {
                const int age = inc(a.age[i]);
                if (mv_[i] == MV_STAY) {
                    b.age[i] = age;
                } else if (age > GP) {
                    b.age[i] = 0;  // deja una cria en su ultima posicion
                } else {
                    b.type[i] = EMPTY;
                    b.age[i] = 0;
                }
                continue;
            }

            // Celda vacia: recoger a los conejos que se mueven hacia aqui.
            // Si varios llegan, sobrevive el de mayor edad de procreacion.
            int best = -1;
            int nb[4];
            neighbors(r, c, i, nb);
            for (int d = 0; d < 4; ++d) {
                const int j = nb[d];
                if (j < 0) continue;
                if (a.type[j] != RABBIT || mv_[j] != OPP[d]) continue;
                const int age = inc(a.age[j]);
                const int carried = age > GP ? 0 : age;
                if (carried > best) best = carried;
            }
            if (best >= 0) {
                b.type[i] = RABBIT;
                b.age[i] = best;
            }
        }
    }
}

// ----------------------------------------------------------------------------
//  Sub-fase de zorros:  B (buf_[1]) -> A (buf_[0])
// ----------------------------------------------------------------------------
void Simulation::foxes_decide(int G, int r0, int r1) {
    const Grid& b = buf_[1];
    for (int r = r0; r < r1; ++r) {
        for (int c = 0; c < p.C; ++c) {
            const int i = idx(r, c);
            if (b.type[i] != FOX) continue;

            int rab[4], nR = 0, emp[4], nE = 0;
            int nb[4];
            neighbors(r, c, i, nb);
            for (int d = 0; d < 4; ++d) {
                if (nb[d] < 0) continue;
                const uint8_t t = b.type[nb[d]];
                if (t == RABBIT) rab[nR++] = d;
                else if (t == EMPTY) emp[nE++] = d;
            }
            const int sel = G + r + c;
            if (nR) {  // come un conejo
                mv_[i] = static_cast<int8_t>(rab[sel % nR]);
            } else if (inc(b.hunger[i]) >= p.gen_food_foxes) {  // muere de hambre
                mv_[i] = MV_DIE;
            } else if (nE) {
                mv_[i] = static_cast<int8_t>(emp[sel % nE]);
            } else {
                mv_[i] = MV_STAY;
            }
        }
    }
}

void Simulation::foxes_resolve(int r0, int r1) {
    const Grid& b = buf_[1];
    Grid& a = buf_[0];
    const int GP = p.gen_proc_foxes;
    for (int r = r0; r < r1; ++r) {
        for (int c = 0; c < p.C; ++c) {
            const int i = idx(r, c);
            const uint8_t t = b.type[i];
            a.type[i] = t;
            a.age[i] = b.age[i];
            a.hunger[i] = b.hunger[i];
            if (t == ROCK) continue;

            if (t == FOX) {
                const int8_t m = mv_[i];
                const int age = inc(b.age[i]);
                if (m == MV_DIE) {
                    a.type[i] = EMPTY;
                    a.age[i] = a.hunger[i] = 0;
                } else if (m == MV_STAY) {  // no comio (no habia conejos)
                    a.age[i] = age;
                    a.hunger[i] = inc(b.hunger[i]);
                } else if (age > GP) {  // deja una cria
                    a.age[i] = 0;
                    a.hunger[i] = 0;
                } else {
                    a.type[i] = EMPTY;
                    a.age[i] = a.hunger[i] = 0;
                }
                continue;
            }

            // Celda vacia o con conejo: recoger a los zorros que llegan.
            // Si habia un conejo, todos los que llegan comieron (hambre 0).
            // Gana el de mayor edad de procreacion; empate -> el menos hambriento.
            const bool ate = (t == RABBIT);
            int bestAge = -1, bestHun = 0;
            int nb[4];
            neighbors(r, c, i, nb);
            for (int d = 0; d < 4; ++d) {
                const int j = nb[d];
                if (j < 0) continue;
                if (b.type[j] != FOX || mv_[j] != OPP[d]) continue;
                const int age = inc(b.age[j]);
                const int carried = age > GP ? 0 : age;
                const int hun = ate ? 0 : inc(b.hunger[j]);
                if (carried > bestAge || (carried == bestAge && hun < bestHun)) {
                    bestAge = carried;
                    bestHun = hun;
                }
            }
            if (bestAge >= 0) {  // un zorro ocupa la celda (y se come al conejo)
                a.type[i] = FOX;
                a.age[i] = bestAge;
                a.hunger[i] = bestHun;
            }
        }
    }
}

}  // namespace eco
