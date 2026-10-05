# Deploying Kita to the Gateway VM

Kita is a static site. Terraform looks up the existing Gateway VM (it never creates, changes or destroys it),
adds a proxied Cloudflare A record for `kita_hostname`, applies its own Hetzner firewall `kita-ssh` to the VM
(by label) that opens port 22 to the deploying machine, then logs in over SSH as root and runs
`files/install.sh`. The script clones or fetches Kita into `/opt/kita`, checks out the full commit SHA
detached, creates a self-signed origin certificate once in `/etc/kita/tls`, installs the nginx server block as
`/etc/nginx/conf.d/kita.conf`, checks that nginx loads it, reloads nginx and requests the site locally.
There is no service user, no volume and no application process; nginx serves the files directly as root.

nginx serves `/`, `/index.html`, `/styles.css` and everything under `/src/` from `/opt/kita`; every other path
answers 404. Every response carries `Cache-Control: no-cache`.

## SSH access from a changing IP

Gateway's own firewall only opens port 22 to the IP Gateway was last applied from. Kita does not rely on it:
every plan detects this machine's public IPv4 (`api.ipify.org`, falling back to `ipv4.icanhazip.com`) and
`kita-ssh` allows port 22 from that `/32`. Hetzner combines the rules of all firewalls on a server, so this
only adds access. A changed IP (for example on Starlink) is picked up by the next `terraform apply`. To pin
fixed ranges instead, set `ssh_allow_cidrs`.

Gateway's `hcloud_server` must set `ignore_remote_firewall_ids = true`; otherwise every Gateway apply tries to
detach `kita-ssh` from the VM.

## Prerequisites

- The Gateway VM carries the Hetzner label matched by `server_label_selector` (default `project=gateway`) and
  that selector matches exactly one server; otherwise the plan fails.
- Gateway's nginx includes the `conf.d` directory. Inside its `http { }` block it needs this line:

  ```nginx
  include /etc/nginx/conf.d/*.conf;
  ```

  If it is missing, `install.sh` stops with an error that names this file; add the line, re-apply Gateway and
  apply Kita again.
- The commit to deploy is on `main` at github.com/IVIR3zaM/Kita (the VM clones the public repository without
  credentials). Get its full SHA with `git rev-parse origin/main`.
- Your SSH key logs in as root on the VM, and you have a Hetzner API token with read and write access (Kita
  manages the `kita-ssh` firewall) and a Cloudflare API token that can edit DNS in the zone. Cloudflare SSL/TLS mode is Full (the origin certificate is self-signed).

## Deploy

1. Copy `deploy/terraform/terraform.tfvars.example` to `deploy/terraform/terraform.tfvars` (gitignored) and fill
   it in:

   | Variable | Meaning | Default |
   | --- | --- | --- |
   | `hcloud_token` | Hetzner API token | required |
   | `cloudflare_api_token` | Cloudflare API token | required |
   | `cloudflare_zone_id` | Zone that holds the hostname | required |
   | `kita_hostname` | Public FQDN, for example `kita.example.com` | required |
   | `kita_git_ref` | Full 40-character lowercase commit SHA | required |
   | `kita_repo_url` | Public Git URL | `https://github.com/IVIR3zaM/Kita.git` |
   | `server_label_selector` | Label selector of the Gateway VM | `project=gateway` |
   | `ssh_private_key_path` | Private key for root on the VM | `~/.ssh/id_ed25519` |
   | `ssh_allow_cidrs` | CIDRs allowed to SSH for the deploy | this machine's public IPv4 |

2. Apply:

   ```bash
   cd deploy/terraform
   terraform init
   terraform apply
   ```

To release a new version, set `kita_git_ref` to the new full SHA and apply again. `install.sh` is safe to
re-run; the certificate is kept.
