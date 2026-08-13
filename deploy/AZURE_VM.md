# Azure VM deployment

This deployment uses one Ubuntu VM in South Africa North. Docker runs the frontend,
FastAPI backend, PostgreSQL, and Nginx. Only Nginx is exposed publicly on port 80.

## Prerequisites

- Azure CLI authenticated with `az login`
- An SSH public key (for example, `~/.ssh/id_ed25519.pub`)
- A Git remote or another secure way to copy this repository to the VM

## Provision the VM

Run these commands in Azure Cloud Shell or a local Bash shell after replacing the SSH key path:

```bash
RG=invoice-ai-rg
VM=invoice-ai-vm
LOCATION=southafricanorth
ADMIN=azureuser

az group create --name "$RG" --location "$LOCATION"
az vm create --resource-group "$RG" --name "$VM" \
  --image Ubuntu2204 --size Standard_B2s --admin-username "$ADMIN" \
  --ssh-key-values ~/.ssh/id_ed25519.pub --public-ip-sku Standard \
  --os-disk-size-gb 64 --assign-identity
az vm open-port --resource-group "$RG" --name "$VM" --port 80 --priority 100

az vm show --resource-group "$RG" --name "$VM" --show-details \
  --query publicIps --output tsv
```

Restrict SSH to your office/public IP with an NSG rule before using it. Do not open
ports 5432, 8000, or 3000 to the internet.

## Deploy on the VM

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker

git clone <YOUR_REPOSITORY_URL> invoice-ai
cd invoice-ai
cp .env.production.example .env.production
nano .env.production
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
docker compose -f docker-compose.production.yml ps
curl http://localhost/api/health
```

Visit `http://<VM_PUBLIC_IP>` once the health check succeeds.

## Important limitations of using a public IP

Gmail and Xero OAuth callback URLs normally require a stable HTTPS domain. Enable those
integrations only after adding a domain and TLS certificate. Keep secrets in Azure Key
Vault or the VM's protected environment file; do not commit `.env.production`.
