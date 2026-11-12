#!/usr/bin/env bash
# Sets up Community on a Ubuntu 22.04, 24.04 or 26.04, or Debian 12 server.
#
#   curl -fsSL https://raw.githubusercontent.com/VillageHQ/community/main/install.sh | sudo bash
#
# Run it again at any time to upgrade. It never changes your settings or your data.
#
# To run it without questions, pass settings after sudo, because sudo drops anything set before it:
#   curl -fsSL <url> | sudo COMMUNITY_DOMAIN=community.example.com COMMUNITY_NONINTERACTIVE=1 bash
#
#   COMMUNITY_DOMAIN           the address of your community, like community.example.com
#   COMMUNITY_NONINTERACTIVE   set to 1 to never ask anything
#   COMMUNITY_REF              the branch or tag to install files from (default: main)
#   COMMUNITY_IMAGE            the app image (default: ghcr.io/villagehq/community:latest)
#   COMMUNITY_BIND_ADDRESS     use only this one of the server's addresses, if another program holds ports 80 or 443 on another
#   COMMUNITY_SERVER_IP        this server's public addresses, separated by commas, if we can't detect them (for example
#                              behind NAT or a load balancer): the addresses your domain should point at
#   COMMUNITY_HEALTH_TIMEOUT_SECONDS   how long to wait for the app and for HTTPS (default: 180)
#
# For testing only. Browsers won't trust this site, so never use it for a real community:
#   COMMUNITY_TEST_MODE=1      accepts names like localhost, skips the DNS check and uses a private certificate
#   COMMUNITY_HTTP_PORT, COMMUNITY_HTTPS_PORT   other ports, honored only in test mode
set -euo pipefail

readonly SCRIPT_PATH="${BASH_SOURCE[0]:-}"
readonly INSTALL_DIRECTORY="/opt/community"
readonly ENV_FILE="$INSTALL_DIRECTORY/.env"
readonly HELPER_PATH="/usr/local/bin/community"
readonly SYSTEMD_DIRECTORY="/etc/systemd/system"
readonly INSTALL_LOG="$INSTALL_DIRECTORY/install.log"
readonly DEFAULT_IMAGE="ghcr.io/villagehq/community:latest"
readonly SOURCE_ARCHIVE_URL="https://codeload.github.com/VillageHQ/community/tar.gz"
readonly INSTALL_COMMAND="curl -fsSL https://raw.githubusercontent.com/VillageHQ/community/main/install.sh | sudo bash"
readonly ISSUES_URL="https://github.com/VillageHQ/community/issues"
readonly POSTGRES_VOLUME="community_postgres-data"
readonly SWAP_FILE="/swapfile"
readonly SWAP_MARK="$INSTALL_DIRECTORY/.swapfile-made-by-installer"
readonly SWAP_SIZE="2G"
readonly SMALL_MACHINE_MEMORY_MB=2048
readonly DNS_RESOLVERS=("https://dns.google/resolve" "https://cloudflare-dns.com/dns-query")
readonly DNS_WAIT_INTERVAL_SECONDS=30
readonly DNS_WAIT_ATTEMPTS=60
readonly TOTAL_STEPS=12

log_file="/dev/null"
current_step=0
current_step_title="starting up"
friendly_exit=""
is_upgrade=""
source_directory=""
temporary_directory=""
domain=""
app_url=""
previous_image_id=""
swaps_file="/proc/swaps"
setup_finished=""
build_failed=""
server_addresses=()
domain_addresses=()

say() { printf '%s\n' "$*"; }

warn() { printf 'Warning: %s\n' "$*"; }

die() {
  friendly_exit=1
  printf '\n%s\n' "$*" >&2
  exit 1
}

step() {
  current_step=$((current_step + 1))
  current_step_title="$1"
  printf '\nStep %s of %s: %s\n' "$current_step" "$TOTAL_STEPS" "$1"
}

on_exit() {
  local exit_code=$?
  [ -z "$temporary_directory" ] || rm -rf "$temporary_directory"
  [ "$log_file" = "$INSTALL_LOG" ] || [ -s "$log_file" ] || rm -f "$log_file"
  [ "$exit_code" -ne 0 ] || return 0
  [ -z "$friendly_exit" ] || return 0
  printf '\nThe installer stopped unexpectedly during this step: %s.\n' "$current_step_title" >&2
  printf 'Your data is safe. Run the same command again to pick up where it stopped.\n' >&2
  printf 'If it stops again, send us the end of %s: %s\n' "$log_file" "$ISSUES_URL" >&2
}

has_terminal() {
  [ -z "${COMMUNITY_NONINTERACTIVE:-}" ] && { : </dev/tty; } 2>/dev/null
}

ask() {
  local variable="$1" question="$2" answer=""
  [ -z "${!variable:-}" ] || return 0
  has_terminal || return 0
  read -r -p "$question " answer </dev/tty || true
  printf -v "$variable" '%s' "$answer"
}

is_test_mode() {
  [ -n "${COMMUNITY_TEST_MODE:-}" ]
}

