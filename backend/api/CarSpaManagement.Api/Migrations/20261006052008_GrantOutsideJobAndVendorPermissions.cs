using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    /// <summary>
    /// RBAC P1-3: outside-job and vendor endpoints now require outsidejobs.* / vendors.* instead of jobcards.*.
    /// Users keep the access they had: anyone holding jobcards.view gets outsidejobs.view + vendors.view, and anyone
    /// holding jobcards.edit gets outsidejobs.manage + vendors.manage. Runs once (migration history), so grants the
    /// Owner later removes are not re-added. Idempotent and non-destructive: existing grants are kept, nothing is removed,
    /// and existing (UserId, PermissionId) pairs are skipped.
    /// </summary>
    public partial class GrantOutsideJobAndVendorPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The four definitions are normally created by PermissionSeeder at startup. Create any that are missing so the
            // grants below cannot silently do nothing on a database where the seeder has not run yet. Same values as the
            // seeder, which matches by Code and therefore will not duplicate them.
            migrationBuilder.Sql("""
                INSERT INTO "Permissions" ("Id", "Code", "Name", "Module", "Description", "CreatedAt")
                SELECT gen_random_uuid(), v.code, v.name, v.module, v.description, CURRENT_TIMESTAMP
                FROM (VALUES
                    ('outsidejobs.view',   'View Outside Jobs',   'Job Cards', 'Allows viewing outside jobs and external vehicle movement'),
                    ('outsidejobs.manage', 'Manage Outside Jobs', 'Job Cards', 'Allows sending vehicles outside, recording returns, and managing outside jobs'),
                    ('vendors.view',       'View Vendors',        'Vendors',   'Allows viewing external service providers and vendors'),
                    ('vendors.manage',     'Manage Vendors',      'Vendors',   'Allows creating and managing external vendors')
                ) AS v(code, name, module, description)
                WHERE NOT EXISTS (SELECT 1 FROM "Permissions" p WHERE p."Code" = v.code);
                """);

            // IX_UserPermissions_UserId_PermissionId is unique over active rows only, so duplicates are prevented with
            // NOT EXISTS. Any existing row for the pair is skipped, including a soft-deleted (revoked) one, so a grant
            // that was deliberately removed is not brought back.
            migrationBuilder.Sql("""
                INSERT INTO "UserPermissions" ("Id", "UserId", "PermissionId", "CreatedAt", "IsDeleted")
                SELECT gen_random_uuid(), grants."UserId", grants."PermissionId", CURRENT_TIMESTAMP, FALSE
                FROM (
                    SELECT DISTINCT up."UserId", target."Id" AS "PermissionId"
                    FROM "UserPermissions" up
                    JOIN "Permissions" source ON source."Id" = up."PermissionId"
                    JOIN (VALUES
                        ('jobcards.view', 'outsidejobs.view'),
                        ('jobcards.view', 'vendors.view'),
                        ('jobcards.edit', 'outsidejobs.manage'),
                        ('jobcards.edit', 'vendors.manage')
                    ) AS m(source_code, target_code) ON m.source_code = source."Code"
                    JOIN "Permissions" target ON target."Code" = m.target_code
                    WHERE NOT up."IsDeleted"
                ) AS grants
                WHERE NOT EXISTS (
                    SELECT 1 FROM "UserPermissions" existing
                    WHERE existing."UserId" = grants."UserId" AND existing."PermissionId" = grants."PermissionId"
                );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Intentionally empty: migrated grants cannot be told apart from grants the Owner made afterwards, and
            // removing access is not a safe automatic rollback.
        }
    }
}
