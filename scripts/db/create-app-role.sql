-- ============================================================================
-- E6 Car Spa — least-privilege application role (Phase 0, P0-2)
--
-- Creates a LOGIN role that can read and write application data but cannot change
-- the schema, create databases/roles, or bypass row-level security.
--
-- Run as the database OWNER / superuser, connected to the application database:
--
--   psql -h <host> -U postgres -d E6CarSpaNew ^
--        -v app_role=carspa_app ^
--        -v app_password='<generate a long random password>' ^
--        -f scripts/db/create-app-role.sql
--
-- Never commit the password. Store it only in the API's secret configuration:
--   ConnectionStrings__DefaultConnection="Host=...;Database=E6CarSpaNew;Username=carspa_app;Password=..."
--   Database__ApplyMigrationsOnStartup=false
--
-- Migrations (schema changes) must then be applied by the owner role during deployment,
-- e.g. by starting the API once with the owner connection string and
-- Database__ApplyMigrationsOnStartup=true, or with an EF Core migration bundle.
-- Re-run this script after migrations that add new tables/sequences if default privileges
-- were not in effect (it is idempotent).
-- ============================================================================

\set ON_ERROR_STOP on

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
              :'app_role', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_role')
\gexec

-- If the role already exists, rotate its password and make sure it is not privileged.
SELECT format('ALTER ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
              :'app_role', :'app_password')
\gexec

SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'app_role') \gexec
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'app_role') \gexec
SELECT format('REVOKE CREATE ON SCHEMA public FROM %I', :'app_role') \gexec

-- Data access on existing objects (includes "__EFMigrationsHistory" read access for the pending-migration check).
SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', :'app_role') \gexec
SELECT format('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO %I', :'app_role') \gexec

-- Objects created later by the current (owner) role get the same grants automatically.
SELECT format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', :'app_role') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO %I', :'app_role') \gexec

-- Verification output
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
FROM pg_roles WHERE rolname = :'app_role';
