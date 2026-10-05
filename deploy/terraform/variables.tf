variable "hcloud_token" {
  description = "Hetzner Cloud API token with read access to the project holding the Gateway VM."
  type        = string
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token allowed to edit DNS records in the zone."
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID of the domain that holds kita_hostname."
  type        = string
}

variable "kita_hostname" {
  description = "Public FQDN of Kita, for example kita.example.com."
  type        = string

  validation {
    condition     = can(regex("^([a-z0-9]([a-z0-9-]*[a-z0-9])?\\.)+[a-z]{2,}$", var.kita_hostname))
    error_message = "kita_hostname must be a lowercase fully qualified domain name, for example kita.example.com."
  }
}

variable "kita_git_ref" {
  description = "Full commit SHA on main to deploy."
  type        = string

  validation {
    condition     = can(regex("^[0-9a-f]{40}$", var.kita_git_ref))
    error_message = "kita_git_ref must be a full 40-character lowercase commit SHA."
  }
}

variable "kita_repo_url" {
  description = "Public Git URL of Kita, cloned without credentials."
  type        = string
  default     = "https://github.com/IVIR3zaM/Kita.git"
}

variable "server_label_selector" {
  description = "Hetzner label selector that matches exactly one server: the Gateway VM."
  type        = string
  default     = "project=gateway"
}

variable "ssh_private_key_path" {
  description = "Private key that logs in as root on the Gateway VM."
  type        = string
  default     = "~/.ssh/id_ed25519"
}
