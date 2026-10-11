using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class FranchiseLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FranchiseLinks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FranchisorOrganizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    FranchiseeOrganizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    InvitedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RespondedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RespondedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    EndedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    EndedByOrganizationId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FranchiseLinks", x => x.Id);
                    table.CheckConstraint("CK_FranchiseLinks_DifferentCompanies", "\"FranchisorOrganizationId\" <> \"FranchiseeOrganizationId\"");
                    table.ForeignKey(
                        name: "FK_FranchiseLinks_Organizations_FranchiseeOrganizationId",
                        column: x => x.FranchiseeOrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FranchiseLinks_Organizations_FranchisorOrganizationId",
                        column: x => x.FranchisorOrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FranchiseLinkScopes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FranchiseLinkId = table.Column<Guid>(type: "uuid", nullable: false),
                    FranchisorOrganizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    FranchiseeOrganizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Scope = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    DecidedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FranchiseLinkScopes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FranchiseLinkScopes_FranchiseLinks_FranchiseLinkId",
                        column: x => x.FranchiseLinkId,
                        principalTable: "FranchiseLinks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FranchiseLinkScopes_Organizations_FranchiseeOrganizationId",
                        column: x => x.FranchiseeOrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FranchiseLinkScopes_Organizations_FranchisorOrganizationId",
                        column: x => x.FranchisorOrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FranchiseLinks_FranchiseeOrganizationId",
                table: "FranchiseLinks",
                column: "FranchiseeOrganizationId");

            migrationBuilder.CreateIndex(
                name: "UX_FranchiseLinks_OpenLink",
                table: "FranchiseLinks",
                columns: new[] { "FranchisorOrganizationId", "FranchiseeOrganizationId" },
                unique: true,
                filter: "\"Status\" IN ('Pending', 'Active')");

            migrationBuilder.CreateIndex(
                name: "IX_FranchiseLinkScopes_FranchiseeOrganizationId",
                table: "FranchiseLinkScopes",
                column: "FranchiseeOrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_FranchiseLinkScopes_FranchiseLinkId_Scope",
                table: "FranchiseLinkScopes",
                columns: new[] { "FranchiseLinkId", "Scope" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FranchiseLinkScopes_FranchisorOrganizationId",
                table: "FranchiseLinkScopes",
                column: "FranchisorOrganizationId");

            // A franchise link belongs to two companies: each of the two can see and change it, nobody else (see the
            // company policy in TenantRowLevelSecurity). app.bypass_rls is for migrations and platform maintenance.
            foreach (var table in new[] { "FranchiseLinks", "FranchiseLinkScopes" })
            {
                migrationBuilder.Sql($@"ALTER TABLE ""{table}"" ENABLE ROW LEVEL SECURITY;");
                migrationBuilder.Sql($@"ALTER TABLE ""{table}"" FORCE ROW LEVEL SECURITY;");
                migrationBuilder.Sql($@"CREATE POLICY tenant_isolation ON ""{table}""
                    USING (""FranchisorOrganizationId"" = NULLIF(current_setting('app.current_org', true), '')::uuid
                           OR ""FranchiseeOrganizationId"" = NULLIF(current_setting('app.current_org', true), '')::uuid
                           OR current_setting('app.bypass_rls', true) = 'on')
                    WITH CHECK (""FranchisorOrganizationId"" = NULLIF(current_setting('app.current_org', true), '')::uuid
                           OR ""FranchiseeOrganizationId"" = NULLIF(current_setting('app.current_org', true), '')::uuid
                           OR current_setting('app.bypass_rls', true) = 'on');");
            }

            // The platform's own record of each company's name, shown to a company that is invited into a link.
            migrationBuilder.Sql(@"UPDATE ""Organizations"" o SET ""Name"" = left(bp.""BusinessName"", 150)
                FROM ""BusinessProfiles"" bp
                WHERE bp.""OrganizationId"" = o.""Id"" AND o.""Name"" = '' AND bp.""BusinessName"" <> '';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var table in new[] { "FranchiseLinkScopes", "FranchiseLinks" })
            {
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS tenant_isolation ON ""{table}"";");
            }

            migrationBuilder.DropTable(
                name: "FranchiseLinkScopes");

            migrationBuilder.DropTable(
                name: "FranchiseLinks");
        }
    }
}
