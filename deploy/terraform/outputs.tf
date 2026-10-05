output "kita_url" {
  description = "Public address of Kita."
  value       = "https://${var.kita_hostname}"
}

output "server_ipv4" {
  description = "Public IPv4 of the Gateway VM."
  value       = local.server.ipv4_address
}
