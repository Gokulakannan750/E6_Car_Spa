import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/franchise/data/franchise_api.dart';
import 'package:e6_car_spa/features/franchise/data/franchise_repository.dart';
import 'package:e6_car_spa/features/franchise/models/franchise_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

const owner = AuthUser(
  id: 'owner-id',
  fullName: 'Owner User',
  username: 'owner',
  role: 'Owner',
  isOwner: true,
);

/// Someone who may look at the franchise network but not change it.
const viewer = AuthUser(
  id: 'viewer-id',
  fullName: 'View Only',
  username: 'viewer',
  role: 'Staff',
  isOwner: false,
  permissions: ['franchise.view'],
);

const totalsLabel = 'Financial totals (revenue, collections, jobs, invoices)';

const exampleLink =
    'http://localhost:5173/franchise-invite/'
    '3f5797ee312909e790561620504c906301b8f010ef35380687c0f58c92db1482';

FranchiseScope scope(String scope, String label, String status) =>
    FranchiseScope(scope: scope, label: label, status: status);

FranchiseLink link({
  String id = 'l1',
  String role = 'Franchisor',
  String hint = '0••2',
  String name = 'Beta Detailing',
  String status = 'Pending',
  List<FranchiseScope>? scopes,
}) => FranchiseLink(
  id: id,
  role: role,
  partnerCodeHint: hint,
  partnerName: name,
  status: status,
  expiresAt: DateTime(2026, 10, 15),
  scopes: scopes ?? [scope('financial_totals', totalsLabel, 'Requested')],
);

FranchiseNetwork network({
  List<FranchiseLink> franchisees = const [],
  List<FranchiseLink> franchisors = const [],
}) => FranchiseNetwork(
  franchiseEnabled: true,
  franchisees: franchisees,
  franchisors: franchisors,
  pendingInvitations: franchisors.where((l) => l.isPending).length,
);

FranchiseTotals totals({
  double invoiced = 1300,
  double collected = 700,
  double outstanding = 600,
  int invoices = 3,
  int jobs = 5,
  List<FranchiseDailyPoint> daily = const [
    FranchiseDailyPoint(date: '2026-10-01', invoiced: 600, collected: 300),
    FranchiseDailyPoint(date: '2026-10-02', invoiced: 700, collected: 400),
  ],
}) => FranchiseTotals(
  invoiceCount: invoices,
  invoicedAmount: invoiced,
  collectedAmount: collected,
  outstandingAmount: outstanding,
  jobCardCount: jobs,
  daily: daily,
);

class TestAuthNotifier extends StateNotifier<AuthState>
    implements AuthNotifier {
  TestAuthNotifier(super.initialState);

  @override
  Future<bool> login(
    String username,
    String password, {
    String? companyCode,
  }) async => true;

  @override
  Future<void> logout() async {
    state = const Unauthenticated();
  }

  @override
  Future<void> restoreSession() async {}

  @override
  void clearError() {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

/// A franchise repository with scripted answers that remembers what it was asked.
class FakeFranchiseRepository extends FranchiseRepository {
  FakeFranchiseRepository() : super(FranchiseApi(Dio()));

  FranchiseAccess access = const FranchiseAccess(
    canActAsFranchisor: true,
    isFranchisee: false,
  );
  FranchiseNetwork currentNetwork = network();
  FranchiseDashboard? dashboard;
  FranchiseLink? invite;
  Object? failWith;

  final List<String> calls = [];
  final List<FranchisePeriod> dashboardPeriods = [];

  void _record(String call) {
    calls.add(call);
    if (failWith != null) {
      throw failWith!;
    }
  }

  @override
  Future<FranchiseAccess> getAccess() async => access;

  @override
  Future<FranchiseNetwork> getNetwork() async => currentNetwork;

  @override
  Future<FranchiseInviteResult> sendInvite(
    String franchiseeCode,
    List<String> scopes,
  ) async {
    _record('invite:$franchiseeCode:${scopes.join(',')}');
    return const FranchiseInviteResult(
      message:
          'If that code belongs to an active company, your invitation has been sent.',
      inviteLink: exampleLink,
    );
  }

  @override
  Future<FranchiseLink> cancelInvite(String linkId) async {
    _record('cancel:$linkId');
    return link(id: linkId, status: 'Cancelled');
  }

  @override
  Future<FranchiseLinkAccess> createLink(String linkId) async {
    _record('newlink:$linkId');
    return FranchiseLinkAccess(
      link: link(id: linkId),
      accessLink: exampleLink,
      accessLinkExpiresAt: DateTime(2026, 10, 15),
    );
  }

  @override
  Future<FranchiseLink> endLink(String linkId) async {
    _record('end:$linkId');
    return link(id: linkId, status: 'Ended');
  }

  @override
  Future<FranchiseLinkAccess> requestScopes(
    String linkId,
    List<String> scopes,
  ) async {
    _record('request:$linkId:${scopes.join(',')}');
    return FranchiseLinkAccess(
      link: link(id: linkId, status: 'Active'),
      accessLink: exampleLink,
    );
  }

  @override
  Future<FranchiseLink> decideScope(
    String linkId,
    String scope,
    bool grant,
  ) async {
    _record('decide:$linkId:$scope:$grant');
    return link(id: linkId, status: 'Active');
  }

  @override
  Future<FranchiseLink> getInvite(String token) async {
    calls.add('getInvite:$token');
    if (failWith != null) {
      throw failWith!;
    }
    return invite ?? link(role: 'Franchisee', name: 'Alpha Car Spa');
  }

  @override
  Future<FranchiseLink> respondToInvite(
    String token,
    bool accept,
    List<String> grantedScopes,
  ) async {
    _record('respond:$token:$accept:${grantedScopes.join(',')}');
    return link(status: accept ? 'Active' : 'Declined');
  }

  @override
  Future<FranchiseDashboard> getDashboard(String from, String to) async {
    dashboardPeriods.add((from: from, to: to));
    if (failWith != null) {
      throw failWith!;
    }
    return dashboard ??
        FranchiseDashboard(
          from: from,
          to: to,
          network: totals(),
          franchisees: const [],
        );
  }
}

/// A big screen, so nothing needs scrolling to be tapped.
void useTallScreen(WidgetTester tester) {
  tester.view.physicalSize = const Size(800, 3200);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

void disableFontDownloads() {
  GoogleFonts.config.allowRuntimeFetching = false;
}

Widget franchiseApp({
  required Widget home,
  required FakeFranchiseRepository repo,
  AuthUser user = owner,
}) {
  return ProviderScope(
    overrides: [
      authNotifierProvider.overrideWith(
        (ref) => TestAuthNotifier(Authenticated(user)),
      ),
      franchiseRepositoryProvider.overrideWithValue(repo),
    ],
    child: MaterialApp(home: home),
  );
}

ApiException serverError(String message, [int status = 400]) =>
    ApiException(message: message, statusCode: status);
