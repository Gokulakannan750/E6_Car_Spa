import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/format_utils.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_confirm_dialog.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/app_logout_action.dart';
import '../../../../shared/widgets/app_screen_scaffold.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../../reports/export/billing_excel.dart';
import '../../../reports/presentation/widgets/report_export_button.dart';
import '../../data/franchise_repository.dart';
import '../../export/franchise_excel.dart';
import '../../models/franchise_models.dart';
import '../../providers/franchise_providers.dart';
import '../widgets/franchise_widgets.dart';

/// The franchise workspace for a company that gives franchises to others: its network of invited companies, and the
/// figures they have allowed it to see. A franchisee does not get this; it answers through an invitation link and
/// reviews what it shares under Settings.
class FranchiseScreen extends ConsumerWidget {
  const FranchiseScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final access = ref.watch(franchiseAccessProvider);

    return AppScreenScaffold(
      title: 'Franchise',
      actions: const [AppLogoutAction()],
      body: access.when(
        loading: () => const AppLoadingState(),
        error: (_, _) => const SizedBox.shrink(),
        data: (value) {
          if (!value.canActAsFranchisor) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: AppEmptyState(
                  key: const Key('franchise_not_active'),
                  icon: Icons.hub_outlined,
                  title: 'The Franchise add-on is not active',
                  message: value.isFranchisee
                      ? 'This section is for companies that give franchises to others. You can review what you share '
                            'under Settings → Franchise Sharing.'
                      : 'This section is for companies that give franchises to others. Contact your administrator to '
                            'switch the Franchise add-on on for your company.',
                  actionLabel: value.isFranchisee
                      ? 'Open Franchise Sharing'
                      : 'Back to dashboard',
                  onAction: () => context.go(
                    value.isFranchisee
                        ? AppRoutes.franchiseSharing
                        : AppRoutes.dashboard,
                  ),
                ),
              ),
            );
          }
          return const DefaultTabController(
            length: 2,
            child: Column(
              children: [
                TabBar(
                  tabs: [
                    Tab(key: Key('franchise_tab_network'), text: 'Network'),
                    Tab(key: Key('franchise_tab_dashboard'), text: 'Dashboard'),
                  ],
                ),
                Expanded(
                  child: TabBarView(children: [_NetworkTab(), _DashboardTab()]),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ── Network ──────────────────────────────────────────────────────────────────────────────────────────────

class _ShownLink {
  final String link;
  final DateTime? expiresAt;
  final String intro;

  const _ShownLink(this.link, this.intro, [this.expiresAt]);
}

class _NetworkTab extends ConsumerStatefulWidget {
  const _NetworkTab();

  @override
  ConsumerState<_NetworkTab> createState() => _NetworkTabState();
}

class _NetworkTabState extends ConsumerState<_NetworkTab> {
  final _codeController = TextEditingController();
  final Set<String> _scopes = {'financial_totals'};
  final Map<String, _ShownLink> _shownLinks = {};
  String? _notice;
  bool _noticeIsError = false;
  bool _sending = false;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  void _setNotice(String text, {bool error = false}) {
    if (!mounted) return;
    setState(() {
      _notice = text;
      _noticeIsError = error;
    });
  }

  Future<void> _run(Future<void> Function() action, {String? success}) async {
    setState(() => _notice = null);
    try {
      await action();
      ref.invalidate(franchiseNetworkProvider);
      if (success != null) _setNotice(success);
    } catch (e) {
      _setNotice(franchiseErrorText(e), error: true);
    }
  }

  Future<void> _sendInvite() async {
    final code = _codeController.text.trim();
    if (code.isEmpty || _scopes.isEmpty) return;
    setState(() {
      _sending = true;
      _notice = null;
    });
    try {
      final result = await ref
          .read(franchiseRepositoryProvider)
          .sendInvite(code, _scopes.toList());
      ref.invalidate(franchiseNetworkProvider);
      if (!mounted) return;
      setState(() {
        _shownLinks['invite'] = _ShownLink(
          result.inviteLink,
          'Send this link to the company you invited, for example on WhatsApp or by email.',
        );
        _codeController.clear();
      });
      _setNotice(result.message);
    } catch (e) {
      _setNotice(franchiseErrorText(e), error: true);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final network = ref.watch(franchiseNetworkProvider);
    final user = ref.watch(currentUserProvider);
    final canManage = user?.hasPermission('franchise.manage') ?? false;

    return network.when(
      loading: () => const AppLoadingState(),
      error: (e, _) => AppErrorState(
        title: 'Could not load the franchise network',
        message: franchiseErrorText(e),
        retryLabel: 'Retry',
        onRetry: () => ref.invalidate(franchiseNetworkProvider),
      ),
      data: (data) => RefreshIndicator(
        onRefresh: () async => ref.refresh(franchiseNetworkProvider.future),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Invite the companies you franchise. They answer through a link you send, and nothing is shared until '
              'they agree.',
              style: AppTextStyles.bodySmall.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 12),
            if (_notice != null)
              FranchiseNotice(text: _notice!, isError: _noticeIsError),
            if (canManage) _buildInviteForm(),
            if (_shownLinks['invite'] case final shown?)
              FranchiseLinkBox(
                link: shown.link,
                intro: shown.intro,
                expiresAt: shown.expiresAt,
              ),
            if (data.franchisees.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(
                  'You have not invited any company yet.',
                  key: const Key('franchise_no_franchisees'),
                  style: AppTextStyles.bodySmall.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              )
            else
              for (final link in data.franchisees)
                _FranchiseeCard(
                  link: link,
                  canManage: canManage,
                  shown: _shownLinks[link.id],
                  onCancel: () => _run(
                    () => ref
                        .read(franchiseRepositoryProvider)
                        .cancelInvite(link.id),
                    success: 'Invitation withdrawn.',
                  ),
                  onNewLink: () => _run(() async {
                    final result = await ref
                        .read(franchiseRepositoryProvider)
                        .createLink(link.id);
                    if (!mounted) return;
                    setState(() {
                      _shownLinks[link.id] = _ShownLink(
                        result.accessLink ?? '',
                        'A new link was made. The earlier link no longer works.',
                        result.accessLinkExpiresAt,
                      );
                    });
                  }),
                  onEnd: () async {
                    final ok = await AppConfirmDialog.show(
                      context: context,
                      title: 'End franchise link',
                      message:
                          'End the franchise link with ${link.partnerName}? You will stop seeing their figures at once.',
                      confirmLabel: 'End link',
                      isDestructive: true,
                    );
                    if (ok == true) {
                      await _run(
                        () => ref
                            .read(franchiseRepositoryProvider)
                            .endLink(link.id),
                        success: 'Franchise link ended.',
                      );
                    }
                  },
                  onAskMore: (scopes) => _run(() async {
                    final result = await ref
                        .read(franchiseRepositoryProvider)
                        .requestScopes(link.id, scopes);
                    if (!mounted) return;
                    if (result.accessLink != null) {
                      setState(() {
                        _shownLinks[link.id] = _ShownLink(
                          result.accessLink!,
                          'Send this link to the company so they can answer your request.',
                          result.accessLinkExpiresAt,
                        );
                      });
                    }
                  }, success: 'Your request was made.'),
                ),
          ],
        ),
      ),
    );
  }

  Widget _buildInviteForm() {
    return FranchiseCard(
      cardKey: const Key('franchise_invite_form'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Invite a company',
            style: AppTextStyles.bodyMedium.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            key: const Key('franchise_invite_code'),
            controller: _codeController,
            maxLength: 20,
            textInputAction: TextInputAction.done,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              labelText: 'Their company code',
              border: OutlineInputBorder(),
              isDense: true,
              counterText: '',
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'What do you want to see?',
            style: AppTextStyles.labelMedium.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
          FranchiseScopePicker(
            keyPrefix: 'franchise_scope',
            options: franchiseScopeOptions,
            selected: _scopes,
            onToggle: (scope) => setState(() {
              if (!_scopes.remove(scope)) _scopes.add(scope);
            }),
          ),
          const SizedBox(height: 6),
          AppButton(
            key: const Key('franchise_send_invite'),
            label: 'Send invitation',
            icon: Icons.send_rounded,
            fullWidth: true,
            isLoading: _sending,
            onPressed: _codeController.text.trim().isEmpty || _scopes.isEmpty
                ? null
                : _sendInvite,
          ),
        ],
      ),
    );
  }
}

class _FranchiseeCard extends StatefulWidget {
  final FranchiseLink link;
  final bool canManage;
  final _ShownLink? shown;
  final VoidCallback onCancel;
  final VoidCallback onNewLink;
  final Future<void> Function() onEnd;
  final void Function(List<String> scopes) onAskMore;

  const _FranchiseeCard({
    required this.link,
    required this.canManage,
    required this.shown,
    required this.onCancel,
    required this.onNewLink,
    required this.onEnd,
    required this.onAskMore,
  });

  @override
  State<_FranchiseeCard> createState() => _FranchiseeCardState();
}

class _FranchiseeCardState extends State<_FranchiseeCard> {
  bool _asking = false;
  final Set<String> _more = {};

  @override
  Widget build(BuildContext context) {
    final link = widget.link;
    final id = link.id;
    final askable = franchiseScopeOptions.where((o) {
      final existing = link.scopes.where((s) => s.scope == o.scope);
      return existing.isEmpty || existing.first.isDenied;
    }).toList();
    final canMakeLink =
        link.isPending || (link.isActive && link.hasOpenRequest);

    return FranchiseCard(
      cardKey: Key('franchise_card_$id'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FranchisePartnerHeader(link: link),
          const SizedBox(height: 10),
          for (final scope in link.scopes)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                children: [
                  Expanded(
                    child: Text(scope.label, style: AppTextStyles.bodySmall),
                  ),
                  Text(
                    scope.isGranted
                        ? 'Allowed'
                        : scope.isRequested
                        ? 'Waiting for their answer'
                        : 'Not allowed',
                    style: AppTextStyles.labelSmall.copyWith(
                      fontWeight: FontWeight.w700,
                      color: scope.isGranted
                          ? AppColors.success
                          : scope.isRequested
                          ? AppColors.warning
                          : AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          if (link.isPending)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'Waiting for their answer. Expires on ${franchiseDate(link.expiresAt)}.',
                style: AppTextStyles.caption.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            ),
          if (widget.shown != null && widget.shown!.link.isNotEmpty) ...[
            const SizedBox(height: 8),
            FranchiseLinkBox(
              link: widget.shown!.link,
              intro: widget.shown!.intro,
              expiresAt: widget.shown!.expiresAt,
            ),
          ],
          if (widget.canManage) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                if (canMakeLink)
                  OutlinedButton.icon(
                    key: Key('franchise_new_link_$id'),
                    onPressed: widget.onNewLink,
                    icon: const Icon(Icons.link_rounded, size: 18),
                    label: const Text('Make a new link'),
                  ),
                if (link.isPending)
                  OutlinedButton.icon(
                    key: Key('franchise_withdraw_$id'),
                    onPressed: widget.onCancel,
                    icon: const Icon(Icons.close_rounded, size: 18),
                    label: const Text('Withdraw invitation'),
                  ),
                if (link.isActive && askable.isNotEmpty)
                  OutlinedButton.icon(
                    key: Key('franchise_ask_more_$id'),
                    onPressed: () => setState(() => _asking = !_asking),
                    icon: const Icon(Icons.add_rounded, size: 18),
                    label: const Text('Ask to see more'),
                  ),
                if (link.isActive)
                  TextButton.icon(
                    key: Key('franchise_end_$id'),
                    onPressed: widget.onEnd,
                    icon: const Icon(Icons.link_off_rounded, size: 18),
                    label: const Text('End link'),
                  ),
              ],
            ),
          ],
          if (_asking && link.isActive)
            Container(
              margin: const EdgeInsets.only(top: 8),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.surfaceAlt,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Column(
                children: [
                  FranchiseScopePicker(
                    keyPrefix: 'franchise_ask_scope_$id',
                    options: askable,
                    selected: _more,
                    onToggle: (scope) => setState(() {
                      if (!_more.remove(scope)) _more.add(scope);
                    }),
                  ),
                  Align(
                    alignment: Alignment.centerRight,
                    child: FilledButton(
                      key: Key('franchise_send_request_$id'),
                      onPressed: _more.isEmpty
                          ? null
                          : () {
                              widget.onAskMore(_more.toList());
                              setState(() {
                                _more.clear();
                                _asking = false;
                              });
                            },
                      child: const Text('Send request'),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

// ── Dashboard ────────────────────────────────────────────────────────────────────────────────────────────

String _isoDate(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

class _DashboardTab extends ConsumerStatefulWidget {
  const _DashboardTab();

  @override
  ConsumerState<_DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends ConsumerState<_DashboardTab> {
  /// 7, 30 or 90 days ending today; null while a custom range is chosen.
  int? _days = 30;
  DateTimeRange? _custom;

  FranchisePeriod get _period {
    if (_days == null && _custom != null) {
      return (from: _isoDate(_custom!.start), to: _isoDate(_custom!.end));
    }
    final today = DateTime.now();
    return (
      from: _isoDate(today.subtract(Duration(days: (_days ?? 30) - 1))),
      to: _isoDate(today),
    );
  }

  Future<void> _pickRange() async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 3),
      lastDate: now,
      initialDateRange:
          _custom ??
          DateTimeRange(
            start: now.subtract(const Duration(days: 29)),
            end: now,
          ),
    );
    if (picked == null || !mounted) return;
    if (picked.duration.inDays > 366) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Choose a period of at most one year.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    setState(() {
      _custom = picked;
      _days = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final period = _period;
    final dashboard = ref.watch(franchiseDashboardProvider(period));

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'The financial figures your franchisees have allowed you to see. Nothing else is shown.',
          style: AppTextStyles.bodySmall.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          children: [
            for (final days in const [7, 30, 90])
              ChoiceChip(
                key: Key('franchise_period_$days'),
                label: Text('Last $days days'),
                selected: _days == days,
                onSelected: (_) => setState(() => _days = days),
              ),
            ChoiceChip(
              key: const Key('franchise_period_custom'),
              label: Text(
                _days == null && _custom != null
                    ? '${_isoDate(_custom!.start)} to ${_isoDate(_custom!.end)}'
                    : 'Custom',
              ),
              selected: _days == null,
              onSelected: (_) => _pickRange(),
            ),
          ],
        ),
        const SizedBox(height: 12),
        dashboard.when(
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(vertical: 32),
            child: AppLoadingState(),
          ),
          error: (e, _) => AppErrorState(
            title: 'Could not load the franchise figures',
            message: franchiseErrorText(e),
            retryLabel: 'Retry',
            onRetry: () => ref.invalidate(franchiseDashboardProvider(period)),
          ),
          data: (data) => _DashboardBody(data: data),
        ),
      ],
    );
  }
}

class _DashboardBody extends StatelessWidget {
  final FranchiseDashboard data;

  const _DashboardBody({required this.data});

  @override
  Widget build(BuildContext context) {
    if (data.franchisees.isEmpty) {
      return const AppEmptyState(
        key: Key('franchise_dashboard_empty'),
        icon: Icons.hub_outlined,
        title: 'No franchisee is connected yet',
        message:
            'Invite a company from the Network tab. Once they accept and allow the financial totals, their figures '
            'appear here.',
      );
    }

    final sharing = data.sharing;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (sharing.isNotEmpty) ...[
          Text(
            'Network total (${sharing.length} ${sharing.length == 1 ? 'company' : 'companies'})',
            key: const Key('franchise_network_heading'),
            style: AppTextStyles.labelLarge.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          _TotalsGrid(totals: data.network),
          const SizedBox(height: 12),
          FranchiseCard(
            cardKey: const Key('franchise_chart_card'),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Invoiced and collected',
                  style: AppTextStyles.bodyMedium.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  '${data.from} to ${data.to}, all companies together',
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 10),
                if (data.network.daily.isEmpty)
                  const SizedBox(
                    height: 120,
                    child: Center(
                      child: Text('No invoices or payments in this period.'),
                    ),
                  )
                else
                  _DailyBarChart(points: data.network.daily),
              ],
            ),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: ReportExportButton(
              label: 'Download network summary (Excel)',
              build: (ref, companyName) async => [
                FranchiseExcel.networkSummary(data, companyName: companyName),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'By company',
            style: AppTextStyles.labelLarge.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          for (final f in sharing)
            FranchiseCard(
              cardKey: Key('franchise_company_${f.linkId}'),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          f.partnerName,
                          style: AppTextStyles.bodyMedium.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      Text(
                        f.partnerCodeHint,
                        style: AppTextStyles.caption.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  _TotalsGrid(totals: f.totals!, compact: true),
                  const SizedBox(height: 8),
                  _CompanyExport(company: f, data: data),
                ],
              ),
            ),
        ],
        if (data.notSharing.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(
            'Not shared with you',
            key: const Key('franchise_not_shared_heading'),
            style: AppTextStyles.labelLarge.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          for (final f in data.notSharing)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text(
                '${f.partnerName} has not allowed the financial totals. You can ask again from the Network tab.',
                style: AppTextStyles.bodySmall.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            ),
        ],
      ],
    );
  }
}

/// One company's Excel file: the full monthly billing workbook when it shared its invoice list (for the month the period
/// ends in), otherwise its totals for the period.
class _CompanyExport extends StatelessWidget {
  final FranchiseeFinancials company;
  final FranchiseDashboard data;

  const _CompanyExport({required this.company, required this.data});

  static const _months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  @override
  Widget build(BuildContext context) {
    final fullBilling = company.allowedItems.contains('invoice_list');
    final end = DateTime.tryParse(data.to) ?? DateTime.now();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ReportExportButton(
          label: fullBilling
              ? 'Full billing report (Excel)'
              : 'Download totals (Excel)',
          build: (ref, companyName) async {
            if (fullBilling) {
              final report = await ref
                  .read(franchiseRepositoryProvider)
                  .getBillingReport(company.linkId, end.year, end.month);
              return [
                BillingExcel.build(report, companyName: company.partnerName),
              ];
            }
            return [FranchiseExcel.companyTotals(company, data.from, data.to)];
          },
        ),
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(
            fullBilling
                ? 'Every day of ${_months[end.month - 1]} ${end.year}, with job cards, invoices and services.'
                : 'Totals and daily totals. Ask for the invoice list to get the full billing report.',
            key: Key('franchise_export_hint_${company.linkId}'),
            style: AppTextStyles.caption.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
        ),
      ],
    );
  }
}

class _TotalsGrid extends StatelessWidget {
  final FranchiseTotals totals;
  final bool compact;

  const _TotalsGrid({required this.totals, this.compact = false});

  @override
  Widget build(BuildContext context) {
    final items = <(String, String)>[
      ('Invoiced', FormatUtils.formatCurrency(totals.invoicedAmount)),
      ('Collected', FormatUtils.formatCurrency(totals.collectedAmount)),
      ('Outstanding', FormatUtils.formatCurrency(totals.outstandingAmount)),
      ('Invoices', totals.invoiceCount.toString()),
      ('Job cards', totals.jobCardCount.toString()),
    ];
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = (constraints.maxWidth - 8) / 2;
        return Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final (label, value) in items)
              Container(
                width: width,
                padding: EdgeInsets.all(compact ? 8 : 12),
                decoration: BoxDecoration(
                  color: compact ? AppColors.surfaceAlt : AppColors.card,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label.toUpperCase(),
                      style: AppTextStyles.labelSmall.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      value,
                      key: Key('franchise_total_${label.replaceAll(' ', '_')}'),
                      style: AppTextStyles.bodyLarge.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
          ],
        );
      },
    );
  }
}

/// Two bars a day, invoiced next to collected, scaled to the largest value.
class _DailyBarChart extends StatelessWidget {
  final List<FranchiseDailyPoint> points;

  const _DailyBarChart({required this.points});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SizedBox(
          height: 150,
          width: double.infinity,
          child: CustomPaint(
            key: const Key('franchise_daily_chart'),
            painter: _BarPainter(points),
          ),
        ),
        const SizedBox(height: 6),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              points.first.date,
              style: AppTextStyles.caption.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
            Text(
              points.last.date,
              style: AppTextStyles.caption.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _Legend(color: Color(0xFF0D9488), label: 'Invoiced'),
            SizedBox(width: 16),
            _Legend(color: Color(0xFF2563EB), label: 'Collected'),
          ],
        ),
      ],
    );
  }
}

