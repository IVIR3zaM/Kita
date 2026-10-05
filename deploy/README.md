# Deploying Kita to the Gateway VM

Kita is a static site. Terraform looks up the existing Gateway VM (it never creates, changes or destroys it),
adds a proxied Cloudflare A record for `kita_hostname`, applies its own Hetzner firewall `kita-ssh` to the VM
(by label) that opens port 22 to the deploying machine, then logs in over SSH as root and runs
`files/install.sh`. The script clones or fetches Kita into `/opt/kita`, checks out the full commit SHA
detached, creates a self-signed origin certificate once in `/etc/kita/tls`, installs the nginx server block as
`/etc/nginx/conf.d/kita.conf`, checks that nginx loads it, reloads nginx and requests the site locally.
There is no service user, no volume and no application process; nginx serves the files directly as root.
Terraform's state lives in Cloudflare R2. You deploy either from your machine or from GitHub Actions
(`.github/workflows/ci.yml`); both use the same state and lock.

nginx serves `/`, `/index.html`, `/styles.css` and everything under `/src/` from `/opt/kita`; every other path
answers 404. Every response carries `Cache-Control: no-cache`.

## SSH access from a changing IP

Gateway's own firewall only opens port 22 to the IP Gateway was last applied from. Kita does not rely on it:
every plan detects this machine's public IPv4 (`api.ipify.org`, falling back to `ipv4.icanhazip.com`) and
`kita-ssh` allows port 22 from that `/32`. Hetzner combines the rules of all firewalls on a server, so this
only adds access. A changed IP (for example on Starlink) is picked up by the next `terraform apply`, and a CI
runner gets in the same way. To pin fixed ranges instead, set `ssh_allow_cidrs`.

Gateway's `hcloud_server` must set `ignore_remote_firewall_ids = true`; otherwise every Gateway apply tries to
detach `kita-ssh` from the VM.

## Prerequisites

