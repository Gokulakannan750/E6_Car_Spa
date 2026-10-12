/// First registration of a company Trovo created: the company code and
/// one-time registration code Trovo gave the customer, plus the Owner account.
class RegisterCompanyRequest {
  final String companyCode;
  final String registrationCode;
  final String fullName;
  final String username;
  final String password;
  final String confirmPassword;

  const RegisterCompanyRequest({
    required this.companyCode,
    required this.registrationCode,
    required this.fullName,
    required this.username,
    required this.password,
    required this.confirmPassword,
  });

  Map<String, dynamic> toJson() => {
    'companyCode': companyCode,
    'registrationCode': registrationCode,
    'fullName': fullName,
    'username': username,
    'password': password,
    'confirmPassword': confirmPassword,
  };
}
