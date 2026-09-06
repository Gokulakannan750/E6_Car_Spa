using System.Collections.Concurrent;
using CarSpaManagement.Api.Application.Interfaces;

namespace CarSpaManagement.Api.Application.Services;

public class AccountLockoutService : IAccountLockoutService
{
    public const int MaxFailedAttempts = 5;
    public static readonly TimeSpan FailureWindow = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(5);

    private class LockoutRecord
    {
        public readonly object SyncRoot = new();
        public readonly List<DateTime> FailedAttemptTimestamps = [];
        public DateTime? LockoutEndUtc { get; set; }
    }

    private readonly ConcurrentDictionary<string, LockoutRecord> _records = new(StringComparer.OrdinalIgnoreCase);

    private static string Normalize(string username) => username.Trim().ToLowerInvariant();

    public (bool IsLocked, int RemainingSeconds) CheckLockout(string username)
    {
        if (string.IsNullOrWhiteSpace(username))
        {
            return (false, 0);
        }

        var normalized = Normalize(username);
        if (!_records.TryGetValue(normalized, out var record))
        {
            return (false, 0);
        }

        lock (record.SyncRoot)
        {
            var now = DateTime.UtcNow;
            if (record.LockoutEndUtc.HasValue)
            {
                if (record.LockoutEndUtc.Value > now)
                {
                    var remaining = (int)Math.Ceiling((record.LockoutEndUtc.Value - now).TotalSeconds);
                    return (true, Math.Max(1, remaining));
                }

                // Lockout period has elapsed; clear the lockout
                record.LockoutEndUtc = null;
                record.FailedAttemptTimestamps.Clear();
            }

            return (false, 0);
        }
    }

    public (bool NewlyLocked, int RemainingSeconds) RecordFailedAttempt(string username)
    {
        if (string.IsNullOrWhiteSpace(username))
        {
            return (false, 0);
        }

        var normalized = Normalize(username);
        var record = _records.GetOrAdd(normalized, _ => new LockoutRecord());

        lock (record.SyncRoot)
        {
            var now = DateTime.UtcNow;

            // If currently locked, return existing remaining seconds
            if (record.LockoutEndUtc.HasValue && record.LockoutEndUtc.Value > now)
            {
                var remaining = (int)Math.Ceiling((record.LockoutEndUtc.Value - now).TotalSeconds);
                return (false, Math.Max(1, remaining));
            }

            // Remove failures outside the 15-minute failure window
            var windowStart = now - FailureWindow;
            record.FailedAttemptTimestamps.RemoveAll(ts => ts < windowStart);

            // Record this failure
            record.FailedAttemptTimestamps.Add(now);

            // Check if threshold reached
            if (record.FailedAttemptTimestamps.Count >= MaxFailedAttempts)
            {
                record.LockoutEndUtc = now.Add(LockoutDuration);
                record.FailedAttemptTimestamps.Clear();
                var remaining = (int)Math.Ceiling(LockoutDuration.TotalSeconds);
                return (true, remaining);
            }

            return (false, 0);
        }
    }

    public void RecordSuccessfulLogin(string username)
    {
        if (string.IsNullOrWhiteSpace(username))
        {
            return;
        }

        var normalized = Normalize(username);
        if (_records.TryGetValue(normalized, out var record))
        {
            lock (record.SyncRoot)
            {
                record.LockoutEndUtc = null;
                record.FailedAttemptTimestamps.Clear();
            }
        }
    }

    public void Reset(string username)
    {
        if (string.IsNullOrWhiteSpace(username))
        {
            return;
        }

        var normalized = Normalize(username);
        _records.TryRemove(normalized, out _);
    }
}
