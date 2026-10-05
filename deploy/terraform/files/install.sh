#!/usr/bin/env bash
# Installs or upgrades Kita on the Gateway VM. Run as root by Terraform; safe to re-run.
# Usage: install.sh REPO_URL GIT_REF HOSTNAME
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "usage: $0 REPO_URL GIT_REF HOSTNAME" >&2
  exit 2
fi

repo_url=$1
git_ref=$2
hostname=$3

if [[ ! $git_ref =~ ^[0-9a-f]{40}$ ]]; then
  echo "GIT_REF must be a full 40-character lowercase commit SHA." >&2
  exit 2
fi

deploy_dir=$(cd "$(dirname "$0")" && pwd)
app_dir=/opt/kita
tls_dir=/etc/kita/tls

install_packages() {
  export DEBIAN_FRONTEND=noninteractive
  # A fresh VM may still be running cloud-init's own apt install; wait for it, and for the dpkg lock, instead of
  # failing. cloud-init exits 2 on recoverable errors and may be absent, neither of which should stop the install.
  cloud-init status --wait >/dev/null 2>&1 || true
  apt-get -o DPkg::Lock::Timeout=300 update -q
  apt-get -o DPkg::Lock::Timeout=300 install -y -q git nginx openssl curl
}

checkout_app() {
  if [[ ! -d $app_dir/.git ]]; then
    git clone --quiet "$repo_url" "$app_dir"
  else
    git -C "$app_dir" remote set-url origin "$repo_url"
    git -C "$app_dir" fetch --quiet --prune origin
  fi
  git -C "$app_dir" checkout --quiet --detach "$git_ref"
}

install_config() {
  install -d -m 0755 /etc/kita
  install -d -m 0700 "$tls_dir"
  # Cloudflare (Full mode) accepts a self-signed origin certificate; made once.
  if [[ ! -f $tls_dir/origin.crt || ! -f $tls_dir/origin.key ]]; then
    openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj "/CN=$hostname" \
      -keyout "$tls_dir/origin.key" -out "$tls_dir/origin.crt"
    chmod 0600 "$tls_dir/origin.key"
  fi
  install -m 0644 "$deploy_dir/kita.conf" /etc/nginx/conf.d/kita.conf
}

reload_nginx() {
  local config_dump
  if ! config_dump=$(nginx -T 2>&1); then
    echo "$config_dump" >&2
    exit 1
  fi
  if ! grep -qF "# configuration file /etc/nginx/conf.d/kita.conf:" <<<"$config_dump"; then
    echo "nginx does not load /etc/nginx/conf.d/kita.conf; add the include described in deploy/README.md." >&2
    exit 1
  fi
  nginx -t
  systemctl reload nginx
}

check_site() {
  local code
  code=$(curl -sk -o /dev/null -w '%{http_code}' --resolve "$hostname:443:127.0.0.1" "https://$hostname/" || true)
  if [[ $code != 200 ]]; then
    echo "https://$hostname/ answered $code locally instead of 200." >&2
    exit 1
  fi
}

install_packages
checkout_app
install_config
reload_nginx
check_site
echo "Kita $git_ref is live at https://$hostname/"
