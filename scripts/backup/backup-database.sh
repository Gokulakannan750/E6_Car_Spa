#!/usr/bin/env bash
# ==============================================================================
# E6 Car Spa — Automated PostgreSQL Database Backup Script (POSIX / Linux / macOS)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

DB_NAME="${DB_NAME:-E6CarSpaNew}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-${REPO_ROOT}/backups}"
LOG_DIR="${LOG_DIR:-${REPO_ROOT}/logs/backup}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "${BACKUP_DIR}"
mkdir -p "${LOG_DIR}"

TODAY=$(date +"%Y-%m-%d")
LOG_FILE="${LOG_DIR}/backup-${TODAY}.log"

log() {
    local level="$1"
    local message="$2"
    local timestamp
    timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    echo "[$timestamp] [$level] $message" | tee -a "${LOG_FILE}"
}

log "INFO" "=================================================="
log "INFO" "E6 Car Spa — Automated Database Backup Initiated"
log "INFO" "Target Database: ${DB_NAME} on ${DB_HOST}:${DB_PORT}"

# Verify pg_dump and pg_restore exist
if ! command -v pg_dump >/dev/null 2>&1; then
    log "ERROR" "pg_dump command not found in PATH."
    exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
    log "ERROR" "pg_restore command not found in PATH."
    exit 1
fi

TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.dump"
SHA256_FILE="${BACKUP_FILE}.sha256"

log "INFO" "Target archive: ${BACKUP_FILE}"

# Execute pg_dump
START_TIME=$(date +%s)
log "INFO" "Executing pg_dump (Format: Custom compressed, Blobs: Yes)..."

export PGPASSWORD="${PGPASSWORD:-${DB_PASSWORD:-}}"
if [ -z "${PGPASSWORD}" ]; then
    log "WARN" "PGPASSWORD is not set. Relying on .pgpass or peer authentication."
fi

if ! pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -F c -b -v -f "${BACKUP_FILE}" "${DB_NAME}" 2>"${LOG_DIR}/pg_dump_stderr.tmp"; then
    log "ERROR" "pg_dump failed with exit code $?. Output:"
    cat "${LOG_DIR}/pg_dump_stderr.tmp" | tee -a "${LOG_FILE}"
    rm -f "${LOG_DIR}/pg_dump_stderr.tmp"
    exit 1
fi
rm -f "${LOG_DIR}/pg_dump_stderr.tmp"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
log "INFO" "pg_dump completed in ${DURATION} seconds."

# Validate File Existence & Size
if [ ! -f "${BACKUP_FILE}" ]; then
    log "ERROR" "Backup file was not created: ${BACKUP_FILE}"
    exit 1
fi

FILE_SIZE=$(wc -c < "${BACKUP_FILE}" | tr -d ' ')
if [ "${FILE_SIZE}" -le 0 ]; then
    log "ERROR" "Backup file is empty (0 bytes): ${BACKUP_FILE}"
    rm -f "${BACKUP_FILE}"
    exit 1
fi
log "INFO" "Backup archive created successfully (${FILE_SIZE} bytes)."

# Verify Table of Contents
log "INFO" "Validating archive integrity via pg_restore Table of Contents..."
if ! pg_restore --list "${BACKUP_FILE}" >/dev/null 2>&1; then
    log "ERROR" "Archive verification failed! pg_restore --list failed."
    exit 1
fi
log "SUCCESS" "Archive Table of Contents validated successfully."

# Generate SHA-256 Checksum
log "INFO" "Generating SHA-256 checksum..."
if command -v sha256sum >/dev/null 2>&1; then
    (cd "${BACKUP_DIR}" && sha256sum "$(basename "${BACKUP_FILE}")" > "${SHA256_FILE}")
elif command -v shasum >/dev/null 2>&1; then
    (cd "${BACKUP_DIR}" && shasum -a 256 "$(basename "${BACKUP_FILE}")" > "${SHA256_FILE}")
fi
log "SUCCESS" "SHA-256 checksum saved to ${SHA256_FILE}"

# Apply Retention Policy (Preserve newest backup unconditionally)
log "INFO" "Applying retention policy (${RETENTION_DAYS} days)..."
BACKUP_COUNT=$(find "${BACKUP_DIR}" -maxdepth 1 -name "${DB_NAME}_*.dump" | wc -l | tr -d ' ')

if [ "${BACKUP_COUNT}" -gt 1 ]; then
    # Find newest file
    NEWEST_FILE=$(find "${BACKUP_DIR}" -maxdepth 1 -name "${DB_NAME}_*.dump" -print0 | xargs -0 ls -t | head -n 1)
    
    # Find expired files
    EXPIRED_FILES=$(find "${BACKUP_DIR}" -maxdepth 1 -name "${DB_NAME}_*.dump" -mtime +"${RETENTION_DAYS}")
    for file in ${EXPIRED_FILES}; do
        if [ "${file}" != "${NEWEST_FILE}" ]; then
            log "WARN" "Pruning expired backup: ${file}"
            rm -f "${file}"
            rm -f "${file}.sha256"
        fi
    done
fi

log "SUCCESS" "Database backup completed successfully."
log "INFO" "=================================================="
exit 0
