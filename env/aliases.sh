# Shell aliases for local/dev service URLs.
# Usage:  source env/aliases.sh
# Override any value before sourcing, or export afterward.

: "${API_PORT:=3001}"
: "${WEB_PORT:=5173}"
: "${OLLAMA_PORT:=11434}"
: "${DREAMTEAM_HOST:=127.0.0.1}"

export API_PORT WEB_PORT OLLAMA_PORT DREAMTEAM_HOST
export API_URL="${API_URL:-http://${DREAMTEAM_HOST}:${API_PORT}}"
export WEB_URL="${WEB_URL:-http://${DREAMTEAM_HOST}:${WEB_PORT}}"
export OLLAMA_URL="${OLLAMA_URL:-http://${DREAMTEAM_HOST}:${OLLAMA_PORT}}"
export PORT="${PORT:-$API_PORT}"
