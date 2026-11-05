#!/usr/bin/env bash
# Tests install.sh inside throwaway Ubuntu and Debian containers. Needs Docker and internet access.
# Docker, systemd and ufw can't run in a plain container, so the tests replace them with stubs on
# PATH and assert on what the installer asked of them. One test per OS installs Docker for real.
#
#   deploy/vps/test-installer.sh [image ...]
# shellcheck disable=SC2016
set -euo pipefail

readonly DEFAULT_TEST_IMAGES=(ubuntu:24.04 ubuntu:22.04 debian:12)
readonly INSTALLER="/source/install.sh"
readonly STUBS="/stubs"
readonly CALLS="/tmp/stub-calls"
readonly SERVER_IP="203.0.113.20"
readonly OTHER_IP="203.0.113.99"
readonly OTHER_IPV6="2001:db8::99"
readonly DOMAIN="community.example.test"
readonly ENV_FILE="/opt/community/.env"
readonly PTY_TIMEOUT_SECONDS=60

failures=0
exit_code=0
output=""
current_case=""

describe() { printf '\n%s\n' "$1"; }

it() {
  current_case="$1"
  reset_server
}

pass() { printf '  ok    %s: %s\n' "$current_case" "$1"; }

fail() {
  failures=$((failures + 1))
  printf '  FAIL  %s: %s\n' "$current_case" "$1"
  printf '%s\n' "$output" | tail -n 30 | sed 's/^/        | /'
}

assert_exit() {
  if [ "$exit_code" -eq "$1" ]; then pass "exits $1"; else fail "exits $1, got $exit_code"; fi
}

assert_says() {
  if printf '%s' "$output" | grep -qF -- "$1"; then pass "says \"$1\""; else fail "says \"$1\""; fi
}

assert_never_says() {
  if printf '%s' "$output" | grep -qF -- "$1"; then fail "never says \"$1\""; else pass "never says \"$1\""; fi
}

assert_called() {
  if grep -qF -- "$1" "$CALLS"; then pass "calls \"$1\""; else fail "calls \"$1\""; fi
}

assert_not_called() {
  if grep -qF -- "$1" "$CALLS"; then fail "doesn't call \"$1\""; else pass "doesn't call \"$1\""; fi
}

assert_true() {
  local description="$1"
  shift
  if "$@"; then pass "$description"; else fail "$description"; fi
}

assert_nothing_set_up() {
  if [ ! -e /opt/community ] && [ ! -e /usr/local/bin/community ] && ! grep -q '^docker' "$CALLS"; then
    pass "leaves nothing set up"
  else
    fail "leaves nothing set up"
  fi
}

write_stub() {
  local name="$1" body="$2"
  printf '#!/usr/bin/env bash\nprintf "%%s\\n" "%s $*" >>%s\n%s\n' "$name" "$CALLS" "$body" >"$STUBS/$name"
  chmod +x "$STUBS/$name"
}

install_stubs() {
  mkdir -p "$STUBS"
  write_stub docker '
args="$*"
[ -z "${STUB_DOCKER_DOWN:-}" ] || [ "$1" != "info" ] || exit 1
case "$args" in
  "volume inspect "*) [ -n "${STUB_VOLUME_EXISTS:-}" ] ;;
  "image inspect "*) printf "%s\n" "${STUB_IMAGE_ID-sha256:current}" ;;
  build*) [ -z "${STUB_BUILD_FAILS:-}" ] ;;
  "inspect "*) printf "%s\n" "${STUB_APP_HEALTH:-healthy}" ;;
  *" pull --quiet app") [ -z "${STUB_PULL_FAILS:-}" ] ;;
  *" ps --status running -q postgres") printf "postgres-id\n" ;;
  *" ps -q app") printf "app-id\n" ;;
  *" exec -T postgres pg_dump "*) printf "dump" ;;
  *" exec -T postgres pg_restore --list") cat >/dev/null ;;
  *) ;;
