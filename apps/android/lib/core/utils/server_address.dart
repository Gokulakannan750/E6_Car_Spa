/// Turns what a person types for the server (for example "myspa.example.com" or "https://myspa.example.com:5298") into
/// the address the app calls, or says what is wrong with it.
class ServerAddress {
  final String? url;
  final String? error;

  const ServerAddress._({this.url, this.error});

  bool get isValid => url != null;

  /// [allowHttp] is true only in development builds: release builds talk HTTPS only, so a customer's server needs a
  /// certificate.
  static ServerAddress parse(String raw, {required bool allowHttp}) {
    var text = raw.trim();
    if (text.isEmpty) {
      return const ServerAddress._(error: 'Enter the server address.');
    }
    if (RegExp(r'\s').hasMatch(text)) {
      return const ServerAddress._(error: 'The address cannot contain spaces.');
    }
    if (!text.contains('://')) {
      text = 'https://$text';
    }

    final uri = Uri.tryParse(text);
    if (uri == null || uri.host.isEmpty) {
      return const ServerAddress._(
        error: 'That does not look like a server address.',
      );
    }
    final scheme = uri.scheme.toLowerCase();
    if (scheme != 'https' && scheme != 'http') {
      return const ServerAddress._(
        error: 'The address must start with https://',
      );
    }
    if (scheme == 'http' && !allowHttp) {
      return const ServerAddress._(
        error:
            'This app only connects over HTTPS. Ask whoever runs your server for an https:// address.',
      );
    }

    var path = uri.path.replaceAll(RegExp(r'/+$'), '');
    if (!path.toLowerCase().endsWith('/api')) {
      path = '$path/api';
    }
    final authority = uri.hasPort ? '${uri.host}:${uri.port}' : uri.host;
    return ServerAddress._(url: '$scheme://$authority$path');
  }
}
