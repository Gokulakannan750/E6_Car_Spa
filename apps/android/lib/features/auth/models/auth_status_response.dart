class AuthStatusResponse {
  final bool initialized;

  const AuthStatusResponse({required this.initialized});

  factory AuthStatusResponse.fromJson(Map<String, dynamic> json) {
    return AuthStatusResponse(
      initialized: json['initialized'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
    'initialized': initialized,
  };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AuthStatusResponse &&
          runtimeType == other.runtimeType &&
          initialized == other.initialized;

  @override
  int get hashCode => initialized.hashCode;
}
