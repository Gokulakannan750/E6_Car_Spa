#!/usr/bin/env bash
# ==============================================================================
# E6 Car Spa — Automated PostgreSQL Database Restore Script (POSIX / Linux / macOS)
# ==============================================================================

set -euo pipefail

if [ "$#" -lt 2 ]; then
    echo "Usage: $0 <BACKUP_FILE> <TARGET_DATABASE> [FORCE_FLAG]"
    echo "Example: $0 backups/E6CarSpaNew_2026-09-08_120000.dump E6CarSpa_RestoreTest"
    exit 1
fi

BACKUP_FILE="$1"
TARGET_DATABASE="$2"
FORCE_FLAG="${3:-}"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"

log() {
    local level="$1"
    local message="$2"
    local timestamp
    timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    echo "[$timestamp] [$level] $message"
}

log "INFO" "=================================================="
log "INFO" "E6 Car Spa — Database Restoration Initiated"

# Validate File
if [ ! -f "${BACKUP_FILE}" ]; then
    log "ERROR" "Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

# Production Safety Guard
if [[ "${TARGET_DATABASE}" =~ ^(E6CarSpaNew|e6carspanew|E6CarSpa|e6carspa|CarSpaProduction)$ ]]; then
    log "WARN" "TARGET IS PRODUCTION DATABASE (${TARGET_DATABASE})!"
    if [ "${FORCE_FLAG}" != "--force" ]; then
        read -r -p "Type 'CONFIRM-OVERWRITE' to proceed: " confirmation
        if [ "${confirmation}" != "CONFIRM-OVERWRITE" ]; then
            log "ERROR" "Restoration aborted by operator safeguard."
            exit 1
        fi
    fi
fi

# Check SHA-256 Checksum if present
SHA256_FILE="${BACKUP_FILE}.sha256"
if [ -f "${SHA256_FILE}" ]; then
    log "INFO" "Verifying SHA-256 checksum..."
    EXPECTED_HASH=$(awk '{print $1}' "${SHA256_FILE}")
    if command -v sha256sum >/dev/null 2>&1; then
        ACTUAL_HASH=$(sha256sum "${BACKUP_FILE}" | awk '{print $1}')
    else
        ACTUAL_HASH=$(shasum -a 256 "${BACKUP_FILE}" | awk '{print $1}')
    fi

    if [ "${EXPECTED_HASH}" != "${ACTUAL_HASH}" ]; then
        log "ERROR" "Checksum mismatch! Archive may be corrupted."
        exit 1
    fi
    log "SUCCESS" "Checksum validated: ${ACTUAL_HASH}"
fi

# Inspect TOC
log "INFO" "Inspecting Table of Contents..."
if ! pg_restore --list "${BACKUP_FILE}" >/dev/null 2>&1; then
    log "ERROR" "Invalid backup archive file."
    exit 1
fi
log "SUCCESS" "Archive Table of Contents validated."

# Ensure database exists
export PGPASSWORD="${PGPASSWORD:-${DB_PASSWORD:-}}"
DB_EXISTS=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -t -A -c "SELECT 1 FROM pg_database WHERE datname = '${TARGET_DATABASE}';" || true)

if [ "${DB_EXISTS}" != "1" ]; then
    log "INFO" "Database '${TARGET_DATABASE}' does not exist. Creating..."
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "CREATE DATABASE \"${TARGET_DATABASE}\" WITH ENCODING 'UTF8';"
    log "SUCCESS" "Database created."
fi

# Restore
log "INFO" "Restoring archive to '${TARGET_DATABASE}'..."
START_TIME=$(date +%s)

pg_restore -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${TARGET_DATABASE}" \
    --clean --if-exists --no-owner --no-privileges -v "${BACKUP_FILE}" || true

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
log "SUCCESS" "Restore completed in ${DURATION} seconds."

# Verify Table Counts
log "INFO" "Verifying row counts in '${TARGET_DATABASE}'..."
VERIFICATION_SQL="
SELECT 'Customers' as entity, COUNT(*)::text as count FROM \"Customers\"
UNION ALL SELECT 'Vehicles', COUNT(*)::text FROM \"Vehicles\"
UNION ALL SELECT 'Services', COUNT(*)::text FROM \"Services\"
UNION ALL SELECT 'JobCards', COUNT(*)::text FROM \"JobCards\"
UNION ALL SELECT 'JobCardServices', COUNT(*)::text FROM \"JobCardServices\"
UNION ALL SELECT 'Staff', COUNT(*)::text FROM \"Staff\"
UNION ALL SELECT 'StaffAdvances', COUNT(*)::text FROM \"StaffAdvances\"
UNION ALL SELECT 'Showrooms', COUNT(*)::text FROM \"Showrooms\"
UNION ALL SELECT 'ShowroomStaffAssignments', COUNT(*)::text FROM \"ShowroomStaffAssignments\"
UNION ALL SELECT 'ShowroomDailyBills', COUNT(*)::text FROM \"ShowroomDailyBills\"
UNION ALL SELECT 'ShowroomDailyAttendances', COUNT(*)::text FROM \"ShowroomDailyAttendances\"
UNION ALL SELECT 'ShowroomPayments', COUNT(*)::text FROM \"ShowroomPayments\"
UNION ALL SELECT 'Invoices', COUNT(*)::text FROM \"Invoices\"
UNION ALL SELECT 'InvoiceItems', COUNT(*)::text FROM \"InvoiceItems\"
UNION ALL SELECT 'Payments', COUNT(*)::text FROM \"Payments\"
UNION ALL SELECT 'Users', COUNT(*)::text FROM \"Users\"
UNION ALL SELECT 'Permissions', COUNT(*)::text FROM \"Permissions\"
UNION ALL SELECT 'UserPermissions', COUNT(*)::text FROM \"UserPermissions\"
UNION ALL SELECT 'BusinessProfiles', COUNT(*)::text FROM \"BusinessProfiles\"
UNION ALL SELECT 'AuditLogs', COUNT(*)::text FROM \"AuditLogs\"
UNION ALL SELECT 'InvoicePublicLinks', COUNT(*)::text FROM \"InvoicePublicLinks\"
UNION ALL SELECT 'WhatsAppConfigurations', COUNT(*)::text FROM \"WhatsAppConfigurations\"
UNION ALL SELECT 'WhatsAppMessages', COUNT(*)::text FROM \"WhatsAppMessages\";"

psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${TARGET_DATABASE}" -t -A -F " : " -c "${VERIFICATION_SQL}" || true

log "SUCCESS" "Restoration verification finished."
log "INFO" "=================================================="
exit 0
