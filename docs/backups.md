# SQLite backups

The production and development Compose files include a `backup` worker. It
runs as a separate container and uses SQLite's online backup API through
`better-sqlite3`; copying `esigglol.db` while the app is in WAL mode is not a
safe substitute because recent committed pages may still be in the WAL file.

The worker creates a temporary file, runs `PRAGMA integrity_check`, and then
renames it into place atomically. It keeps the newest
`BACKUP_RETENTION_COUNT` files (seven by default).

## Configuration

These variables are read by the worker from `.env.local`:

| Variable | Default | Description |
|---|---:|---|
| `BACKUP_ENABLED` | `true` | Set to `false` to leave the worker idle. |
| `BACKUP_INTERVAL_SECONDS` | `86400` | Time between snapshots. |
| `BACKUP_RETRY_INTERVAL_SECONDS` | `300` | Delay after a failed snapshot. |
| `BACKUP_RUN_ON_START` | `true` | Take a snapshot as soon as the worker starts. |
| `BACKUP_RETENTION_COUNT` | `7` | Number of snapshots to retain. |
| `BACKUP_FILENAME_PREFIX` | `esigglol` | Safe filename prefix (`A-Z`, `a-z`, digits, `_`, `-`). |
| `BACKUP_HOST_PATH` | `./backups` | Host path mounted at `/app/backups`. This is a Compose interpolation variable, so define it in the shell or the Compose `.env` file (not only in `env_file`). |

The source remains `DB_PATH` (normally `/app/data/esigglol.db`). Keep the
backup directory on a different disk, host, or external mount where possible.
The app and backup worker must be able to read/write the mounted directories;
the Compose examples run the worker as UID 1000.

Start it with the rest of the stack:

```bash
mkdir -p backups
docker compose up -d --build
docker compose logs -f backup
```

For an external mount, set the path before invoking Compose, for example:

```bash
BACKUP_HOST_PATH=/mnt/backup-disk/esigglol docker compose up -d
```

No cloud credentials or upload provider is configured by this repository.
After a local snapshot is working, an operator can sync the mounted backup
directory to object storage using their approved provider and credentials.
Backups contain the complete database (including any runtime configuration),
so protect the directory and encrypt it at rest/in transit as appropriate.

## One-off backup and verification

On a development checkout, or in a container that has the repository scripts:

```bash
npm run backup
npm run backup:verify -- backups/esigglol-20260906T120000Z.db
```

The command exits non-zero if the source is missing or the integrity check
fails. Scheduled failures are logged by the worker and retried at the next
interval.

## Restore procedure

Restoration is intentionally manual and requires an explicit `--force`:

1. Stop the app and backup worker (`docker compose stop app backup`).
2. Verify the selected backup.
3. Run `npm run backup:restore -- --source <backup-file> --force` with the
   same `DB_PATH` that the app uses (or pass `--destination`).
4. Start the stack and inspect the application before removing the old data.

The restore command validates the source, writes a temporary online-backup
copy, validates that copy, replaces the destination while retaining the old
file with a `.before-restore-<id>` suffix, and removes stale `-wal`/`-shm`
sidecars. It will not run without `--force`; do not use it while the app is
running. Keep the retained previous database until the restore has been
confirmed.

The repository does not deploy, upload, or schedule anything outside Docker;
host-level off-site replication and alerting remain operational decisions.
