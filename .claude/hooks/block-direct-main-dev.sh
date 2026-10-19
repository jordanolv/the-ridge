#!/bin/bash
# Refuse commit/push direct sur main et dev. Flow attendu : feat/xxx -> PR -> dev -> PR -> main.

CMD=$(cat | jq -r '.tool_input.command // ""')

# vraie invocation git commit/push uniquement (début de commande ou après ; && || |),
# pas une simple mention dans un grep ou un heredoc
INVOKE='(^|[;&|]|&&|\|\|)[[:space:]]*git[[:space:]]+([-][^[:space:]]+[[:space:]]+|-C[[:space:]]+[^[:space:]]+[[:space:]]+)*(commit|push)([[:space:]]|$)'
echo "$CMD" | grep -qE "$INVOKE" || exit 0

BRANCH=$(git -C "${CLAUDE_PROJECT_DIR:-.}" symbolic-ref --short HEAD 2>/dev/null)

block() {
  echo "BLOQUÉ: $1. Flow du repo (CLAUDE.md) : brancher depuis dev, PR vers dev, puis PR dev -> main." >&2
  exit 2
}

case "$BRANCH" in
  main|dev) block "commit/push direct alors que tu es sur '$BRANCH', branche protégée" ;;
esac

# push explicite vers main/dev depuis n'importe quelle branche (push origin main, HEAD:dev, ...)
if echo "$CMD" | grep -qE 'git[[:space:]]+push([[:space:]]+[^;&|]*)?[[:space:]](main|dev)([[:space:]]|$)|:(main|dev)([[:space:]]|$)'; then
  block "push explicite vers une branche protégée"
fi

exit 0