compose() {
  docker compose --project-directory "$INSTALL_DIRECTORY" -f "$INSTALL_DIRECTORY/compose.yml" "$@"
}

read_setting() {
  sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1
}

apt_get() {
  DEBIAN_FRONTEND=noninteractive apt-get -o DPkg::Lock::Timeout=300 -y "$@" >>"$log_file" 2>&1 </dev/null
}

install_missing_tools() {
  local missing=() tool
  for tool in curl openssl tar gzip; do
    command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
  done
  dpkg -s ca-certificates >/dev/null 2>&1 || missing+=(ca-certificates)
  [ "${#missing[@]}" -gt 0 ] || return 0
  say "Installing a few small tools: ${missing[*]}"
  apt_get update || die "We couldn't reach the software catalog. Check this server's internet connection. Details are in $log_file."
  apt_get install "${missing[@]}" || die "We couldn't install ${missing[*]}. Details are in $log_file."
}

check_server() {
  step "Checking this server"
  [ "$(id -u)" -eq 0 ] || die "This needs administrator rights. Run it like this:

  $INSTALL_COMMAND"

  local os_id="" os_version="" architecture=""
  if [ -r /etc/os-release ]; then
    os_id="$(sed -n 's/^ID=//p' /etc/os-release | tr -d '"')"
    os_version="$(sed -n 's/^VERSION_ID=//p' /etc/os-release | tr -d '"')"
  fi
  case "$os_id:$os_version" in
    ubuntu:22.04 | ubuntu:24.04 | ubuntu:26.04 | debian:12) ;;
    *)
      die "This server runs ${os_id:-an unknown system} ${os_version}, and we only support Ubuntu 22.04, 24.04 and 26.04, and Debian 12.
Most hosting companies let you reinstall a server with one of those. Do that, then run this command again."
      ;;
  esac

  architecture="$(dpkg --print-architecture)"
  case "$architecture" in
    amd64 | arm64) ;;
    *) die "This server's processor type ($architecture) isn't supported. Choose a server with an amd64 (also called x86) or arm64 processor." ;;
  esac
  say "$os_id $os_version on $architecture. That works."

  install_missing_tools
  if [ -f "$ENV_FILE" ]; then
    is_upgrade=1
    if is_setup_finished; then
      setup_finished=1
      say "Community is already installed here, so this run upgrades it."
    else
      say "We found the settings from an earlier run, so this run keeps them and picks up from there."
    fi
  fi
}

# Setup is finished once someone has created the first admin on the /setup page. Until then a re-run is
# still a first install, even though the settings already exist, so it ends with the setup token again.
is_setup_finished() {
  command -v docker >/dev/null 2>&1 && [ -f "$INSTALL_DIRECTORY/compose.yml" ] || return 1
  local answer
  answer="$(compose exec -T postgres psql -U community -d community -tAc \
    "SELECT 1 FROM instance_settings WHERE key = 'first_admin_user_id'" 2>/dev/null || true)"
  [ "$(printf '%s' "$answer" | tr -d '[:space:]')" = "1" ]
}

explain_missing_domain() {
  die "You need a domain name to continue, and nothing has been set up yet.

Your community must open on a secure address that starts with https://. Sign-in and the Village
connection depend on it. Secure addresses need a domain name, so a bare server number won't work.

What to do:
  1. Buy a domain, or pick a new name under one your fund already owns, like community.yourfund.com.
  2. Run this command again and enter that name. We'll tell you exactly what to set up:

     $INSTALL_COMMAND"
}

normalize_domain() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's#^[[:space:]]*([a-z]+://)?##; s#[/:].*$##; s#[.[:space:]]*$##'
}

is_valid_domain() {
  if is_test_mode; then
    [[ "$1" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]]
    return
  fi
  [[ "$1" =~ ^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+([a-z]{2,}|xn--[a-z0-9-]+)$ ]]
}

choose_domain() {
  step "Choosing your community's address"
  if [ -n "$is_upgrade" ]; then
    domain="$(read_setting COMMUNITY_DOMAIN)"
    app_url="$(read_setting APP_URL)"
    say "Keeping your current address: $app_url"
    if [ -n "${COMMUNITY_DOMAIN:-}" ] && [ "$(normalize_domain "$COMMUNITY_DOMAIN")" != "$domain" ]; then
      warn "You passed ${COMMUNITY_DOMAIN}, but we never change existing settings. The guide shows how to change the address: https://github.com/VillageHQ/community/blob/main/docs/self-host-vps.md"
    fi
    if [ -n "${COMMUNITY_BIND_ADDRESS:-}" ] && [ "$COMMUNITY_BIND_ADDRESS" != "$(read_setting COMMUNITY_BIND_ADDRESS)" ]; then
      warn "You passed COMMUNITY_BIND_ADDRESS=${COMMUNITY_BIND_ADDRESS}, but we never change existing settings."
    fi
    return 0
  fi

  say "Enter the address people will use to open your community, like community.yourfund.com."
  ask COMMUNITY_DOMAIN "Your community's domain:"
  [ -n "${COMMUNITY_DOMAIN:-}" ] || explain_missing_domain

  domain="$(normalize_domain "$COMMUNITY_DOMAIN")"
  is_valid_domain "$domain" || die "\"$COMMUNITY_DOMAIN\" doesn't look like a domain name. It should look like community.yourfund.com.
Secure addresses can't use a bare server number. Run the command again with a domain name."
  check_bind_address

  app_url="https://$domain"
  if is_test_mode && [ -n "${COMMUNITY_HTTPS_PORT:-}" ]; then
    app_url="https://$domain:$COMMUNITY_HTTPS_PORT"
  fi
  say "Your address will be $app_url"
}

