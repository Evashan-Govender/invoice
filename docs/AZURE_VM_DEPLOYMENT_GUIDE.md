# Invoice AI: Azure VM deployment guide

This guide deploys Invoice AI to a single Ubuntu virtual machine (VM) in Azure.
It uses Docker Compose to run the frontend, FastAPI backend, PostgreSQL database,
and Nginx reverse proxy on one server.

This is suitable for a pilot or small production workload. It is not a
high-availability design: if the VM is stopped or fails, the whole application is
unavailable until it is restored.

## 1. Resulting architecture

```text
Browser
  |
  | HTTP/HTTPS (80/443)
  v
Azure Public IP
  |
  v
Network Security Group (firewall)
  |
  v
Ubuntu VM
  |
  +-- Nginx (only public container)
       |-- Next.js frontend
       `-- FastAPI backend
              `-- PostgreSQL database
```

The frontend calls the backend through `/api`. Nginx forwards that path internally,
so PostgreSQL (5432), FastAPI (8000), and Next.js (3000) are not exposed to the
internet.

## 2. Azure resources created

| Resource | Purpose |
|---|---|
| Resource group | Logical container for all deployment resources. |
| Ubuntu VM | Runs Docker and the application containers. |
| Managed OS disk | Holds the VM, PostgreSQL Docker volume, and uploaded invoices. |
| Public IP | Lets users access the web application. |
| Virtual network, subnet, NIC | Private Azure network connected to the VM. |
| Network Security Group (NSG) | Firewall rules for SSH and the website. |
| System-assigned managed identity | Optional future integration with Azure Key Vault. |

The recommended starter size is `Standard_B2s` (2 vCPU, 4 GB RAM) with a 64-GB
OS disk. Increase the VM size or disk before processing a sustained high volume of
large invoices.

## 3. Prerequisites

On your Windows administration computer, install:

- Azure CLI
- OpenSSH client (included with current Windows versions)
- Git, if you deploy from a repository
- A valid Google Gemini API key

You also need:

- An Azure subscription where you can create resource groups, VMs, networking,
  and disks.
- A public SSH key. This guide creates a dedicated one.
- The project source code, including `docker-compose.production.yml`, both
  Dockerfiles, and `deploy/nginx.conf`.

Before continuing, commit the production deployment files to your Git repository
or keep a local copy of the complete project for the archive-transfer approach in
this guide.

## 4. Sign in to Azure

Open a new PowerShell window and run:

```powershell
az login
az account show --output table
```

If `az` is not found immediately after installation, either reopen PowerShell or
use the installed executable directly:

```powershell
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" login
```

If you have multiple subscriptions, select the intended one:

```powershell
az account list --output table
az account set --subscription "<subscription-name-or-id>"
```

## 5. Create a dedicated SSH key

Use a separate key for this VM. Do not email or commit its private-key file.

```powershell
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\invoice_ai_azure" -C "invoice-ai-azure"
```

Press Enter for the default passphrase prompt, or use a strong passphrase if the
key will be stored on a shared or portable computer.

This creates:

- `C:\Users\<you>\.ssh\invoice_ai_azure` — private key; keep secret.
- `C:\Users\<you>\.ssh\invoice_ai_azure.pub` — public key; Azure adds this to
  the VM.

## 6. Choose names and find your current public IP

The example below uses South Africa North. Change the names only if necessary;
they are used in later commands.

```powershell
$resourceGroup = "invoice-ai-rg"
$vmName = "invoice-ai-vm"
$location = "southafricanorth"
$adminUser = "azureuser"
$sshKey = "$env:USERPROFILE\.ssh\invoice_ai_azure.pub"
$yourPublicIp = (Invoke-RestMethod -Uri "https://api.ipify.org").ToString()
$yourPublicIp
```

`$yourPublicIp` is used to restrict SSH. If your internet connection changes later,
update the NSG rule before trying to connect again.

## 7. Create the Azure resource group and VM

Create the resource group:

```powershell
az group create --name $resourceGroup --location $location
```

Create the VM. `--nsg-rule NONE` deliberately starts with no public ports open.

```powershell
az vm create `
  --resource-group $resourceGroup `
  --name $vmName `
  --image Ubuntu2204 `
  --size Standard_B2s `
  --admin-username $adminUser `
  --ssh-key-values $sshKey `
  --public-ip-sku Standard `
  --nsg-rule NONE `
  --os-disk-size-gb 64 `
  --assign-identity
```

Retrieve and store the public IP:

```powershell
$vmPublicIp = az vm show --resource-group $resourceGroup --name $vmName `
  --show-details --query publicIps --output tsv
