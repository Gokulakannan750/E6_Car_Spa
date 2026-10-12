using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations.Platform
{
    /// <inheritdoc />
    public partial class FranchiseLinksInCatalog : Migration
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
                    InviteTokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    InviteTokenExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FranchiseLinks", x => x.Id);
                    table.CheckConstraint("CK_FranchiseLinks_DifferentCompanies", "\"FranchisorOrganizationId\" <> \"FranchiseeOrganizationId\"");
                    table.ForeignKey(
                        name: "FK_FranchiseLinks_Companies_FranchiseeOrganizationId",
                        column: x => x.FranchiseeOrganizationId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FranchiseLinks_Companies_FranchisorOrganizationId",
                        column: x => x.FranchisorOrganizationId,
                        principalTable: "Companies",
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
                });

            migrationBuilder.CreateIndex(
                name: "IX_FranchiseLinks_FranchiseeOrganizationId",
                table: "FranchiseLinks",
                column: "FranchiseeOrganizationId");

            migrationBuilder.CreateIndex(
                name: "UX_FranchiseLinks_InviteTokenHash",
                table: "FranchiseLinks",
                column: "InviteTokenHash",
                unique: true,
                filter: "\"InviteTokenHash\" IS NOT NULL");

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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FranchiseLinkScopes");

            migrationBuilder.DropTable(
                name: "FranchiseLinks");
        }
    }
}
