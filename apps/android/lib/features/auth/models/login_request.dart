/// This is the Android app; the server checks it against the user's licence
/// (a user may only sign in to the apps their licence covers).
const String clientApp = 'android';

class LoginRequest {
  final String username;
  final String password;
  final String? companyCode;

  const LoginRequest({
    required this.username,
    required this.password,
    this.companyCode,
  });

  Map<String, dynamic> toJson() {
    final code = companyCode?.trim() ?? '';
    return {
      'username': username,
      'password': password,
      if (code.isNotEmpty) 'companyCode': code,
      'app': clientApp,
    };
  }
}