$vmPublicIp
```

## 8. Configure the firewall

Find the VM's NSG name:

```powershell
$nsgName = az network nic show --resource-group $resourceGroup `
  --name "$vmName`VMNic" --query networkSecurityGroup.id --output tsv
$nsgName = Split-Path $nsgName -Leaf
```

Allow SSH only from your current public IP:

```powershell
az network nsg rule create `
  --resource-group $resourceGroup `
  --nsg-name $nsgName `
  --name allow-ssh-current-ip `
  --priority 100 `
  --direction Inbound `
  --access Allow `
  --protocol Tcp `
  --source-address-prefixes $yourPublicIp `
  --destination-port-ranges 22
```

Allow public HTTP access to the application:

```powershell
az network nsg rule create `
  --resource-group $resourceGroup `
  --nsg-name $nsgName `
  --name allow-http `
  --priority 110 `
  --direction Inbound `
  --access Allow `
  --protocol Tcp `
  --source-address-prefixes Internet `
  --destination-port-ranges 80
```

Do **not** create rules for ports 5432, 8000, or 3000. They must remain private.

Test the SSH connection:

```powershell
ssh -i "$env:USERPROFILE\.ssh\invoice_ai_azure" "$adminUser@$vmPublicIp"
```

Type `exit` after confirming the login works.

## 9. Package and copy the source code

Run these commands in the project root on your administration computer. This
approach does not require the VM to have GitHub credentials.

```powershell
tar -a -c -f C:\tmp\invoice-ai-deploy.zip `
  --exclude=.git `
  --exclude=node_modules `
  --exclude=.next `
  --exclude=venv `
  --exclude=__pycache__ `
  --exclude=uploads `
  --exclude=.env `
  --exclude=.env.local `
  .

scp -i "$env:USERPROFILE\.ssh\invoice_ai_azure" `
  C:\tmp\invoice-ai-deploy.zip `
  "${adminUser}@${vmPublicIp}:/tmp/invoice-ai-deploy.zip"
```

The archive deliberately excludes environment files, uploaded invoices, local
dependencies, and Git history.

## 10. Install Docker and unpack the application

Connect to the VM:

```powershell
ssh -i "$env:USERPROFILE\.ssh\invoice_ai_azure" "$adminUser@$vmPublicIp"
```

On the VM, install Docker and Docker Compose:

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 unzip
sudo mkdir -p /opt/invoice-ai
sudo unzip -oq /tmp/invoice-ai-deploy.zip -d /opt/invoice-ai
sudo chown -R azureuser:azureuser /opt/invoice-ai
cd /opt/invoice-ai
```

## 11. Configure production environment variables

Create the protected production configuration file:

```bash
cd /opt/invoice-ai
cp .env.production.example .env.production
chmod 600 .env.production
```

Generate values for the database password and JWT secret:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Use the first generated value for both occurrences of the database password and
the second for `JWT_SECRET_KEY`. Edit the file securely:

```bash
sudoedit /opt/invoice-ai/.env.production
```

Use this structure, replacing all placeholder values:

```env
POSTGRES_DB=invoiceai
POSTGRES_USER=invoiceai
POSTGRES_PASSWORD=<first-random-value>
DATABASE_URL=postgresql://invoiceai:<first-random-value>@postgres:5432/invoiceai
JWT_SECRET_KEY=<second-random-value>

# Optional server-wide fallback. Users can alternatively save their own key in Settings.
GEMINI_API_KEY=<your-gemini-api-key>

CORS_ORIGINS=http://<vm-public-ip>

# Leave blank until you have an HTTPS domain and configure Google OAuth.
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_APP_URL=http://<vm-public-ip>
```

Important:

- `POSTGRES_PASSWORD` and the password inside `DATABASE_URL` must be identical.
- Never commit `.env.production` or send it in email/chat.
- A raw HTTP public IP is fine for initial invoice processing, but Gmail and Xero
  OAuth should wait for a stable HTTPS domain.
- Xero credentials are entered through the application Settings page and stored
  per user in the database; they are not normally global `.env` values.

## 12. Build and start the application

From `/opt/invoice-ai` on the VM:

```bash
sudo docker compose -f docker-compose.production.yml --env-file .env.production config --quiet
sudo docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
sudo docker compose -f docker-compose.production.yml --env-file .env.production ps
```

Expected services:

- `postgres` — healthy
- `backend` — running
- `frontend` — running
- `nginx` — running and bound to port 80

Verify from the VM:

```bash
curl http://localhost/api/health
```

Expected response:

```json
{"status":"healthy"}
```

Then open this in a browser:

```text
http://<vm-public-ip>
```

## 13. Configure Gemini and use the application

You can use either method:

1. Set `GEMINI_API_KEY` in `.env.production` for a server-wide fallback.
2. Register a user in the application and save that user's Gemini key in Settings.

The per-user Settings method is generally preferable when different users must use
their own Gemini credentials.

After changing only `GEMINI_API_KEY`, restart the backend:

```bash
cd /opt/invoice-ai
sudo docker compose -f docker-compose.production.yml --env-file .env.production up -d --force-recreate backend
```

## 14. Gmail OAuth and HTTPS domain setup

Do this only after a DNS name points to the VM's public IP.

1. Add DNS `A` record, for example `invoice.example.com`, pointing to the VM IP.
2. Add an NSG rule for port 443.
3. Configure Nginx and a TLS certificate (for example, Let's Encrypt).
4. Update `.env.production`:

   ```env
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=<Google OAuth client ID>
   GOOGLE_CLIENT_SECRET=<Google OAuth client secret>
   NEXT_PUBLIC_APP_URL=https://invoice.example.com
   CORS_ORIGINS=https://invoice.example.com
   ```

5. In Google Cloud Console, add:

   - Authorized JavaScript origin: `https://invoice.example.com`
   - Redirect URI: `https://invoice.example.com/api/auth/gmail/callback`

