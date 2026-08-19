# Phase 2 Notes

Here's everything that went wrong while I containerized EventHub and how I fixed each one.

## 1. Containers wouldn't start at all — netavark/nftables error
Every single `podman run` blew up with `nftables error: "nft" did not return successfully while applying ruleset`. Took me forever to figure out why. Turns out Podman 6.0 dropped its iptables firewall backend, and WSL2's kernel doesn't fully support the nftables backend that replaced it. I tried setting `firewall_driver="iptables"` manually, but that just got rejected outright since the option doesn't even exist anymore in this version. In the end I gave up fighting it and switched every container to `--network host` instead of a custom bridge network. No more firewall rules needed = no more error.

## 2. Frontend build kept saying `vite: not found`
This one had two bugs hiding in it. First, `vite` is a devDependency and my `npm install` wasn't picking it up. Fixed that with `NODE_ENV=development` + `--include=dev`. Still failed. Turned out I had no `.dockerignore`, so `COPY . .` was literally overwriting the fresh `node_modules` I'd just installed inside the container with my local Windows one. Added a `.dockerignore` with `node_modules`, `dist`, `.env` and it finally worked.

## 3. Container couldn't talk to Postgres running natively on Windows
Tried `host.containers.internal` as the hostname — got connection refused on some weird link-local address (`169.254.1.2`). Didn't bother chasing why it resolved wrong; just switched to `--network host` + `127.0.0.1` since that's simpler and matches everything else in the project.

## 4. `127.0.0.1` refused connections on the custom network
Before I fully committed to `--network host`, I tried `--network eventhub-net` with `127.0.0.1` as the host — got refused again. Makes sense in hindsight: on an isolated bridge network, `127.0.0.1` points at the container itself, not the host. Another point in favor of just sticking with host networking everywhere.

## 5. Auth and notification kept timing out at a random IP
After I containerized Postgres and RabbitMQ (they used to be native), auth and notification were still failing — this time with `ETIMEDOUT` at some old LAN IP (`192.168.1.18`) that had nothing to do with anything. Realized those two containers had been created earlier with the wrong env vars baked in, and restarting a container doesn't let you change that. Had to `podman rm -f` them and recreate with `PGHOST=127.0.0.1` / the right RabbitMQ URL.

## 6. nginx wouldn't start — permission denied on port 80
`bind() to 0.0.0.0:80 failed (Permission denied)`. Port 80 needs root and nginx wasn't running as root here. Didn't want to mess with running as root just for this, so I just moved nginx to listen on 3000 instead with a quick `sed` on the config, kept the app on the same port it's always used.

## 7. Ran the script from inside `podman machine ssh` — everything broke
Wasted a chunk of time here. I SSH'd into the Podman machine to debug something, then ran the whole script from inside that session without thinking about it. Postgres readiness check kept failing even though the container was clearly up. Turns out running things from inside the machine's own VM is a totally different environment than Git Bash/PowerShell on Windows. Lesson: only go into `podman machine ssh` to fix the machine itself, never to run the actual project.

## 8. PowerShell can't run `.sh` files
Obvious in hindsight — PowerShell doesn't speak bash. Just ran it through Git Bash instead, which can still call `podman.exe` fine.

## 9. Copy-paste bug: every volume was named `mysql-data`
Wrote the infra section of the script by copying the MySQL block four times and forgot to rename the volume in three of them. So Postgres, Mongo, and Redis were all technically writing into a volume called `mysql-data`. Went back and gave each one its actual name.

## 10. Disabling the firewall killed internet access during builds
At one point I tried `firewall_driver="none"` as a fix for issue #1. Containers started fine after that, but then `podman build` couldn't reach the internet anymore to pull Maven dependencies. Fixed it with `podman build --network=host` so the build shares the host's network directly. (Ended up not needing this workaround once I moved to `--network host` everywhere anyway.)

