using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class FranchiseHasScope : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Does the signed-in company (app.current_org) have an ACTIVE franchise link to this franchisee with this
            // item GRANTED? The database answers from its own link records, so an app bug cannot talk it into "yes".
            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION franchise_has_scope(p_franchisee uuid, p_scope text)
                RETURNS boolean
                LANGUAGE sql
                SECURITY DEFINER
                SET search_path = public
                AS $fn$
                    SELECT EXISTS (
                        SELECT 1
                        FROM "FranchiseLinks" l
                        JOIN "FranchiseLinkScopes" s ON s."FranchiseLinkId" = l."Id"
                        WHERE l."FranchisorOrganizationId" = NULLIF(current_setting('app.current_org', true), '')::uuid
                          AND l."FranchiseeOrganizationId" = p_franchisee
                          AND l."Status" = 'Active' AND NOT l."IsDeleted"
                          AND s."Scope" = p_scope AND s."Status" = 'Granted' AND NOT s."IsDeleted")
                $fn$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP FUNCTION IF EXISTS franchise_has_scope(uuid, text);");
        }
    }
}
