import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/errors/api_exception.dart';
import '../../shared/widgets/app_button.dart';
import '../../shared/widgets/app_screen_scaffold.dart';
import '../auth/providers/auth_provider.dart';
import 'owner_subscription.dart';
import 'plan_change.dart';
import 'subscription_provider.dart';

String _money(int minor) =>
    NumberFormat.currency(locale: 'en_IN', symbol: '₹').format(minor / 100);

String _date(DateTime value) => DateFormat('dd MMM yyyy').format(value);

const _licenceLabels = {
  'both': 'Windows + Android',
  'windows': 'Windows only',
  'android': 'Android only',
};

/// The company's Trovo subscription. Everyone with settings access sees the plan;
/// the Owner can change it, add licences, pay invoices, renew and cancel.
class SubscriptionScreen extends ConsumerStatefulWidget {
  const SubscriptionScreen({super.key});

  @override
  ConsumerState<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends ConsumerState<SubscriptionScreen> {
  Future<(OwnerSubscription, List<OwnerInvoice>)>? _owner;
  String? _busy;
  String? _notice;
  bool _noticeIsError = false;

  @override
  void initState() {
    super.initState();
    final user = ref.read(currentUserProvider);
    if (user?.isOwner ?? false) _reload();
  }

  void _reload() {
    final api = ref.read(ownerSubscriptionApiProvider);
    setState(() {
      _owner = Future.wait([
        api.load(),
        api.invoices(),
      ]).then((r) => (r[0] as OwnerSubscription, r[1] as List<OwnerInvoice>));
    });
  }

  Future<void> _run(
    String key,
    Future<void> Function() action,
    String success,
  ) async {
    setState(() {
      _busy = key;
      _notice = null;
    });
    try {
      await action();
      _notice = success;
      _noticeIsError = false;
      await ref.read(subscriptionStatusProvider.notifier).load();
      _reload();
    } on ApiException catch (e) {
      _notice = e.message;
      _noticeIsError = true;
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _openChange(OwnerSubscription data) async {
    final result = await showModalBottomSheet<ChangeResult>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => ChangePlanSheet(data: data),
    );
    if (result == null || !mounted) return;
    setState(() {
      _noticeIsError = false;
      _notice = result.status == 'Scheduled'
          ? 'Done. Your new plan starts on ${_date(result.effectiveAt)}.'
          : result.invoiceNumber != null
          ? 'Done. Your new plan is in effect. Invoice ${result.invoiceNumber} for ${_money(result.amountNowMinor)} is below.'
          : 'Done. Your new plan is in effect.';
    });
    await ref.read(subscriptionStatusProvider.notifier).load();
    _reload();
  }

  Future<void> _confirmCancel(OwnerSubscription data) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel subscription?'),
        content: Text(
          'You keep full use until ${_date(data.currentPeriodEnd)}. Then the software becomes read-only for 90 days '
          'so you can export your data. Nothing is refunded.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep subscription'),
          ),
          TextButton(
            key: const Key('subscription_cancel_confirm'),
            onPressed: () => Navigator.pop(context, true),
            child: const Text(
              'Cancel at period end',
              style: TextStyle(color: Colors.red),
            ),
          ),
        ],
      ),
    );
    if (ok == true) {
      await _run(
        'cancel',
        () => ref.read(ownerSubscriptionApiProvider).cancel(null),
        'Cancelled. It ends at the end of your paid period.',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = ref.watch(subscriptionStatusProvider);
    final user = ref.watch(currentUserProvider);
    final isOwner = user?.isOwner ?? false;

    return AppScreenScaffold(
      title: 'Subscription',
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (status?.planChangePending ?? false)
            Card(
              color: const Color(0xFFEEF2FF),
              child: ListTile(
                key: const Key('subscription_review_change'),
                leading: const Icon(Icons.swap_horiz_rounded),
                title: const Text('Trovo has proposed a change to your plan'),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => showPlanChangeSheet(context),
              ),
            ),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('PLAN', style: Theme.of(context).textTheme.labelSmall),
                  const SizedBox(height: 4),
                  Text(
                    status?.planName ?? '—',
                    key: const Key('subscription_plan_name'),
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(status?.status ?? ''),
                  const SizedBox(height: 12),
                  for (final l in status?.licences ?? const [])
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              _licenceLabels[l.appAccess.toLowerCase()] ??
                                  l.appAccess,
                            ),
                          ),
                          Text(
                            '${l.used} of ${l.total} in use',
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
          if (!isOwner)
            const Padding(
              padding: EdgeInsets.all(8),
              child: Text(
                'The Owner can change the plan, add user licences and pay invoices here.',
              ),
            )
          else
            FutureBuilder<(OwnerSubscription, List<OwnerInvoice>)>(
              future: _owner,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }
                if (!snapshot.hasData) {
                  return Text(
                    snapshot.error is ApiException
                        ? (snapshot.error as ApiException).message
                        : 'Could not load your subscription.',
                  );
                }
                final (data, invoices) = snapshot.data!;
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_notice != null)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Text(
                          _notice!,
                          key: const Key('subscription_notice'),
                          style: TextStyle(
                            color: _noticeIsError
                                ? Colors.red.shade700
                                : Colors.green.shade800,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    if (data.cancelAtPeriodEnd)
                      Card(
                        color: const Color(0xFFFFFBEB),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Your subscription ends on ${_date(data.currentPeriodEnd)} and will not renew.',
                              ),
                              TextButton(
                                onPressed: _busy == null
                                    ? () => _run(
                                        'resume',
                                        () => ref
                                            .read(ownerSubscriptionApiProvider)
                                            .resume(),
                                        'Your subscription will renew as usual.',
                                      )
                                    : null,
                                child: const Text('Keep my subscription'),
                              ),
                            ],
                          ),
                        ),
                      ),
                    const SizedBox(height: 8),
                    AppButton(
                      key: const Key('subscription_change_plan'),
                      label: 'Change plan or licences',
                      icon: Icons.swap_horiz_rounded,
                      fullWidth: true,
                      onPressed: data.cancelAtPeriodEnd || _busy != null
                          ? null
                          : () => _openChange(data),
                    ),
                    if (data.status == 'Active' && !data.cancelAtPeriodEnd) ...[
                      const SizedBox(height: 8),
                      AppButton(
                        label: 'Renew now',
                        icon: Icons.autorenew_rounded,
                        variant: AppButtonVariant.secondary,
                        fullWidth: true,
                        isLoading: _busy == 'renew',
                        onPressed: _busy == null
                            ? () => _run(
                                'renew',
                                () => ref
                                    .read(ownerSubscriptionApiProvider)
                                    .renew(),
                                'Your renewal invoice is ready below.',
                              )
                            : null,
                      ),
                    ],
                    const SizedBox(height: 16),
                    Text(
                      'INVOICES FROM TROVO',
                      style: Theme.of(context).textTheme.labelSmall,
                    ),
                    if (invoices.isEmpty)
                      const Padding(
                        padding: EdgeInsets.all(8),
                        child: Text('No invoices yet.'),
                      ),
                    for (final invoice in invoices)
                      Card(
                        child: ListTile(
                          key: Key('invoice_${invoice.id}'),
                          title: Text(
                            '${invoice.invoiceNumber} · ${_money(invoice.totalMinor)}',
                          ),
                          subtitle: Text(
                            invoice.kind == 'Adjustment'
                                ? 'Upgrade (rest of period) · ${invoice.status == 'Open' ? 'due ${_date(invoice.dueAt)}' : invoice.status}'
                                : '${invoice.periodStart != null ? '${_date(invoice.periodStart!)} – ${_date(invoice.periodEnd!)}' : 'Subscription'}'
                                      ' · ${invoice.status == 'Open' ? 'due ${_date(invoice.dueAt)}' : invoice.status}',
                          ),
                          trailing: invoice.payable
                              ? (data.canPayOnline
                                    ? TextButton(
                                        key: Key('pay_${invoice.id}'),
                                        onPressed: _busy == null
                                            ? () => _run(
                                                invoice.id,
                                                () => ref
                                                    .read(
                                                      ownerSubscriptionApiProvider,
                                                    )
                                                    .pay(invoice.id),
                                                'Paid. Thank you! Invoice ${invoice.invoiceNumber} is settled.',
                                              )
                                            : null,
                                        child: Text(
                                          data.testPayments
                                              ? 'Pay (test)'
                                              : 'Pay',
                                        ),
                                      )
                                    : const Text(
                                        'Call Trovo',
                                        style: TextStyle(fontSize: 12),
                                      ))
                              : null,
                        ),
                      ),
                    if (!data.canPayOnline)
                      const Padding(
                        padding: EdgeInsets.all(8),
                        child: Text(
                          'Online payment is coming soon. To pay now, call Trovo on +91 90426 72148.',
                        ),
                      ),
                    if ((data.status == 'Active' || data.status == 'PastDue') &&
                        !data.cancelAtPeriodEnd)
                      TextButton(
                        key: const Key('subscription_cancel'),
                        onPressed: _busy == null
                            ? () => _confirmCancel(data)
                            : null,
                        child: const Text(
                          'Cancel subscription',
                          style: TextStyle(color: Colors.red),
                        ),
                      ),
                  ],
                );
              },
            ),
        ],
      ),
    );
  }
}

