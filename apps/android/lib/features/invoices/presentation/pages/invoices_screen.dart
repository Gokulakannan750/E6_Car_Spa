import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/app_logout_action.dart';
import '../../../../shared/widgets/app_search_field.dart';
import '../../../../shared/widgets/e6_brand_badge.dart';
import '../../../../core/utils/auto_refresh_mixin.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../models/invoice_model.dart';
import '../../providers/invoice_providers.dart';
import '../widgets/invoice_card.dart';

class InvoicesScreen extends ConsumerStatefulWidget {
  const InvoicesScreen({super.key});

  @override
  ConsumerState<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _InvoicesScreenState extends ConsumerState<InvoicesScreen>
    with WidgetsBindingObserver, AutoRefreshMixin<InvoicesScreen> {
  final _searchController = TextEditingController();

  @override
  void onAutoRefresh() {
    final authUser = ref.read(currentUserProvider);
    if (authUser != null && !authUser.hasPermission('invoices.view')) return;
    ref.read(invoiceListProvider.notifier).loadInvoices(silent: true);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(invoiceListProvider);
    final notifier = ref.read(invoiceListProvider.notifier);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Row(
          children: [
            const E6BrandBadge(),
            const SizedBox(width: 10),
            Text(
              'Invoices',
              style: AppTextStyles.appBarTitle,
            ),
          ],
        ),
        centerTitle: false,
        actions: const [
          AppLogoutAction(),
        ],
      ),
      body: Column(
        children: [
          // ── Search & Status Filters Bar ─────────────────────────────────
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Column(
              children: [
                AppSearchField(
                  controller: _searchController,
                  hint: 'Search invoices, customer, vehicle...',
                  clearIcon: Icons.clear,
                  onChanged: (val) => notifier.search(val),
                  onClear: () {
                    _searchController.clear();
                    notifier.search('');
                  },
                ),
                const SizedBox(height: 8),

                // Status Filter Chips
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _buildFilterChip('All Invoices', null, state.selectedStatus, notifier),
                      const SizedBox(width: 6),
                      _buildFilterChip('Draft', InvoiceStatus.draft, state.selectedStatus, notifier),
                      const SizedBox(width: 6),
                      _buildFilterChip('Payment Pending', InvoiceStatus.generated, state.selectedStatus, notifier),
                      const SizedBox(width: 6),
                      _buildFilterChip('Partially Paid', InvoiceStatus.partiallyPaid, state.selectedStatus, notifier),
                      const SizedBox(width: 6),
                      _buildFilterChip('Paid', InvoiceStatus.paid, state.selectedStatus, notifier),
                      const SizedBox(width: 6),
                      _buildFilterChip('Cancelled', InvoiceStatus.cancelled, state.selectedStatus, notifier),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.border),

          // ── Main Content Area ─────────────────────────────────────────────
          Expanded(
            child: _buildContent(context, state, notifier),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(
    String label,
    InvoiceStatus? status,
    InvoiceStatus? currentStatus,
    InvoiceListNotifier notifier,
  ) {
    final isSelected = currentStatus == status;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (_) => notifier.setStatusFilter(status),
      labelStyle: TextStyle(
        color: isSelected ? Colors.white : AppColors.textPrimary,
        fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
        fontSize: 12,
      ),
      selectedColor: AppColors.primary,
      backgroundColor: AppColors.surfaceAlt,
      showCheckmark: false,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(
          color: isSelected ? AppColors.primary : AppColors.border,
        ),
      ),
    );
  }

  Widget _buildContent(
    BuildContext context,
    InvoiceListState state,
    InvoiceListNotifier notifier,
  ) {
    if (state.isLoading && state.items.isEmpty) {
      return const AppLoadingState(message: 'Loading invoices...');
    }

    if (state.errorMessage != null && state.items.isEmpty) {
      return AppErrorState(
        message: state.errorMessage!,
        onRetry: () => notifier.loadInvoices(),
      );
    }

    if (state.items.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => notifier.loadInvoices(refresh: true),
        color: AppColors.primary,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Container(
            height: MediaQuery.of(context).size.height * 0.6,
            alignment: Alignment.center,
            child: AppEmptyState(
              title: state.searchQuery.isNotEmpty || state.selectedStatus != null
                  ? 'No matching invoices'
                  : 'No Invoices Yet',
              message: state.searchQuery.isNotEmpty || state.selectedStatus != null
                  ? 'Try adjusting your search query or status filter.'
                  : 'Invoices converted from Job Cards will appear here.',
              icon: Icons.receipt_long_outlined,
            ),
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => notifier.loadInvoices(refresh: true),
      color: AppColors.primary,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: state.items.length,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          final item = state.items[index];
          return InvoiceCard(
            item: item,
            onTap: () {
              context.go('/quotations-invoices/${item.id}');
            },
          );
        },
      ),
    );
  }
}