esac'
  cat >"$STUBS/curl" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "curl $*" >>/tmp/stub-calls
case "$*" in
  *--resolve*) [ -z "${STUB_HTTPS_FAILS:-}" ]; exit ;;
  *-4*ipify*) printf '%s' "${STUB_PUBLIC_IP:-203.0.113.20}"; exit ;;
  *dns.google*) [ -z "${STUB_GOOGLE_DNS_DOWN:-}" ] || exit 7 ;;
  *cloudflare-dns*) [ -z "${STUB_CLOUDFLARE_DNS_DOWN:-}" ] || exit 7 ;;
  *) exit 7 ;;
esac
name="$(printf '%s' "$*" | sed -E 's/.*name=([^&]*)&.*/\1/')"
record_type="$(printf '%s' "$*" | sed -E 's/.*type=([A-Z]+).*/\1/')"
type_number=1
[ "$record_type" = "A" ] || type_number=28
answers="$(awk -v record_type="$record_type" -v name="$name" -v number="$type_number" \
  '$1 == record_type && $2 == name { printf "{\"name\":\"%s.\",\"type\":%s,\"TTL\":60,\"data\":\"%s\"},", name, number, $3 }' /tmp/dns-records)"
printf '{"Status":0,"Answer":[{"name":"%s.","type":5,"TTL":60,"data":"elsewhere.test."},%s{"name":"end.","type":46,"TTL":1,"data":"x"}]}' "$name" "$answers"
STUB
  chmod +x "$STUBS/curl"
  write_stub systemctl ':'
  write_stub ufw '[ "$1" != "status" ] || [ -z "${STUB_UFW_ACTIVE:-}" ] || printf "Status: active\n"'
  write_stub ss '[ -z "${STUB_PORT_BUSY:-}" ] || printf "LISTEN 0 511 0.0.0.0:80 users:((\"nginx\",pid=1,fd=6))\n"'
  write_stub fallocate 'touch "$3"'
  write_stub mkswap ':'
  write_stub swapon '[ "${1:-}" != "--show" ] || [ -z "${STUB_SWAP_ACTIVE:-}" ] || printf "/existing\n"'
}

reset_server() {
  rm -rf /opt/community /usr/local/bin/community /etc/systemd/system/community-backup.* /swapfile
  : >/tmp/dns-records
  cp /tmp/fstab.original /etc/fstab
  : >"$CALLS"
}

point_domain_at() {
  local record_type="A"
  case "$1" in *:*) record_type="AAAA" ;; *) ;; esac
  printf '%s %s %s\n' "$record_type" "${2:-$DOMAIN}" "$1" >>/tmp/dns-records
}

run_installer() {
  exit_code=0
  output="$(env PATH="$STUBS:$PATH" COMMUNITY_NONINTERACTIVE=1 "$@" bash "$INSTALLER" </dev/null 2>&1)" || exit_code=$?
}

run_installer_in_terminal() {
  local answers="$1"
  shift
  exit_code=0
  output="$(eval "$answers" | env PATH="$STUBS:$PATH" "$@" timeout "$PTY_TIMEOUT_SECONDS" script -qec "bash $INSTALLER" /dev/null 2>&1)" || exit_code=$?
}

run_function() {
  local body="$1"
  shift
  head -n -1 "$INSTALLER" >/tmp/installer-functions.sh
  exit_code=0
  output="$(env PATH="$STUBS:$PATH" "$@" bash -c ". /tmp/installer-functions.sh; $body" 2>&1)" || exit_code=$?
}

read_secret() {
  sed -n "s/^$1=//p" "$ENV_FILE"
}

is_secret() {
  [[ "$(read_secret "$1")" =~ ^[0-9a-f]{64}$ ]]
}

mode_of() {
  stat -c '%a' "$1"
}

is_mode() {
  [ "$(mode_of "$2")" = "$1" ]
}

