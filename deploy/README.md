# Deploying Kita to the Gateway VM

Kita is a static site. Terraform looks up the existing Gateway VM (it never creates, changes or destroys it),
adds a proxied Cloudflare A record for `kita_hostname`, then logs in over SSH as root and runs
`files/install.sh`. The script clones or fetches Kita into `/opt/kita`, checks out the full commit SHA
detached, creates a self-signed origin certificate once in `/etc/kita/tls`, installs the nginx server block as
`/etc/nginx/conf.d/kita.conf`, checks that nginx loads it, reloads nginx and requests the site locally.
There is no service user, no volume and no application process; nginx serves the files directly as root.

nginx serves `/`, `/index.html`, `/styles.css` and everything under `/src/` from `/opt/kita`; every other path
answers 404. Every response carries `Cache-Control: no-cache`.

## Not validated yet

`terraform validate` was not run for these files (the provider registry was not reachable when they were
written). Before the first apply, run it:

```bash
cd deploy/terraform
terraform init && terraform validate
```

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
- Your SSH key logs in as root on the VM, and you have a Hetzner API token and a Cloudflare API token that can
  edit DNS in the zone. Cloudflare SSL/TLS mode is Full (the origin certificate is self-signed).

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

2. Apply:

   ```bash
   cd deploy/terraform
   terraform init
   terraform apply
   ```

To release a new version, set `kita_git_ref` to the new full SHA and apply again. `install.sh` is safe to
re-run; the certificate is kept.
