import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_search_field.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../../../core/utils/auto_refresh_mixin.dart';
import '../../../settings/providers/system_preferences_provider.dart';
import '../../models/showroom_billing_model.dart';
import '../../models/showroom_model.dart';
import '../../providers/showroom_billing_provider.dart';
import '../../providers/showroom_provider.dart';
import 'showroom_detail_screen.dart';

class ShowroomReceivablesScreen extends ConsumerStatefulWidget {
  const ShowroomReceivablesScreen({super.key});

  @override
  ConsumerState<ShowroomReceivablesScreen> createState() =>
      _ShowroomReceivablesScreenState();
}

class _ShowroomReceivablesScreenState
    extends ConsumerState<ShowroomReceivablesScreen>
    with WidgetsBindingObserver, AutoRefreshMixin<ShowroomReceivablesScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchTerm = '';
  String _filter = 'all'; // 'all' | 'due' | 'paid'

  @override
  void onAutoRefresh() {
    ref.read(showroomsProvider.notifier).loadShowrooms(silent: true);
    ref.invalidate(showroomsOutstandingProvider);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  String _formatCurrency(double val) {
    return NumberFormat.currency(
      locale: 'en_IN',
      symbol: '₹',
      decimalDigits: 2,
    ).format(val);
  }

  @override
  Widget build(BuildContext context) {
    final preferences = ref.watch(systemPreferencesProvider);
    syncRefreshTimerWithPreferences(preferences.refreshInterval);
    final asyncOutstanding = ref.watch(showroomsOutstandingProvider);
    final showroomsState = ref.watch(showroomsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          'Showroom Receivables',
          style: AppTextStyles.headingMedium.copyWith(
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        actions: [
          IconButton(
            onPressed: () => ref.refresh(showroomsOutstandingProvider),
            icon: const Icon(
              Icons.refresh_rounded,
              color: AppColors.textPrimary,
            ),
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: asyncOutstanding.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.error_outline,
                  size: 48,
                  color: AppColors.error,
                ),
                const SizedBox(height: 12),
                Text(
                  'Failed to load receivables overview: $err',
                  textAlign: TextAlign.center,
                  style: AppTextStyles.bodyMedium.copyWith(
                    color: AppColors.error,
                  ),
                ),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: () => ref.refresh(showroomsOutstandingProvider),
                  icon: const Icon(Icons.refresh),
                  label: const Text('Try Again'),
                ),
              ],
            ),
          ),
        ),
        data: (outstandingList) {
          final totalBilled = outstandingList.fold<double>(
            0,
            (sum, i) => sum + i.totalBilled,
          );
          final totalReceived = outstandingList.fold<double>(
            0,
            (sum, i) => sum + i.totalReceived,
          );
          final totalOutstanding = outstandingList.fold<double>(
            0,
            (sum, i) => sum + i.outstandingAmount,
          );
          final dueCount = outstandingList
              .where((i) => i.outstandingAmount > 0.001)
              .length;

          // Filter by search & status
          var filteredList = outstandingList.where((item) {
            final matchesSearch =
                _searchTerm.isEmpty ||
                item.showroomName.toLowerCase().contains(
                  _searchTerm.toLowerCase(),
                ) ||
                item.address.toLowerCase().contains(_searchTerm.toLowerCase());

            if (!matchesSearch) return false;

            if (_filter == 'due') {
              return item.outstandingAmount > 0.001;
            } else if (_filter == 'paid') {
              return item.outstandingAmount <= 0.001;
            }
            return true;
          }).toList();

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(showroomsOutstandingProvider);
            },
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.only(bottom: 40, top: 8),
              children: [
                // Global Financial Overview Banner
                Container(
                  margin: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 6,
                  ),
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
                            'All Showrooms Summary',
                            style: AppTextStyles.labelMedium.copyWith(
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: dueCount > 0
                                  ? AppColors.warning.withAlpha(25)
                                  : AppColors.success.withAlpha(25),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              '$dueCount Showrooms with Due',
                              style: AppTextStyles.bodySmall.copyWith(
                                color: dueCount > 0
                                    ? AppColors.warning
                                    : AppColors.success,
                                fontWeight: FontWeight.w700,
                                fontSize: 11,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          _buildKpiCard(
                            title: 'Total Billed',
                            amount: _formatCurrency(totalBilled),
                            color: AppColors.textPrimary,
                            icon: Icons.receipt_long_rounded,
                          ),
                          const SizedBox(width: 8),
                          _buildKpiCard(
                            title: 'Collected',
                            amount: _formatCurrency(totalReceived),
                            color: AppColors.success,
                            icon: Icons.check_circle_outline_rounded,
                          ),
                          const SizedBox(width: 8),
                          _buildKpiCard(
                            title: 'Outstanding',
                            amount: _formatCurrency(totalOutstanding),
                            color: totalOutstanding > 0.001
                                ? AppColors.error
                                : AppColors.success,
                            icon: Icons.pending_actions_rounded,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // Search Field
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 6,
                  ),
                  child: AppSearchField(
                    controller: _searchController,
                    hint: 'Search showroom by name or location...',
                    onChanged: (val) =>
                        setState(() => _searchTerm = val.trim()),
                    onClear: () => setState(() => _searchTerm = ''),
                  ),
                ),

                // Filter Chips
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 2,
                  ),
                  child: Row(
                    children: [
                      _buildFilterChip(
                        'All (${outstandingList.length})',
                        'all',
                      ),
                      const SizedBox(width: 8),
                      _buildFilterChip('With Due ($dueCount)', 'due'),
                      const SizedBox(width: 8),
                      _buildFilterChip(
                        'Fully Paid (${outstandingList.length - dueCount})',
                        'paid',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 6),

                // Showroom Receivables List
                if (filteredList.isEmpty) ...[
                  const Padding(
                    padding: EdgeInsets.all(32),
                    child: AppEmptyState(
                      icon: Icons.storefront_outlined,
                      title: 'No showrooms found',
                      message: 'Try adjusting your search or filter criteria.',
                    ),
                  ),
                ] else ...[
                  for (final item in filteredList)
                    _buildShowroomReceivableCard(
                      item,
                      showroomsState.showrooms,
                    ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildKpiCard({
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

  Widget _buildFilterChip(String label, String value) {
    final isSelected = _filter == value;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (selected) {
        if (selected) {
          setState(() => _filter = value);
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

  Widget _buildShowroomReceivableCard(
    ShowroomOutstandingOverview item,
    List<Showroom> allShowrooms,
  ) {
    final isDue = item.outstandingAmount > 0.001;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDue ? AppColors.error.withAlpha(60) : AppColors.border,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(4),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () {
            // Find corresponding Showroom object and navigate to workspace
            final match = allShowrooms.firstWhere(
              (s) => s.id == item.showroomId,
              orElse: () => Showroom(
                id: item.showroomId,
                name: item.showroomName,
                address: item.address,
                phone: item.phone,
                isActive: item.isActive,
                createdAt: DateTime.now(),
              ),
            );
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => ShowroomDetailScreen(showroom: match),
              ),
            );
          },
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Showroom Name & Status
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CircleAvatar(
                      radius: 16,
                      backgroundColor: item.isActive
                          ? AppColors.primary.withAlpha(25)
                          : AppColors.surface,
                      child: Text(
                        item.showroomName.isNotEmpty
                            ? item.showroomName[0].toUpperCase()
                            : 'S',
                        style: AppTextStyles.labelMedium.copyWith(
                          fontWeight: FontWeight.w700,
                          color: item.isActive
                              ? AppColors.primary
                              : AppColors.textSecondary,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.showroomName,
                            style: AppTextStyles.labelLarge.copyWith(
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          if (item.address.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(
                              item.address,
                              style: AppTextStyles.bodySmall.copyWith(
                                color: AppColors.textSecondary,
                                fontSize: 11,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    if (isDue)
                      const StatusBadge(
                        label: 'Due',
                        type: StatusType.cancelled,
                        isCompact: true,
                      )
                    else
                      const StatusBadge(
                        label: 'Settled',
                        type: StatusType.completed,
                        isCompact: true,
                      ),
                  ],
                ),
                const SizedBox(height: 10),

                // Financial Breakdown Row
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Billed',
                            style: AppTextStyles.bodySmall.copyWith(
                              color: AppColors.textSecondary,
                              fontSize: 10,
                            ),
                          ),
                          Text(
                            item.formattedBilled,
                            style: AppTextStyles.bodySmall.copyWith(
                              fontWeight: FontWeight.w600,
                              color: AppColors.textPrimary,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Received',
                            style: AppTextStyles.bodySmall.copyWith(
                              color: AppColors.textSecondary,
                              fontSize: 10,
                            ),
                          ),
                          Text(
                            item.formattedReceived,
                            style: AppTextStyles.bodySmall.copyWith(
                              fontWeight: FontWeight.w600,
                              color: AppColors.success,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            'Outstanding',
                            style: AppTextStyles.bodySmall.copyWith(
                              color: AppColors.textSecondary,
                              fontSize: 10,
                            ),
                          ),
                          Text(
                            item.formattedOutstanding,
                            style: AppTextStyles.bodySmall.copyWith(
                              fontWeight: FontWeight.w700,
                              color: isDue
                                  ? AppColors.error
                                  : AppColors.success,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
