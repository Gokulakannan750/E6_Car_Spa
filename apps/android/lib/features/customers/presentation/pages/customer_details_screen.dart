import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/auto_refresh_mixin.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../../jobcards/providers/job_card_providers.dart';
import '../../../vehicles/presentation/widgets/add_vehicle_dialog.dart';
import '../../../vehicles/presentation/widgets/vehicle_card.dart';
import '../../models/customer_model.dart';
import '../../providers/customer_providers.dart';
import '../widgets/edit_customer_dialog.dart';

class CustomerDetailsScreen extends ConsumerStatefulWidget {
  final String customerId;

  const CustomerDetailsScreen({
    super.key,
    required this.customerId,
  });

  @override
  ConsumerState<CustomerDetailsScreen> createState() => _CustomerDetailsScreenState();
}

class _CustomerDetailsScreenState extends ConsumerState<CustomerDetailsScreen>
    with WidgetsBindingObserver, AutoRefreshMixin<CustomerDetailsScreen> {
  @override
  void onAutoRefresh() {
    final authUser = ref.read(currentUserProvider);
    if (authUser != null && !authUser.hasPermission('customers.view')) return;
    ref.read(customerDetailsProvider(widget.customerId).notifier).loadDetails(silent: true);
  }

  Future<void> _handleEditCustomer(
    BuildContext context,
    Customer customer,
  ) async {
    final updated = await EditCustomerDialog.show(context, customer: customer);
    if (updated != null) {
      ref.read(customerDetailsProvider(widget.customerId).notifier).loadDetails();
      ref.read(customerListProvider.notifier).loadCustomers(silent: true);
    }
  }



  String _activityFilter = 'all';

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(customerDetailsProvider(widget.customerId));
    final notifier = ref.read(customerDetailsProvider(widget.customerId).notifier);
    final authUser = ref.watch(currentUserProvider);
    final canEdit = authUser == null || authUser.hasPermission('customers.edit');

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(state.customer?.name ?? 'Customer Profile'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/customers'),
        ),
        actions: [
          if (state.customer != null && canEdit)
            IconButton(
              key: const Key('edit_details_action'),
              icon: const Icon(Icons.edit_outlined),
              tooltip: 'Edit Details',
              onPressed: () => _handleEditCustomer(context, state.customer!),
            ),
        ],
      ),
      bottomNavigationBar: state.customer != null
          ? SafeArea(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: const BoxDecoration(
                  color: AppColors.card,
                  border: Border(top: BorderSide(color: AppColors.border)),
                ),
                child: Row(
                  children: [
                    if (canEdit) ...[
                      Expanded(
                        child: OutlinedButton.icon(
                          key: const Key('edit_details_bottom_button'),
                          icon: const Icon(Icons.edit_outlined, size: 18),
                          label: const Text('Edit Details'),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            side: const BorderSide(color: AppColors.border),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          onPressed: () => _handleEditCustomer(context, state.customer!),
                        ),
                      ),
                      const SizedBox(width: 12),
                    ],
                    Expanded(
                      flex: canEdit ? 1 : 2,
                      child: AppButton(
                        key: const Key('new_job_card_bottom_button'),
                        label: 'New Job Card',
                        icon: Icons.add_task,
                        onPressed: () {
                          ref.read(newJobCardProvider.notifier).selectCustomer(
                                state.customer!,
                                state.vehicles,
                              );
                          context.go('/job-cards/new');
                        },
                      ),
                    ),
                  ],
                ),
              ),
            )
          : null,
      body: _buildBody(context, state, notifier),
    );
  }

  Widget _buildBody(
    BuildContext context,
    CustomerDetailsState state,
    CustomerDetailsNotifier notifier,
  ) {
    if (state.isLoading) {
      return const AppLoadingState(message: 'Loading customer profile...');
    }

    if (state.errorMessage != null || state.customer == null) {
      return AppErrorState(
        message: state.errorMessage ?? 'Customer not found.',
        onRetry: () => notifier.loadDetails(),
      );
    }

    final customer = state.customer!;
    final allJobCards = state.history?.jobCards ?? [];

    bool checkCancelled(CustomerJobCardHistoryItem jc) =>
        jc.paymentStatus == 'Cancelled' || jc.status == 'Cancelled';

    bool checkPaid(CustomerJobCardHistoryItem jc) =>
        !checkCancelled(jc) &&
        (jc.paymentStatus == 'Paid' ||
            (jc.invoiceTotal != null &&
                (jc.outstandingAmount ?? 0) <= 0 &&
                (jc.paidAmount ?? 0) > 0));

    bool checkPartiallyPaid(CustomerJobCardHistoryItem jc) =>
        !checkCancelled(jc) &&
        !checkPaid(jc) &&
        (jc.paymentStatus == 'Partially Paid' ||
            jc.paymentStatus == 'PartiallyPaid' ||
            (jc.invoiceId != null &&
                (jc.paidAmount ?? 0) > 0 &&
                (jc.outstandingAmount ?? 0) > 0));

    bool checkPaymentPending(CustomerJobCardHistoryItem jc) =>
        !checkCancelled(jc) &&
        !checkPaid(jc) &&
        !checkPartiallyPaid(jc) &&
        jc.paymentStatus != 'Draft' &&
        jc.status != 'Draft' &&
        (jc.outstandingAmount ?? 0) > 0 &&
        (jc.paidAmount ?? 0) == 0;

    final filteredJobCards = allJobCards.where((jc) {
      if (_activityFilter == 'all') return true;
      if (_activityFilter == 'paid') return checkPaid(jc);
      if (_activityFilter == 'payment-pending') return checkPaymentPending(jc);
      if (_activityFilter == 'partially-paid') return checkPartiallyPaid(jc);
      return true;
    }).toList();

    final paidCount = allJobCards.where(checkPaid).length;
    final paymentPendingCount = allJobCards.where(checkPaymentPending).length;
    final partiallyPaidCount = allJobCards.where(checkPartiallyPaid).length;

    return RefreshIndicator(
      onRefresh: () => notifier.loadDetails(),
      color: AppColors.primary,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 88),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Customer Profile Card ───────────────────────────────────────
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: const BorderSide(color: AppColors.border, width: 1),
              ),
              color: AppColors.card,
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  children: [
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 28,
                          backgroundColor: AppColors.primaryContainer,
                          child: Text(
                            customer.initials,
                            style: AppTextStyles.headingLarge.copyWith(
                              color: AppColors.textOnPrimary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                customer.name,
                                style: AppTextStyles.displaySmall,
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  const Icon(Icons.phone, size: 15, color: AppColors.accent),
                                  const SizedBox(width: 6),
                                  Text(
                                    customer.phoneNumber,
                                    style: AppTextStyles.bodyMedium.copyWith(
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.accent,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    if (customer.email != null && customer.email!.isNotEmpty) ...[
                      const Divider(height: 24, color: AppColors.borderLight),
                      Row(
                        children: [
                          const Icon(Icons.email_outlined, size: 16, color: AppColors.textSecondary),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              customer.email!,
                              style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textSecondary),
                            ),
                          ),
                        ],
                      ),
                    ],
                    if (customer.address != null && customer.address!.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.location_on_outlined, size: 16, color: AppColors.textSecondary),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              customer.address!,
                              style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textSecondary),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // ── Vehicles Section ────────────────────────────────────────────
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Registered Vehicles (${state.vehicles.length})',
                  style: AppTextStyles.headingMedium,
                ),
                TextButton.icon(
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Add Vehicle'),
                  onPressed: () {
                    AddVehicleDialog.show(
                      context,
                      customerId: customer.id,
                      customerName: customer.name,
                      onCreated: (newVehicle) {
                        notifier.loadDetails();
                        ref.read(customerListProvider.notifier).loadCustomers(silent: true);
                      },
                    );
                  },
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (state.vehicles.isEmpty)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: Center(
                  child: Column(
                    children: [
                      const Icon(Icons.directions_car_outlined, size: 36, color: AppColors.textTertiary),
                      const SizedBox(height: 8),
                      Text(
                        'No vehicles registered yet.',
                        style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
              )
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: state.vehicles.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final vehicle = state.vehicles[index];
                  return VehicleCard(
                    vehicle: vehicle,
                    trailing: IconButton(
                      icon: const Icon(Icons.add_task, color: AppColors.accent),
                      tooltip: 'New Job Card for this vehicle',
                      onPressed: () {
                        ref.read(newJobCardProvider.notifier).selectCustomer(
                              customer,
                              state.vehicles,
                              vehicle: vehicle,
                            );
                        context.go('/job-cards/new');
                      },
                    ),
                  );
                },
              ),
            const SizedBox(height: 24),

            // ── Recent Activity / Job Cards Section ─────────────────────────
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Recent Activity',
                  style: AppTextStyles.headingMedium,
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Activity Filter Chips
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildActivityFilterChip(
                    label: 'All (${allJobCards.length})',
                    isSelected: _activityFilter == 'all',
                    onSelected: () => setState(() => _activityFilter = 'all'),
                  ),
                  const SizedBox(width: 8),
                  _buildActivityFilterChip(
                    label: 'Paid ($paidCount)',
                    isSelected: _activityFilter == 'paid',
                    onSelected: () => setState(() => _activityFilter = 'paid'),
                  ),
                  const SizedBox(width: 8),
                  _buildActivityFilterChip(
                    label: 'Payment Pending ($paymentPendingCount)',
                    isSelected: _activityFilter == 'payment-pending',
                    onSelected: () => setState(() => _activityFilter = 'payment-pending'),
                  ),
                  const SizedBox(width: 8),
                  _buildActivityFilterChip(
                    label: 'Partially Paid ($partiallyPaidCount)',
                    isSelected: _activityFilter == 'partially-paid',
                    onSelected: () => setState(() => _activityFilter = 'partially-paid'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            if (allJobCards.isEmpty)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: Center(
                  child: Text(
                    'No job cards created for this customer yet.',
                    style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textSecondary),
                  ),
                ),
              )
            else if (filteredJobCards.isEmpty)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: Center(
                  child: Text(
                    'No $_activityFilter activity records found.',
                    style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textSecondary),
                  ),
                ),
              )
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: filteredJobCards.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final jc = filteredJobCards[index];
                  final hasInvoice = jc.invoiceId != null;
                  final isPaid = checkPaid(jc);
                  final isPartiallyPaid = checkPartiallyPaid(jc);
                  final isPaymentPending = checkPaymentPending(jc);
                  final isCancelled = checkCancelled(jc);
                  final total = jc.invoiceTotal ?? jc.totalAmount;
                  final paid = jc.paidAmount ?? 0;
                  final outstanding = jc.outstandingAmount ?? 0;

                  final displayIdentifier = (jc.invoiceNumber != null && jc.invoiceNumber!.isNotEmpty)
                      ? jc.invoiceNumber!
                      : jc.jobCardNumber;

                  return Card(
                    elevation: 0,
                    margin: EdgeInsets.zero,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                      side: const BorderSide(color: AppColors.border, width: 1),
                    ),
                    color: AppColors.card,
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      title: Row(
                        children: [
                          Text(
                            displayIdentifier,
                            style: AppTextStyles.headingSmall.copyWith(
                              color: AppColors.primary,
                            ),
                          ),
                          if (jc.invoiceNumber != null && jc.jobCardNumber.isNotEmpty && jc.jobCardNumber != jc.invoiceNumber) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.surfaceAlt,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                jc.jobCardNumber,
                                style: AppTextStyles.bodySmall.copyWith(
                                  color: AppColors.textSecondary,
                                  fontFamily: 'monospace',
                                  fontSize: 11,
                                ),
                              ),
                            ),
                          ],
                          const Spacer(),
                          Text(
                            '₹${total.toStringAsFixed(2)}',
                            style: AppTextStyles.headingSmall,
                          ),
                        ],
                      ),
                      subtitle: Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  jc.vehicleNumber ?? '—',
                                  style: AppTextStyles.bodySmall.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                if (hasInvoice)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: isPaid
                                          ? Colors.green.shade50
                                          : (isPartiallyPaid
                                              ? Colors.amber.shade50
                                              : (isCancelled
                                                  ? Colors.red.shade50
                                                  : Colors.blue.shade50)),
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(
                                        color: isPaid
                                            ? Colors.green.shade300
                                            : (isPartiallyPaid
                                                ? Colors.amber.shade300
                                                : (isCancelled
                                                    ? Colors.red.shade300
                                                    : Colors.blue.shade300)),
                                      ),
                                    ),
                                    child: Text(
                                      isPaid
                                          ? 'PAID'
                                          : (isPartiallyPaid
                                              ? 'PARTIALLY PAID'
                                              : (isCancelled ? 'CANCELLED' : 'PAYMENT PENDING')),
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: isPaid
                                            ? Colors.green.shade800
                                            : (isPartiallyPaid
                                                ? Colors.amber.shade900
                                                : (isCancelled
                                                    ? Colors.red.shade800
                                                    : Colors.blue.shade800)),
                                      ),
                                    ),
                                  )
                                else
                                  StatusBadge.fromLabel(jc.status),
                              ],
                            ),
                            if (hasInvoice && (isPaymentPending || isPartiallyPaid)) ...[
                              const SizedBox(height: 4),
                              Text(
                                'Paid: ₹${paid.toStringAsFixed(2)} · Pending: ₹${outstanding.toStringAsFixed(2)}',
                                style: AppTextStyles.bodySmall.copyWith(
                                  color: isPartiallyPaid ? Colors.amber.shade800 : AppColors.textSecondary,
                                  fontWeight: FontWeight.w500,
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                        trailing: const Icon(Icons.chevron_right, color: AppColors.textTertiary),
                        onTap: () {
                          if (jc.invoiceId != null && jc.invoiceId!.isNotEmpty) {
                            context.go('/invoices/${jc.invoiceId}');
                          } else {
                            context.go('/job-cards/${jc.jobCardId}');
                          }
                        },
                      ),
                    );
                },
              ),

            const SizedBox(height: 20),

            // ── Customer Total Outstanding Balance Card ───────────────────────
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: (state.history?.totalOutstandingAmount ?? 0) > 0
                    ? Colors.amber.shade50
                    : AppColors.card,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: (state.history?.totalOutstandingAmount ?? 0) > 0
                      ? Colors.amber.shade300
                      : AppColors.border,
                ),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: (state.history?.totalOutstandingAmount ?? 0) > 0
                          ? Colors.amber.shade100
                          : Colors.green.shade100,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      (state.history?.totalOutstandingAmount ?? 0) > 0
                          ? Icons.account_balance_wallet_outlined
                          : Icons.check_circle_outline,
                      color: (state.history?.totalOutstandingAmount ?? 0) > 0
                          ? Colors.amber.shade800
                          : Colors.green.shade800,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Outstanding Amount',
                          style: AppTextStyles.labelMedium.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '₹${(state.history?.totalOutstandingAmount ?? 0).toStringAsFixed(2)}',
                          style: AppTextStyles.headingMedium.copyWith(
                            fontWeight: FontWeight.w700,
                            color: (state.history?.totalOutstandingAmount ?? 0) > 0
                                ? Colors.amber.shade900
                                : AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: (state.history?.totalOutstandingAmount ?? 0) > 0
                          ? Colors.amber.shade100
                          : Colors.green.shade100,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: (state.history?.totalOutstandingAmount ?? 0) > 0
                            ? Colors.amber.shade300
                            : Colors.green.shade300,
                      ),
                    ),
                    child: Text(
                      (state.history?.totalOutstandingAmount ?? 0) > 0
                          ? 'Pending Payment'
                          : 'All Settled',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: (state.history?.totalOutstandingAmount ?? 0) > 0
                            ? Colors.amber.shade900
                            : Colors.green.shade800,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActivityFilterChip({
    required String label,
    required bool isSelected,
    required VoidCallback onSelected,
  }) {
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (_) => onSelected(),
      labelStyle: AppTextStyles.labelMedium.copyWith(
        color: isSelected ? AppColors.textOnPrimary : AppColors.textPrimary,
        fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
        fontSize: 12,
      ),
      selectedColor: AppColors.primary,
      backgroundColor: AppColors.surfaceAlt,
      showCheckmark: false,
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: isSelected ? AppColors.primary : AppColors.border,
        ),
      ),
    );
  }
}
