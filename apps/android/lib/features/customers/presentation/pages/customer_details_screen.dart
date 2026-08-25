import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../../jobcards/providers/job_card_providers.dart';
import '../../../vehicles/presentation/widgets/add_vehicle_dialog.dart';
import '../../../vehicles/presentation/widgets/vehicle_card.dart';
import '../../providers/customer_providers.dart';

class CustomerDetailsScreen extends ConsumerWidget {
  final String customerId;

  const CustomerDetailsScreen({
    super.key,
    required this.customerId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(customerDetailsProvider(customerId));
    final notifier = ref.read(customerDetailsProvider(customerId).notifier);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(state.customer?.name ?? 'Customer Profile'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/customers'),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: state.customer == null
            ? null
            : () {
                ref.read(newJobCardProvider.notifier).selectCustomer(
                      state.customer!,
                      state.vehicles,
                    );
                context.go('/job-cards/new');
              },
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.textOnPrimary,
        icon: const Icon(Icons.add_task),
        label: const Text('New Job Card'),
      ),
      body: _buildBody(context, state, notifier, ref),
    );
  }

  Widget _buildBody(
    BuildContext context,
    CustomerDetailsState state,
    CustomerDetailsNotifier notifier,
    WidgetRef ref,
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
                      onCreated: (newVehicle) {
                        notifier.loadDetails();
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

            // ── Recent Job Cards Section ────────────────────────────────────
            Text(
              'Recent Job Cards',
              style: AppTextStyles.headingMedium,
            ),
            const SizedBox(height: 8),
            if (state.history == null || state.history!.jobCards.isEmpty)
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
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: state.history!.jobCards.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final jc = state.history!.jobCards[index];
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
                            jc.jobCardNumber,
                            style: AppTextStyles.headingSmall.copyWith(
                              color: AppColors.primary,
                            ),
                          ),
                          const Spacer(),
                          Text(
                            '₹${jc.totalAmount.toStringAsFixed(2)}',
                            style: AppTextStyles.headingSmall,
                          ),
                        ],
                      ),
                      subtitle: Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Row(
                          children: [
                            Text(
                              jc.vehicleNumber ?? '—',
                              style: AppTextStyles.bodySmall.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(width: 8),
                            StatusBadge.fromLabel(jc.status),
                          ],
                        ),
                      ),
                      trailing: const Icon(Icons.chevron_right, color: AppColors.textTertiary),
                      onTap: () => context.go('/job-cards/${jc.jobCardId}'),
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}
