using System.Text.RegularExpressions;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// Unit tests validating database backup filename conventions, retention safety algorithms,
/// connection string redaction, and disaster recovery safeguards.
/// </summary>
public class DatabaseBackupSecurityTests
{
    private static readonly Regex BackupFileRegex = new(
        @"^(?<db>[a-zA-Z0-9_\-]+)_(?<timestamp>\d{4}-\d{2}-\d{2}_\d{6})\.dump$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    [Theory]
    [InlineData("E6CarSpaNew_2026-09-08_120000.dump", "E6CarSpaNew", "2026-09-08_120000")]
    [InlineData("E6CarSpa_2026-12-31_235959.dump", "E6CarSpa", "2026-12-31_235959")]
    [InlineData("CarSpa_Production-DB_2025-01-01_000000.dump", "CarSpa_Production-DB", "2025-01-01_000000")]
    public void BackupFileName_ValidFormat_MatchesRegexAndExtractsTimestamp(
        string fileName, string expectedDb, string expectedTimestamp)
    {
        var match = BackupFileRegex.Match(fileName);

        Assert.True(match.Success);
        Assert.Equal(expectedDb, match.Groups["db"].Value);
        Assert.Equal(expectedTimestamp, match.Groups["timestamp"].Value);
    }

    [Theory]
    [InlineData("E6CarSpaNew_2026-09-08_120000.sql")]          // Must not be plain SQL
    [InlineData("E6CarSpaNew_2026-09-08.dump")]                 // Missing time component
    [InlineData("../E6CarSpaNew_2026-09-08_120000.dump")]       // Path traversal attempt
    [InlineData("..\\E6CarSpaNew_2026-09-08_120000.dump")]       // Windows traversal attempt
    [InlineData("E6CarSpaNew_backup.dump")]                     // Missing timestamp
    [InlineData("invalid_format.tar")]                          // Invalid extension
    public void BackupFileName_InvalidOrUnsafeFormat_IsRejected(string fileName)
    {
        var match = BackupFileRegex.Match(fileName);
        Assert.False(match.Success);
    }

    [Fact]
    public void RetentionPolicy_WhenOnlyOneBackupExists_NeverPrunedEvenIfExpired()
    {
        // Arrange: 1 backup created 60 days ago (older than 30-day retention)
        var backups = new List<MockBackupFile>
        {
            new("E6CarSpaNew_2026-07-01_020000.dump", DateTime.UtcNow.AddDays(-60))
        };

        // Act
        var pruned = EvaluateRetentionPruning(backups, retentionDays: 30);

        // Assert: 0 pruned because latest backup must always be preserved
        Assert.Empty(pruned);
    }

    [Fact]
    public void RetentionPolicy_WhenAllBackupsAreOlderThanRetention_NewestIsPreserved()
    {
        // Arrange: 3 backups from 90, 60, and 45 days ago
        var backups = new List<MockBackupFile>
        {
            new("E6CarSpaNew_2026-06-01_020000.dump", DateTime.UtcNow.AddDays(-90)),
            new("E6CarSpaNew_2026-07-01_020000.dump", DateTime.UtcNow.AddDays(-60)),
            new("E6CarSpaNew_2026-07-15_020000.dump", DateTime.UtcNow.AddDays(-45))
        };

        // Act
        var pruned = EvaluateRetentionPruning(backups, retentionDays: 30);

        // Assert: The 90-day and 60-day files are pruned, but the 45-day (newest) is preserved
        Assert.Equal(2, pruned.Count);
        Assert.Contains(pruned, f => f.FileName.Contains("2026-06-01"));
        Assert.Contains(pruned, f => f.FileName.Contains("2026-07-01"));
        Assert.DoesNotContain(pruned, f => f.FileName.Contains("2026-07-15"));
    }

    [Fact]
    public void RetentionPolicy_MixedAges_PrunesOnlyExpiredNonLatest()
    {
        // Arrange
        var backups = new List<MockBackupFile>
        {
            new("E6CarSpaNew_old1.dump", DateTime.UtcNow.AddDays(-45)),
            new("E6CarSpaNew_old2.dump", DateTime.UtcNow.AddDays(-35)),
            new("E6CarSpaNew_valid1.dump", DateTime.UtcNow.AddDays(-10)),
            new("E6CarSpaNew_valid2.dump", DateTime.UtcNow.AddDays(-1))
        };

        // Act
        var pruned = EvaluateRetentionPruning(backups, retentionDays: 30);

        // Assert: 2 expired pruned, 2 valid kept
        Assert.Equal(2, pruned.Count);
        Assert.Contains(pruned, f => f.FileName == "E6CarSpaNew_old1.dump");
        Assert.Contains(pruned, f => f.FileName == "E6CarSpaNew_old2.dump");
        Assert.DoesNotContain(pruned, f => f.FileName == "E6CarSpaNew_valid1.dump");
        Assert.DoesNotContain(pruned, f => f.FileName == "E6CarSpaNew_valid2.dump");
    }

    [Theory]
    [InlineData("Host=localhost;Port=5432;Database=E6CarSpaNew;Username=postgres;Password=SuperSecretPassword123;", "Password=***;")]
    [InlineData("Host=db.server;Password=MyP@ssw0rd!;Username=admin", "Password=***")]
    [InlineData("postgres://admin:SecretPass%21@localhost:5432/E6CarSpaNew", "postgres://admin:***@localhost:5432/E6CarSpaNew")]
    public void CredentialRedaction_RemovesSensitivePasswordsFromStrings(string input, string expectedSubstring)
    {
        var redacted = RedactCredentials(input);

        Assert.DoesNotContain("SuperSecretPassword123", redacted);
        Assert.DoesNotContain("MyP@ssw0rd!", redacted);
        Assert.DoesNotContain("SecretPass%21", redacted);
        Assert.Contains(expectedSubstring, redacted);
    }

    [Theory]
    [InlineData("E6CarSpaNew", true)]
    [InlineData("e6carspanew", true)]
    [InlineData("E6CarSpa", true)]
    [InlineData("CarSpaProduction", true)]
    [InlineData("E6CarSpa_RestoreTest", false)]
    [InlineData("E6CarSpa_Staging", false)]
    [InlineData("TestDb", false)]
    public void ProductionSafetyGuard_IdentifiesProtectedProductionDatabases(string databaseName, bool isProtected)
    {
        var protectedDatabases = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "E6CarSpaNew",
            "E6CarSpa",
            "CarSpaProduction"
        };

        Assert.Equal(isProtected, protectedDatabases.Contains(databaseName));
    }

