import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/errors/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../../shared/widgets/app_button.dart';
import '../auth/providers/auth_provider.dart';
import '../auth/providers/auth_state.dart';
import 'subscription_provider.dart';

/// A plan as the Owner sees it in a proposal.
class PlanTerms {
  final String planName;
  final String interval;
  final int androidLicences;
  final int windowsLicences;
  final int bothLicences;
  final List<String> addOns;

  const PlanTerms({
    required this.planName,
    required this.interval,
    required this.androidLicences,
    required this.windowsLicences,
    required this.bothLicences,
    required this.addOns,
  });

  bool get yearly => interval == 'Year';

  String get licencesText {
    final parts = [
      if (bothLicences > 0) '$bothLicences Windows + Android',
      if (windowsLicences > 0) '$windowsLicences Windows only',
      if (androidLicences > 0) '$androidLicences Android only',
    ];
    return parts.isEmpty ? 'No user licences' : parts.join(', ');
  }

  factory PlanTerms.fromJson(Map<String, dynamic> json) => PlanTerms(
    planName: json['planName'] as String? ?? '',
    interval: json['interval'] as String? ?? 'Month',
    androidLicences: json['androidLicences'] as int? ?? 0,
    windowsLicences: json['windowsLicences'] as int? ?? 0,
    bothLicences: json['bothLicences'] as int? ?? 0,
    addOns: (json['addOns'] as List<dynamic>? ?? const []).cast<String>(),
  );
}

/// A change to the plan that Trovo proposed ("Pending") or that the Owner
/// approved and starts at the end of the paid period ("Scheduled").
class PlanChangeProposal {
  final String id;
  final String status;

  /// Now, NowWithCharge or AtPeriodEnd.
  final String timing;
  final PlanTerms from;
  final PlanTerms to;
  final int currentPeriodPriceMinor;
  final int newPeriodPriceMinor;
  final int amountNowMinor;
  final DateTime effectiveAt;
  final DateTime expiresAt;
  final String? reason;

  const PlanChangeProposal({
    required this.id,
    required this.status,
    required this.timing,
    required this.from,
    required this.to,
    required this.currentPeriodPriceMinor,
    required this.newPeriodPriceMinor,
    required this.amountNowMinor,
    required this.effectiveAt,
    required this.expiresAt,
    this.reason,
  });

  bool get pending => status == 'Pending';

  factory PlanChangeProposal.fromJson(Map<String, dynamic> json) =>
      PlanChangeProposal(
        id: json['id'] as String,
        status: json['status'] as String? ?? 'Pending',
        timing: json['timing'] as String? ?? 'Now',
        from: PlanTerms.fromJson(json['from'] as Map<String, dynamic>),
        to: PlanTerms.fromJson(json['to'] as Map<String, dynamic>),
        currentPeriodPriceMinor: json['currentPeriodPriceMinor'] as int? ?? 0,
        newPeriodPriceMinor: json['newPeriodPriceMinor'] as int? ?? 0,
        amountNowMinor: json['amountNowMinor'] as int? ?? 0,
        effectiveAt: DateTime.parse(json['effectiveAt'] as String).toLocal(),
        expiresAt: DateTime.parse(json['expiresAt'] as String).toLocal(),
        reason: json['reason'] as String?,
      );
}

/// GET/POST /api/subscription/plan-change…
class PlanChangeApi {
  final Dio _dio;

  PlanChangeApi(this._dio);

  Future<T> _guard<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<PlanChangeProposal?> open() => _guard(() async {
    final response = await _dio.get('/subscription/plan-change');
    if (response.statusCode == 204 || response.data is! Map) return null;
    return PlanChangeProposal.fromJson(response.data as Map<String, dynamic>);
  });

  /// Returns the change while it waits for the period end, or null once in effect.
  Future<PlanChangeProposal?> approve(String id) => _guard(() async {
    final response = await _dio.post('/subscription/plan-change/$id/approve');
    if (response.statusCode == 204 || response.data is! Map) return null;
    return PlanChangeProposal.fromJson(response.data as Map<String, dynamic>);
  });

  Future<void> decline(String id) =>
      _guard(() => _dio.post('/subscription/plan-change/$id/decline'));
}

final planChangeApiProvider = Provider<PlanChangeApi>(
  (ref) => PlanChangeApi(ref.watch(dioProvider)),
);

String _money(int minor) =>
    NumberFormat.currency(locale: 'en_IN', symbol: '₹').format(minor / 100);

String _date(DateTime value) => DateFormat('dd MMM yyyy').format(value);

