import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/providers/auth_provider.dart';
import '../data/franchise_repository.dart';
import '../models/franchise_models.dart';

/// What the signed-in company can do in the franchise network.
///
/// It watches who is signed in, so signing in as someone else always asks again instead of showing the previous
/// person's answer. While it loads, or if it cannot be loaded, nothing franchise-related is shown.
final franchiseAccessProvider = FutureProvider.autoDispose<FranchiseAccess>((
  ref,
) async {
  final user = ref.watch(currentUserProvider);
  if (user == null || !user.hasPermission('franchise.view')) {
    return FranchiseAccess.none;
  }
  try {
    return await ref.watch(franchiseRepositoryProvider).getAccess();
  } catch (_) {
    return FranchiseAccess.none;
  }
});

final franchiseNetworkProvider = FutureProvider.autoDispose<FranchiseNetwork>((
  ref,
) {
  ref.watch(currentUserProvider);
  return ref.watch(franchiseRepositoryProvider).getNetwork();
});

final franchiseDashboardProvider = FutureProvider.autoDispose
    .family<FranchiseDashboard, FranchisePeriod>((ref, period) {
      ref.watch(currentUserProvider);
      return ref
          .watch(franchiseRepositoryProvider)
          .getDashboard(period.from, period.to);
    });

/// What a franchise invitation link is asking, for the signed-in company's Owner.
final franchiseInviteProvider = FutureProvider.autoDispose
    .family<FranchiseLink, String>((ref, token) {
      ref.watch(currentUserProvider);
      return ref.watch(franchiseRepositoryProvider).getInvite(token);
    });
