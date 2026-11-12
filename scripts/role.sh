#!/usr/bin/env bash
# Manage system roles (User, Organizer, Arborist, Admin) in the local database: the
# treefinder-mysql Docker container if it's running, otherwise a local MySQL (e.g. Homebrew)
# reached with the DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME settings in .env.local.
#   ./scripts/role.sh list                      people with roles beyond User
#   ./scripts/role.sh list <email>              one person's roles
#   ./scripts/role.sh add <email> <Role>...     grant one or more roles
#   ./scripts/role.sh remove <email> <Role>...  revoke one or more roles
# The account must already exist (register in the app first).
# Changes apply on the user's next page load; no need to log out.
set -euo pipefail

cd "$(dirname "$0")/.."
CONTAINER=treefinder-mysql
ROLES=(User Organizer Arborist Admin)

# Use the same connection settings as the app (.env.local), defaulting to docker-compose.yml's.
DB_HOST=127.0.0.1 DB_PORT=3306 DB_USER=root DB_PASSWORD=treefinder DB_NAME=volunteer_db
if [[ -f .env.local ]]; then
  for key in DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME; do
    value=$(grep -E "^$key=" .env.local | tail -1 | cut -d= -f2- || true)
    [[ -n "$value" ]] && printf -v "$key" '%s' "$value"
  done
fi

# Run the mysql client (extra arguments are passed through) against whichever database is available.
mysql_client() {
  if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$CONTAINER"; then
    docker exec -i -e MYSQL_PWD="$DB_PASSWORD" "$CONTAINER" mysql -uroot volunteer_db "$@"
  elif command -v mysql >/dev/null 2>&1; then
    MYSQL_PWD="$DB_PASSWORD" mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" "$DB_NAME" "$@"
  else
    echo "Error: MySQL isn't reachable. Start it with \`npm run db:start\` (Docker) or \`brew services start mysql\`." >&2
    exit 1
  fi
}

usage() {
  echo "Usage: $0 list [email] | add <email> <Role>... | remove <email> <Role>..." >&2
  echo "Roles: ${ROLES[*]}" >&2
  exit 1
}

sql() {
  mysql_client --table -e "$1"
}

check_email() {
  # Only plain email characters, so the value is safe to place in SQL.
  [[ "$1" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]+$ ]] || { echo "Error: \"$1\" isn't a valid email." >&2; exit 1; }
  local found
  found=$(mysql_client -N -e "SELECT COUNT(*) FROM Users WHERE Email=LOWER('$1');")
  [[ "$found" == 1 ]] || { echo "Error: no account with email $1. Register in the app first." >&2; exit 1; }
}

check_role() {
  # Case-insensitive match (tr instead of ${1,,}, which macOS's bash 3.2 lacks).
  local given
  given=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
  for role in "${ROLES[@]}"; do
    [[ "$given" == "$(printf '%s' "$role" | tr '[:upper:]' '[:lower:]')" ]] && { echo "$role"; return; }
  done
  echo "Error: unknown role \"$1\". Choose from: ${ROLES[*]}" >&2
  exit 1
}

show() {
  sql "SELECT u.UserID, CONCAT(u.FName, ' ', u.LName) AS Name, u.Email,
         GROUP_CONCAT(r.RoleName ORDER BY r.RoleID SEPARATOR ', ') AS Roles
       FROM Users u LEFT JOIN UserRole ur ON ur.UserID=u.UserID LEFT JOIN Role r ON r.RoleID=ur.RoleID
       WHERE u.Email=LOWER('$1') GROUP BY u.UserID;"
}

command=${1:-}
case "$command" in
  list)
    if [[ $# -ge 2 ]]; then
      check_email "$2"
      show "$2"
    else
      sql "SELECT CONCAT(u.FName, ' ', u.LName) AS Name, u.Email,
             GROUP_CONCAT(r.RoleName ORDER BY r.RoleID SEPARATOR ', ') AS Roles
           FROM Users u JOIN UserRole ur ON ur.UserID=u.UserID JOIN Role r ON r.RoleID=ur.RoleID
           GROUP BY u.UserID HAVING SUM(r.RoleName <> 'User') > 0 ORDER BY Roles DESC, u.Email;"
    fi
    ;;
  add|remove)
    [[ $# -ge 3 ]] || usage
    email=$2
    shift 2
    sql "SELECT 1;" >/dev/null
    check_email "$email"
    for given in "$@"; do
      role=$(check_role "$given")
      if [[ "$command" == add ]]; then
        sql "INSERT IGNORE INTO UserRole (UserID, RoleID)
             SELECT u.UserID, r.RoleID FROM Users u JOIN Role r ON r.RoleName='$role' WHERE u.Email=LOWER('$email');"
        echo "Granted $role to $email."
      else
        [[ "$role" == User ]] && { echo "Error: every account keeps the base User role." >&2; exit 1; }
        sql "DELETE ur FROM UserRole ur JOIN Users u ON u.UserID=ur.UserID JOIN Role r ON r.RoleID=ur.RoleID
             WHERE u.Email=LOWER('$email') AND r.RoleName='$role';"
        echo "Removed $role from $email."
      fi
    done
    show "$email"
    ;;
  *)
    usage
    ;;
esac
