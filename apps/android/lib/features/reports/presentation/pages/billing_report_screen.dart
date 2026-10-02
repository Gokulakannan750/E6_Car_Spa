import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/app_screen_scaffold.dart';
import '../../models/monthly_billing_report_model.dart';
import '../../providers/reports_provider.dart';

class BillingReportScreen extends ConsumerStatefulWidget {
  const BillingReportScreen({super.key});

  @override
  ConsumerState<BillingReportScreen> createState() =>
      _BillingReportScreenState();
}

class _BillingReportScreenState extends ConsumerState<BillingReportScreen> {
  static const List<String> monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  String _formatCurrency(double value) {
    final formatter = NumberFormat.currency(
      locale: 'en_IN',
      symbol: '₹',
      decimalDigits: 2,
    );
    return formatter.format(value);
  }

  @override
  Widget build(BuildContext context) {
    final selectedYear = ref.watch(monthlyBillingReportYearProvider);
    final selectedMonth = ref.watch(monthlyBillingReportMonthProvider);
    final reportAsync = ref.watch(monthlyBillingReportProvider);
    final currentYear = DateTime.now().year;
    final years = List.generate(7, (index) => currentYear - 3 + index);

    return AppScreenScaffold(
      title: 'Monthly Billing Report',
      actions: [
        IconButton(
          icon: const Icon(Icons.refresh, color: AppColors.textPrimary),
          tooltip: 'Refresh Report',
          onPressed: () {
            ref.invalidate(monthlyBillingReportProvider);
          },
        ),
      ],
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(monthlyBillingReportProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Month & Year Selector Card
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(AppTheme.radiusMD),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.calendar_month,
                      size: 20,
                      color: AppColors.primary,
                    ),
                    const SizedBox(width: 10),
                    const Text(
                      'Period:',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<int>(
                          isExpanded: true,
                          value: selectedMonth,
                          dropdownColor: AppColors.surface,
                          items: List.generate(
                            12,
                            (idx) => DropdownMenuItem<int>(
                              value: idx + 1,
                              child: Text(
                                monthNames[idx],
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ),
                          onChanged: (val) {
                            if (val != null) {
                              ref
                                      .read(
                                        monthlyBillingReportMonthProvider
                                            .notifier,
                                      )
                                      .state =
                                  val;
                            }
                          },
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    DropdownButtonHideUnderline(
                      child: DropdownButton<int>(
                        value: selectedYear,
                        dropdownColor: AppColors.surface,
                        items:
                            years
                                .map(
                                  (y) => DropdownMenuItem<int>(
                                    value: y,
                                    child: Text(
                                      '$y',
                                      style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                )
                                .toList(),
                        onChanged: (val) {
                          if (val != null) {
                            ref
                                    .read(
                                      monthlyBillingReportYearProvider.notifier,
                                    )
                                    .state =
                                val;
                          }
                        },
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // 2. Report Content Handling
              reportAsync.when(
                loading: () => const AppLoadingState(
                  message: 'Loading monthly billing report...',
                ),
                error: (error, _) => AppErrorState(
                  message: error.toString(),
                  onRetry: () => ref.invalidate(monthlyBillingReportProvider),
                ),
                data: (report) {
                  final summary = report.summary;
                  final activeSheets =
                      report.dailySheets.where((s) => s.hasActivity).toList();

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // KPI Grid
                      GridView.count(
                        crossAxisCount: 2,
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        crossAxisSpacing: 12,
                        mainAxisSpacing: 12,
                        childAspectRatio: 1.25,
                        children: [
                          _buildKpiCard(
                            title: 'Total Invoiced',
                            value: _formatCurrency(summary.totalInvoiceAmount),
                            subtitle: '${summary.totalInvoices} invoices',
                            icon: Icons.receipt_long,
                            color: AppColors.primary,
                          ),
                          _buildKpiCard(
                            title: 'Total Paid',
                            value: _formatCurrency(summary.totalAmountPaid),
                            subtitle: '${summary.totalInvoicesPaid} fully paid',
                            icon: Icons.check_circle_outline,
                            color: AppColors.success,
                          ),
                          _buildKpiCard(
                            title: 'Receivables',
                            value: _formatCurrency(summary.totalAmountPending),
                            subtitle:
                                '${summary.totalInvoicesPendingPayment} pending',
                            icon: Icons.schedule,
                            color: AppColors.error,
                          ),
                          _buildKpiCard(
                            title: 'Job Cards',
                            value:
                                '${summary.totalJobCardsFinished} / ${summary.totalJobCardsCreated}',
                            subtitle:
                                '${summary.totalServicesPerformed} services done',
                            icon: Icons.directions_car,
                            color: const Color(0xFF0284C7),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),

                      // Invoices Status Distribution
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.card,
                          borderRadius: BorderRadius.circular(
                            AppTheme.radiusMD,
                          ),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Invoice Status Breakdown',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 12),
                            _buildStatusRow(
                              'Fully Paid Invoices',
                              summary.totalInvoicesPaid,
                              AppColors.success,
                              Icons.check_circle,
                            ),
                            const SizedBox(height: 8),
                            _buildStatusRow(
                              'Partially Paid / Pending',
                              summary.totalInvoicesPendingPayment,
                              AppColors.warning,
                              Icons.timelapse,
                            ),
                            const SizedBox(height: 8),
                            _buildStatusRow(
                              'Draft Invoices',
                              summary.totalInvoicesDraft,
                              AppColors.textSecondary,
                              Icons.edit_note,
                            ),
                            const SizedBox(height: 8),
                            _buildStatusRow(
                              'Cancelled Invoices',
                              summary.totalInvoicesCancelled,
                              AppColors.error,
                              Icons.cancel_outlined,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Daily Billing Breakdown
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Daily Billing Sheets (${activeSheets.length} Active Days)',
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          Text(
                            '${report.daysInMonth} Days Total',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textTertiary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      if (activeSheets.isEmpty)
                        const AppEmptyState(
                          title: 'No billing activity',
                          message:
                              'No invoices or services recorded in this month.',
                          icon: Icons.receipt_long_outlined,
                        )
                      else
                        ListView.separated(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: activeSheets.length,
                          separatorBuilder: (context, index) =>
                              const SizedBox(height: 10),
                          itemBuilder: (context, index) {
                            final sheet = activeSheets[index];
                            return _buildDailySheetCard(sheet);
                          },
                        ),
                    ],
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildKpiCard({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppTheme.radiusMD),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title.toUpperCase(),
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textSecondary,
                  letterSpacing: 0.5,
                ),
              ),
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(AppTheme.radiusSM),
                ),
                child: Icon(icon, size: 16, color: color),
              ),
            ],
          ),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          Text(
            subtitle,
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.textTertiary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusRow(
    String label,
    int count,
    Color color,
    IconData icon,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(AppTheme.radiusSM),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: color,
                ),
              ),
            ],
          ),
          Text(
            '$count invoices',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDailySheetCard(DailyBillingSheetModel sheet) {
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(AppTheme.radiusMD),
          border: Border.all(color: AppColors.border),
        ),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          leading: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(AppTheme.radiusSM),
            ),
            child: Center(
              child: Text(
                '${sheet.day}',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: AppColors.primary,
                ),
              ),
            ),
          ),
          title: Text(
            sheet.dateFormatted,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          subtitle: Text(
            '${sheet.jobCards.length} Jobs • ${sheet.invoices.length} Bills • ${_formatCurrency(sheet.totals.invoiceTotal)}',
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.textSecondary,
            ),
          ),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Divider(color: AppColors.border, height: 1),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _buildMiniBadge(
                        'Total Billed',
                        _formatCurrency(sheet.totals.invoiceTotal),
                        AppColors.primary,
                      ),
                      _buildMiniBadge(
                        'Collected',
                        _formatCurrency(sheet.totals.amountPaid),
                        AppColors.success,
                      ),
                      _buildMiniBadge(
                        'Pending',
                        _formatCurrency(sheet.totals.amountPending),
                        AppColors.error,
                      ),
                    ],
                  ),
                  if (sheet.invoices.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    const Text(
                      'Invoices on this day:',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    ...sheet.invoices.map(
                      (inv) => Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                '${inv.invoiceNumber} • ${inv.customerName} (${inv.vehicleRegistration})',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ),
                            Text(
                              _formatCurrency(inv.invoiceTotal),
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMiniBadge(String label, String value, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 10, color: AppColors.textTertiary),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: color,
          ),
        ),
      ],
    );
  }
}
