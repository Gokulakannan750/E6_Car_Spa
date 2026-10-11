/// A link the customer can open to see their invoice. The address is only known right after it is made: the server
/// keeps a hash of the secret, so an existing link cannot be shown again, only replaced.
class InvoicePublicLink {
  final String url;
  final DateTime? createdAt;

  const InvoicePublicLink({required this.url, this.createdAt});

  factory InvoicePublicLink.fromJson(Map<String, dynamic> json) =>
      InvoicePublicLink(
        url: json['url'] as String? ?? '',
        createdAt: DateTime.tryParse(json['createdAtUtc'] as String? ?? ''),
      );
}

class InvoicePublicLinkStatus {
  final bool hasActiveLink;
  final DateTime? createdAt;
  final int accessCount;
  final DateTime? lastAccessedAt;

  const InvoicePublicLinkStatus({
    required this.hasActiveLink,
    this.createdAt,
    this.accessCount = 0,
    this.lastAccessedAt,
  });

  factory InvoicePublicLinkStatus.fromJson(Map<String, dynamic> json) =>
      InvoicePublicLinkStatus(
        hasActiveLink: json['hasActiveLink'] as bool? ?? false,
        createdAt: DateTime.tryParse(json['createdAtUtc'] as String? ?? ''),
        accessCount: (json['accessCount'] as num?)?.toInt() ?? 0,
        lastAccessedAt: DateTime.tryParse(
          json['lastAccessedAtUtc'] as String? ?? '',
        ),
      );
}