6. Rebuild the frontend after changing any `NEXT_PUBLIC_*` value:

   ```bash
   cd /opt/invoice-ai
   sudo docker compose -f docker-compose.production.yml --env-file .env.production up -d --build frontend backend
   ```

The frontend Dockerfile and Compose configuration must include the Google client ID
as a frontend build argument and pass `GOOGLE_CLIENT_SECRET` to the backend.

## 15. Routine operations

Run these from `/opt/invoice-ai` on the VM.

View service status:

```bash
sudo docker compose -f docker-compose.production.yml --env-file .env.production ps
```

View logs:

```bash
sudo docker compose -f docker-compose.production.yml --env-file .env.production logs --tail=100 backend
sudo docker compose -f docker-compose.production.yml --env-file .env.production logs --tail=100 frontend
sudo docker compose -f docker-compose.production.yml --env-file .env.production logs --tail=100 nginx
```

Restart the stack:

```bash
sudo docker compose -f docker-compose.production.yml --env-file .env.production restart
```

Stop it without deleting data:

```bash
sudo docker compose -f docker-compose.production.yml --env-file .env.production down
```

Start it again:

```bash
sudo docker compose -f docker-compose.production.yml --env-file .env.production up -d
```

## 16. Updating the application

For a source archive deployment:

1. Create a new archive on the administration computer.
2. Copy it to the VM with `scp`.
3. On the VM, stop the services, extract the archive over `/opt/invoice-ai`, and
   start with `--build`.

```bash
cd /opt/invoice-ai
sudo docker compose -f docker-compose.production.yml --env-file .env.production down
sudo unzip -oq /tmp/invoice-ai-deploy.zip -d /opt/invoice-ai
sudo chown -R azureuser:azureuser /opt/invoice-ai
sudo docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

Do not overwrite `.env.production`. Keep a backup before application updates.

## 17. Backups and recovery

The database and uploaded files are Docker volumes stored on the VM disk. A VM disk
failure without backup can lose both.

At minimum, create a PostgreSQL dump regularly:

```bash
cd /opt/invoice-ai
sudo docker compose -f docker-compose.production.yml --env-file .env.production exec -T postgres \
  pg_dump -U invoiceai invoiceai > invoiceai-$(date +%F).sql
```

Copy the resulting SQL backup to a secure off-VM location. For stronger recovery,
configure Azure Backup for the VM and regularly test restoring both the database
and uploaded-file volume.

## 18. Security checklist

- Keep port 22 restricted to known administrative IP addresses.
- Keep ports 5432, 8000, and 3000 closed in the NSG.
- Add a domain and HTTPS before enabling OAuth or handling sensitive production data.
- Use long random database and JWT secrets.
- Protect `.env.production` with mode `600`.
- Back up the database and invoices off the VM.
- Apply Ubuntu security updates regularly:

  ```bash
  sudo apt-get update
  sudo apt-get upgrade -y
  ```

- For a stronger secret-management design, store secrets in Azure Key Vault and
  grant the VM's system-assigned managed identity the minimum required access.

## 19. Cost control and cleanup

Stop billing for VM compute while keeping its disk and IP:

```powershell
az vm deallocate --resource-group $resourceGroup --name $vmName
```

Start it again:

```powershell
az vm start --resource-group $resourceGroup --name $vmName
```

To permanently delete all deployment resources and their data:

```powershell
az group delete --name $resourceGroup --yes --no-wait
```

This deletes the VM, public IP, disk, network, database, uploaded invoices, and
all other resources inside the group. Take verified backups first.