plain_address() {
  local address="${1#[}"
  printf '%s' "${address%]}"
}

is_ipv4() { [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; }

is_ipv6() { [[ "$1" =~ ^[0-9a-f:]*:[0-9a-f:]*$ ]]; }

is_full_ipv4() {
  is_ipv4 "$1" || return 1
  local part parts
  IFS=. read -r -a parts <<<"$1"
  for part in "${parts[@]}"; do
    [ "$((10#$part))" -le 255 ] || return 1
  done
}

is_full_ipv6() { is_ipv6 "$1" && [[ "$1" =~ [0-9a-f] ]] && [[ "$1" =~ :.*: ]]; }

read_server_ip_setting() {
  local addresses address
  read -r -a addresses <<<"$(printf '%s' "$COMMUNITY_SERVER_IP" | tr ',\n\t' '   ' | tr '[:upper:]' '[:lower:]')"
  for address in "${addresses[@]}"; do
    address="$(plain_address "$address")"
    is_full_ipv4 "$address" || is_full_ipv6 "$address" || die "\"$address\" doesn't look like a server address.
COMMUNITY_SERVER_IP takes addresses like 203.0.113.10 or 2001:db8::1, separated by commas."
    server_addresses+=("$address")
  done
}

detect_server_addresses() {
  server_addresses=()
  if [ -n "${COMMUNITY_SERVER_IP:-}" ]; then
    read_server_ip_setting
    return 0
  fi
  if [ -n "${COMMUNITY_BIND_ADDRESS:-}" ]; then
    server_addresses=("$(plain_address "$COMMUNITY_BIND_ADDRESS")")
    return 0
  fi
  local ipv4 ipv6
  ipv4="$(curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
  ipv6="$(curl -6 -fsS --max-time 5 https://api6.ipify.org 2>/dev/null | tr '[:upper:]' '[:lower:]' || true)"
  if is_ipv4 "$ipv4"; then server_addresses+=("$ipv4"); fi
  if is_ipv6 "$ipv6"; then server_addresses+=("$ipv6"); fi
}

query_public_dns() {
  local record_type="$1" resolver answer
  for resolver in "${DNS_RESOLVERS[@]}"; do
    if answer="$(curl -fsS --max-time 10 -H 'accept: application/dns-json' "$resolver?name=$domain&type=$record_type" 2>/dev/null)"; then
      printf '%s' "$answer" | grep -oE '"type": *(1|28),[^}]*"data": *"[^"]+"' | sed -E 's/.*"data": *"([^"]+)"/\1/' | tr '[:upper:]' '[:lower:]' || true
      return 0
    fi
  done
  return 1
}

resolve_domain() {
  domain_addresses=()
  local record_type answers address
  for record_type in A AAAA; do
    answers="$(query_public_dns "$record_type")" || die "We couldn't look up $domain. Check this server's internet connection, then run the same command again."
    while read -r address; do
      [ -z "$address" ] || domain_addresses+=("$address")
    done <<<"$answers"
  done
}

is_server_address() {
  local address
  for address in "${server_addresses[@]}"; do
    [ "$address" != "$1" ] || return 0
  done
  return 1
}

domain_points_here() {
  local address
  resolve_domain
  [ "${#domain_addresses[@]}" -gt 0 ] || return 1
  for address in "${domain_addresses[@]}"; do
    is_server_address "$address" || return 1
  done
}

record_type_for() {
  if is_ipv4 "$1"; then printf 'A'; else printf 'AAAA'; fi
}

record_name_for_domain() {
  if [ "$(printf '%s' "$domain" | tr -cd '.' | wc -c)" -ge 2 ]; then
    printf '%s' "${domain%%.*}"
  else
    printf '@'
  fi
}

# The detected address is the one this server goes out from. When none of its own network cards has it, the server
# sits behind NAT or a load balancer (Fly.io, some clouds), and visitors may reach it on another address.
is_behind_nat() {
  [ -z "${COMMUNITY_SERVER_IP:-}" ] && [ -z "${COMMUNITY_BIND_ADDRESS:-}" ] || return 1
  local address
  for address in "${server_addresses[@]}"; do
    if has_local_address "$address"; then return 1; fi
  done
}

explain_nat() {
  local other_addresses=("$@") listed
  say ""
  say "This server goes out to the internet from ${server_addresses[0]}, but none of its own network cards has that address."
  say "It may sit behind NAT or a load balancer (as on Fly.io), where visitors reach it on another address."
  if [ "${#other_addresses[@]}" -gt 0 ]; then
    listed="$(IFS=,; printf '%s' "${other_addresses[*]}")"
    say "Right now $domain points at ${other_addresses[*]}. If that's where visitors reach this server, the record is right."
    say "Keep it instead of creating the one above, and run the command again with that address:"
  else
    listed="<the address visitors reach this server on>"
    say "If visitors reach it on another address, point $domain there instead, and run the command again with it:"
  fi
  say ""
  say "  curl -fsSL https://raw.githubusercontent.com/VillageHQ/community/main/install.sh | sudo COMMUNITY_DOMAIN=$domain COMMUNITY_SERVER_IP=$listed bash"
  say ""
  if [ "${#other_addresses[@]}" -gt 0 ]; then
    say "If not, change or delete the record that points at ${other_addresses[*]}, and create the one above."
  fi
}

explain_dns_record() {
  local address other_addresses=() behind_nat=""
  for address in "${domain_addresses[@]}"; do
    is_server_address "$address" || other_addresses+=("$address")
  done
  if is_behind_nat; then behind_nat=1; fi
  say ""
  say "$domain doesn't point at this server yet."
  say ""
  say "Log in to the company where you bought your domain, open its DNS settings and create this record:"
  say ""
  say "  Type:   $(record_type_for "${server_addresses[0]}")"
  say "  Name:   $(record_name_for_domain)"
  say "  Value:  ${server_addresses[0]}"
  say ""
  say "If $domain is your main domain, with nothing in front of it, use @ as the name."
  if [ -n "$behind_nat" ]; then
    explain_nat "${other_addresses[@]}"
  else
    for address in "${other_addresses[@]}"; do
      say "Right now $domain points at $address. Change or delete that old record."
    done
  fi
  say "On Cloudflare, set the record to \"DNS only\" (the grey cloud)."
  say "Changes usually show up within a few minutes, and sometimes take up to an hour."
}

wait_for_dns() {
  local attempt
  say "Checking every $DNS_WAIT_INTERVAL_SECONDS seconds, for up to 30 minutes. Press Ctrl+C to stop."
  for ((attempt = 0; attempt < DNS_WAIT_ATTEMPTS; attempt++)); do
    sleep "$DNS_WAIT_INTERVAL_SECONDS"
    if domain_points_here; then return 0; fi
    say "Not yet."
  done
  return 1
}

check_dns() {
  step "Checking that $domain points at this server"
  if [ -n "$is_upgrade" ]; then
    if [ -n "$setup_finished" ]; then say "Already set up, so we skip this check."; else say "An earlier run checked this, so we skip it."; fi
    return 0
  fi
  if is_test_mode; then
    warn "Test mode: skipping this check. Never use test mode for a real community."
    return 0
  fi

  detect_server_addresses
  [ "${#server_addresses[@]}" -gt 0 ] || die "We couldn't work out this server's public address, so we can't check your domain.
Check that this server can reach the internet, then run the command again.
If it sits behind a network that hides its address, pass it: sudo COMMUNITY_SERVER_IP=<address> bash"

  local choice
  until domain_points_here; do
    explain_dns_record
    has_terminal || die "Create that record, wait a few minutes, then run the same command again."
    say ""
    read -r -p "Press Enter to check again, type wait to keep checking by itself, or type quit to stop: " choice </dev/tty || choice="quit"
    case "$choice" in
      quit) die "Stopped. Nothing has been set up. Run the same command again once the record is in place." ;;
      wait) if wait_for_dns; then break; fi ;;
      *) ;;
    esac
  done
  say "$domain points at this server."
}

