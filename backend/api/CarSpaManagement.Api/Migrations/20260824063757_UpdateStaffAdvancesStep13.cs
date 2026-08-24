using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class UpdateStaffAdvancesStep13 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "StaffAdvances",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Outstanding",
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20,
                oldNullable: true,
                oldDefaultValue: "Pending");

            migrationBuilder.AlterColumn<string>(
                name: "StaffName",
                table: "StaffAdvances",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100);

            migrationBuilder.AlterColumn<string>(
                name: "AdvanceType",
                table: "StaffAdvances",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20);

            migrationBuilder.AddColumn<string>(
                name: "ObsoleteReason",
                table: "StaffAdvances",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ObsoletedAt",
                table: "StaffAdvances",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ObsoletedByUserId",
                table: "StaffAdvances",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Reason",
                table: "StaffAdvances",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "SettledAt",
                table: "StaffAdvances",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SettledByUserId",
                table: "StaffAdvances",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_StaffAdvances_ObsoletedByUserId",
                table: "StaffAdvances",
                column: "ObsoletedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_StaffAdvances_SettledByUserId",
                table: "StaffAdvances",
                column: "SettledByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_StaffAdvances_Users_ObsoletedByUserId",
                table: "StaffAdvances",
                column: "ObsoletedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_StaffAdvances_Users_SettledByUserId",
                table: "StaffAdvances",
                column: "SettledByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_StaffAdvances_Users_ObsoletedByUserId",
                table: "StaffAdvances");

            migrationBuilder.DropForeignKey(
                name: "FK_StaffAdvances_Users_SettledByUserId",
                table: "StaffAdvances");

            migrationBuilder.DropIndex(
                name: "IX_StaffAdvances_ObsoletedByUserId",
                table: "StaffAdvances");

            migrationBuilder.DropIndex(
                name: "IX_StaffAdvances_SettledByUserId",
                table: "StaffAdvances");

            migrationBuilder.DropColumn(
                name: "ObsoleteReason",
                table: "StaffAdvances");

            migrationBuilder.DropColumn(
                name: "ObsoletedAt",
                table: "StaffAdvances");

            migrationBuilder.DropColumn(
                name: "ObsoletedByUserId",
                table: "StaffAdvances");

            migrationBuilder.DropColumn(
                name: "Reason",
                table: "StaffAdvances");

            migrationBuilder.DropColumn(
                name: "SettledAt",
                table: "StaffAdvances");

            migrationBuilder.DropColumn(
                name: "SettledByUserId",
                table: "StaffAdvances");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "StaffAdvances",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true,
                defaultValue: "Pending",
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20,
                oldDefaultValue: "Outstanding");

            migrationBuilder.AlterColumn<string>(
                name: "StaffName",
                table: "StaffAdvances",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "AdvanceType",
                table: "StaffAdvances",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50,
                oldNullable: true);
        }
    }
}
