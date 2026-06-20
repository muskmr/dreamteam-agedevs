#!/bin/bash
# afterFileEdit hook: format the edited file with the project's local Prettier.
# Fails open so a formatting hiccup never blocks an edit.

input=$(cat)

file_path=$(printf '%s' "$input" | jq -r '.file_path // empty')
[ -z "$file_path" ] && exit 0
[ -f "$file_path" ] || exit 0

prettier_bin="node_modules/.bin/prettier"
[ -x "$prettier_bin" ] || exit 0

# --ignore-unknown lets Prettier silently skip files it can't parse,
# so we don't need a matcher to filter by extension.
"$prettier_bin" --write --ignore-unknown "$file_path" >/dev/null 2>&1

exit 0
