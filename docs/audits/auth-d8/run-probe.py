#!/usr/bin/env python3
"""Run the D8 read-only diagnostic with a fresh synthetic environment."""
import os
from pathlib import Path
import subprocess
import sys

folder = Path(__file__).resolve().parent
repo = folder.parents[2]
# env.ts calls dotenv.config(): refuse even an implicit local credential read.
if (repo / '.env').exists() or (repo / '.env').is_symlink():
    sys.exit('Refusing diagnostic in a checkout containing .env')
environment = {
    'PATH': os.environ['PATH'],
    'JWT_SECRET': 'auth-d8-synthetic-jwt',
    'AUTH_CONTRACT_MODE': 'v1',
    'DATABASE_URL': 'postgresql://synthetic:synthetic@127.0.0.1:1/d8_unused',
}
# stdin module imports resolve from the repository root. No Prisma query runs:
# the real issuer receives the synthetic persistence implementation explicitly.
result = subprocess.run(
    ['node', '--import', 'tsx', '--input-type=module'],
    input=(folder / 'probe.mjs').read_text(), text=True, cwd=repo,
    env=environment, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
)
sys.stdout.write(result.stdout)
sys.stderr.write(result.stderr)
sys.exit(result.returncode)
