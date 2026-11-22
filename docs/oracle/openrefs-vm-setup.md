# Openrefs VM setup: where it stopped, and the 10-minute path

**Status:** blocked at Oracle sign-in. The built-in browser is not signed in, and I don't enter passwords or handle MFA. Nothing was created in your Oracle account.

## Fastest way to continue
1. Open the browser pane in the Claude desktop app (Ctrl+Shift+B). It is on the Oracle sign-in page.
2. Sign in yourself (cloud account name, password, MFA).
3. Tell me "go". I create the VM from step 1 below.

## Or do step 1 yourself
Oracle console, region Indonesia North (Batam), Compute > Instances > Create instance:
- Name: openrefs-capture
- Image: Canonical Ubuntu 24.04 for Arm (aarch64)
- Shape: Ampere VM.Standard.A1.Flex, 2 OCPU, 12 GB. It must show "Always Free-eligible". If it doesn't, stop.
- Networking: new VCN with a public subnet, assign a public IPv4 address
- SSH keys: paste your own public key (on the PC: `ssh-keygen -t ed25519`, then the .pub file)
- Boot volume: 50 GB
- Show advanced options > Management > paste `openrefs-vm-cloud-init.yaml`
- "Out of host capacity": Batam has one availability domain, so retry later.

## After the VM is up (about 10 minutes for cloud-init to finish)
1. Restrict SSH: Networking > your VCN > Security Lists > Default > edit the port 22 ingress rule, source = your IP /32.
2. `ssh ubuntu@<public ip>`, then `sudo tailscale up` and open the link it prints.
3. Once Tailscale works, delete the port 22 rule so no inbound ports remain.
4. `sudo nano /etc/openrefs/env` and fill the values by hand. Never paste them into chat.
5. Check `/var/log/openrefs-setup-done` exists.

## Then the plan continues
- Gate 1, pilot: 50 showcase sites on the VM with deploys off, compared with the PC's tmp/daily-captures.log.
- Gate 2, mirror: `node scripts/cdn-sync.ts --no-deploy`, compare file counts with R2 before any deploy.
- Nightly database dump through a read-only role, then a systemd timer beside the PC job for two weeks.
