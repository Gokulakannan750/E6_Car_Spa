namespace CarSpaManagement.Api.Application.Common;

public class ConflictException(string message) : Exception(message);

public class UnauthorizedException(string message) : Exception(message);

public class ForbiddenException(string message) : Exception(message);

public class ValidationException(string message) : Exception(message);

public class NotFoundException(string message) : Exception(message);

public class AccountLockedException(string message, int remainingLockoutSeconds) : Exception(message)
{
    public int RemainingLockoutSeconds { get; } = remainingLockoutSeconds;
}