has_setting() {
  grep -qF -- "$1" "$ENV_FILE"
}

test_server_checks() {
  describe "Checking the server"

  it "refuses a user without administrator rights"
  exit_code=0
  output="$(setpriv --reuid=65534 --clear-groups env PATH="$STUBS:$PATH" COMMUNITY_NONINTERACTIVE=1 bash "$INSTALLER" </dev/null 2>&1)" || exit_code=$?
  assert_exit 1
  assert_says "administrator rights"
  assert_never_says "stopped unexpectedly"
  assert_nothing_set_up

  it "refuses an unsupported system"
  local original
  original="$(cat /etc/os-release)"
  rm -f /etc/os-release
  printf 'ID=debian\nVERSION_ID="11"\n' >/etc/os-release
  run_installer COMMUNITY_DOMAIN="$DOMAIN"
  rm -f /etc/os-release
  printf '%s\n' "$original" >/etc/os-release
  assert_exit 1
  assert_says "we only support Ubuntu 22.04, Ubuntu 24.04 and Debian 12"
  assert_nothing_set_up
}

test_missing_domain() {
  describe "Having no domain"

  it "stops and explains in non-interactive mode"
  run_installer
  assert_exit 1
  assert_says "You need a domain name to continue"
  assert_says "community.yourfund.com"
  assert_never_says "stopped unexpectedly"
  assert_nothing_set_up

  it "stops and explains when someone presses Enter at the question"
  run_installer_in_terminal "{ sleep 3; printf '\n'; sleep 3; }"
  assert_says "Your community's domain:"
  assert_says "You need a domain name to continue"
  assert_nothing_set_up

  it "refuses a bare server number"
  run_installer COMMUNITY_DOMAIN="$SERVER_IP"
  assert_exit 1
  assert_says "doesn't look like a domain name"
  assert_nothing_set_up

  it "refuses a domain that could inject settings"
  run_installer COMMUNITY_DOMAIN='evil.test
ADMIN=1'
  assert_exit 1
  assert_says "doesn't look like a domain name"
  assert_nothing_set_up
}

test_dns_failure() {
  describe "Having DNS that doesn't point here"

  it "explains the record to create when no record exists"
  run_installer COMMUNITY_DOMAIN="nowhere.example.test"
  assert_exit 1
  assert_says "nowhere.example.test doesn't point at this server yet"
  assert_says "Type:   A"
  assert_says "Name:   nowhere"
  assert_says "Value:  $SERVER_IP"
  assert_says "run the same command again"
  assert_never_says "AAAA"
  assert_nothing_set_up

  it "names the old address when the domain points elsewhere"
  point_domain_at "$OTHER_IP"
  run_installer COMMUNITY_DOMAIN="$DOMAIN"
  assert_exit 1
  assert_says "Right now $DOMAIN points at $OTHER_IP"
  assert_nothing_set_up

  it "catches an old IPv6 record next to a correct IPv4 record"
  point_domain_at "$SERVER_IP"
  point_domain_at "$OTHER_IPV6"
  run_installer COMMUNITY_DOMAIN="$DOMAIN"
  assert_exit 1
  assert_says "Right now $DOMAIN points at $OTHER_IPV6"
  assert_nothing_set_up

  it "suggests @ for a main domain"
  run_installer COMMUNITY_DOMAIN="nowhere.test"
  assert_says "Name:   @"

  it "stops when someone types quit"
  run_installer_in_terminal "{ sleep 3; printf 'quit\n'; sleep 3; }" COMMUNITY_DOMAIN="nowhere.example.test"
  assert_says "Press Enter to check again"
  assert_says "Stopped. Nothing has been set up."
  assert_nothing_set_up

  it "continues when the record appears and someone presses Enter"
  run_installer_in_terminal "{ sleep 3; printf 'A %s %s\n' '$DOMAIN' '$SERVER_IP' >>/tmp/dns-records; printf '\n'; sleep 15; }" COMMUNITY_DOMAIN="$DOMAIN"
  assert_says "$DOMAIN points at this server"
  assert_says "Your community is ready"

  it "falls back to a second DNS service"
  point_domain_at "$SERVER_IP"
  run_installer COMMUNITY_DOMAIN="$DOMAIN" STUB_GOOGLE_DNS_DOWN=1
  assert_exit 0
  assert_says "$DOMAIN points at this server"

  it "stops plainly when no DNS service answers"
  run_installer COMMUNITY_DOMAIN="$DOMAIN" STUB_GOOGLE_DNS_DOWN=1 STUB_CLOUDFLARE_DNS_DOWN=1
  assert_exit 1
  assert_says "We couldn't look up $DOMAIN"
  assert_nothing_set_up

  it "accepts an IPv6-only server"
  point_domain_at "2001:db8::20"
  run_installer COMMUNITY_DOMAIN="$DOMAIN" COMMUNITY_SERVER_IP="2001:db8::20"
  assert_exit 0
  assert_says "$DOMAIN points at this server"

  it "stops when it can't detect this server's address"
  run_installer COMMUNITY_DOMAIN="$DOMAIN" STUB_PUBLIC_IP="nonsense"
  assert_exit 1
  assert_says "couldn't work out this server's public address"
  assert_nothing_set_up
}