/// The Owner picks plan, billing, licences and add-ons; the server's price and timing show before confirming.
class ChangePlanSheet extends ConsumerStatefulWidget {
  final OwnerSubscription data;

  const ChangePlanSheet({super.key, required this.data});

  @override
  ConsumerState<ChangePlanSheet> createState() => _ChangePlanSheetState();
}

class _ChangePlanSheetState extends ConsumerState<ChangePlanSheet> {
  late OwnerChoice _choice;
  ChangePreview? _preview;
  String? _error;
  bool _loading = false;
  bool _saving = false;
  Timer? _debounce;
  int _request = 0;

  @override
  void initState() {
    super.initState();
    _choice = widget.data.current;
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  OwnerChoice get _wanted =>
      _choice.cleaned(widget.data.plans, widget.data.addOns);

  bool get _unchanged =>
      _wanted.key ==
      widget.data.current.cleaned(widget.data.plans, widget.data.addOns).key;

  CatalogPlan? get _plan =>
      widget.data.plans.where((p) => p.code == _choice.planCode).firstOrNull;

  void _update(OwnerChoice choice) {
    setState(() {
      _choice = choice;
      _preview = null;
      _error = null;
    });
    _debounce?.cancel();
    if (_unchanged ||
        _plan?.pricesFor(choice.interval) == null ||
        choice.licences.total < (_plan?.minimumLicences ?? 1)) {
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 300), () async {
      final ticket = ++_request;
      setState(() => _loading = true);
      try {
        final preview = await ref
            .read(ownerSubscriptionApiProvider)
            .preview(_wanted);
        if (mounted && ticket == _request) setState(() => _preview = preview);
      } on ApiException catch (e) {
        if (mounted && ticket == _request) setState(() => _error = e.message);
      } finally {
        if (mounted && ticket == _request) setState(() => _loading = false);
      }
    });
  }