http_port() {
  if is_test_mode; then printf '%s' "${COMMUNITY_HTTP_PORT:-80}"; else printf '80'; fi
}

https_port() {
  if is_test_mode; then printf '%s' "${COMMUNITY_HTTPS_PORT:-443}"; else printf '443'; fi
}

is_wildcard_address() { [[ "$1" == "0.0.0.0" || "$1" == "[::]" || "$1" == "*" ]]; }

is_valid_bind_address() { [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ || "$1" =~ ^\[[0-9a-fA-F:]+\]$ ]]; }

has_local_address() {
  command -v ip >/dev/null 2>&1 || return 0
  ip -o addr show 2>/dev/null | awk '{ sub(/\/.*/, "", $4); print $4 }' | grep -qxF "$(plain_address "$1")"
}

check_bind_address() {
  [ -n "${COMMUNITY_BIND_ADDRESS:-}" ] || return 0
  is_valid_bind_address "$COMMUNITY_BIND_ADDRESS" || die "\"$COMMUNITY_BIND_ADDRESS\" doesn't look like a server address. It should look like 203.0.113.10, or [2001:db8::1] for IPv6."
  has_local_address "$COMMUNITY_BIND_ADDRESS" || die "This server doesn't have the address $COMMUNITY_BIND_ADDRESS, so your community can't use it.
Check the address on your hosting company's page, then run the command again."
}

program_name() {
  printf '%s' "$1" | sed -nE 's/.*users:\(\("([^"]+)".*/\1/p'
}

