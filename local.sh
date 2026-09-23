#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if command -v docker-compose >/dev/null; then
  compose=(docker-compose)
else
  compose=(docker compose)
fi
compose+=(--env-file local/.env -f docker-compose.yaml -f docker-compose.local.yaml)
case "${1:-help}" in
  setup)
    if [[ ! -f local/.env ]]; then
      umask 077
      python3 - <<'PY' > local/.env
import secrets
print('POSTGRES_USER=postgres\nPOSTGRES_DB=postgres')
print('POSTGRES_PASSWORD=' + secrets.token_hex(32))
print('SEARXNG_SECRET=' + secrets.token_hex(32))
PY
    fi
    echo 'Local configuration ready.'
    ;;
  start) DOCKER_BUILDKIT=1 "${compose[@]}" up --build -d ;;
  stop) "${compose[@]}" down ;;
  status) "${compose[@]}" ps ;;
  logs) "${compose[@]}" logs --tail=80 "${@:2}" ;;
  test) python3 -u local/smoke.py "${@:2}" ;;
  *) echo 'Usage: ./local.sh {setup|start|stop|status|logs [service]|test [--ai]}' ;;
esac
