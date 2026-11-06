#!/usr/bin/env bash
# Grant (or remove) the Admin role for an existing account.
#   ./scripts/set-admin.sh you@vt.edu            make an admin
#   ./scripts/set-admin.sh --remove you@vt.edu   remove admin
# The account must already exist (register in the app first).
# Takes effect on the user's next page load; no need to log out.
set -euo pipefail

action=add
if [[ "${1:-}" == "--remove" ]]; then
  action=remove
  shift
fi

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 [--remove] <email>" >&2
  exit 1
fi

exec "$(dirname "$0")/role.sh" "$action" "$1" Admin