conflicting_listeners() {
  command -v ss >/dev/null 2>&1 || return 0
  local bind_address="${COMMUNITY_BIND_ADDRESS:-}" _state _received _sent local_address _peer process address
  while read -r _state _received _sent local_address _peer process; do
    address="${local_address%:*}"
    address="${address%%\%*}"
    if [ -z "$bind_address" ] || [ "$address" = "$bind_address" ] || is_wildcard_address "$address"; then
      printf '%s %s\n' "$local_address" "$(program_name "$process")"
    fi
  done < <(ss -ltnpH "( sport = :$(http_port) or sport = :$(https_port) )" 2>/dev/null || true)
}

can_share_ports_by_address() {
  local listeners="$1" local_address _program
  [ -z "${COMMUNITY_BIND_ADDRESS:-}" ] || return 1
  while read -r local_address _program; do
    if is_wildcard_address "${local_address%:*}"; then return 1; fi
  done <<<"$listeners"
}

explain_port_conflict() {
  local listeners="$1" suggestion="stop or remove that program, then run the same command again."
  if can_share_ports_by_address "$listeners"; then
    suggestion="either stop that program, or keep it and let your community use only this server's public address:

  curl -fsSL https://raw.githubusercontent.com/VillageHQ/community/main/install.sh | sudo COMMUNITY_DOMAIN=$domain COMMUNITY_BIND_ADDRESS=${server_addresses[0]:-<public address>} bash"
  fi
  die "Another program on this server is already using the web ports, and your community needs them.
Nothing has been set up yet.

$(printf '%s\n' "$listeners" | sed 's/^/  /')

To fix this, $suggestion"
}

check_web_ports() {
  step "Checking that the web ports are free"
  if [ -n "$is_upgrade" ]; then
    if [ -n "$setup_finished" ]; then say "Your community already uses them, so we skip this check."; else say "An earlier run checked them, so we skip this check."; fi
    return 0
  fi
  local listeners
  listeners="$(conflicting_listeners)"
  [ -z "$listeners" ] || explain_port_conflict "$listeners"
  say "Ports $(http_port) and $(https_port) are free."
}

move_log_to_install_directory() {
  install -d -m 700 "$INSTALL_DIRECTORY"
  cat "$log_file" >>"$INSTALL_LOG"
  chmod 600 "$INSTALL_LOG"
  [ "$log_file" = "/dev/null" ] || rm -f "$log_file"
  log_file="$INSTALL_LOG"
}

install_docker() {
  local os_id codename architecture
  os_id="$(sed -n 's/^ID=//p' /etc/os-release | tr -d '"')"
  codename="$(sed -n 's/^VERSION_CODENAME=//p' /etc/os-release | tr -d '"')"
  architecture="$(dpkg --print-architecture)"

  say "Installing Docker from its official source. This takes a minute or two."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$os_id/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/%s %s stable\n' \
    "$architecture" "$os_id" "$codename" >/etc/apt/sources.list.d/docker.list
  apt_get update || die "We couldn't reach Docker's software catalog. Details are in $log_file."
  apt_get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin ||
    die "We couldn't install Docker. Details are in $log_file."
}

docker_service_is_up() {
  systemctl is-enabled --quiet docker 2>/dev/null && systemctl is-active --quiet docker 2>/dev/null
}

ensure_docker() {
  step "Making sure Docker is installed"
  move_log_to_install_directory
  say "Docker runs your community in sealed boxes, so it stays separate from the rest of this server."
  if command -v docker >/dev/null 2>&1; then
    say "Docker is already here."
  else
    install_docker
  fi

  docker compose version >/dev/null 2>&1 || die "This server has an old Docker without its Compose tool.
Install Docker from its official guide, then run this command again: https://docs.docker.com/engine/install/"

  if command -v systemctl >/dev/null 2>&1 && ! docker_service_is_up; then
    systemctl enable --now docker >>"$log_file" 2>&1 || true
  fi
  docker info >/dev/null 2>&1 || die "Docker is installed, but it isn't running.
Restart the server, then run the same command again. Details are in $log_file."
  say "Docker is running."
}

total_memory_mb() {
  awk '/^MemTotal:/ { print int($2 / 1024) }' /proc/meminfo
}

has_active_swap() {
  [ -n "$(tail -n +2 "$swaps_file" 2>/dev/null)" ] || [ -n "$(swapon --show --noheadings 2>/dev/null)" ]
}

# Only ever called for a swap file this installer made (it leaves a mark next to its settings).
remove_own_swap_file() {
  swapoff "$SWAP_FILE" >>"$log_file" 2>&1 || true
  rm -f "$SWAP_FILE" >>"$log_file" 2>&1 || true
  sed -i "\#^$SWAP_FILE #d" /etc/fstab 2>>"$log_file" || true
  rm -f "$SWAP_MARK" || true
}

