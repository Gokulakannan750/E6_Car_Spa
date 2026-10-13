import 'package:dio/dio.dart';
import '../models/franchise_models.dart';

class FranchiseApi {
  final Dio _dio;

  FranchiseApi(this._dio);

  Map<String, dynamic> _map(Response<dynamic> response) =>
      response.data as Map<String, dynamic>;

  Future<FranchiseSignupCodes> getSignupCodes() async =>
      FranchiseSignupCodes.fromJson(
        _map(await _dio.get('/franchise/signup-codes')),
      );

  Future<CreatedFranchiseSignupCode> createSignupCode(
    List<String> scopes,
    String? label,
  ) async => CreatedFranchiseSignupCode.fromJson(
    _map(
      await _dio.post(
        '/franchise/signup-codes',
        data: {'scopes': scopes, 'label': ?label},
      ),
    ),
  );

  Future<FranchiseSignupCode> cancelSignupCode(String id) async =>
      FranchiseSignupCode.fromJson(
        _map(await _dio.post('/franchise/signup-codes/$id/cancel')),
      );

  Future<FranchiseAccess> getAccess() async =>
      FranchiseAccess.fromJson(_map(await _dio.get('/franchise/access')));

  Future<FranchiseNetwork> getNetwork() async =>
      FranchiseNetwork.fromJson(_map(await _dio.get('/franchise')));

  Future<FranchiseInviteResult> sendInvite(
    String franchiseeCode,
    List<String> scopes,
  ) async => FranchiseInviteResult.fromJson(
    _map(
      await _dio.post(
        '/franchise/invites',
        data: {'franchiseeCode': franchiseeCode, 'scopes': scopes},
      ),
    ),
  );

  Future<FranchiseLink> cancelInvite(String linkId) async =>
      FranchiseLink.fromJson(
        _map(await _dio.post('/franchise/links/$linkId/cancel')),
      );

  Future<FranchiseLinkAccess> createLink(String linkId) async =>
      FranchiseLinkAccess.fromJson(
        _map(await _dio.post('/franchise/links/$linkId/new-link')),
      );

  Future<FranchiseLink> endLink(String linkId) async => FranchiseLink.fromJson(
    _map(await _dio.post('/franchise/links/$linkId/end')),
  );

  Future<FranchiseLinkAccess> requestScopes(
    String linkId,
    List<String> scopes,
  ) async => FranchiseLinkAccess.fromJson(
    _map(
      await _dio.post(
        '/franchise/links/$linkId/scopes',
        data: {'scopes': scopes},
      ),
    ),
  );

  Future<FranchiseLink> decideScope(
    String linkId,
    String scope,
    bool grant,
  ) async => FranchiseLink.fromJson(
    _map(
      await _dio.put(
        '/franchise/links/$linkId/scopes/$scope',
        data: {'grant': grant},
      ),
    ),
  );

  Future<FranchiseLink> getInvite(String token) async => FranchiseLink.fromJson(
    _map(await _dio.get('/franchise/invites/${Uri.encodeComponent(token)}')),
  );

  Future<FranchiseLink> respondToInvite(
    String token,
    bool accept,
    List<String> grantedScopes,
  ) async => FranchiseLink.fromJson(
    _map(
      await _dio.post(
        '/franchise/invites/${Uri.encodeComponent(token)}/respond',
        data: {'accept': accept, 'grantedScopes': grantedScopes},
      ),
    ),
  );

  /// The full monthly billing report of one franchisee, only when it shared its invoice list.
  Future<Map<String, dynamic>> getBillingReport(
    String linkId,
    int year,
    int month,
  ) async => _map(
    await _dio.get(
      '/franchise/links/$linkId/billing-report',
      queryParameters: {'year': year, 'month': month},
    ),
  );

  Future<FranchiseDashboard> getDashboard(String from, String to) async =>
      FranchiseDashboard.fromJson(
        _map(
          await _dio.get(
            '/franchise/dashboard',
            queryParameters: {'from': from, 'to': to},
          ),
        ),
      );
}
