class AuthStatusResponse {
  final bool initialized;

  /// True on Trovo's platform: a new company registers with the company code
  /// and one-time registration code Trovo gave it.
  final bool companyRegistration;

  const AuthStatusResponse({
    required this.initialized,
    this.companyRegistration = false,
  });

  factory AuthStatusResponse.fromJson(Map<String, dynamic> json) {
    return AuthStatusResponse(
      initialized: json['initialized'] as bool? ?? false,
      companyRegistration: json['companyRegistration'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
    'initialized': initialized,
    'companyRegistration': companyRegistration,
  };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AuthStatusResponse &&
          runtimeType == other.runtimeType &&
          initialized == other.initialized &&
          companyRegistration == other.companyRegistration;

  @override
  int get hashCode => Object.hash(initialized, companyRegistration);
}
