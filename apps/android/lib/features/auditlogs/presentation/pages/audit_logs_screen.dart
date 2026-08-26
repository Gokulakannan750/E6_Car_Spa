import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/app_logout_action.dart';
import '../../../../shared/widgets/app_screen_scaffold.dart';
import '../../../../shared/widgets/app_search_field.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../../auth/providers/auth_state.dart';
import '../widgets/audit_log_card.dart';
import '../widgets/audit_log_detail_sheet.dart';
import '../../providers/audit_logs_provider.dart';
import '../../providers/audit_logs_state.dart';

class AuditLogsScreen extends ConsumerStatefulWidget {
  const AuditLogsScreen({super.key});

  @override
  ConsumerState<AuditLogsScreen> createState() => _AuditLogsScreenState();
}

class _AuditLogsScreenState extends ConsumerState<AuditLogsScreen> {
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  static const List<Map<String, String>> _moduleOptions = [
    {'label': 'All Modules', 'value': ''},
    {'label': 'Authentication', 'value': 'Authentication'},
    {'label': 'Users', 'value': 'Users'},
    {'label': 'Invoices', 'value': 'Invoices'},
    {'label': 'Payments', 'value': 'Payments'},
    {'label': 'Showrooms', 'value': 'Showrooms'},
    {'label': 'Staff Advances', 'value': 'StaffAdvances'},
    {'label': 'Settings', 'value': 'Settings'},
    {'label': 'Customers', 'value': 'Customers'},
    {'label': 'Vehicles', 'value': 'Vehicles'},
    {'label': 'Job Cards', 'value': 'JobCards'},
  ];

