using System.Data.Common;
using System.Runtime.CompilerServices;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace CarSpaManagement.Api.Infrastructure.Tenancy;

/// <summary>
/// Tells PostgreSQL which company a connection is working for (<c>app.current_org</c>), so the row-level security
/// policies on every company-owned table can refuse anything else. This is the second lock behind the query
/// filters: even code that forgets a filter, or hand-written SQL, only reaches the current company's rows.
///
/// The setting is a session setting. It is sent only when it changes, and forgotten whenever the connection is
/// closed (the pool resets it) or a rollback may have undone it, so a later command always sends it again.
/// </summary>
public sealed class TenantSessionInterceptor : DbCommandInterceptor, IDbConnectionInterceptor, IDbTransactionInterceptor
{
    public const string SettingName = "app.current_org";

    private static readonly ConditionalWeakTable<DbConnection, StrongBox<string?>> Applied = new();

    private static string ValueFor(Microsoft.EntityFrameworkCore.DbContext? context) =>
        context is AppDbContext { CurrentOrganizationId: var id } && id != Guid.Empty ? id.ToString() : string.Empty;

    private static void Apply(DbConnection? connection, DbTransaction? transaction, Microsoft.EntityFrameworkCore.DbContext? context)
    {
        if (connection is null || context is null)
        {
            return;
        }

        var wanted = ValueFor(context);
        var box = Applied.GetOrCreateValue(connection);
        if (box.Value == wanted)
        {
            return;
        }

        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "SELECT set_config('app.current_org', @value, false)";
        var parameter = command.CreateParameter();
        parameter.ParameterName = "value";
        parameter.Value = wanted;
        command.Parameters.Add(parameter);
        command.ExecuteScalar();
        box.Value = wanted;
    }

    private static async Task ApplyAsync(DbConnection? connection, DbTransaction? transaction,
        Microsoft.EntityFrameworkCore.DbContext? context, CancellationToken cancellationToken)
    {
        if (connection is null || context is null)
        {
            return;
        }

        var wanted = ValueFor(context);
        var box = Applied.GetOrCreateValue(connection);
        if (box.Value == wanted)
        {
            return;
        }

        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "SELECT set_config('app.current_org', @value, false)";
        var parameter = command.CreateParameter();
        parameter.ParameterName = "value";
        parameter.Value = wanted;
        command.Parameters.Add(parameter);
        await command.ExecuteScalarAsync(cancellationToken);
        box.Value = wanted;
    }

    private static void Forget(DbConnection? connection)
    {
        if (connection is not null)
        {
            Applied.Remove(connection);
        }
    }

    // ── Before every command ────────────────────────────────────────────────────────────────────────────────

    public override InterceptionResult<DbDataReader> ReaderExecuting(DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result)
    {
        Apply(command.Connection, command.Transaction, eventData.Context);
        return result;
    }

    public override async ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command, CommandEventData eventData,
        InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
    {
        await ApplyAsync(command.Connection, command.Transaction, eventData.Context, cancellationToken);
        return result;
    }

    public override InterceptionResult<int> NonQueryExecuting(DbCommand command, CommandEventData eventData, InterceptionResult<int> result)
    {
        Apply(command.Connection, command.Transaction, eventData.Context);
        return result;
    }

    public override async ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(DbCommand command, CommandEventData eventData,
        InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        await ApplyAsync(command.Connection, command.Transaction, eventData.Context, cancellationToken);
        return result;
    }

    public override InterceptionResult<object> ScalarExecuting(DbCommand command, CommandEventData eventData, InterceptionResult<object> result)
    {
        Apply(command.Connection, command.Transaction, eventData.Context);
        return result;
    }

    public override async ValueTask<InterceptionResult<object>> ScalarExecutingAsync(DbCommand command, CommandEventData eventData,
        InterceptionResult<object> result, CancellationToken cancellationToken = default)
    {
        await ApplyAsync(command.Connection, command.Transaction, eventData.Context, cancellationToken);
        return result;
    }

    // ── When the setting may have been lost ─────────────────────────────────────────────────────────────────

    void IDbConnectionInterceptor.ConnectionClosed(DbConnection connection, ConnectionEndEventData eventData) => Forget(connection);

    Task IDbConnectionInterceptor.ConnectionClosedAsync(DbConnection connection, ConnectionEndEventData eventData)
    {
        Forget(connection);
        return Task.CompletedTask;
    }

    void IDbTransactionInterceptor.TransactionRolledBack(DbTransaction transaction, TransactionEndEventData eventData) =>
        Forget(transaction.Connection);

    Task IDbTransactionInterceptor.TransactionRolledBackAsync(DbTransaction transaction, TransactionEndEventData eventData,
        CancellationToken cancellationToken)
    {
        Forget(transaction.Connection);
        return Task.CompletedTask;
    }

    void IDbTransactionInterceptor.RolledBackToSavepoint(DbTransaction transaction, TransactionEventData eventData) =>
        Forget(transaction.Connection);

    Task IDbTransactionInterceptor.RolledBackToSavepointAsync(DbTransaction transaction, TransactionEventData eventData,
        CancellationToken cancellationToken)
    {
        Forget(transaction.Connection);
        return Task.CompletedTask;
    }
}