test_fresh_install() {
  describe "Installing on a fresh server"

  it "cleans a pasted web address"
  point_domain_at "$SERVER_IP"
  run_installer COMMUNITY_DOMAIN="https://Community.Example.Test/"
  assert_exit 0
  assert_true "stores the clean domain" has_setting "COMMUNITY_DOMAIN=$DOMAIN"

  it "leaves a running service and prints what to do next"
  point_domain_at "$SERVER_IP"
  run_installer COMMUNITY_DOMAIN="$DOMAIN"
  assert_exit 0
  assert_says "Step 1 of 11"
  assert_says "Step 11 of 11"
  assert_says "Address:      https://$DOMAIN"
  assert_says "Setup token:  $(read_secret SETUP_TOKEN)"
  assert_says "https://$DOMAIN/setup"
  assert_says "same disk"
  assert_true "keeps .env private" is_mode 600 "$ENV_FILE"
  assert_true "keeps the install folder private" is_mode 700 /opt/community
  assert_true "keeps backups private" is_mode 700 /opt/community/backups
  assert_true "installs the helper" test -x /usr/local/bin/community
  assert_true "installs the compose file" test -f /opt/community/compose.yml
  assert_true "installs the Caddyfile" test -f /opt/community/Caddyfile
  assert_true "generates POSTGRES_PASSWORD" is_secret POSTGRES_PASSWORD
  assert_true "generates SETUP_TOKEN" is_secret SETUP_TOKEN
  assert_true "generates BETTER_AUTH_SECRET" is_secret BETTER_AUTH_SECRET
  assert_true "sets APP_URL to HTTPS" has_setting "APP_URL=https://$DOMAIN"
  assert_called "systemctl enable --now community-backup.timer"
  assert_called "pull --quiet app"
  assert_called "up -d --remove-orphans"
  assert_never_says "/etc/apt"

  it "refuses to replace a database whose settings file is gone"
  point_domain_at "$SERVER_IP"
  run_installer COMMUNITY_DOMAIN="$DOMAIN" STUB_VOLUME_EXISTS=1
  assert_exit 1
  assert_says "settings file ($ENV_FILE) is gone"
  assert_true "writes no new .env" test ! -e "$ENV_FILE"

  it "explains when another program holds the web ports"
  point_domain_at "$SERVER_IP"
  run_installer COMMUNITY_DOMAIN="$DOMAIN" STUB_PORT_BUSY=1
  assert_exit 1
  assert_says "already using the web ports"
  assert_says "nginx"
  assert_not_called "up -d"

  it "points at the logs when the app never gets healthy"
  point_domain_at "$SERVER_IP"
  run_installer COMMUNITY_DOMAIN="$DOMAIN" STUB_APP_HEALTH=starting COMMUNITY_HEALTH_TIMEOUT_SECONDS=1
  assert_exit 1
  assert_says "sudo community logs app"
  assert_never_says "stopped unexpectedly"

  it "points at the certificate logs when HTTPS never answers"
  point_domain_at "$SERVER_IP"
  run_installer COMMUNITY_DOMAIN="$DOMAIN" STUB_HTTPS_FAILS=1 COMMUNITY_HEALTH_TIMEOUT_SECONDS=1
  assert_exit 1
  assert_says "couldn't get a security certificate"
  assert_says "sudo community logs caddy"
  assert_says "sudo community setup-token"

  it "uses a private certificate only in test mode"
  run_installer COMMUNITY_DOMAIN="localhost" COMMUNITY_TEST_MODE=1 COMMUNITY_HTTPS_PORT=18443 COMMUNITY_HTTP_PORT=18480
  assert_exit 0
  assert_says "Test mode"
  assert_true "turns on the private certificate" has_setting "CADDY_GLOBAL_OPTIONS=local_certs"
  assert_true "keeps the port in APP_URL" has_setting "APP_URL=https://localhost:18443"
}

