class BootstrapOwnerRequest {
  final String fullName;
  final String username;
  final String password;
  final String confirmPassword;

  const BootstrapOwnerRequest({
    required this.fullName,
    required this.username,
    required this.password,
    required this.confirmPassword,
  });

  Map<String, dynamic> toJson() => {
    'fullName': fullName,
    'username': username,
    'password': password,
    'confirmPassword': confirmPassword,
  };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is BootstrapOwnerRequest &&
          runtimeType == other.runtimeType &&
          fullName == other.fullName &&
          username == other.username &&
          password == other.password &&
          confirmPassword == other.confirmPassword;

  @override
  int get hashCode =>
      fullName.hashCode ^
      username.hashCode ^
      password.hashCode ^
      confirmPassword.hashCode;
}