  Future<void> _confirm() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final result = await ref
          .read(ownerSubscriptionApiProvider)
          .change(_wanted);
      if (mounted) Navigator.of(context).pop(result);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String _explanation(ChangePreview p) => switch (p.timing) {
    'NowWithCharge' =>
      'It starts now. You pay ${_money(p.amountNowMinor)} today: the difference for the rest of your paid period.',
    'AtPeriodEnd' =>
      'It starts on ${_date(p.effectiveAt)}, when your paid period ends. Nothing is refunded; your renewal uses the new price.',
    _ =>
      'It starts now. Nothing to pay today; your next invoice uses the new price.',
  };

  @override
  Widget build(BuildContext context) {
    final data = widget.data;
    final prices = _plan?.pricesFor(_choice.interval);
    final per = _choice.interval == 'Year' ? '/yr' : '/mo';
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          16,
          0,
          16,
          16 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: SingleChildScrollView(
          child: Column(
            key: const Key('change_plan_sheet'),
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Change plan',
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 12),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'Month', label: Text('Monthly')),
                  ButtonSegment(value: 'Year', label: Text('Yearly')),
                ],
                selected: {_choice.interval},
                onSelectionChanged: (s) =>
                    _update(_choice.copyWith(interval: s.first)),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                children: [
                  for (final p in data.plans)
                    ChoiceChip(
                      key: Key('plan_${p.code}'),
                      label: Text(p.name),
                      selected: _choice.planCode == p.code,
                      onSelected: p.pricesFor(_choice.interval) == null
                          ? null
                          : (_) => _update(_choice.copyWith(planCode: p.code)),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                'USER LICENCES',
                style: Theme.of(context).textTheme.labelSmall,
              ),
              for (final key in ['both', 'windows', 'android'])
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(_licenceLabels[key]!),
                          Text(
                            '${prices != null ? '${_money(prices.forLicence(key))} per user$per · ' : ''}${data.licencesInUse.of(key)} in use',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      key: Key('fewer_$key'),
                      icon: const Icon(Icons.remove_circle_outline),
                      onPressed:
                          _choice.licences.of(key) <= data.licencesInUse.of(key)
                          ? null
                          : () => _update(
                              _choice.copyWith(
                                licences: _choice.licences.withValue(
                                  key,
                                  _choice.licences.of(key) - 1,
                                ),
                              ),
                            ),
                    ),
                    Text('${_choice.licences.of(key)}', key: Key('count_$key')),
                    IconButton(
                      key: Key('more_$key'),
                      icon: const Icon(Icons.add_circle_outline),
                      onPressed: () => _update(
                        _choice.copyWith(
                          licences: _choice.licences.withValue(
                            key,
                            _choice.licences.of(key) + 1,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              const SizedBox(height: 8),
              Text('ADD-ONS', style: Theme.of(context).textTheme.labelSmall),
              for (final a in data.addOns)
                if (a.includedIn(_plan))
                  ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: Text(a.name),
                    subtitle: Text('Included in ${_plan?.name}'),
                  )
                else if (a.priceFor(_choice.interval) != null)
                  SwitchListTile(
                    key: Key('addon_${a.code}'),
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: Text(a.name),
                    subtitle: Text(
                      '${_money(a.priceFor(_choice.interval)!)}$per',
                    ),
                    value: (_choice.addOns[a.code] ?? 0) > 0,
                    onChanged: (on) => _update(
                      _choice.copyWith(
                        addOns: {..._choice.addOns, a.code: on ? 1 : 0},
                      ),
                    ),
                  ),
              const SizedBox(height: 8),
              Container(
                key: const Key('change_preview'),
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _unchanged
                      ? 'Change something above to see the price.'
                      : _error ??
                            (_loading || _preview == null
                                ? 'Working out the price…'
                                : 'New price: ${_money(_preview!.newPeriodPriceMinor)}$per (now ${_money(_preview!.currentPeriodPriceMinor)}$per).\n'
                                      '${_explanation(_preview!)}'),
                  style: TextStyle(
                    color: _error != null ? Colors.red.shade700 : null,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              AppButton(
                key: const Key('change_plan_confirm'),
                label: _preview?.timing == 'NowWithCharge'
                    ? 'Upgrade and pay ${_money(_preview!.amountNowMinor)}'
                    : 'Confirm change',
                fullWidth: true,
                isLoading: _saving,
                onPressed:
                    _unchanged || _preview == null || _loading || _error != null
                    ? null
                    : _confirm,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
