#!/usr/bin/env bash
# Drive write + CPU/RAM load at a Loonaris cluster so the metrics curves move.
#
# Usage:
#   ./run.sh '<connection-string>' [clients] [duration_seconds]
#
# Example:
#   ./run.sh 'postgresql://sk_live_..._rw@<gateway-host>:5432/app?sslmode=disable' 12 240
#
# Requires pgbench (apt install postgresql-client). Each transaction inserts 500
# rows and runs a hash-aggregate/sort, so a handful of clients pegs the primary
# at its 500m CPU pod limit within seconds. Writes only hit the primary; replicas
# stay cool (they just apply WAL).
set -euo pipefail

CS="${1:?connection string required}"
CLIENTS="${2:-12}"
DURATION="${3:-240}"
THREADS=$(( CLIENTS < 4 ? CLIENTS : 4 ))
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Make sure the target table exists before pgbench fans out.
psql "$CS" -v ON_ERROR_STOP=1 -c \
  "CREATE TABLE IF NOT EXISTS load_test (id bigserial PRIMARY KEY, ts timestamptz DEFAULT now(), k int, payload text);"

echo "Running load: ${CLIENTS} clients / ${THREADS} threads for ${DURATION}s..."
pgbench -n -f "$HERE/load.sql" -c "$CLIENTS" -j "$THREADS" -T "$DURATION" -P 15 "$CS"
