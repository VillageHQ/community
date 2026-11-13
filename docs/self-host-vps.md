# Run your community on your own server

This guide puts your community on a server you rent, with one command. You don't need to be an engineer. If you can copy and paste, you can do this. It takes about 20 minutes, and most of that is waiting.

> **Status:** We've run this on one rented Ubuntu 26.04 server with a real security certificate, and on fresh Ubuntu and Debian test machines. If a step doesn't match what you see, [tell us](https://github.com/VillageHQ/community/issues).

You'll need:

- A server, which hosting companies call a **VPS** (a virtual private server: a small computer you rent by the month).
- A domain name, like `yourfund.com`. Your community can use a new name under it, like `community.yourfund.com`. Only want to try it first? See [Try it without a domain](#try-it-without-a-domain).
- A way to paste a command on your server. Your hosting company's page explains how, and the next steps show you.

## 1. Rent a server

Any company works. [Hetzner](https://www.hetzner.com/cloud), [DigitalOcean](https://www.digitalocean.com/products/droplets) and [Vultr](https://www.vultr.com/products/cloud-compute/) are common choices.

Choose:

| Setting | Choose |
| --- | --- |
| System | **Ubuntu 24.04**. Ubuntu 22.04, Ubuntu 26.04 and Debian 12 work too. |
| Memory | **2 GB** is comfortable. 1 GB is the minimum. |
| Disk | 20 GB or more |
| Processor | Either kind works: x86 (also called amd64) or Arm (also called arm64) |
| Location | Near most of your members |

Write down the server's **IP address** when it's ready. It's a number like `203.0.113.10`.

Your hosting company gives you a way to log in, either a password or an SSH key. SSH is the secure way to control a server from your own computer. To connect, open Terminal on a Mac or PowerShell on Windows, and type this with your own IP address:

```sh
ssh root@203.0.113.10
```

Some companies use another username, like `ubuntu`. Their page tells you which.

## 2. Point your domain at the server

Log in to the company where you bought your domain and open its **DNS settings**. DNS is the internet's address book. It turns your domain into your server's number.

Create this record, with your own values:

| Field | Value |
| --- | --- |
| Type | `A` |
| Name | `community`, for `community.yourfund.com`. Use `@` if you're using your main domain, with nothing in front of it. |
| Value | Your server's IP address |

If an old record already exists for that name, change it. This includes any `AAAA` record, which is the same thing for newer IPv6 addresses. On Cloudflare, set the record to **DNS only**, the grey cloud.

This usually works within a few minutes, and sometimes takes up to an hour. The installer checks it for you and can wait.

## 3. Run the one command

Paste this on your server:

```sh
curl -fsSL https://raw.githubusercontent.com/VillageHQ/community/main/install.sh | sudo bash
```

It asks for your domain. Then it works through these steps and tells you what it's doing:

1. Checks your server.
2. Asks for your community's address.
3. Checks that your domain points at this server. If it doesn't, it shows the exact record to create and offers to wait.
4. Checks that no other program is using the web ports.
5. Installs Docker, the tool that runs your community.
6. Adds spare memory, if your server is small.
7. Allows web traffic, if your server has a firewall switched on.
8. Creates your private secrets and settings.
9. Downloads the app.
10. Starts everything.
11. Waits until your community answers on its secure address.
12. Shows your address and setup token.

At the end you'll see this:

```text
Your community is ready.

  Address:      https://community.yourfund.com
  Setup token:  3f9a...
```

### Try it without a domain

To try this before you have a domain, use a free name from [sslip.io](https://sslip.io), which points at your server's IP address by itself. Put your own IP address in this command:

```sh
curl -fsSL https://raw.githubusercontent.com/VillageHQ/community/main/install.sh | sudo COMMUNITY_DOMAIN=community.203.0.113.10.sslip.io bash
```

Use this for testing only. Many people share sslip.io, so a certificate can fail when too many of them ask at once. Your address also changes if your server's IP address does. Use a real domain for your real community.

## 4. Create your admin account

1. Save the setup token in your password manager. You need it again if you lose your admin password.
2. Open `https://your-domain/setup` in your browser.
3. Enter the setup token, your name, your email and a password.

Then follow [Your first 10 minutes](../README.md#your-first-10-minutes).

## Everyday commands

Run these on your server.

| Command | What it does |
| --- | --- |
| `sudo community status` | Shows what's running and your last backup |
| `sudo community logs` | Shows recent activity. Press Ctrl+C to stop. |
| `sudo community upgrade` | Installs the newest version |
| `sudo community backup` | Makes a backup now |
| `sudo community restore <file>` | Replaces your data with a backup |
| `sudo community setup-token` | Shows your setup token |

## Upgrade

Updates aren't automatic. To install the newest version:

```sh
sudo community upgrade
```

It backs up your data first. It never changes your settings or your data. If something is wrong, you can run it again safely.

## Back up and restore

Your server makes a backup every day and keeps the last 7, in `/opt/community/backups`. Everything lives in that backup: posts, members, messages, logos and photos.

**That's not enough by itself.** Those copies sit on the same disk as your data. If the server is lost, so are they. Copy one to another place at least once a week.

To copy a backup to your own computer:

1. On your server, run `sudo community status`. It shows the path of your last backup.
2. On your own computer, open Terminal or PowerShell and run this, with your server's address and that path:

   ```sh
   scp root@203.0.113.10:/opt/community/backups/community-20260101-030000.dump .
   ```

If you log in with a username other than `root`, first make a copy you can read. On your server, run this:

```sh
sudo install -o "$USER" -m 600 /opt/community/backups/community-20260101-030000.dump ~/
```

Then run `scp` with your username and the file's new place in your home folder. Delete that copy from your home folder afterward.

Backups hold everything in your community, including private messages in plain text. Keep your copies somewhere private.

To restore a backup, first run `sudo community restore` on its own to see your backups. Then pass the one you want:

```sh
sudo community restore /opt/community/backups/community-20260101-030000.dump
```

It asks you to confirm, and saves your current data first as a file starting with `before-restore`. If the restore fails, your data stays as it was.

### Move to a new server

1. Rent the new server and point your domain at it.
2. Run the one command on the new server.
3. Copy your backup to it with `scp`.
4. Run `sudo community restore` with that file.

Everyone needs to sign in again, because the new server has new secrets. Your setup token also changes, so paste your Village keys again under **Admin**, **Settings**. See it with `sudo community setup-token`.

## Change a setting

Your settings live in `/opt/community/.env`. To send invites by email, for example, add `RESEND_API_KEY` and `RESEND_FROM_ADDRESS`. The [README](../README.md#environment-variables) lists every setting.

1. Run `sudo nano /opt/community/.env`.
2. Change the line, then press Ctrl+O, Enter and Ctrl+X to save and close.
3. Run `sudo community upgrade` to apply it.

To change your address, point the new domain at your server first. Then change both `COMMUNITY_DOMAIN` and `APP_URL`.

Keep a copy of this file in your password manager. It holds your secrets.

## Troubleshooting

**"sudo: command not found":** You're already the administrator. Run the same command without the word `sudo`.

**"doesn't point at this server yet":** Your DNS record is missing or wrong. The message shows the exact record to create. Wait a few minutes after you create it, because changes take time to spread. On Cloudflare, use **DNS only**.

**"none of its own network cards has that address":** Your server sits behind NAT or a load balancer (as on Fly.io), so the address it goes out from isn't the one visitors reach it on. If your record already points at the address visitors use, it's right: run the command the message shows, which passes that address as `COMMUNITY_SERVER_IP`. It takes several addresses separated by commas, for example `COMMUNITY_SERVER_IP=203.0.113.10,2001:db8::10` when your domain has both an `A` and an `AAAA` record.

**"couldn't get a security certificate":** The app is fine, but it can't get the certificate that makes `https://` work. Check three things: your domain points at this server, your hosting company's firewall allows ports 80 and 443, and Cloudflare is on **DNS only**. It keeps trying by itself. Run `sudo community logs caddy` to see what's happening. Caddy is the program that handles certificates.

**"already using the web ports":** Another program holds port 80 or 443. The message names it. Remove that program, or start with a fresh server. If it only uses a private address, like a Tailscale one, you can keep it. The message shows the command that puts your community on your public address instead, using the `COMMUNITY_BIND_ADDRESS` setting.

**"We couldn't download the ready-made app":** Your server builds the app itself instead. That needs about 2.5 GB of memory and swap together, and the installer adds swap on small servers. It takes about 3 minutes with 4 GB of memory and 2 dedicated processors, and 30 minutes or more on a 2 GB server with a shared processor. If you can, use a bigger server for the first install. Some hosting companies let you move to a smaller plan afterwards. To follow the build, run `sudo tail -f /opt/community/install.log` in another window.

**"The build failed":** The message shows the build's last lines and what they mean: the server ran out of memory (use a server with more memory), or it couldn't look up internet addresses (check the server's DNS settings). The whole build is in `/opt/community/install.log`. Your settings are saved, so run the same command again once it's fixed.

**Running the command again after a first install that stopped:** It keeps the settings and secrets it already made and picks up where it stopped. Until someone creates the admin account, it ends with your setup token and the `/setup` steps again. After that, a run is an upgrade.

**"a file at /swapfile that isn't turned on":** The installer only adds, turns on or removes a swap file it marked as its own. It left this one alone. If your server is small, turn that swap file on yourself, or remove it and run the same command again.

**"Your community didn't start in time":** Run `sudo community logs app` and look for lines with `"scope":"migrations"` or `"scope":"health"`. They give the real cause. Then run the same command again.

**"a Community database, but its settings file is gone":** Someone deleted `/opt/community/.env`. Put it back from your own copy. Without it, your community can't open its database. If you don't have a copy, [ask us for help](https://github.com/VillageHQ/community/issues).

**A page says "Something went wrong":** Wait a minute and reload. Then run `sudo community status`, which should show `healthy`.

**The server restarted:** Nothing to do. Your community starts by itself.

**The disk is full:** Run `sudo community status` to see the free space. Old versions of the app get removed when you upgrade. You can delete old files in `/opt/community/backups`, once you've copied them somewhere safe.

**Still stuck?** [Open an issue](https://github.com/VillageHQ/community/issues). Include what `sudo community status` shows, and the end of `/opt/community/install.log`. Run `sudo tail -n 50 /opt/community/install.log` to see it. Never paste your `.env` file or your setup token.

## What it installs

Three programs, each in its own Docker container: the app, a Postgres 17 database, and Caddy, which handles certificates and HTTPS. Only ports 80 and 443 are open to the internet. The database isn't. Your files live in `/opt/community`, the `community` command in `/usr/local/bin`, and your data in a Docker volume named `community_postgres-data`.