test_image_fallback() {
  describe "Getting the app"

  it "builds from source with a memory warning when the download fails"
  point_domain_at "$SERVER_IP"
  run_installer COMMUNITY_DOMAIN="$DOMAIN" STUB_PULL_FAILS=1
  assert_exit 0
  assert_says "building it on this server"
  assert_says "2 GB"
  assert_called "docker build -f /source/deploy/vps/Dockerfile -t ghcr.io/villagehq/community:latest /source"

  it "doesn't build when the download works"
  point_domain_at "$SERVER_IP"
  run_installer COMMUNITY_DOMAIN="$DOMAIN"
  assert_not_called "docker build"

  it "stops and explains when the build fails on a first install"
  point_domain_at "$SERVER_IP"
  run_installer COMMUNITY_DOMAIN="$DOMAIN" STUB_PULL_FAILS=1 STUB_BUILD_FAILS=1 STUB_IMAGE_ID=""
  assert_exit 1
  assert_says "The build failed"
  assert_not_called "up -d"
}

test_rerun() {
  describe "Running it again"

  it "keeps every secret and upgrades in place"
  point_domain_at "$SERVER_IP"
  run_installer COMMUNITY_DOMAIN="$DOMAIN"
  local checksum_before token_before
  checksum_before="$(sha256sum "$ENV_FILE")"
  token_before="$(read_secret SETUP_TOKEN)"
  : >"$CALLS"
  run_installer COMMUNITY_DOMAIN="different.example.test"
  assert_exit 0
  assert_says "already installed"
  assert_says "Keeping your existing settings"
  assert_says "You passed different.example.test"
  assert_says "up to date at https://$DOMAIN"
  assert_never_says "$token_before"
  assert_true "leaves .env byte for byte the same" test "$checksum_before" = "$(sha256sum "$ENV_FILE")"
  assert_true "keeps .env private" is_mode 600 "$ENV_FILE"
  assert_called "exec -T postgres pg_dump"
  assert_called "up -d --remove-orphans"
  assert_not_called "volume rm"
  assert_not_called "down"

  it "needs neither a domain nor DNS"
  point_domain_at "$SERVER_IP"
  run_installer COMMUNITY_DOMAIN="$DOMAIN"
  : >/tmp/dns-records
  run_installer
  assert_exit 0
  assert_says "Already set up, so we skip this check"

  it "repairs .env permissions without changing its contents"
  point_domain_at "$SERVER_IP"
  run_installer COMMUNITY_DOMAIN="$DOMAIN"
  chmod 644 "$ENV_FILE"
  run_installer
  assert_true "sets the mode back" is_mode 600 "$ENV_FILE"

  it "keeps the current version when a rebuild fails"
  point_domain_at "$SERVER_IP"
  run_installer COMMUNITY_DOMAIN="$DOMAIN"
  run_installer STUB_PULL_FAILS=1 STUB_BUILD_FAILS=1
  assert_exit 0
  assert_says "keeping the version you have"

  it "stops before changing anything when the backup fails"
  point_domain_at "$SERVER_IP"
  run_installer COMMUNITY_DOMAIN="$DOMAIN"
  : >"$CALLS"
  local stub_backup
  stub_backup="$(cat "$STUBS/docker")"
  printf '%s\n' "$stub_backup" | sed 's|printf "dump"|exit 1|' >"$STUBS/docker"
  run_installer
  printf '%s\n' "$stub_backup" >"$STUBS/docker"
  assert_exit 1
  assert_says "stopped before changing anything"
  assert_not_called "up -d"
}