create_swap_file() {
  if [ ! -e "$SWAP_FILE" ]; then
    install -d -m 700 "$INSTALL_DIRECTORY" && : >"$SWAP_MARK" || return 1
    fallocate -l "$SWAP_SIZE" "$SWAP_FILE" 2>>"$log_file" || dd if=/dev/zero of="$SWAP_FILE" bs=1M count=2048 2>>"$log_file" || return 1
    chmod 600 "$SWAP_FILE" || return 1
    mkswap "$SWAP_FILE" >>"$log_file" 2>&1 || return 1
  fi
  swapon "$SWAP_FILE" >>"$log_file" 2>&1 || return 1
  grep -q "^$SWAP_FILE " /etc/fstab || printf '%s none swap sw 0 0\n' "$SWAP_FILE" >>/etc/fstab
}

ensure_swap() {
  step "Checking this server's memory"
  local memory_mb
  memory_mb="$(total_memory_mb)"
  if [ "$memory_mb" -ge "$SMALL_MACHINE_MEMORY_MB" ]; then
    say "This server has enough memory (${memory_mb} MB)."
    return 0
  fi
  if has_active_swap; then
    say "This server has ${memory_mb} MB of memory and already has swap, which is disk space used as spare memory."
    return 0
  fi
  if [ -e "$SWAP_FILE" ] && [ ! -e "$SWAP_MARK" ]; then
    warn "There's already a file at $SWAP_FILE that isn't turned on, and we didn't mark it as ours, so we left it alone and added no swap."
    say "Your community may still run fine, but it could stop if memory runs out."
    return 0
  fi
  say "This server has ${memory_mb} MB of memory, so we're adding $SWAP_SIZE of swap: disk space used as spare memory."
  if create_swap_file; then
    say "Swap is on."
    return 0
  fi
  remove_own_swap_file
  warn "We couldn't add swap here. Your community may still run fine, but it could stop if memory runs out."
}

open_firewall() {
  step "Allowing web traffic"
  if ! command -v ufw >/dev/null 2>&1 || ! ufw status 2>/dev/null | grep -q '^Status: active'; then
    say "This server's firewall (ufw) isn't on, so there's nothing to change. We left it off."
    say "Some hosting companies have their own firewall in their dashboard. If yours does, allow ports 80 and 443."
    return 0
  fi
  ufw allow 80/tcp >>"$log_file" 2>&1
  ufw allow 443/tcp >>"$log_file" 2>&1
  say "Your firewall now allows ports 80 and 443. We didn't touch your other rules, so SSH works as before."
}

download_source() {
  local reference="${COMMUNITY_REF:-main}"
  temporary_directory="$(mktemp -d)"
  say "Downloading Community's files ($reference)."
  curl -fsSL "$SOURCE_ARCHIVE_URL/$reference" | tar -xz --strip-components=1 -C "$temporary_directory" ||
    die "We couldn't download Community's files. Check this server's internet connection, then run the command again."
  source_directory="$temporary_directory"
}

locate_source() {
  local script_directory
  if [ -n "$SCRIPT_PATH" ] && [ -f "$SCRIPT_PATH" ]; then
    script_directory="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
    if [ -f "$script_directory/deploy/vps/compose.yml" ]; then
      source_directory="$script_directory"
      return 0
    fi
  fi
  download_source
}

new_secret() {
  openssl rand -hex 32
}

write_settings() {
  if [ -n "$is_upgrade" ]; then
    chmod 600 "$ENV_FILE"
    say "Keeping your existing settings and secrets in $ENV_FILE."
    return 0
  fi
  if docker volume inspect "$POSTGRES_VOLUME" >/dev/null 2>&1; then
    die "This server already has a Community database, but its settings file ($ENV_FILE) is gone.
We stopped so we don't damage your data. Put the file back from your own copy, then run the same command again."
  fi

  say "Creating your private secrets."
  local draft
  draft="$(mktemp "$INSTALL_DIRECTORY/.env.XXXXXX")"
  {
    say "# Your community's private settings. Keep them secret. Re-running the installer never changes this file."
    say "COMMUNITY_DOMAIN=$domain"
    say "APP_URL=$app_url"
    if [ -n "${COMMUNITY_BIND_ADDRESS:-}" ]; then say "COMMUNITY_BIND_ADDRESS=$COMMUNITY_BIND_ADDRESS"; fi
    say "POSTGRES_PASSWORD=$(new_secret)"
    say "SETUP_TOKEN=$(new_secret)"
    say "BETTER_AUTH_SECRET=$(new_secret)"
    if [ -n "${COMMUNITY_IMAGE:-}" ]; then say "COMMUNITY_IMAGE=$COMMUNITY_IMAGE"; fi
    if is_test_mode; then
      say "CADDY_GLOBAL_OPTIONS=local_certs"
      if [ -n "${COMMUNITY_HTTP_PORT:-}" ]; then say "COMMUNITY_HTTP_PORT=$COMMUNITY_HTTP_PORT"; fi
      if [ -n "${COMMUNITY_HTTPS_PORT:-}" ]; then say "COMMUNITY_HTTPS_PORT=$COMMUNITY_HTTPS_PORT"; fi
    fi
  } >"$draft"
  chmod 600 "$draft"
  mv "$draft" "$ENV_FILE"
  say "Saved them in $ENV_FILE. Only the administrator can read that file."
}

