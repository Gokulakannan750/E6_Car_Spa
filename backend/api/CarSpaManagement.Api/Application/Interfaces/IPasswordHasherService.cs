using CarSpaManagement.Api.Domain.Entities;

namespace CarSpaManagement.Api.Application.Interfaces;

public interface IPasswordHasherService
{
    string HashPassword(User user, string password);
    bool VerifyPassword(User user, string passwordHash, string providedPassword);
}
