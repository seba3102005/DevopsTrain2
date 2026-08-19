# Phase 2 Notes

Issues encountered while containerizing and orchestrating EventHub by hand,
and how they were resolved. Fill this in as you actually run the script
on your machine -- this is a starting template, not a finished record.

## Example entry format

### Issue: <short description>

**What happened:** ...

**Why:** ...

**Fix:** ...

---

## Known things worth documenting once you hit them

- Podman on Windows requires a running `podman machine` (a Linux VM) --
  document how long `podman machine init` took and any WSL2 prerequisites.
- `--health-cmd` requires the tool it calls (`curl`, `pg_isready`, etc.) to
  actually exist inside that image -- note which images needed it added
  and why the base images didn't include it by default.
- If a service container exits immediately, `podman logs <name>` is the
  first thing to check -- record what the actual failure looked like the
  first time a dependency ordering was wrong (e.g. auth service starting
  before Postgres was truly ready to accept connections, not just running).
- Note any port conflicts with services still running natively from
  Phase 1 -- both can't bind the same host port at once.