test_firewall() {
  describe "Handling the firewall"

  it "allows only the web ports when ufw is on"
  point_domain_at "$SERVER_IP"
  run_installer COMMUNITY_DOMAIN="$DOMAIN" STUB_UFW_ACTIVE=1
  assert_called "ufw allow 80/tcp"
  assert_called "ufw allow 443/tcp"
  assert_not_called "ufw enable"
  assert_not_called "ufw default"
  assert_not_called "ufw deny"
  assert_says "SSH works as before"

  it "leaves ufw off when it's off"
  point_domain_at "$SERVER_IP"
  run_installer COMMUNITY_DOMAIN="$DOMAIN"
  assert_not_called "ufw allow"
  assert_not_called "ufw enable"
  assert_says "We left it off"
}

test_swap() {
  describe "Handling memory"

  local small_machine='total_memory_mb() { printf 512; }; ensure_swap'

  it "adds swap once on a small machine"
  run_function "$small_machine; $small_machine"
  assert_exit 0
  assert_called "mkswap /swapfile"
  assert_called "swapon /swapfile"
  assert_true "lists it in fstab once" test "$(grep -c '^/swapfile ' /etc/fstab)" = "1"

  it "leaves a large machine alone"
  run_function 'total_memory_mb() { printf 4096; }; ensure_swap'
  assert_not_called "mkswap"

  it "leaves a small machine with swap alone"
  run_function "$small_machine" STUB_SWAP_ACTIVE=1
  assert_not_called "mkswap"
}

test_truncated_download() {
  describe "Getting a cut-off download"

  it "runs nothing, wherever the download stops"
  local line_count line prefix_output ran_something=""
  line_count="$(wc -l <"$INSTALLER")"
  for ((line = 1; line < line_count; line++)); do
    prefix_output="$(head -n "$line" "$INSTALLER" | env PATH="$STUBS:$PATH" COMMUNITY_DOMAIN="$DOMAIN" bash 2>/dev/null || true)"
    case "$prefix_output" in *Step*) ran_something="$line" ;; *) ;; esac
  done
  output="stopped at line $ran_something"
  assert_true "prints no step at any cut" test -z "$ran_something"
  assert_nothing_set_up
}

