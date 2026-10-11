using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20261009100000_AddCancelDispatchedOutsideJobPermission")]
    public partial class AddCancelDispatchedOutsideJobPermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                INSERT INTO "Permissions" ("Id", "Code", "Name", "Module", "Description", "CreatedAt")
                SELECT gen_random_uuid(), 'outsidejobs.cancel_dispatched', 'Cancel Dispatched Outside Jobs', 'Job Cards', 'Allows cancelling external vendor jobs after vehicle has been dispatched outside', CURRENT_TIMESTAMP
                WHERE NOT EXISTS (SELECT 1 FROM "Permissions" p WHERE p."Code" = 'outsidejobs.cancel_dispatched');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Permission definitions and any deliberate assignments are retained on rollback.
        }
    }
}
