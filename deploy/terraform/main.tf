provider "hcloud" {
  token = var.hcloud_token
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# Kita shares the existing Gateway VM; Terraform only looks it up, never manages it.
data "hcloud_servers" "gateway" {
  with_selector = var.server_label_selector

  lifecycle {
    postcondition {
      condition     = length(self.servers) == 1
      error_message = "Label selector \"${var.server_label_selector}\" must match exactly one Hetzner server (the Gateway VM)."
    }
  }
}

# The deploying machine's public IPv4, re-read on every plan so a changing IP (e.g. Starlink) still gets in.
data "http" "my_ip_primary" {
  url = "https://api.ipify.org"
  retry {
    attempts = 2
  }
}

data "http" "my_ip_fallback" {
  url = "https://ipv4.icanhazip.com"
  retry {
    attempts = 2
  }
}

locals {
  detected_ip = try(
    chomp(data.http.my_ip_primary.response_body),
    chomp(data.http.my_ip_fallback.response_body),
  )
  ssh_allow_cidrs = length(var.ssh_allow_cidrs) == 0 ? ["${local.detected_ip}/32"] : var.ssh_allow_cidrs

  server     = data.hcloud_servers.gateway.servers[0]
  deploy_dir = "/root/kita-deploy"

  kita_conf = templatefile("${path.module}/templates/kita.conf.tftpl", {
    hostname = var.kita_hostname
  })

  install_args = [var.kita_repo_url, var.kita_git_ref, var.kita_hostname]
  # Single-quote every argument so the remote shell passes it through verbatim.
  install_command = join(" ", concat(
    ["bash", "${local.deploy_dir}/install.sh"],
    [for arg in local.install_args : "'${replace(arg, "'", "'\\''")}'"],
  ))
}

resource "cloudflare_dns_record" "kita" {
  zone_id = var.cloudflare_zone_id
  name    = var.kita_hostname
  type    = "A"
  content = local.server.ipv4_address
  proxied = true
  ttl     = 1
}

# Kita's own firewall on the Gateway VM: SSH from the deploying machine only. Hetzner combines the rules of all
# firewalls on a server, so this only adds access next to Gateway's firewall.
resource "hcloud_firewall" "kita_ssh" {
  name = "kita-ssh"

  rule {
    direction   = "in"
    protocol    = "tcp"
    port        = "22"
    source_ips  = local.ssh_allow_cidrs
    description = "SSH for Kita deploys"
  }

  apply_to {
    label_selector = var.server_label_selector
  }

  lifecycle {
    precondition {
      condition     = length(var.ssh_allow_cidrs) > 0 || can(regex("^[0-9]{1,3}(\\.[0-9]{1,3}){3}$", local.detected_ip))
      error_message = "Could not detect this machine's public IPv4 (got \"${local.detected_ip}\"). Set ssh_allow_cidrs."
    }
  }
}

resource "terraform_data" "install" {
  depends_on = [cloudflare_dns_record.kita, hcloud_firewall.kita_ssh]

  triggers_replace = {
    git_ref    = var.kita_git_ref
    repo_url   = var.kita_repo_url
    hostname   = var.kita_hostname
    server_id  = local.server.id
    install_sh = filesha256("${path.module}/files/install.sh")
    kita_conf  = sha256(local.kita_conf)
  }

  connection {
    type        = "ssh"
    host        = local.server.ipv4_address
    user        = "root"
    private_key = file(pathexpand(var.ssh_private_key_path))
  }

  provisioner "remote-exec" {
    inline = ["install -d -m 0700 ${local.deploy_dir}"]
  }

  provisioner "file" {
    content     = local.kita_conf
    destination = "${local.deploy_dir}/kita.conf"
  }

  provisioner "file" {
    source      = "${path.module}/files/install.sh"
    destination = "${local.deploy_dir}/install.sh"
  }

  provisioner "remote-exec" {
    inline = [local.install_command]
  }
}