test_helper() {
  describe "Using the helper"

  it "tells a non-administrator to use sudo"
  point_domain_at "$SERVER_IP"
  run_installer COMMUNITY_DOMAIN="$DOMAIN"
  exit_code=0
  output="$(setpriv --reuid=65534 --clear-groups /usr/local/bin/community setup-token 2>&1)" || exit_code=$?
  assert_exit 1
  assert_says "sudo community setup-token"

  it "says so when Community isn't installed"
  exit_code=0
  output="$(/source/deploy/vps/community status 2>&1)" || exit_code=$?
  assert_exit 1
  assert_says "isn't installed"

  it "prints the setup token"
  point_domain_at "$SERVER_IP"
  run_installer COMMUNITY_DOMAIN="$DOMAIN"
  local token
  token="$(read_secret SETUP_TOKEN)"
  output="$(env PATH="$STUBS:$PATH" community setup-token)"
  assert_true "matches .env" test "$output" = "$token"

  it "keeps 7 daily backups and never prunes a safety copy"
  point_domain_at "$SERVER_IP"
  run_installer COMMUNITY_DOMAIN="$DOMAIN"
  local day
  for day in 01 02 03 04 05 06 07 08 09; do
    : >"/opt/community/backups/community-202601${day}-000000.dump"
  done
  : >/opt/community/backups/before-restore-20260101-000000.dump
  output="$(env PATH="$STUBS:$PATH" community backup)"
  assert_true "keeps 7" test "$(find /opt/community/backups -name 'community-*.dump' | wc -l)" = "7"
  assert_true "removes the oldest" test ! -e /opt/community/backups/community-20260101-000000.dump
  assert_true "keeps the safety copy" test -e /opt/community/backups/before-restore-20260101-000000.dump
  assert_says "same disk"

  it "shows help with no command and rejects an unknown one"
  output="$(env PATH="$STUBS:$PATH" bash /source/deploy/vps/community)"
  assert_says "sudo community restore <file>"
  exit_code=0
  output="$(env PATH="$STUBS:$PATH" bash /source/deploy/vps/community nonsense 2>&1)" || exit_code=$?
  assert_exit 1
}

test_real_docker_install() {
  describe "Installing Docker for real, in a container with no way to run it"

  it "installs from Docker's official source and stops plainly when Docker can't start"
  exit_code=0
  output="$(env COMMUNITY_NONINTERACTIVE=1 COMMUNITY_TEST_MODE=1 COMMUNITY_DOMAIN="localhost" bash "$INSTALLER" </dev/null 2>&1)" || exit_code=$?
  local codename
  codename="$(sed -n 's/^VERSION_CODENAME=//p' /etc/os-release)"
  assert_exit 1
  assert_says "Docker is installed, but it isn't running"
  assert_true "installs the docker command" command -v docker
  assert_true "installs Compose" docker compose version
  assert_true "uses Docker's official repository" grep -q "download.docker.com/linux/.* $codename stable" /etc/apt/sources.list.d/docker.list
  assert_true "writes no settings yet" test ! -e "$ENV_FILE"
}

run_inside() {
  : >"$CALLS"
  : >/tmp/dns-records
  cp /etc/fstab /tmp/fstab.original 2>/dev/null || : >/tmp/fstab.original

  if [ "${1:-}" = "real-docker" ]; then
    test_real_docker_install
  else
    install_stubs
    test_server_checks
    test_missing_domain
    test_dns_failure
    test_fresh_install
    test_image_fallback
    test_rerun
    test_firewall
    test_swap
    test_truncated_download
    test_helper
  fi

  printf '\nFailures: %s\n' "$failures"
  [ "$failures" -eq 0 ]
}

run_on_image() {
  local image="$1" mode="$2" repository="$3"
  printf '\n=== %s (%s) ===\n' "$image" "$mode"
  docker run --rm --name "community-vps-test-$(printf '%s' "$image" | tr -c 'a-z0-9' '-')$mode" \
    -v "$repository:/source:ro" "$image" \
    bash /source/deploy/vps/test-installer.sh --inside "$mode"
}

main() {
  if [ "${1:-}" = "--inside" ]; then
    shift
    run_inside "$@"
    return
  fi

  local repository images=("$@") image overall=0
  repository="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  [ "${#images[@]}" -gt 0 ] || images=("${DEFAULT_TEST_IMAGES[@]}")
  for image in "${images[@]}"; do
    run_on_image "$image" stubbed "$repository" || overall=1
    run_on_image "$image" real-docker "$repository" || overall=1
  done
  exit "$overall"
}

main "$@"
