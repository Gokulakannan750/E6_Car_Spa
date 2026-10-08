import 'auth_user.dart';

class LoginResponse {
  final String token;
  final AuthUser user;
  final String companyCode;

  const LoginResponse({
    required this.token,
    required this.user,
    this.companyCode = '',
  });

  factory LoginResponse.fromJson(Map<String, dynamic> json) {
    return LoginResponse(
      token: json['token'] as String? ?? '',
      user: AuthUser.fromJson(json['user'] as Map<String, dynamic>? ?? {}),
      companyCode: json['companyCode'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {'token': token, 'user': user.toJson(), 'companyCode': companyCode};
  }
}