install_files() {
  install -m 644 "$source_directory/deploy/vps/compose.yml" "$INSTALL_DIRECTORY/compose.yml"
  install -m 644 "$source_directory/deploy/vps/Caddyfile" "$INSTALL_DIRECTORY/Caddyfile"
  install -m 755 "$source_directory/deploy/vps/community" "$HELPER_PATH"
  install -m 644 "$source_directory/deploy/vps/community-backup.service" "$SYSTEMD_DIRECTORY/community-backup.service"
  install -m 644 "$source_directory/deploy/vps/community-backup.timer" "$SYSTEMD_DIRECTORY/community-backup.timer"
}

schedule_backups() {
  if systemctl daemon-reload >>"$log_file" 2>&1 && systemctl enable --now community-backup.timer >>"$log_file" 2>&1; then
    say "Daily backups are on. We keep the last 7 in $INSTALL_DIRECTORY/backups."
    return 0
  fi
  warn "We couldn't schedule daily backups. Make them by hand with: sudo community backup"
}

use_only_saved_settings() {
  unset COMMUNITY_DOMAIN COMMUNITY_IMAGE COMMUNITY_BIND_ADDRESS COMMUNITY_HTTP_PORT COMMUNITY_HTTPS_PORT
}

write_configuration() {
  step "Writing your settings"
  locate_source
  install -d -m 700 "$INSTALL_DIRECTORY" "$INSTALL_DIRECTORY/backups"
  write_settings
  use_only_saved_settings
  install_files
  schedule_backups
}

is_postgres_running() {
  [ -n "$(compose ps --status running -q postgres 2>/dev/null)" ]
}

backup_before_upgrade() {
  [ -n "$is_upgrade" ] || return 0
  if ! is_postgres_running; then
    if [ -n "$setup_finished" ]; then warn "Your database isn't running, so we can't back it up before upgrading."; fi
    return 0
  fi
  say "Backing up your data before upgrading."
  "$HELPER_PATH" backup >/dev/null || die "We couldn't make a backup, so we stopped before changing anything. Your community is unchanged."
}

app_image() {
  local image
  image="$(read_setting COMMUNITY_IMAGE)"
  printf '%s' "${image:-$DEFAULT_IMAGE}"
}

image_id() {
  docker image inspect --format '{{.Id}}' "$1" 2>/dev/null || true
}

oom_kill_count() {
  awk '$1 == "oom_kill" { count = $2 } END { print count + 0 }' /proc/vmstat 2>/dev/null || printf '0'
}

build_failure_advice() {
  local build_output="$1" oom_kills_before="$2"
  if [ "$(oom_kill_count)" -gt "$oom_kills_before" ] ||
    grep -qE 'exit code: 137|Killed|heap out of memory|Cannot allocate memory|ENOMEM' <<<"$build_output"; then
    say "The server ran out of memory during the build. Use a server with more memory (4 GB builds it in minutes), then run the same command again."
  elif grep -qE 'EAI_AGAIN|ENOTFOUND|getaddrinfo|Temporary failure in name resolution|Could not resolve host' <<<"$build_output"; then
    say "The build couldn't look up internet addresses (DNS). Check this server's DNS settings and internet connection, then run the same command again."
  else
    say "Run the same command again. If it fails the same way, send us those lines: $ISSUES_URL"
  fi
}

# The build's output goes to the install log, so a failure can show its real cause instead of a guess.
build_from_source() {
  local image="$1" previous_image_id="$2" log_lines_before oom_kills_before build_output
  warn "We couldn't download the ready-made app, so we're building it on this server instead."
  say "That takes a long time on a small server: 30 minutes or more with 2 GB of memory and a shared processor,"
  say "and about 3 minutes with 4 GB and 2 dedicated processors. It needs about 2.5 GB of memory and swap together."
  if [ -z "$setup_finished" ]; then
    say "If you can, use a bigger server for the first install: press Ctrl+C now and run the same command there."
  fi
  say "Building. To follow along, run this in another window: sudo tail -f $log_file"
  log_lines_before="$(wc -l <"$log_file")"
  oom_kills_before="$(oom_kill_count)"
  # The host's network gives the build the server's own resolver, which also works when that is IPv6 only.
  if docker build --network host -f "$source_directory/deploy/vps/Dockerfile" -t "$image" "$source_directory" >>"$log_file" 2>&1; then
    say "Built the app."
    return 0
  fi

  build_output="$(tail -n "+$((log_lines_before + 1))" "$log_file")"
  say ""
  say "The build failed. Its last lines:"
  printf '%s\n' "$build_output" | tail -n 15 | sed 's/^/  /'
  say ""
  build_failure_advice "$build_output" "$oom_kills_before"
  say "The whole build is in $log_file."
  [ -n "$previous_image_id" ] || die "Nothing is running yet. Your settings are saved, so the next run picks up from here."
  build_failed=1
  warn "The build failed, so we're keeping the version you have. Try again later."
}