/// What approving means, in plain words.
String planChangeExplanation(PlanChangeProposal change) {
  if (!change.pending) {
    return 'Approved. It starts on ${_date(change.effectiveAt)}, when your paid period ends. '
        'Until then nothing changes, and the renewal invoice uses the new price.';
  }
  return switch (change.timing) {
    'NowWithCharge' =>
      'It starts as soon as you approve. You will get an invoice for ${_money(change.amountNowMinor)}: '
          'the price difference for the rest of your paid period.',
    'AtPeriodEnd' =>
      'It starts on ${_date(change.effectiveAt)}, when your paid period ends. Nothing is refunded; '
          'the renewal invoice uses the new price.',
    _ =>
      'It starts as soon as you approve. Nothing to pay now; your next invoice uses the new price.',
  };
}

/// Opens the proposal in a bottom sheet (from the subscription banner).
Future<void> showPlanChangeSheet(BuildContext context) =>
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const PlanChangeSheet(),
    );

class PlanChangeSheet extends ConsumerStatefulWidget {
  const PlanChangeSheet({super.key});

  @override
  ConsumerState<PlanChangeSheet> createState() => _PlanChangeSheetState();
}

class _PlanChangeSheetState extends ConsumerState<PlanChangeSheet> {
  late Future<PlanChangeProposal?> _change;
  String? _busy;
  String? _message;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _change = ref.read(planChangeApiProvider).open();
  }

  Future<void> _answer(PlanChangeProposal change, bool approve) async {
    setState(() {
      _busy = approve ? 'approve' : 'decline';
      _message = null;
      _failed = false;
    });
    try {
      final api = ref.read(planChangeApiProvider);
      if (approve) {
        final waiting = await api.approve(change.id);
        _message = waiting == null
            ? 'Approved. Your new plan is in effect.'
            : 'Approved. The change starts on ${_date(waiting.effectiveAt)}.';
      } else {
        await api.decline(change.id);
        _message = 'Declined. Your plan stays as it is.';
      }
      await ref.read(subscriptionStatusProvider.notifier).load();
    } on ApiException catch (e) {
      _failed = true;
      _message = e.message;
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authNotifierProvider);
    final isOwner = auth is Authenticated && auth.user.isOwner;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: FutureBuilder<PlanChangeProposal?>(
          future: _change,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Padding(
                padding: EdgeInsets.all(32),
                child: Center(child: CircularProgressIndicator()),
              );
            }
            final change = snapshot.data;
            if (change == null) {
              return Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  _message ??
                      (snapshot.hasError
                          ? 'Could not load the plan change. Please try again.'
                          : 'There is no plan change waiting.'),
                ),
              );
            }
            final answered = _message != null && !_failed;
            return Column(
              key: const Key('plan_change_sheet'),
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  change.pending
                      ? 'Trovo has proposed a change to your plan'
                      : 'Your plan will change',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (change.reason != null && change.pending) ...[
                  const SizedBox(height: 4),
                  Text(
                    'Reason: ${change.reason}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
                const SizedBox(height: 12),
                _TermsCard(
                  title: 'NOW',
                  terms: change.from,
                  price: change.currentPeriodPriceMinor,
                ),
                const Center(child: Icon(Icons.arrow_downward_rounded)),
                _TermsCard(
                  title: 'NEW',
                  terms: change.to,
                  price: change.newPeriodPriceMinor,
                ),
                const SizedBox(height: 12),
                Text(
                  planChangeExplanation(change),
                  key: const Key('plan_change_explanation'),
                ),
                const SizedBox(height: 16),
                if (_message != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(
                      _message!,
                      key: const Key('plan_change_message'),
                      style: TextStyle(
                        color: _failed
                            ? Colors.red.shade700
                            : Colors.green.shade700,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                if (change.pending && !answered)
                  isOwner
                      ? Row(
                          children: [
                            Expanded(
                              child: AppButton(
                                key: const Key('plan_change_decline'),
                                label: 'Decline',
                                variant: AppButtonVariant.secondary,
                                isLoading: _busy == 'decline',
                                onPressed: _busy == null
                                    ? () => _answer(change, false)
                                    : null,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: AppButton(
                                key: const Key('plan_change_approve'),
                                label: 'Approve',
                                isLoading: _busy == 'approve',
                                onPressed: _busy == null
                                    ? () => _answer(change, true)
                                    : null,
                              ),
                            ),
                          ],
                        )
                      : const Text(
                          'Only the Owner can approve or decline this.',
                        ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _TermsCard extends StatelessWidget {
  final String title;
  final PlanTerms terms;
  final int price;

  const _TermsCard({
    required this.title,
    required this.terms,
    required this.price,
  });

  @override
  Widget build(BuildContext context) {
    final small = Theme.of(context).textTheme.bodySmall;
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: small?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 2),
            Text(
              '${terms.planName} ${terms.yearly ? 'yearly' : 'monthly'}',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            Text(terms.licencesText, style: small),
            Text(
              terms.addOns.isEmpty
                  ? 'No add-ons'
                  : 'Add-ons: ${terms.addOns.join(', ')}',
              style: small,
            ),
            const SizedBox(height: 2),
            Text(
              '${_money(price)} per ${terms.yearly ? 'year' : 'month'}',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
    );
  }
}
