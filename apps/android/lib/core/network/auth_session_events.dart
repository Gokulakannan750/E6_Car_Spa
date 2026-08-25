import 'dart:async';

/// Global event broadcaster for auth session lifecycle events (e.g. 401 Unauthorized)
/// Decouples Dio network layer from Riverpod UI state management to prevent circular dependencies.
class AuthSessionEvents {
  static final StreamController<void> _unauthorizedController =
      StreamController<void>.broadcast();

  /// Stream notifying when a 401 Unauthorized response is received
  static Stream<void> get onUnauthorized => _unauthorizedController.stream;

  /// Notify all listeners that an unauthorized event occurred
  static void notifyUnauthorized() {
    if (!_unauthorizedController.isClosed) {
      _unauthorizedController.add(null);
    }
  }
}
