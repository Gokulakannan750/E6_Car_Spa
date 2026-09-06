namespace CarSpaManagement.Api.Application.Interfaces;

public interface IAccountLockoutService
{
    (bool IsLocked, int RemainingSeconds) CheckLockout(string username);
    (bool NewlyLocked, int RemainingSeconds) RecordFailedAttempt(string username);
    void RecordSuccessfulLogin(string username);
    void Reset(string username);
}
