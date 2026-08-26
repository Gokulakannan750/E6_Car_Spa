namespace CarSpaManagement.Api.Infrastructure.Security;

public interface IAesEncryptionService
{
	string? Encrypt(string? plainText);
	string? Decrypt(string? cipherText);
}