    #region Helper Logic Emulating Scripts

    private record MockBackupFile(string FileName, DateTime CreationTime);

    private static List<MockBackupFile> EvaluateRetentionPruning(List<MockBackupFile> files, int retentionDays)
    {
        if (files.Count <= 1)
        {
            return new List<MockBackupFile>();
        }

        var sorted = files.OrderByDescending(f => f.CreationTime).ToList();
        var cutoff = DateTime.UtcNow.AddDays(-retentionDays);
        var toPrune = new List<MockBackupFile>();

        // Skip index 0 (the newest backup is unconditionally preserved)
        for (int i = 1; i < sorted.Count; i++)
        {
            if (sorted[i].CreationTime < cutoff)
            {
                toPrune.Add(sorted[i]);
            }
        }

        return toPrune;
    }

    private static string RedactCredentials(string input)
    {
        // Redact standard ADO.NET connection string password
        var result = Regex.Replace(
            input,
            @"(Password\s*=\s*)([^;]+)",
            "$1***",
            RegexOptions.IgnoreCase);

        // Redact URI style credentials: protocol://user:password@host
        result = Regex.Replace(
            result,
            @"(://[^:]+:)([^@]+)(@)",
            "$1***$3",
            RegexOptions.IgnoreCase);

        return result;
    }

    #endregion
}
