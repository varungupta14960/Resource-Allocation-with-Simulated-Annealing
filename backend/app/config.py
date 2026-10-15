"""Central configuration. Every value can be overridden by an environment variable."""
import os

# Numerical tolerance used for every feasibility comparison (usage <= capacity + TOL).
TOL = 1e-9

# Exhaustive enumeration is refused when the raw search space  prod_j (U_j - L_j + 2)
# exceeds this many candidate allocations.
EXACT_MAX_SPACE = int(os.getenv("EXACT_MAX_SPACE", "2000000"))

# Safety limits so a mistyped parameter cannot freeze the server.
MAX_SA_ITERATIONS = int(os.getenv("MAX_SA_ITERATIONS", "5000000"))      # one SA run
MAX_TOTAL_ITERATIONS = int(os.getenv("MAX_TOTAL_ITERATIONS", "40000000"))  # one experiment

CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if o.strip()
]
