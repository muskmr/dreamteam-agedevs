#!/usr/bin/env bash
# Stop/remove the DreamTeam single-container Podman app.
set -euo pipefail

CONTAINER="${DREAMTEAM_CONTAINER:-dreamteam-app}"

if podman container exists "$CONTAINER" >/dev/null 2>&1; then
  echo "==> Stopping ${CONTAINER}"
  podman rm -f "$CONTAINER"
  echo "==> Done"
else
  echo "==> No container named ${CONTAINER}"
fi
