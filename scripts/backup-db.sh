#!/usr/bin/env bash
#
# Online-safe SQLite backup for the USMC site.
#
# Uses the app's own Docker image (which bundles the sqlite3 npm package) to
# run SQLite's backup API against the live database — safe while the server
# is running, no extra tooling needed on the host.
#
# Usage:
#   scripts/backup-db.sh <image> <data-dir> <backup-dir> [label]
#
#   examples:
#     scripts/backup-db.sh uos_climbing      ~/data      ~/backups/prod pre-deploy
#     scripts/backup-db.sh uos_climbing_beta ~/data_beta ~/backups/beta pre-deploy
#     scripts/backup-db.sh uos_climbing      ~/data      ~/backups/prod daily
#
# Environment:
#   RETENTION_COUNT   how many backups to keep per directory (default: 14)
#   INCLUDE_UPLOADS   set to "true" to also archive the uploads/ directory
#                     (photos live outside SQLite; consider weekly cadence —
#                     these archives are much larger than the DB)
#
# Exits non-zero on failure so callers (CI deploys!) can abort safely.
set -euo pipefail

IMAGE="${1:?usage: backup-db.sh <image> <data-dir> <backup-dir> [label]}"
DATA_DIR="${2:?missing data-dir}"
BACKUP_DIR="${3:?missing backup-dir}"
LABEL="${4:-manual}"
RETENTION_COUNT="${RETENTION_COUNT:-14}"

umask 077  # backups contain member data (emergency contacts) — keep them private

DB_PATH="$DATA_DIR/uscc.db"
if [ ! -f "$DB_PATH" ]; then
    echo "[backup] no database at $DB_PATH — skipping (nothing to back up)"
    exit 0
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
OUT_NAME="uscc-${LABEL}-${STAMP}.db"

echo "[backup] $DB_PATH -> $BACKUP_DIR/$OUT_NAME (image: $IMAGE)"

# Read-only handle on the source; SQLite's backup API produces a consistent
# snapshot even if the server writes mid-copy. The Backup API in the sqlite3
# npm package is step-driven: pump pages until done, finish(), then verify the
# snapshot with PRAGMA integrity_check so a corrupt backup can never pass.
docker run --rm \
    -v "$DATA_DIR:/src:ro" \
    -v "$BACKUP_DIR:/backups" \
    --entrypoint node \
    "$IMAGE" -e "
        const sqlite3 = require('sqlite3');
        const db = new sqlite3.Database('/src/uscc.db', sqlite3.OPEN_READONLY, (err) => {
            if (err) { console.error('[backup] open failed:', err.message); process.exit(1); }
        });
        const backup = db.backup('/backups/$OUT_NAME');
        let steps = 0;
        (function pump() {
            backup.step(64, (err, done) => {
                steps++;
                if (err) { console.error('[backup] FAILED:', err.message); process.exit(1); }
                if (done || backup.completed) {
                    backup.finish((ferr) => {
                        if (ferr) { console.error('[backup] finish failed:', ferr.message); process.exit(1); }
                        const vdb = new sqlite3.Database('/backups/$OUT_NAME', sqlite3.OPEN_READONLY, (verr) => {
                            if (verr) { console.error('[backup] cannot reopen snapshot:', verr.message); process.exit(1); }
                            vdb.get('PRAGMA integrity_check', (icErr, row) => {
                                if (icErr || !row || row.integrity_check !== 'ok') {
                                    console.error('[backup] integrity check FAILED:', icErr ? icErr.message : JSON.stringify(row));
                                    process.exit(1);
                                }
                                console.log('[backup] snapshot written (' + steps + ' steps), integrity_check: ok');
                                vdb.close(() => db.close(() => process.exit(0)));
                            });
                        });
                    });
                } else if (steps > 1000000) {
                    console.error('[backup] FAILED: step limit exceeded');
                    process.exit(1);
                } else {
                    setImmediate(pump);
                }
            });
        })();
    "

gzip -f "$BACKUP_DIR/$OUT_NAME"

if [ "${INCLUDE_UPLOADS:-false}" = "true" ] && [ -d "$DATA_DIR/uploads" ]; then
    echo "[backup] archiving uploads/ ..."
    tar czf "$BACKUP_DIR/uploads-${LABEL}-${STAMP}.tar.gz" -C "$DATA_DIR" uploads
fi

# Prune oldest beyond retention (per-pool: databases and upload archives separately)
ls -1t "$BACKUP_DIR"/uscc-*.db.gz 2>/dev/null    | tail -n +"$((RETENTION_COUNT + 1))" | xargs -r rm --
ls -1t "$BACKUP_DIR"/uploads-*.tar.gz 2>/dev/null | tail -n +"$((RETENTION_COUNT + 1))" | xargs -r rm --

LATEST=$(ls -1t "$BACKUP_DIR"/uscc-*.db.gz 2>/dev/null | head -1)
echo "[backup] complete: $LATEST ($(du -h "$LATEST" | cut -f1))"