fetch_images() {
  step "Downloading the app"
  backup_before_upgrade

  local image
  image="$(app_image)"
  previous_image_id="$(image_id "$image")"

  if compose pull --quiet app >>"$log_file" 2>&1; then
    say "Downloaded the app."
  else
    build_from_source "$image" "$previous_image_id"
  fi

  compose pull --quiet postgres caddy >>"$log_file" 2>&1 ||
    die "We couldn't download the database and web server. Check this server's internet connection. Details are in $log_file."
  say "Downloaded the database and the web server."
}

start_services() {
  step "Starting your community"
  if ! compose up -d --remove-orphans >>"$log_file" 2>&1; then
    if tail -n 20 "$log_file" | grep -q 'address already in use'; then
      die "Another program on this server is using the web ports, so your community couldn't start.
Your data is safe. See what's using them with: sudo ss -ltnp
Then stop that program and run the same command again."
    fi
    die "Your community didn't start. Details are in $log_file."
  fi
  say "Started."
}

remove_replaced_image() {
  [ -n "$previous_image_id" ] || return 0
  [ "$previous_image_id" != "$(image_id "$(app_image)")" ] || return 0
  docker image rm "$previous_image_id" >>"$log_file" 2>&1 || true
}

app_health_status() {
  local container
  container="$(compose ps -q app 2>/dev/null || true)"
  [ -n "$container" ] || return 0
  docker inspect --format '{{.State.Health.Status}}' "$container" 2>/dev/null || true
}

https_responds() {
  local saved_https_port bind_address curl_options=(-fsS --max-time 10)
  saved_https_port="$(read_setting COMMUNITY_HTTPS_PORT)"
  bind_address="$(read_setting COMMUNITY_BIND_ADDRESS)"
  if is_test_mode; then curl_options+=(-k); fi
  curl "${curl_options[@]}" --resolve "$domain:${saved_https_port:-443}:${bind_address:-127.0.0.1}" "$app_url/api/health" >/dev/null 2>&1
}

wait_until_healthy() {
  step "Waiting for your community to be ready"
  local timeout_seconds="${COMMUNITY_HEALTH_TIMEOUT_SECONDS:-180}"
  local deadline=$((SECONDS + timeout_seconds))

  say "Preparing the database. This usually takes less than a minute."
  until [ "$(app_health_status)" = "healthy" ]; do
    [ "$SECONDS" -lt "$deadline" ] || die "Your community didn't start in time. Your data is safe.

See what went wrong:  sudo community logs app
Check what's running: sudo community status
Then run the same command again. If it's still stuck, tell us: $ISSUES_URL"
    sleep 3
  done
  say "The app is running."

  say "Getting your security certificate. This usually takes less than a minute."
  deadline=$((SECONDS + timeout_seconds))
  until https_responds; do
    [ "$SECONDS" -lt "$deadline" ] || die "The app is running, but we couldn't get a security certificate for $domain yet.
It keeps trying by itself, so this may fix itself within a few minutes.

Check these:
  1. $domain points at this server.
  2. Your hosting company's firewall allows ports 80 and 443.
  3. On Cloudflare, the record is set to \"DNS only\" (the grey cloud).

See what's happening: sudo community logs caddy
Your setup token:     sudo community setup-token"
    sleep 5
  done
  say "HTTPS works."
}

print_upgrade_summary() {
  say ""
  if [ -n "$build_failed" ]; then
    say "Done. Your community still runs the version you had, at $app_url"
  else
    say "Done. Your community is up to date at $app_url"
  fi
  say "Your settings and data are unchanged."
  say "To see your setup token: sudo community setup-token"
}

print_first_install_summary() {
  say ""
  say "Your community is ready."
  say ""
  say "  Address:      $app_url"
  say "  Setup token:  $(read_setting SETUP_TOKEN)"
  say ""
  say "What to do next:"
  say "  1. Save the setup token in your password manager. You need it again if you lose your admin password."
  say "     You can see it later with: sudo community setup-token"
  say "  2. Open $app_url/setup in your browser."
  say "  3. Enter the setup token, your name, your email and a password. This creates your admin account."
  say ""
  say "Backups: this server backs up your data every day and keeps the last 7."
  say "Those copies sit on the same disk as your data, so they're not enough if the server is lost."
  say "Copy one to your own computer regularly. The guide shows how:"
  say "  https://github.com/VillageHQ/community/blob/main/docs/self-host-vps.md"
  say ""
  say "To see all the commands: community"
}

print_summary() {
  step "All done"
  if is_test_mode; then warn "Test mode is on. Browsers won't trust this site. Never use test mode for a real community."; fi
  if [ -n "$is_upgrade" ] && is_setup_finished; then
    print_upgrade_summary
    return 0
  fi
  print_first_install_summary
}

main() {
  trap on_exit EXIT
  log_file="$(mktemp)"
  check_server
  choose_domain
  check_dns
  check_web_ports
  ensure_docker
  ensure_swap || warn "We couldn't finish the memory step. Your community may still run fine, but it could stop if memory runs out."
  open_firewall
  write_configuration
  fetch_images
  start_services
  wait_until_healthy
  remove_replaced_image
  print_summary
}

main "$@"
