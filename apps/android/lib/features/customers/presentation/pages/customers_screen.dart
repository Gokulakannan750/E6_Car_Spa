import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/auto_refresh_mixin.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/app_logout_action.dart';
import '../../../../shared/widgets/app_shell.dart';
import '../../../../shared/widgets/app_search_field.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../../settings/providers/system_preferences_provider.dart';
import '../../models/customer_model.dart';
import '../../providers/customer_providers.dart';
import '../widgets/add_customer_dialog.dart';

class CustomersScreen extends ConsumerStatefulWidget {
  const CustomersScreen({super.key});

  @override
  ConsumerState<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends ConsumerState<CustomersScreen>
    with WidgetsBindingObserver, AutoRefreshMixin<CustomersScreen> {
  final _searchController = TextEditingController();

  @override
  void onAutoRefresh() {
    final authUser = ref.read(currentUserProvider);
    if (authUser != null && !authUser.hasPermission('customers.view')) return;
    ref.read(customerListProvider.notifier).loadCustomers(silent: true);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final preferences = ref.watch(systemPreferencesProvider);
    syncRefreshTimerWithPreferences(preferences.refreshInterval);
    final state = ref.watch(customerListProvider);
    final notifier = ref.read(customerListProvider.notifier);
    final inBillingSuite = BillingSuiteScope.maybeOf(context);

    final scaffold = Scaffold(
      backgroundColor: AppColors.background,
      appBar: inBillingSuite
          ? null
          : AppBar(
              leading: IconButton(
                key: const Key('customers_back_button'),
                icon: const Icon(Icons.arrow_back_rounded),
                tooltip: 'Back to Dashboard',
                onPressed: () => context.go(AppRoutes.dashboard),
              ),
              title: Text('Customers', style: AppTextStyles.appBarTitle),
              centerTitle: false,
              actions: const [AppLogoutAction()],
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => AddCustomerDialog.show(context),
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.textOnPrimary,
        icon: const Icon(Icons.person_add_outlined),
        label: const Text('Add Customer'),
      ),
      body: RefreshIndicator(
        onRefresh: () => notifier.loadCustomers(refresh: true),
        color: AppColors.primary,
        child: Column(
          children: [
            // Search and summary bar
            Container(
              color: AppColors.card,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AppSearchField(
                    controller: _searchController,
                    hint: 'Search customers by name or phone...',
                    onChanged: (query) => notifier.search(query),
                    onClear: () {
                      _searchController.clear();
                      notifier.search('');
                    },
                  ),
                  const SizedBox(height: 10),
                  // Payment Status Filter Chips
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildStatusChip(
                          'All',
                          state.paymentStatus == null ||
                              state.paymentStatus!.isEmpty,
                          () => notifier.filterByPaymentStatus(null),
                        ),
                        const SizedBox(width: 6),
                        _buildStatusChip(
                          'Paid',
                          state.paymentStatus == 'Paid',
                          () => notifier.filterByPaymentStatus('Paid'),
                        ),
                        const SizedBox(width: 6),
                        _buildStatusChip(
                          'Payment Pending',
                          state.paymentStatus == 'Payment Pending',
                          () =>
                              notifier.filterByPaymentStatus('Payment Pending'),
                        ),
                        const SizedBox(width: 6),
                        _buildStatusChip(
                          'Payment Due',
                          state.paymentStatus == 'Payment Due',
                          () => notifier.filterByPaymentStatus('Payment Due'),
                        ),
                        const SizedBox(width: 6),
                        _buildStatusChip(
                          'No Invoices',
                          state.paymentStatus == 'No Invoices',
                          () => notifier.filterByPaymentStatus('No Invoices'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        state.searchQuery.isNotEmpty
                            ? 'Search results for "${state.searchQuery}"'
                            : (state.paymentStatus != null &&
                                      state.paymentStatus!.isNotEmpty
                                  ? '${state.paymentStatus} Customers'
                                  : 'All Customers'),
                        style: AppTextStyles.labelMedium,
                      ),
                      Text(
                        '${state.totalCount} customer${state.totalCount != 1 ? 's' : ''}',
                        style: AppTextStyles.labelMedium.copyWith(
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // Customer List content
            Expanded(child: _buildBody(state, notifier)),
          ],
        ),
      ),
    );

    if (inBillingSuite) return scaffold;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        context.go(AppRoutes.dashboard);
      },
      child: scaffold,
    );
  }

  Widget _buildStatusChip(String label, bool isSelected, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : AppColors.surfaceAlt,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.border,
          ),
        ),
        child: Text(
          label,
          style: AppTextStyles.labelSmall.copyWith(
            color: isSelected ? AppColors.textOnPrimary : AppColors.textPrimary,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
          ),
        ),
      ),
    );
  }

  Widget _buildBody(CustomerListState state, CustomerListNotifier notifier) {
    if (state.isLoading && !state.isRefreshing) {
      return const AppLoadingState(message: 'Loading customers...');
    }

    if (state.errorMessage != null) {
      return AppErrorState(
        message: state.errorMessage!,
        onRetry: () => notifier.loadCustomers(),
      );
    }

    if (state.customers.isEmpty) {
      return AppEmptyState(
        title: 'No customers found',
        message: state.searchQuery.isNotEmpty
            ? 'No customer records matching "${state.searchQuery}".'
            : (state.paymentStatus != null && state.paymentStatus!.isNotEmpty
                  ? 'No customers with payment status "${state.paymentStatus}".'
                  : 'Customers are automatically registered when creating a job card.'),
        icon: Icons.people_outline,
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.only(left: 16, right: 16, top: 12, bottom: 88),
      itemCount: state.customers.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final customer = state.customers[index];
        return _CustomerCard(
          customer: customer,
          onTap: () => context.go('/customers/${customer.id}'),
        );
      },
    );
  }
}

