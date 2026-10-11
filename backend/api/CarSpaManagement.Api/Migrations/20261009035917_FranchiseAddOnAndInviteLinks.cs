using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class FranchiseAddOnAndInviteLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "FranchiseAddOnEnabled",
                table: "Organizations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "InviteTokenExpiresAt",
                table: "FranchiseLinks",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InviteTokenHash",
                table: "FranchiseLinks",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "UX_FranchiseLinks_InviteTokenHash",
                table: "FranchiseLinks",
                column: "InviteTokenHash",
                unique: true,
                filter: "\"InviteTokenHash\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "UX_FranchiseLinks_InviteTokenHash",
                table: "FranchiseLinks");

            migrationBuilder.DropColumn(
                name: "FranchiseAddOnEnabled",
                table: "Organizations");

            migrationBuilder.DropColumn(
                name: "InviteTokenExpiresAt",
                table: "FranchiseLinks");

            migrationBuilder.DropColumn(
                name: "InviteTokenHash",
                table: "FranchiseLinks");
        }
    }
}
