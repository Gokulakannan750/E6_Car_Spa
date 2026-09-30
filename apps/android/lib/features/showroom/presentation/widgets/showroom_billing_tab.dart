import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../models/showroom_billing_model.dart';
import '../../models/showroom_model.dart';
import '../../providers/showroom_billing_provider.dart';
import 'payment_transaction_card.dart';
import 'record_payment_modal_sheet.dart';
import 'set_daily_bill_modal_sheet.dart';

class ShowroomBillingTab extends ConsumerStatefulWidget {
  final Showroom showroom;
  final DateTime selectedDate;
  final ValueChanged<DateTime>? onSelectDate;

  const ShowroomBillingTab({
    super.key,
    required this.showroom,
    required this.selectedDate,
    this.onSelectDate,
  });

  @override
  ConsumerState<ShowroomBillingTab> createState() => _ShowroomBillingTabState();
}

class _ShowroomBillingTabState extends ConsumerState<ShowroomBillingTab> {
  @override
  void didUpdateWidget(covariant ShowroomBillingTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.selectedDate != widget.selectedDate) {
      Future.microtask(() {
        ref
            .read(showroomBillingProvider(widget.showroom.id).notifier)
            .setDate(widget.selectedDate);
      });
    }
  }

  bool _hasPermission(String permission) {
    final user = ref.watch(currentUserProvider);
    if (user == null) return false;
    if (user.isOwner) return true;
    return user.hasPermission(permission);
  }

  String _formatCurrency(double val) {
    return NumberFormat.currency(
      locale: 'en_IN',
      symbol: '₹',
      decimalDigits: 2,
    ).format(val);
  }

  void _openSetDailyBillModal(ShowroomDailyBill? currentBill) {
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => SetDailyBillModalSheet(
        currentBill: currentBill,
        onSave: (request) async {
          final success = await ref
              .read(showroomBillingProvider(widget.showroom.id).notifier)
              .setDailyBill(request);
          if (success && mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Daily bill updated successfully!'),
                backgroundColor: AppColors.success,
              ),
            );
          }
          return success;
        },
      ),
    );
  }

  void _openRecordPaymentModal(double remainingBalance) {
    if (remainingBalance <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No remaining balance due for this date.'),
          backgroundColor: AppColors.warning,
        ),
      );
      return;
    }

    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => RecordPaymentModalSheet(
        remainingBalance: remainingBalance,
        onSave: (request) async {
          final success = await ref
              .read(showroomBillingProvider(widget.showroom.id).notifier)
              .recordPayment(request);
          if (success && mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Payment recorded successfully!'),
                backgroundColor: AppColors.success,
              ),
            );
          }
          return success;
        },
      ),
    );
  }

  Future<void> _handleDeletePayment(String paymentId) async {
    final success = await ref
        .read(showroomBillingProvider(widget.showroom.id).notifier)
        .deletePayment(paymentId);
    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Payment transaction voided.'),
          backgroundColor: AppColors.textSecondary,
        ),
      );
    }
  }

  Future<void> _showCustomDateRangePicker() async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 2),
      lastDate: DateTime(now.year + 1),
      initialDateRange: DateTimeRange(
        start: DateTime(now.year, now.month, 1),
        end: now,
      ),
    );

    if (picked != null) {
      ref
          .read(showroomBillingProvider(widget.showroom.id).notifier)
          .setHistoryPreset(
            BillingHistoryPreset.custom,
            customStart: picked.start,
            customEnd: picked.end,
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(showroomBillingProvider(widget.showroom.id));
    final canManageBilling =
        _hasPermission('showroom.manage_billing') ||
        _hasPermission('showroom.manage');
    final canRecordPayment =
        _hasPermission('showroom.record_payment') ||
        _hasPermission('showroom.manage');
    final canDeletePayment = _hasPermission('showroom.delete_payment');
    final canViewHistory =
        _hasPermission('showroom.view_history') ||
        _hasPermission('showroom.view');

    return RefreshIndicator(
      onRefresh: () => ref
          .read(showroomBillingProvider(widget.showroom.id).notifier)
          .refresh(),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 88, top: 4),
        children: [
          // Sub-Tab Switcher (Daily Bill | Billing History)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: _buildSubTabButton(
                      label: 'Daily Bill',
                      icon: Icons.receipt_long_rounded,
                      isActive: state.activeTab == ShowroomBillingTabMode.daily,
                      onTap: () => ref
                          .read(
                            showroomBillingProvider(
                              widget.showroom.id,
                            ).notifier,
                          )
                          .setTab(ShowroomBillingTabMode.daily),
                    ),
                  ),
                  if (canViewHistory)
                    Expanded(
                      child: _buildSubTabButton(
                        label: 'Billing History',
                        icon: Icons.history_rounded,
                        isActive:
                            state.activeTab == ShowroomBillingTabMode.history,
                        onTap: () => ref
                            .read(
                              showroomBillingProvider(
                                widget.showroom.id,
                              ).notifier,
                            )
                            .setTab(ShowroomBillingTabMode.history),
                      ),
                    ),
                ],
              ),
            ),
          ),

          // Main Content depending on Sub-Tab
          if (state.activeTab == ShowroomBillingTabMode.daily) ...[
            _buildDailyBillView(
              state: state,
              canManageBilling: canManageBilling,
              canRecordPayment: canRecordPayment,
              canDeletePayment: canDeletePayment,
            ),
          ] else ...[
            _buildHistoryView(state: state),
          ],
        ],
      ),
    );
  }

  Widget _buildSubTabButton({
    required String label,
    required IconData icon,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(9),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isActive ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(9),
            boxShadow: isActive
                ? [
                    BoxShadow(
                      color: Colors.black.withAlpha(8),
                      blurRadius: 3,
                      offset: const Offset(0, 1),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 16,
                color: isActive ? AppColors.primary : AppColors.textSecondary,
              ),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  style: AppTextStyles.labelMedium.copyWith(
                    fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                    color: isActive
                        ? AppColors.primary
                        : AppColors.textSecondary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DAILY BILL VIEW
  // ══════════════════════════════════════════════════════════════════════════

  Widget _buildDailyBillView({
    required ShowroomBillingState state,
    required bool canManageBilling,
    required bool canRecordPayment,
    required bool canDeletePayment,
  }) {
    if (state.isLoading && state.dailyBill == null) {
      return const Padding(
        padding: EdgeInsets.all(32),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    if (state.errorMessage != null && state.dailyBill == null) {
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            const Icon(Icons.error_outline, size: 48, color: AppColors.error),
            const SizedBox(height: 12),
            Text(
              state.errorMessage!,
              textAlign: TextAlign.center,
              style: AppTextStyles.bodyMedium.copyWith(color: AppColors.error),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: () => ref
                  .read(showroomBillingProvider(widget.showroom.id).notifier)
                  .loadDailyBill(),
              icon: const Icon(Icons.refresh),
              label: const Text('Try Again'),
            ),
          ],
        ),
      );
    }

    final bill = state.dailyBill;
    final billed = bill?.amount ?? 0.0;
    final received = bill?.amountReceived ?? 0.0;
    final balance = bill?.balanceAmount ?? 0.0;
    final status = bill?.status ?? 'Unpaid';
    final hasBill = bill != null && bill.amount > 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Daily Summary KPI Card
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withAlpha(4),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Title & Status
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.account_balance_wallet_rounded,
                          size: 16,
                          color: AppColors.primary,
                        ),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            'Daily Bill Summary',
                            style: AppTextStyles.labelMedium.copyWith(
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (hasBill)
                    _buildPaymentStatusBadge(status)
                  else
                    const StatusBadge(
                      label: 'No Bill Set',
                      type: StatusType.draft,
                      isCompact: true,
                    ),
                ],
              ),
              const SizedBox(height: 12),

              // KPI Row: Billed | Received | Balance
              Row(
                children: [
                  _buildFinancialKpiItem(
                    title: 'Daily Billed',
                    amount: _formatCurrency(billed),
                    color: AppColors.textPrimary,
                    icon: Icons.receipt_long_rounded,
                  ),
                  const SizedBox(width: 8),
                  _buildFinancialKpiItem(
                    title: 'Received',
                    amount: _formatCurrency(received),
                    color: AppColors.success,
                    icon: Icons.check_circle_outline_rounded,
                  ),
                  const SizedBox(width: 8),
                  _buildFinancialKpiItem(
                    title: 'Balance Due',
                    amount: _formatCurrency(balance),
                    color: balance <= 0.001
                        ? AppColors.success
                        : (received > 0 ? AppColors.warning : AppColors.error),
                    icon: Icons.pending_actions_rounded,
                  ),
                ],
              ),

              // Bill Notes if present
              if (bill?.notes != null && bill!.notes!.trim().isNotEmpty) ...[
                const SizedBox(height: 10),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.border.withAlpha(120)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(
                        Icons.notes_rounded,
                        size: 14,
                        color: AppColors.textSecondary,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          bill.notes!,
                          style: AppTextStyles.bodySmall.copyWith(
                            color: AppColors.textSecondary,
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 12),

              // Action Buttons Row
              Row(
                children: [
                  if (canManageBilling)
                    Expanded(
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                            vertical: 10,
                            horizontal: 8,
                          ),
                          side: const BorderSide(color: AppColors.primary),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        onPressed: () => _openSetDailyBillModal(bill),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              hasBill ? Icons.edit_outlined : Icons.add_rounded,
                              size: 16,
                              color: AppColors.primary,
                            ),
                            const SizedBox(width: 4),
                            Flexible(
                              child: Text(
                                hasBill ? 'Edit Bill' : 'Set Daily Bill',
                                style: AppTextStyles.labelMedium.copyWith(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w600,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  if (canManageBilling && canRecordPayment && balance > 0)
                    const SizedBox(width: 8),
                  if (canRecordPayment && balance > 0)
                    Expanded(
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.success,
                          padding: const EdgeInsets.symmetric(
                            vertical: 10,
                            horizontal: 8,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        onPressed: () => _openRecordPaymentModal(balance),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.add_card_rounded,
                              size: 16,
                              color: Colors.white,
                            ),
                            const SizedBox(width: 4),
                            Flexible(
                              child: Text(
                                'Record Payment',
                                style: AppTextStyles.labelMedium.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),

        // Section Title: Payment Ledger
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
          child: Row(
            children: [
              Text(
                'Payment Ledger',
                style: AppTextStyles.headingSmall.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.primary.withAlpha(20),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '${state.payments.length}',
                  style: AppTextStyles.bodySmall.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                    fontSize: 11,
                  ),
                ),
              ),
            ],
          ),
        ),

        // Payments List or Empty State
        if (state.payments.isEmpty) ...[
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: AppEmptyState(
              icon: Icons.payments_outlined,
              title: hasBill
                  ? 'No payments recorded'
                  : 'Daily bill not set yet',
              message: hasBill
                  ? 'Tap "Record Payment" to record customer collections for this date.'
                  : 'Set the daily billed amount to start recording payment transactions.',
              actionLabel: canManageBilling && !hasBill
                  ? 'Set Daily Bill'
                  : null,
              onAction: canManageBilling && !hasBill
                  ? () => _openSetDailyBillModal(bill)
                  : null,
            ),
          ),
        ] else ...[
          for (final payment in state.payments)
            PaymentTransactionCard(
              payment: payment,
              canDelete: canDeletePayment,
              onDelete: () => _handleDeletePayment(payment.id),
            ),
        ],
      ],
    );
  }

  Widget _buildFinancialKpiItem({
    required String title,
    required String amount,
    required Color color,
    required IconData icon,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 12, color: AppColors.textSecondary),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    title,
                    style: AppTextStyles.bodySmall.copyWith(
                      color: AppColors.textSecondary,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                amount,
                style: AppTextStyles.labelLarge.copyWith(
                  fontWeight: FontWeight.w700,
                  color: color,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPaymentStatusBadge(String status) {
    switch (status.toLowerCase()) {
      case 'paid':
        return const StatusBadge(
          label: 'Paid',
          type: StatusType.paid,
          isCompact: true,
        );
      case 'partiallypaid':
      case 'partially_paid':
        return const StatusBadge(
          label: 'Partially Paid',
          type: StatusType.pending,
          isCompact: true,
        );
      case 'unpaid':
      default:
        return const StatusBadge(
          label: 'Unpaid',
          type: StatusType.cancelled,
          isCompact: true,
        );
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BILLING HISTORY VIEW
  // ══════════════════════════════════════════════════════════════════════════

  Widget _buildHistoryView({required ShowroomBillingState state}) {
    if (state.isSummaryLoading && state.summary == null) {
      return const Padding(
        padding: EdgeInsets.all(32),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    if (state.summaryErrorMessage != null && state.summary == null) {
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            const Icon(Icons.error_outline, size: 48, color: AppColors.error),
            const SizedBox(height: 12),
            Text(
              state.summaryErrorMessage!,
              textAlign: TextAlign.center,
              style: AppTextStyles.bodyMedium.copyWith(color: AppColors.error),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: () => ref
                  .read(showroomBillingProvider(widget.showroom.id).notifier)
                  .loadSummary(),
              icon: const Icon(Icons.refresh),
              label: const Text('Try Again'),
            ),
          ],
        ),
      );
    }

    final summary = state.summary;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Preset Date Range Filter Chips
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildPresetChip(
                  'This Month',
                  BillingHistoryPreset.thisMonth,
                  state,
                ),
                const SizedBox(width: 8),
                _buildPresetChip('Today', BillingHistoryPreset.today, state),
                const SizedBox(width: 8),
                _buildPresetChip(
                  'This Week',
                  BillingHistoryPreset.thisWeek,
                  state,
                ),
                const SizedBox(width: 8),
                _buildPresetChip(
                  'Last Month',
                  BillingHistoryPreset.lastMonth,
                  state,
                ),
                const SizedBox(width: 8),
                _buildCustomPresetChip(state),
              ],
            ),
          ),
        ),

        // Summary Aggregates Banner
        if (summary != null) ...[
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withAlpha(4),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Period Overview',
                      style: AppTextStyles.labelMedium.copyWith(
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    Text(
                      '${DateFormat('dd MMM').format(state.historyFromDate)} - ${DateFormat('dd MMM yyyy').format(state.historyToDate)}',
                      style: AppTextStyles.bodySmall.copyWith(
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _buildFinancialKpiItem(
                      title: 'Total Billed',
                      amount: summary.formattedBilled,
                      color: AppColors.textPrimary,
                      icon: Icons.receipt_long_rounded,
                    ),
                    const SizedBox(width: 8),
                    _buildFinancialKpiItem(
                      title: 'Collected',
                      amount: summary.formattedReceived,
                      color: AppColors.success,
                      icon: Icons.check_circle_outline_rounded,
                    ),
                    const SizedBox(width: 8),
                    _buildFinancialKpiItem(
                      title: 'Outstanding',
                      amount: summary.formattedOutstanding,
                      color: summary.outstandingAmount > 0
                          ? AppColors.error
                          : AppColors.success,
                      icon: Icons.pending_actions_rounded,
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                // Days breakdown row
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.calendar_month_rounded,
                              size: 13,
                              color: AppColors.textSecondary,
                            ),
                            const SizedBox(width: 4),
                            Flexible(
                              child: Text(
                                'Active Days: ${summary.totalDaysWithActivity}',
                                style: AppTextStyles.bodySmall.copyWith(
                                  color: AppColors.textSecondary,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.warning_amber_rounded,
                              size: 13,
                              color: AppColors.warning,
                            ),
                            const SizedBox(width: 4),
                            Flexible(
                              child: Text(
                                'Unpaid Days: ${summary.unpaidDaysCount}',
                                style: AppTextStyles.bodySmall.copyWith(
                                  color: AppColors.warning,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],

        // Daily History Table Header
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Daily History Breakdown',
                style: AppTextStyles.headingSmall.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              if (summary != null)
                Text(
                  '${summary.dailyHistory.length} Days',
                  style: AppTextStyles.bodySmall.copyWith(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
            ],
          ),
        ),

        // History Rows or Empty State
        if (summary == null || summary.dailyHistory.isEmpty) ...[
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            child: AppEmptyState(
              icon: Icons.history_rounded,
              title: 'No billing history',
              message:
                  'No bills or activity recorded for the selected date range.',
            ),
          ),
        ] else ...[
          for (final row in summary.dailyHistory)
            _buildDailyHistoryRowCard(row),
        ],
      ],
    );
  }

  Widget _buildPresetChip(
    String label,
    BillingHistoryPreset preset,
    ShowroomBillingState state,
  ) {
    final isSelected = state.historyPreset == preset;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (selected) {
        if (selected) {
          ref
              .read(showroomBillingProvider(widget.showroom.id).notifier)
              .setHistoryPreset(preset);
        }
      },
      selectedColor: AppColors.primary,
      backgroundColor: Colors.white,
      labelStyle: TextStyle(
        fontSize: 12,
        fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
        color: isSelected ? Colors.white : AppColors.textPrimary,
      ),
      side: BorderSide(
        color: isSelected ? AppColors.primary : AppColors.border,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    );
  }

  Widget _buildCustomPresetChip(ShowroomBillingState state) {
    final isSelected = state.historyPreset == BillingHistoryPreset.custom;
    return ChoiceChip(
      avatar: Icon(
        Icons.date_range_rounded,
        size: 14,
        color: isSelected ? Colors.white : AppColors.textSecondary,
      ),
      label: const Text('Custom'),
      selected: isSelected,
      onSelected: (selected) {
        _showCustomDateRangePicker();
      },
      selectedColor: AppColors.primary,
      backgroundColor: Colors.white,
      labelStyle: TextStyle(
        fontSize: 12,
        fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
        color: isSelected ? Colors.white : AppColors.textPrimary,
      ),
      side: BorderSide(
        color: isSelected ? AppColors.primary : AppColors.border,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    );
  }

  Widget _buildDailyHistoryRowCard(ShowroomDailyHistoryRow row) {
    final isSelectedDate = DateUtils.isSameDay(row.date, widget.selectedDate);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isSelectedDate ? AppColors.primary : AppColors.border,
          width: isSelectedDate ? 1.5 : 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(3),
            blurRadius: 3,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          onTap: () {
            // Select this date in the parent workspace and switch back to Daily Bill tab
            widget.onSelectDate?.call(row.date);
            ref
                .read(showroomBillingProvider(widget.showroom.id).notifier)
                .setTab(ShowroomBillingTabMode.daily);
          },
          borderRadius: BorderRadius.circular(10),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                // Date Column
                Expanded(
                  flex: 3,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        DateFormat('dd MMM yyyy').format(row.date),
                        style: AppTextStyles.labelMedium.copyWith(
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${row.totalVehicles} Vehicles • ${row.staffCount} Staff',
                        style: AppTextStyles.bodySmall.copyWith(
                          color: AppColors.textSecondary,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),

                // Financial Breakdown Column
                Expanded(
                  flex: 4,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        'Billed: ${row.formattedBilled}',
                        style: AppTextStyles.bodySmall.copyWith(
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                          fontSize: 12,
                        ),
                      ),
                      Text(
                        'Recv: ${row.formattedReceived} | Due: ${row.formattedBalance}',
                        style: AppTextStyles.bodySmall.copyWith(
                          color: row.balanceAmount > 0
                              ? AppColors.error
                              : AppColors.success,
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(width: 8),

                // Status Badge & Navigation Chevron
                _buildPaymentStatusBadge(row.status),
                const SizedBox(width: 4),
                const Icon(
                  Icons.chevron_right_rounded,
                  size: 16,
                  color: AppColors.textSecondary,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
