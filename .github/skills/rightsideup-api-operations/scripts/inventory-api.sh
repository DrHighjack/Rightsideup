#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$repo_root"

printf '%-58s %-22s %-13s %s\n' 'ROUTE' 'METHODS' 'RISK' 'AUTH HEURISTIC'
printf '%s\n' '----------------------------------------------------------------------------------------------------------------------'

while IFS= read -r route_file; do
  route="/${route_file#app/api/}"
  route="${route%/route.ts}"
  methods="$(grep -Eo 'export( async)? function (GET|POST|PUT|PATCH|DELETE)' "$route_file" | sed -E 's/.* function //' | paste -sd, - || true)"
  [[ -n "$methods" ]] || methods='(none found)'

  risk='READ'
  if [[ "$methods" =~ POST|PUT|PATCH|DELETE ]]; then risk='MUTATION'; fi

  auth='inspect handler'
  if grep -Eq 'auth\(\)|CRON_SECRET|Authorization|authorization' "$route_file"; then
    auth='protected/inspect role'
  elif [[ "$route" =~ ^/(auth|leads|smart-sign/\[tagCode\]/tap) ]]; then
    auth='public or external'
  fi

  printf '%-58s %-22s %-13s %s\n' "$route" "$methods" "$risk" "$auth"
done < <(find app/api -name route.ts | sort)
