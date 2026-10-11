import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/dio_client.dart';
import '../models/franchise_models.dart';
import 'franchise_api.dart';

final franchiseApiProvider = Provider<FranchiseApi>((ref) {
  return FranchiseApi(ref.watch(dioProvider));
});

final franchiseRepositoryProvider = Provider<FranchiseRepository>((ref) {
  return FranchiseRepository(ref.watch(franchiseApiProvider));
});

/// The franchise network, with every server error turned into a message a person can read.
class FranchiseRepository {
  final FranchiseApi _api;

  FranchiseRepository(this._api);

  Future<T> _guard<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<FranchiseAccess> getAccess() => _guard(_api.getAccess);

  Future<FranchiseNetwork> getNetwork() => _guard(_api.getNetwork);

  Future<FranchiseInviteResult> sendInvite(
    String franchiseeCode,
    List<String> scopes,
  ) => _guard(() => _api.sendInvite(franchiseeCode.trim(), scopes));

  Future<FranchiseLink> cancelInvite(String linkId) =>
      _guard(() => _api.cancelInvite(linkId));

  Future<FranchiseLinkAccess> createLink(String linkId) =>
      _guard(() => _api.createLink(linkId));

  Future<FranchiseLink> endLink(String linkId) =>
      _guard(() => _api.endLink(linkId));

  Future<FranchiseLinkAccess> requestScopes(
    String linkId,
    List<String> scopes,
  ) => _guard(() => _api.requestScopes(linkId, scopes));

  Future<FranchiseLink> decideScope(String linkId, String scope, bool grant) =>
      _guard(() => _api.decideScope(linkId, scope, grant));

  Future<FranchiseLink> getInvite(String token) =>
      _guard(() => _api.getInvite(token));

  Future<FranchiseLink> respondToInvite(
    String token,
    bool accept,
    List<String> grantedScopes,
  ) => _guard(() => _api.respondToInvite(token, accept, grantedScopes));

  Future<FranchiseDashboard> getDashboard(String from, String to) =>
      _guard(() => _api.getDashboard(from, to));

  /// The secret part of an invitation link (or the secret on its own) that a person pasted, or null when the text
  /// does not contain one.
  static String? tokenFromPastedText(String text) {
    final parts = text
        .trim()
        .split(RegExp(r'[/?#]'))
        .where((p) => p.isNotEmpty)
        .toList();
    if (parts.isEmpty) {
      return null;
    }
    final secret = RegExp(r'^[0-9a-fA-F]{64}$');
    for (final part in parts.reversed) {
      if (secret.hasMatch(part)) {
        return part.toLowerCase();
      }
    }
    return null;
  }
}
