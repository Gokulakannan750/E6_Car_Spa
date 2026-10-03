# Secrets Remediation (Phase 0, P0-1)

**Status:** credentials rotated where this session could do so safely; the database password rotation and
git-history cleanup **require the owner's action** and have **not** been executed.
No secret value appears in this document.

## 1. What was exposed

| Secret | Where | Commits | Still valid? |
|---|---|---|---|
| PostgreSQL password for user `postgres` (9 chars, starts `Go`) | `backend/api/CarSpaManagement.Api/appsettings.Development.json`, `.../appsettings.json`, and a committed build copy `.../bin/Debug/net10.0/appsettings.Development.json` | introduced `0977bf93` (2026-08-21), present in `86cb2a2d` (2026-08-23), removed in `84bb640e` (2026-08-27) | **Yes** — the local development connection (user-secrets) still uses this same password. Treat as compromised. |
| JWT signing key (starts `E6Ca`) | `.../appsettings.json`, `.../appsettings.Development.json` | `86cb2a2d` → removed in `84bb640e` | No longer in use (the active key differed and has now been rotated again). |
| WhatsApp/Aadhaar encryption key | never committed | — | Not exposed; **must not be rotated** without re-encrypting stored data. |

The commits are reachable from 23 remote branches on `github.com/Gokulakannan750/E6_Car_Spa` (57 local and
remote refs in total). Anyone who has cloned or forked the repository has these values. Removing a secret
from the working tree does **not** make it safe; rotation is what makes it safe.

## 2. Done in Phase 0

- Working-tree `appsettings*.json` contain only the `CHANGE_ME` placeholder.
- Local development JWT signing key regenerated (64 random bytes) in .NET user-secrets (outside the repo).
  Existing desktop/Android sessions must log in again after the API restarts.
- Production refuses to start with a missing or placeholder database password
  (`StartupConfigurationGuard`), and warns when connecting as the `postgres` superuser.
- `scripts/db/create-app-role.sql` creates a least-privilege `carspa_app` role.

## 3. Required owner actions

1. **Rotate the PostgreSQL `postgres` password** on every server that ever used it (development PC and any
   LAN/production server):
   ```sql
   ALTER ROLE postgres WITH PASSWORD '<new long random password>';
   ```
   Then update the connection string in user-secrets (development) or the server's environment
   variables (production). Do not reuse the old value anywhere.
2. **Create the application role** (`scripts/db/create-app-role.sql`) and switch the API to it
   (see `docs/PRODUCTION_CONFIGURATION.md` §3).
3. If PostgreSQL ever listened on a network interface with that password, review `pg_hba.conf`
   (restrict to `127.0.0.1`/trusted LAN) and check the PostgreSQL logs for unexpected logins.
4. Decide on history cleanup (below).

## 4. Git history cleanup (NOT executed — requires approval)

Rewriting history changes every commit hash after `0977bf93` on all 57 refs, requires a force-push of
every affected branch, and every collaborator must re-clone. It is only worthwhile if the repository is,
or may become, accessible to people who should not have the old credentials. **Rotation (§3) is required
either way.**

Recommended procedure with [`git-filter-repo`](https://github.com/newren/git-filter-repo):

```bash
# 0. Coordinate: no one pushes during the rewrite. Work on a fresh mirror clone.
git clone --mirror https://github.com/Gokulakannan750/E6_Car_Spa.git e6-rewrite.git
cd e6-rewrite.git

# 1. Create replacements.txt OUTSIDE the repository, one literal per line:
#      <old-postgres-password>==>REMOVED-ROTATED
#      <old-jwt-key>==>REMOVED-ROTATED
#    (Take the exact values from your password manager; never commit this file.)

# 2. Replace the literals everywhere in history and drop committed build output.
git filter-repo --replace-text ../replacements.txt \
                --path-glob 'backend/api/CarSpaManagement.Api/bin/*' --invert-paths

# 3. Verify nothing remains.
git log --all -p | grep -c "<old-postgres-password>"   # must print 0

# 4. Push the rewritten history (force) — only after approval.
git push --force --mirror origin

# 5. Every collaborator re-clones. Delete old forks/clones. Ask GitHub Support to purge cached
#    views of the old commits if the repository was ever public.
```

Alternative: BFG Repo-Cleaner (`bfg --replace-text replacements.txt`) followed by
`git reflog expire --expire=now --all && git gc --prune=now --aggressive`.

## 5. Prevention

- Keep secrets only in user-secrets (development) and environment variables / a secret manager (production).
- Add a secret scanner (for example gitleaks) as a pre-commit hook and in CI (Phase 5).
- Never commit `bin/`, `obj/` or build output (already in `.gitignore`).