- terraform 1.16.5 (the version CI pins; the module needs >= 1.10 for the R2 lock file).
- A Cloudflare R2 bucket and an R2 API token for the state (see [R2 state backend](#r2-state-backend)).
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

## R2 state backend

Gateway, Sonar and Kita share one private R2 bucket and one R2 API token (Object Read & Write on that bucket).
Each project has its own key; Kita's is `kita/terraform.tfstate` (set in `versions.tf`). Terraform locks the
state with a lock file next to it in the bucket.

1. In Cloudflare, create the private bucket once (or reuse the one Gateway and Sonar already use) and an R2 API
   token scoped to it. Note the account ID, the bucket name, and the token's access key ID and secret access key.
2. Create the backend config (gitignored), fill in the bucket, account ID and the token's access key ID
   and secret access key, then chmod 600 backend.hcl:

   ```bash
   cd deploy/terraform
   cp backend.hcl.example backend.hcl
   # Edit backend.hcl and replace the placeholders, then:
   chmod 600 backend.hcl
   ```

3. The R2 credentials in `backend.hcl` take precedence over any AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
   AWS_PROFILE variables or `~/.aws` in your shell, so nothing is exported and other AWS profiles and
   `~/.aws` stay untouched. If you have a root already initialized before the keys were added to
   `backend.hcl`, re-initialize it once with:

   ```bash
   terraform init -reconfigure -backend-config=backend.hcl
   ```

4. One time only, if you already have a local `terraform.tfstate` from an earlier deploy, move it into R2:

   ```bash
   terraform init -migrate-state -backend-config=backend.hcl
   ```

   Answer yes to copy the state. Afterwards `terraform state list` must show the DNS record, the `kita-ssh`
   firewall and the install; then keep the old local state files only as a private backup. On a first-ever
   deploy there is nothing to migrate: run `terraform init -backend-config=backend.hcl`.

## Deploy from your machine

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

2. With `backend.hcl` filled in (see above), init and apply:

   ```bash
   cd deploy/terraform
   terraform init -backend-config=backend.hcl
   terraform apply -lock-timeout=10m
   ```

To release a new version, set `kita_git_ref` to the new full SHA and apply again. `install.sh` is safe to
re-run; the certificate is kept.

## GitHub Actions

`.github/workflows/ci.yml` (workflow `CI`) has two jobs:

- `test` runs on every push to any branch, every pull request and every manual dispatch: `node --test` on
  Node 22. It uses no environment and no secret.
- `deploy` needs `test` and runs only after a push to `main` or a manual dispatch. It applies `deploy/terraform`
  on the R2 backend.

What triggers a deploy:

- **Push to main:** the pushed commit is tested and deployed.
- **Dispatch:** Actions, CI, Run workflow, with input `ref` (a branch, tag or SHA; default `main`). Both jobs
  check out that ref, and `deploy` resolves it to the full commit SHA it hands terraform as `kita_git_ref`, so
  the VM always installs one exact commit. The ref must be pushed to GitHub. From the command line:
  `gh workflow run ci.yml -f ref=main`.

Set up once, in the repository settings:

1. Create the environment `production` and limit its deployment branches to `main`. The `deploy` job runs in it.
2. Add these secrets and variables to the `production` environment:

   | Name | Kind | Terraform variable or use |
   |---|---|---|
   | `HCLOUD_TOKEN` | secret | `hcloud_token`; also lists the Gateway VM to mask its IP |
   | `CLOUDFLARE_API_TOKEN` | secret | `cloudflare_api_token` |
   | `CLOUDFLARE_ZONE_ID` | secret | `cloudflare_zone_id` |
   | `KITA_HOSTNAME` | secret | `kita_hostname` |
   | `SSH_PRIVATE_KEY` | secret | written to a mode-600 file in the runner's temp dir; its path is `ssh_private_key_path` |
   | `R2_ACCESS_KEY_ID` | secret | `AWS_ACCESS_KEY_ID` for the R2 backend |
   | `R2_SECRET_ACCESS_KEY` | secret | `AWS_SECRET_ACCESS_KEY` for the R2 backend |
   | `R2_ACCOUNT_ID` | variable | endpoint `https://<account-id>.r2.cloudflarestorage.com` in the generated `backend.hcl` |
   | `R2_BUCKET` | variable | `bucket` in the generated `backend.hcl` |

   `ssh_allow_cidrs` is not set in CI, so `kita-ssh` opens port 22 to the runner's own IPv4 for that run.

How the deploy job behaves:

- **One at a time:** every deploy joins the `deploy` concurrency queue and waits; none is cancelled, because an
  apply cut short could leave the R2 lock held.
- **Empty-state guard:** after `terraform init` the job checks `terraform state list`. If the state is empty
  (not migrated to R2, or the wrong bucket or key) it fails before apply, because an apply would recreate
  `kita-ssh` and the DNS record.
- **Lock:** apply runs with `-lock-timeout=10m`, so it waits for a local run that holds the lock.
- **Logs are public.** The repository is public, so anyone can read the workflow logs. The job masks the
  Gateway VM's IPv4 before any terraform call, runs terraform without the output wrapper and never runs
  `terraform output`.

## Coexistence with Gateway and Sonar

Kita shares the Gateway VM with Gateway and Sonar, and the bucket with both.

- **Gateway replaces the VM:** while Gateway swaps the VM, two servers briefly carry `project=gateway`. A Kita
  deploy in that window fails its exactly-one-server check before changing anything; re-run it once the old
  server is gone.
- **Gateway redeploys Kita:** after Gateway's workflow replaces the VM, it dispatches this workflow (`ci.yml`
  with `ref=main`), so Kita is installed again on the new VM without you doing anything.
- **nginx:** Kita's `kita.conf` sits in `/etc/nginx/conf.d/` next to Sonar's, and Gateway's `nginx.conf`
  includes them all. Together they must pass `nginx -t`; the install stops before reloading nginx if they
  don't. Keep server names and listen options compatible across the three projects.
- **Lock:** a local apply and a CI run use the same R2 state and lock, so whichever starts second waits (up to
  `-lock-timeout=10m`).

## Operations

- **Upgrade:** push to `main`. CI tests the commit and deploys it. For a local apply instead, set
  `kita_git_ref` to the current main SHA first (`git rev-parse origin/main`); an older SHA would roll Kita back.
- **Gateway redeploy:** if redeploying Gateway replaces the VM, Gateway's workflow dispatches Kita's deploy; if
  it doesn't, run `gh workflow run ci.yml -f ref=main`.
- **Secrets:** state lives in R2, not on your machine, and holds secrets; keep the bucket private.
  `backend.hcl` now holds the R2 keys. Terraform keeps a copy in the gitignored `.terraform/` and in any
  saved `-out` plan file, so never share those. `terraform.tfvars` and `backend.hcl` are gitignored; never
  commit them, the R2 credentials or the SSH key.