  static const List<Map<String, String>> _outcomeOptions = [
    {'label': 'All Outcomes', 'value': ''},
    {'label': 'Success', 'value': 'Success'},
    {'label': 'Failure', 'value': 'Failure'},
  ];

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(auditLogsNotifierProvider.notifier).loadMore();
    }
  }

  Future<void> _pickDateRange(
    DateTime? currentFrom,
    DateTime? currentTo,
  ) async {
    final now = DateTime.now();
    final initialRange = currentFrom != null && currentTo != null
        ? DateTimeRange(start: currentFrom, end: currentTo)
        : DateTimeRange(
            start: now.subtract(const Duration(days: 7)),
            end: now,
          );

    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
      initialDateRange: initialRange,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: AppColors.primary,
              onPrimary: Colors.white,
              surface: Colors.white,
              onSurface: AppColors.textPrimary,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      ref
          .read(auditLogsNotifierProvider.notifier)
          .setDateRange(picked.start, picked.end);
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);

    final bool canViewAudit = authState is Authenticated &&
        (authState.user.isOwner ||
            authState.user.role.toLowerCase() == 'owner' ||
            authState.user.permissions.contains('audit.view'));

    if (!canViewAudit) {
      return AppScreenScaffold(
        title: 'Audit Trail',
        actions: const [AppLogoutAction()],
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.errorLight,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.cancelledBorder),
                  ),
                  child: const Icon(
                    Icons.lock_outline_rounded,
                    size: 40,
                    color: AppColors.error,
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Access Restricted',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'You do not have permission (audit.view) to view system audit logs.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 14,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final state = ref.watch(auditLogsNotifierProvider);

    return AppScreenScaffold(
      title: 'Audit Trail',
      actions: const [AppLogoutAction()],
      body: RefreshIndicator(
        onRefresh: () =>
            ref.read(auditLogsNotifierProvider.notifier).refresh(),
        color: AppColors.primary,
        child: Column(
          children: [
            // Top Controls Area
            Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // KPI Metric Strip
                  Row(
                    children: [
                      Expanded(
                        child: _buildKpiCard(
                          title: 'Total Logs',
                          value: '${state.totalCount}',
                          icon: Icons.history_rounded,
                          color: AppColors.primary,
                          bgColor: AppColors.accentPill,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _buildKpiCard(
                          title: 'Current Page',
                          value: '${state.page} / ${state.totalPages}',
                          icon: Icons.auto_stories_outlined,
                          color: const Color(0xFF6B21A8),
                          bgColor: const Color(0xFFFAF5FF),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 12),

                  // Search Field
                  AppSearchField(
                    controller: _searchController,
                    hint: 'Search user, action, module, reference...',
                    onChanged: (val) {
                      ref
                          .read(auditLogsNotifierProvider.notifier)
                          .setSearch(val);
                    },
                    onClear: () {
                      _searchController.clear();
                      ref
                          .read(auditLogsNotifierProvider.notifier)
                          .setSearch('');
                    },
                  ),

                  const SizedBox(height: 10),

                  // Filter Row 1: Module Chips
                  SizedBox(
                    height: 34,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: _moduleOptions.length,
                      separatorBuilder: (context, index) =>
                          const SizedBox(width: 6),
                      itemBuilder: (context, index) {
                        final opt = _moduleOptions[index];
                        final isSelected =
                            (state.query.module ?? '') == opt['value'];

                        return FilterChip(
                          selected: isSelected,
                          label: Text(opt['label']!),
                          labelStyle: TextStyle(
                            fontSize: 12,
                            fontWeight: isSelected
                                ? FontWeight.w700
                                : FontWeight.w500,
                            color: isSelected
                                ? AppColors.primary
                                : AppColors.textSecondary,
                          ),
                          backgroundColor: AppColors.surfaceAlt,
                          selectedColor: AppColors.accentPill,
                          checkmarkColor: AppColors.primary,
                          side: BorderSide(
                            color: isSelected
                                ? AppColors.primary
                                : AppColors.border,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          onSelected: (_) {
                            ref
                                .read(auditLogsNotifierProvider.notifier)
                                .setModule(
                                  opt['value']!.isEmpty ? null : opt['value'],
                                );
                          },
                        );
                      },
                    ),
                  ),

                  const SizedBox(height: 8),

                  // Filter Row 2: Outcome Chips & Date Range Picker
                  Row(
                    children: [
                      // Outcome chips
                      ..._outcomeOptions.map((opt) {
                        final isSelected =
                            (state.query.outcome ?? '') == opt['value'];
                        return Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: FilterChip(
                            selected: isSelected,
                            label: Text(opt['label']!),
                            labelStyle: TextStyle(
                              fontSize: 11,
                              fontWeight: isSelected
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                              color: isSelected
                                  ? AppColors.primary
                                  : AppColors.textSecondary,
                            ),
                            backgroundColor: AppColors.surfaceAlt,
                            selectedColor: AppColors.accentPill,
                            checkmarkColor: AppColors.primary,
                            side: BorderSide(
                              color: isSelected
                                  ? AppColors.primary
                                  : AppColors.border,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                            padding: const EdgeInsets.symmetric(horizontal: 2),
                            onSelected: (_) {
                              ref
                                  .read(auditLogsNotifierProvider.notifier)
                                  .setOutcome(
                                    opt['value']!.isEmpty
                                        ? null
                                        : opt['value'],
                                  );
                            },
                          ),
                        );
                      }),

                      const Spacer(),

                      // Date Range Button
                      InkWell(
                        onTap: () => _pickDateRange(
                          state.query.fromDate,
                          state.query.toDate,
                        ),
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: state.query.fromDate != null
                                ? AppColors.accentPill
                                : AppColors.surfaceAlt,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: state.query.fromDate != null
                                  ? AppColors.primary
                                  : AppColors.border,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.calendar_today_rounded,
                                size: 13,
                                color: state.query.fromDate != null
                                    ? AppColors.primary
                                    : AppColors.textSecondary,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                state.query.fromDate != null &&
                                        state.query.toDate != null
                                    ? '${DateFormat('dd/MM').format(state.query.fromDate!)} - ${DateFormat('dd/MM').format(state.query.toDate!)}'
                                    : 'Date Range',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: state.query.fromDate != null
                                      ? AppColors.primary
                                      : AppColors.textSecondary,
                                ),
                              ),
                              if (state.query.fromDate != null) ...[
                                const SizedBox(width: 4),
                                GestureDetector(
                                  onTap: () {
                                    ref
                                        .read(
                                            auditLogsNotifierProvider.notifier)
                                        .setDateRange(null, null);
                                  },
                                  child: const Icon(
                                    Icons.close_rounded,
                                    size: 13,
                                    color: AppColors.primary,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),

                  // Active Filters notice bar
                  if (state.hasActiveFilters) ...[
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Active filters applied',
                          style: TextStyle(
                            fontSize: 11,
                            color: AppColors.textTertiary,
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                        InkWell(
                          onTap: () {
                            _searchController.clear();
                            ref
                                .read(auditLogsNotifierProvider.notifier)
                                .clearFilters();
                          },
                          child: const Text(
                            'Clear all filters',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),

            const Divider(height: 1, color: AppColors.border),

            // Content List
            Expanded(
              child: _buildContent(state),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(AuditLogsState state) {
    if (state.isLoading && !state.hasLoaded) {
      return const AppLoadingState(message: 'Loading audit records...');
    }

    if (state.errorMessage != null && !state.hasLoaded) {
      return AppErrorState(
        title: 'Failed to load audit logs',
        message: state.errorMessage!,
        onRetry: () =>
            ref.read(auditLogsNotifierProvider.notifier).loadLogs(),
      );
    }

    if (state.items.isEmpty) {
      return AppEmptyState(
        icon: Icons.shield_outlined,
        title: 'No audit records found',
        message: 'Try adjusting your filters or search terms.',
        actionLabel: state.hasActiveFilters ? 'Clear Filters' : null,
        onAction: state.hasActiveFilters
            ? () {
                _searchController.clear();
                ref.read(auditLogsNotifierProvider.notifier).clearFilters();
              }
            : null,
      );
    }

    return ListView.builder(
      controller: _scrollController,
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: state.items.length + (state.isLoadingMore ? 1 : 0),
      itemBuilder: (context, index) {
        if (index == state.items.length) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Center(
              child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  color: AppColors.primary,
                ),
              ),
            ),
          );
        }

        final log = state.items[index];
        return AuditLogCard(
          log: log,
          onTap: () => AuditLogDetailSheet.show(context, log),
        );
      },
    );
  }

  Widget _buildKpiCard({
    required String title,
    required String value,
    required IconData icon,
    required Color color,
    required Color bgColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 20, color: color),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: color,
                ),
              ),
              const SizedBox(height: 1),
              Text(
                value,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: color,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