class _Legend extends StatelessWidget {
  final Color color;
  final String label;

  const _Legend({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(width: 10, height: 10, color: color),
        const SizedBox(width: 4),
        Text(label, style: AppTextStyles.caption),
      ],
    );
  }
}

class _BarPainter extends CustomPainter {
  final List<FranchiseDailyPoint> points;

  _BarPainter(this.points);

  @override
  void paint(Canvas canvas, Size size) {
    var maxValue = 0.0;
    for (final p in points) {
      if (p.invoiced > maxValue) maxValue = p.invoiced;
      if (p.collected > maxValue) maxValue = p.collected;
    }
    if (maxValue <= 0) return;

    final baseline = Paint()
      ..color = const Color(0xFFE2E8F0)
      ..strokeWidth = 1;
    canvas.drawLine(
      Offset(0, size.height - 0.5),
      Offset(size.width, size.height - 0.5),
      baseline,
    );

    final slot = size.width / points.length;
    final barWidth = (slot * 0.35).clamp(2.0, 18.0);
    final invoicedPaint = Paint()..color = const Color(0xFF0D9488);
    final collectedPaint = Paint()..color = const Color(0xFF2563EB);

    for (var i = 0; i < points.length; i++) {
      final centre = slot * i + slot / 2;
      final invoicedHeight = size.height * points[i].invoiced / maxValue;
      final collectedHeight = size.height * points[i].collected / maxValue;
      canvas.drawRect(
        Rect.fromLTWH(
          centre - barWidth,
          size.height - invoicedHeight,
          barWidth,
          invoicedHeight,
        ),
        invoicedPaint,
      );
      canvas.drawRect(
        Rect.fromLTWH(
          centre,
          size.height - collectedHeight,
          barWidth,
          collectedHeight,
        ),
        collectedPaint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _BarPainter oldDelegate) =>
      oldDelegate.points != points;
}
