import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/subscription/plan_change.dart';
import '../../features/subscription/plan_features.dart';
import '../../features/subscription/subscription_provider.dart';

class BillingSuiteScope extends InheritedWidget {
  const BillingSuiteScope({super.key, required super.child});

  static bool maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<BillingSuiteScope>() != null;

  @override
  bool updateShouldNotify(BillingSuiteScope oldWidget) => false;
}

class AppShell extends ConsumerWidget {
  final Widget child;
  final String? currentLocation;

  const AppShell({super.key, required this.child, this.currentLocation});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final subscription = ref.watch(subscriptionStatusProvider);
    final message = subscription?.bannerMessage;
    if (message == null || message.isEmpty) return child;

    // The subscription message from the server (trial ending, payment
    // overdue, read-only) above every screen.
    return Column(
      children: [
        SubscriptionBanner(status: subscription!),
        Expanded(child: child),
      ],
    );
  }
}

class SubscriptionBanner extends StatelessWidget {
  final SubscriptionStatus status;

  const SubscriptionBanner({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final (background, foreground, icon) = switch (status.bannerLevel) {
      'error' => (
        const Color(0xFFFEF2F2),
        const Color(0xFF991B1B),
        Icons.lock_outline_rounded,
      ),
      'warning' => (
        const Color(0xFFFFFBEB),
        const Color(0xFF92400E),
        Icons.warning_amber_rounded,
      ),
      _ => (
        const Color(0xFFEFF6FF),
        const Color(0xFF1E3A8A),
        Icons.info_outline_rounded,
      ),
    };
    return Material(
      key: const Key('subscription_banner'),
      color: background,
      // A plan change waiting for the Owner: tap to see it and answer.
      child: InkWell(
        onTap: status.planChangePending
            ? () => showPlanChangeSheet(context)
            : null,
        child: SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              children: [
                Icon(icon, size: 18, color: foreground),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    status.bannerMessage ?? '',
                    style: TextStyle(
                      color: foreground,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                if (status.planChangePending)
                  Icon(
                    Icons.chevron_right_rounded,
                    size: 20,
                    color: foreground,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
