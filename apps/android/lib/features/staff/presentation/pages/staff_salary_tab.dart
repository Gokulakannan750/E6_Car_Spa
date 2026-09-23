import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/constants/app_colors.dart';
import '../../models/staff_salary_models.dart';
import '../../providers/staff_salary_providers.dart';
import '../widgets/enter_salary_bottom_sheet.dart';
import '../widgets/salary_staff_card.dart';
import '../widgets/settle_salary_bottom_sheet.dart';
import '../widgets/settlement_history_bottom_sheet.dart';

class StaffSalaryTab extends ConsumerStatefulWidget {
  const StaffSalaryTab({super.key});

  @override
  ConsumerState<StaffSalaryTab> createState() => _StaffSalaryTabState();
}

class _StaffSalaryTabState extends ConsumerState<StaffSalaryTab> {
  final _searchController = TextEditingController();
  final _currencyFormat = NumberFormat.currency(
    locale: 'en_IN',
    symbol: '₹',
    decimalDigits: 0,
  );
  final _displayDateFormat = DateFormat('dd MMM yyyy');

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() {
      ref.read(salarySearchQueryProvider.notifier).state = _searchController.text;
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  DateTime _parseDate(String dateStr) {
    return DateTime.tryParse(dateStr) ?? DateTime.now();
  }

  String _formatDateForApi(DateTime dt) {
    final monthStr = dt.month.toString().padLeft(2, '0');
    final dayStr = dt.day.toString().padLeft(2, '0');
    return '${dt.year}-$monthStr-$dayStr';
  }

  Future<void> _selectPeriodFrom(BuildContext context) async {
    final currentFromStr = ref.read(salaryPeriodFromProvider);
    final currentToStr = ref.read(salaryPeriodToProvider);

    final currentFrom = _parseDate(currentFromStr);
    final currentTo = _parseDate(currentToStr);

    final picked = await showDatePicker(
      context: context,
      initialDate: currentFrom,
      firstDate: DateTime(2020),
      lastDate: currentTo,
      helpText: 'Select Salary Period Start Date',
    );

    if (picked != null) {
      final newFromStr = _formatDateForApi(picked);
      if (newFromStr != currentFromStr) {
        ref.read(salaryPeriodFromProvider.notifier).state = newFromStr;
      }
    }
  }

  Future<void> _selectPeriodTo(BuildContext context) async {
    final currentFromStr = ref.read(salaryPeriodFromProvider);
    final currentToStr = ref.read(salaryPeriodToProvider);

    final currentFrom = _parseDate(currentFromStr);
    final currentTo = _parseDate(currentToStr);

    final picked = await showDatePicker(
      context: context,
      initialDate: currentTo,
      firstDate: currentFrom,
      lastDate: DateTime(2035),
      helpText: 'Select Salary Period End Date',
    );

    if (picked != null) {
      final newToStr = _formatDateForApi(picked);
      if (newToStr != currentToStr) {
        ref.read(salaryPeriodToProvider.notifier).state = newToStr;
      }
    }
  }

  void _openEnterSalary(StaffSalaryItem item) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => EnterSalaryBottomSheet(item: item),
    );
  }

  void _openSettleSalary(StaffSalaryItem item) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => SettleSalaryBottomSheet(item: item),
    );
  }

  void _openSettlementHistory(StaffSalaryItem item) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => SettlementHistoryBottomSheet(
        staffId: item.staffId,
        staffName: item.staffName,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final fromDateStr = ref.watch(salaryPeriodFromProvider);
    final toDateStr = ref.watch(salaryPeriodToProvider);
    final selectedFilter = ref.watch(salaryStatusFilterProvider);
    final rosterAsync = ref.watch(salaryRosterProvider);

    final fromDate = _parseDate(fromDateStr);
    final toDate = _parseDate(toDateStr);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(salaryRosterProvider);
          await ref.read(salaryRosterProvider.future);
        },
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Period Selector Card
                    _buildPeriodSelectorCard(context, fromDate, toDate),
                    const SizedBox(height: 12),

                    // Search input
                    TextField(
                      controller: _searchController,
                      decoration: InputDecoration(
                        hintText: 'Search staff by name or role...',
                        prefixIcon: const Icon(Icons.search, size: 20),
                        suffixIcon: _searchController.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear, size: 18),
                                onPressed: () {
                                  _searchController.clear();
                                },
                              )
                            : null,
                        isDense: true,
                        filled: true,
                        fillColor: AppColors.surface,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(
                            color: AppColors.border,
                          ),
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Filter chips
                    _buildFilterChips(selectedFilter),
                  ],
                ),
              ),
            ),

            // Roster Data
            rosterAsync.when(
              data: (roster) {
                final items = roster.items;

                return SliverMainAxisGroup(
                  slivers: [
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Column(
                          children: [
                            // KPI Cards
                            _buildKpiSummary(
                              totalEntered: roster.totalEnteredSalary,
                              totalAdvance: roster.totalAdvanceDeductions,
                              totalNetPayable: roster.totalFinalSalary,
                              staffCount: roster.totalStaffCount,
                            ),
                            const SizedBox(height: 12),
                          ],
                        ),
                      ),
                    ),
                    if (items.isEmpty)
                      SliverFillRemaining(
                        hasScrollBody: false,
                        child: Center(
                          child: Padding(
                            padding: const EdgeInsets.all(32),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(
                                  Icons.account_balance_wallet_outlined,
                                  size: 48,
                                  color: AppColors.textTertiary,
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  _searchController.text.isNotEmpty
                                      ? 'No staff members match your search'
                                      : 'No salary records found for this period',
                                  style: const TextStyle(
                                    color: AppColors.textSecondary,
                                    fontSize: 14,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ),
                          ),
                        ),
                      )
                    else
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
                        sliver: SliverList.builder(
                          itemCount: items.length,
                          itemBuilder: (context, index) {
                            final item = items[index];
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: SalaryStaffCard(
                                item: item,
                                onEnterSalary: () => _openEnterSalary(item),
                                onSettleSalary: () => _openSettleSalary(item),
                                onSettlementHistory: () => _openSettlementHistory(item),
                              ),
                            );
                          },
                        ),
                      ),
                  ],
                );
              },
              loading: () => const SliverFillRemaining(
                child: Center(
                  child: CircularProgressIndicator(color: AppColors.primary),
                ),
              ),
              error: (err, stack) => SliverFillRemaining(
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline, size: 48, color: AppColors.error),
                        const SizedBox(height: 12),
                        const Text(
                          'Failed to load salary roster',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          err.toString(),
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 16),
                        FilledButton.icon(
                          onPressed: () => ref.invalidate(salaryRosterProvider),
                          icon: const Icon(Icons.refresh, size: 18),
                          label: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPeriodSelectorCard(BuildContext context, DateTime from, DateTime to) {
    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(
          color: AppColors.border,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: const [
                Icon(
                  Icons.date_range,
                  size: 20,
                  color: AppColors.primary,
                ),
                SizedBox(width: 8),
                Text(
                  'Salary Period (Arbitrary Range)',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: () => _selectPeriodFrom(context),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: AppColors.border,
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'From Date',
                            style: TextStyle(
                              fontSize: 11,
                              color: AppColors.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _displayDateFormat.format(from),
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 8),
                  child: Icon(Icons.arrow_forward, size: 16, color: AppColors.textTertiary),
                ),
                Expanded(
                  child: InkWell(
                    onTap: () => _selectPeriodTo(context),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: AppColors.border,
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'To Date',
                            style: TextStyle(
                              fontSize: 11,
                              color: AppColors.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _displayDateFormat.format(to),
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            const Text(
              'Changing period recalculates applicable advances (AdvanceDate ≤ PeriodTo) without modifying entered salary.',
              style: TextStyle(
                fontSize: 11,
                color: AppColors.textSecondary,
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChips(String current) {
    const filters = [
      {'label': 'All Staff', 'value': 'All'},
      {'label': 'Pending Settlement', 'value': 'Unsettled'},
      {'label': 'Settled', 'value': 'Settled'},
      {'label': 'With Advances', 'value': 'WithAdvances'},
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: filters.map((f) {
          final isSelected = f['value'] == current;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text(f['label']!),
              selected: isSelected,
              onSelected: (selected) {
                if (selected) {
                  ref.read(salaryStatusFilterProvider.notifier).state = f['value']!;
                }
              },
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildKpiSummary({
    required double totalEntered,
    required double totalAdvance,
    required double totalNetPayable,
    required int staffCount,
  }) {
    return Row(
      children: [
        Expanded(
          child: _buildMetricCard(
            label: 'Total Entered',
            value: _currencyFormat.format(totalEntered),
            color: const Color(0xFF0453CD),
            icon: Icons.payments_outlined,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _buildMetricCard(
            label: 'Advance Rec.',
            value: _currencyFormat.format(totalAdvance),
            color: const Color(0xFFD97706),
            icon: Icons.money_off,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _buildMetricCard(
            label: 'Net Payable',
            value: _currencyFormat.format(totalNetPayable),
            color: const Color(0xFF16A34A),
            icon: Icons.account_balance_wallet,
          ),
        ),
      ],
    );
  }

  Widget _buildMetricCard({
    required String label,
    required String value,
    required Color color,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withAlpha(60)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: color),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: color,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.bold,
              color: color,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
