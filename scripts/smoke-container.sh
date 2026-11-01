#!/usr/bin/env bash
set -euo pipefail

image=${1:?Usage: smoke-container.sh IMAGE}
prefix="zello-client-smoke-$$"
scratch=$(mktemp -d)
cleanup() {
  result=$?
  if (( result != 0 )); then docker logs "$prefix-app" 2>&1 || true; fi
  docker rm -fv "$prefix-app" "$prefix-api" >/dev/null 2>&1 || true
  docker network rm "$prefix" >/dev/null 2>&1 || true
  rm -rf "$scratch"
}
trap cleanup EXIT

runtime_user=$(docker image inspect --format '{{.Config.User}}' "$image")
case "$runtime_user" in ''|root|0|0:*) echo 'Container must run as a non-root user' >&2; exit 1 ;; esac
cat > "$scratch/upstream.conf" <<'NGINX'
server {
    listen 8080;
    location / {
        default_type application/json;
        return 200 '{"uri":"$request_uri","scheme":"$http_x_forwarded_proto"}';
    }
}
NGINX
chmod 755 "$scratch"
chmod 644 "$scratch/upstream.conf"
docker network create "$prefix" >/dev/null
docker run -d --name "$prefix-api" --network "$prefix" --network-alias mock-api \
  --mount "type=bind,src=$scratch/upstream.conf,dst=/etc/nginx/conf.d/default.conf,readonly" \
  --entrypoint nginx "$image" -g 'daemon off;' >/dev/null
docker run -d --name "$prefix-app" --network "$prefix" -p 127.0.0.1::8080 \
  -e API_UPSTREAM=http://mock-api:8080 "$image" >/dev/null
binding=$(docker port "$prefix-app" 8080/tcp)
base="http://127.0.0.1:${binding##*:}"
curl --fail --silent --show-error --retry 15 --retry-delay 1 --retry-all-errors \
  --max-time 3 "$base/healthz" >/dev/null
curl --fail --silent --show-error "$base/" > "$scratch/index.html"
python3 -c 'import sys; assert "id=\"root\"" in open(sys.argv[1]).read()' "$scratch/index.html"

for route in '/api/auth/status?smoke=1' '/oauth2/authorization/github' '/login/oauth2/code/github?code=smoke'; do
  curl --fail --silent --show-error -H 'X-Forwarded-Proto: https' "$base$route" > "$scratch/proxy.json"
  python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); assert d == {"uri":sys.argv[2], "scheme":"https"}, d' "$scratch/proxy.json" "$route"
done
asset=$(python3 -c 'import re,sys; print(re.search(r"src=\"(/assets/[^\"]+\.js)\"", open(sys.argv[1]).read())[1])' "$scratch/index.html")
curl --fail --silent --show-error -D "$scratch/headers" -o /dev/null "$base$asset"
python3 -c 'import sys; assert "immutable" in open(sys.argv[1]).read().lower()' "$scratch/headers"
status=$(curl --silent --output /dev/null --write-out '%{http_code}' "$base/assets/missing.js")
test "$status" = 404
echo 'Client container: static pages, asset caching, API/OAuth paths and HTTPS forwarding passed.'
