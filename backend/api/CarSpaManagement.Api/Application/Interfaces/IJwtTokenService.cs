using CarSpaManagement.Api.Domain.Entities;

namespace CarSpaManagement.Api.Application.Interfaces;

public interface IJwtTokenService
{
    string GenerateToken(User user);
}