class _CustomerCard extends StatelessWidget {
  final Customer customer;
  final VoidCallback onTap;

  const _CustomerCard({required this.customer, required this.onTap});

  String _formatOutstanding(double amount) {
    if (amount <= 0) return '₹0';
    if (amount == amount.truncateToDouble()) {
      return '₹${amount.toInt().toString().replaceAllMapped(RegExp(r'(\d+?)(?=(\d\d)+(\d)(?!\d))(\.\d+)?'), (m) => '${m[1]},')}';
    }
    return '₹${amount.toStringAsFixed(2)}';
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.border, width: 1),
      ),
      color: AppColors.card,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Initials Avatar
              CircleAvatar(
                radius: 22,
                backgroundColor: AppColors.primaryContainer,
                child: Text(
                  customer.initials,
                  style: AppTextStyles.headingSmall.copyWith(
                    color: AppColors.textOnPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 14),

              // Customer Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      customer.name,
                      style: AppTextStyles.headingMedium,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        const Icon(
                          Icons.phone_outlined,
                          size: 14,
                          color: AppColors.textSecondary,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          customer.phoneNumber,
                          style: AppTextStyles.bodySmall.copyWith(
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                    if (customer.email != null &&
                        customer.email!.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          const Icon(
                            Icons.email_outlined,
                            size: 14,
                            color: AppColors.textSecondary,
                          ),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              customer.email!,
                              style: AppTextStyles.bodySmall,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),

              // Badges & Financial Info
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  _CustomerPaymentStatusBadge(status: customer.paymentStatus),
                  const SizedBox(height: 4),
                  Text(
                    _formatOutstanding(customer.totalOutstandingAmount),
                    style: AppTextStyles.labelMedium.copyWith(
                      fontWeight: FontWeight.w700,
                      color: customer.totalOutstandingAmount > 0
                          ? Colors.amber.shade900
                          : AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceAlt,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Text(
                          '${customer.invoiceCount} inv',
                          style: AppTextStyles.labelSmall.copyWith(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ),
                      const SizedBox(width: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceAlt,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Text(
                          '${customer.vehicleCount} vehicle${customer.vehicleCount != 1 ? 's' : ''}',
                          style: AppTextStyles.labelSmall.copyWith(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(width: 4),
              const Icon(
                Icons.chevron_right,
                color: AppColors.textTertiary,
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CustomerPaymentStatusBadge extends StatelessWidget {
  final String status;

  const _CustomerPaymentStatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color border;
    Color text;

    switch (status) {
      case 'Paid':
        bg = Colors.green.shade50;
        border = Colors.green.shade300;
        text = Colors.green.shade800;
        break;
      case 'Payment Pending':
        bg = Colors.amber.shade50;
        border = Colors.amber.shade300;
        text = Colors.amber.shade900;
        break;
      case 'Payment Due':
        bg = Colors.red.shade50;
        border = Colors.red.shade300;
        text = Colors.red.shade800;
        break;
      case 'No Invoices':
      default:
        bg = Colors.grey.shade100;
        border = Colors.grey.shade300;
        text = Colors.grey.shade700;
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: border),
      ),
      child: Text(
        status,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: text,
        ),
      ),
    );
  }
}
