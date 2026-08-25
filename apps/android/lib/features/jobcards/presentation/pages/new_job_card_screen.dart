import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../customers/presentation/widgets/add_customer_dialog.dart';
import '../../../vehicles/presentation/widgets/add_vehicle_dialog.dart';
import '../../../vehicles/presentation/widgets/vehicle_card.dart';
import '../../providers/job_card_providers.dart';
import '../widgets/add_custom_service_dialog.dart';

class NewJobCardScreen extends ConsumerStatefulWidget {
  const NewJobCardScreen({super.key});

  @override
  ConsumerState<NewJobCardScreen> createState() => _NewJobCardScreenState();
}

class _NewJobCardScreenState extends ConsumerState<NewJobCardScreen> {
  final _lookupController = TextEditingController();
  final _notesController = TextEditingController();
  final _serviceSearchController = TextEditingController();

  @override
  void dispose() {
    _lookupController.dispose();
    _notesController.dispose();
    _serviceSearchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(newJobCardProvider);
    final notifier = ref.read(newJobCardProvider.notifier);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'New Job Card',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppColors.textPrimary),
        ),
        leading: IconButton(
          icon: const Icon(Icons.close, color: AppColors.textPrimary),
          onPressed: () => context.go('/job-cards'),
        ),
      ),
      body: Column(
        children: [
          // ── Step Indicator ───────────────────────────────────────────────
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            child: Row(
              children: [
                _buildStepBubble(0, 'Customer & Vehicle', state.step),
                _buildStepDivider(state.step > 0),
                _buildStepBubble(1, 'Services', state.step),
                _buildStepDivider(state.step > 1),
                _buildStepBubble(2, 'Review', state.step),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.border),

          // ── Active Step View ─────────────────────────────────────────────
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: _buildCurrentStep(state, notifier),
            ),
          ),

          // ── Bottom Navigation Bar ────────────────────────────────────────
          _buildBottomBar(state, notifier),
        ],
      ),
    );
  }

  Widget _buildStepBubble(int stepIndex, String title, int currentStep) {
    final isDone = currentStep > stepIndex;
    final isActive = currentStep == stepIndex;

    return Expanded(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: isDone
                  ? AppColors.primary
                  : (isActive ? AppColors.primary : AppColors.surfaceAlt),
              shape: BoxShape.circle,
              border: Border.all(
                color: isDone || isActive ? AppColors.primary : AppColors.outline,
                width: 1.5,
              ),
            ),
            child: Center(
              child: isDone
                  ? const Icon(Icons.check, size: 16, color: Colors.white)
                  : Text(
                      '${stepIndex + 1}',
                      style: TextStyle(
                        color: isActive ? Colors.white : AppColors.textSecondary,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            title,
            style: TextStyle(
              color: isActive || isDone ? AppColors.primary : AppColors.textSecondary,
              fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
              fontSize: 11,
            ),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildStepDivider(bool isDone) {
    return Container(
      width: 24,
      height: 2,
      margin: const EdgeInsets.only(bottom: 18),
      color: isDone ? AppColors.primary : AppColors.border,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── STEP 0: CUSTOMER & VEHICLE ────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildStep0CustomerVehicle(NewJobCardState state, NewJobCardNotifier notifier) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Customer & Vehicle Details',
          style: AppTextStyles.displaySmall.copyWith(color: AppColors.textPrimary),
        ),
        const SizedBox(height: 4),
        Text(
          'Search existing customer by phone number or vehicle registration.',
          style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textSecondary),
        ),
        const SizedBox(height: 16),

        // Lookup Box
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: AppTextField(
                controller: _lookupController,
                hint: 'Phone or vehicle registration',
                prefixIcon: const Icon(Icons.search, color: AppColors.textTertiary),
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(
              height: 48,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: state.isSearching
                    ? null
                    : () {
                        final val = _lookupController.text.trim();
                        if (val.isEmpty) return;
                        if (RegExp(r'^[0-9]+$').hasMatch(val)) {
                          notifier.lookupByPhone(val);
                        } else {
                          notifier.lookupByRegistration(val);
                        }
                      },
                child: state.isSearching
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Search', style: TextStyle(fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),

        if (state.lookupError != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surfaceAlt,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline, color: AppColors.primary, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    state.lookupError!,
                    style: AppTextStyles.bodySmall.copyWith(color: AppColors.textPrimary),
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 16),

        // Create New Customer Button (Always available)
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(
            backgroundColor: Colors.white,
            foregroundColor: AppColors.primary,
            side: const BorderSide(color: AppColors.primary, width: 1.2),
            padding: const EdgeInsets.symmetric(vertical: 12),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          icon: const Icon(Icons.person_add_outlined, size: 18),
          label: const Text('Create New Customer', style: TextStyle(fontWeight: FontWeight.w600)),
          onPressed: () {
            AddCustomerDialog.show(
              context,
              initialPhone: _lookupController.text.trim(),
              onCreated: (newCust) {
                notifier.selectCustomer(newCust, []);
              },
            );
          },
        ),
        const SizedBox(height: 20),

        // Selected Customer Card (if found/created)
        if (state.customer != null) ...[
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.primary, width: 1.5),
              boxShadow: const [
                BoxShadow(color: Color(0x0A0453CD), blurRadius: 8, offset: Offset(0, 2)),
              ],
            ),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: AppColors.accentPill,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Center(
                        child: Icon(Icons.person_rounded, size: 22, color: AppColors.primary),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                state.customer!.name,
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppColors.readyBg,
                                  borderRadius: BorderRadius.circular(4),
                                  border: Border.all(color: AppColors.readyBorder),
                                ),
                                child: const Text(
                                  'Selected',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.readyText,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            state.customer!.phoneNumber,
                            style: AppTextStyles.bodySmall.copyWith(color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.check_circle, color: AppColors.primary, size: 22),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Vehicles List for Selected Customer
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Customer Vehicles',
                style: AppTextStyles.headingMedium.copyWith(color: AppColors.textPrimary),
              ),
              TextButton.icon(
                icon: const Icon(Icons.add, size: 16, color: AppColors.primary),
                label: const Text('Add Vehicle', style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.primary)),
                onPressed: () {
                  AddVehicleDialog.show(
                    context,
                    customerId: state.customer!.id,
                    initialRegNumber: RegExp(r'^[0-9]+$').hasMatch(_lookupController.text)
                        ? null
                        : _lookupController.text.trim(),
                    onCreated: (newVeh) {
                      final updatedList = [...state.customerVehicles, newVeh];
                      notifier.selectCustomer(state.customer!, updatedList, vehicle: newVeh);
                    },
                  );
                },
              ),
            ],
          ),
          const SizedBox(height: 8),

          if (state.customerVehicles.isEmpty)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.border),
              ),
              child: Center(
                child: Text(
                  'No vehicle registered for this customer yet. Tap "+ Add Vehicle" above.',
                  style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textSecondary),
                  textAlign: TextAlign.center,
                ),
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: state.customerVehicles.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final v = state.customerVehicles[index];
                final isSelected = state.selectedVehicle?.id == v.id;
                return VehicleCard(
                  vehicle: v,
                  onTap: () => notifier.selectVehicle(v),
                  trailing: isSelected
                      ? const Icon(Icons.check_circle, color: AppColors.primary, size: 24)
                      : const Icon(Icons.radio_button_unchecked, color: AppColors.textTertiary, size: 24),
                );
              },
            ),
        ],
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── STEP 1: SERVICES ──────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildStep1Services(NewJobCardState state, NewJobCardNotifier notifier) {
    final search = _serviceSearchController.text.trim().toLowerCase();
    final filteredServices = state.availableServices.where((s) {
      if (search.isEmpty) return true;
      return s.name.toLowerCase().contains(search) ||
          (s.category != null && s.category!.toLowerCase().contains(search));
    }).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Select Services',
                    style: AppTextStyles.displaySmall.copyWith(color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Add detailing, washing, and protection services',
                    style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.accentPill,
                foregroundColor: AppColors.primary,
                elevation: 0,
                side: const BorderSide(color: AppColors.inProgressBorder),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              icon: const Icon(Icons.add, size: 16),
              label: const Text('Custom Service', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
              onPressed: () {
                AddCustomServiceDialog.show(
                  context,
                  onCreated: (newSvc) {
                    notifier.addService(newSvc);
                  },
                );
              },
            ),
          ],
        ),
        const SizedBox(height: 16),

        // Added Services Container
        if (state.selectedServices.isNotEmpty) ...[
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.inProgressBorder, width: 1.5),
              boxShadow: const [
                BoxShadow(color: Color(0x0A0453CD), blurRadius: 8, offset: Offset(0, 2)),
              ],
            ),
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.shopping_bag_outlined, color: AppColors.primary, size: 18),
                        const SizedBox(width: 8),
                        Text(
                          'Added Services (${state.selectedServices.length})',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.textPrimary),
                        ),
                      ],
                    ),
                    Text(
                      '₹${state.previewSubtotal.toStringAsFixed(2)}',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.primary),
                    ),
                  ],
                ),
                const Divider(height: 18, color: AppColors.border),
                ...state.selectedServices.values.map((item) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.service.name,
                                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: AppColors.textPrimary),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '₹${item.service.price.toStringAsFixed(2)} × ${item.quantity} = ₹${item.subtotal.toStringAsFixed(2)}',
                                style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                        // Quantity Controls
                        Container(
                          decoration: BoxDecoration(
                            color: AppColors.surfaceAlt,
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              InkWell(
                                onTap: () => notifier.updateQuantity(item.service.id, item.quantity - 1),
                                child: const Padding(
                                  padding: EdgeInsets.all(4),
                                  child: Icon(Icons.remove, size: 16, color: AppColors.textPrimary),
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 8),
                                child: Text(
                                  '${item.quantity}',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                ),
                              ),
                              InkWell(
                                onTap: () => notifier.updateQuantity(item.service.id, item.quantity + 1),
                                child: const Padding(
                                  padding: EdgeInsets.all(4),
                                  child: Icon(Icons.add, size: 16, color: AppColors.primary),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        IconButton(
                          icon: const Icon(Icons.delete_outline_rounded, color: AppColors.error, size: 20),
                          onPressed: () => notifier.removeService(item.service.id),
                        ),
                      ],
                    ),
                  );
                }),
              ],
            ),
          ),
          const SizedBox(height: 20),
        ],

        // Available Services Search & List
        AppTextField(
          controller: _serviceSearchController,
          hint: 'Search catalogue services...',
          prefixIcon: const Icon(Icons.search, color: AppColors.textTertiary),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 12),

        if (state.isLoadingServices)
          const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()))
        else if (filteredServices.isEmpty)
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.border),
            ),
            child: const Center(child: Text('No services found matching search.')),
          )
        else
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: filteredServices.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final svc = filteredServices[index];
              final isAdded = state.selectedServices.containsKey(svc.id);

              return Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: isAdded ? AppColors.inProgressBorder : AppColors.border,
                    width: isAdded ? 1.5 : 1,
                  ),
                ),
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            svc.name,
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.textPrimary),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceAlt,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  svc.category ?? 'General',
                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: AppColors.textSecondary),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                'GST ${svc.taxPercentage.toInt()}%',
                                style: const TextStyle(fontSize: 11, color: AppColors.textTertiary),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '₹${svc.price.toStringAsFixed(2)}',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.primary),
                          ),
                        ],
                      ),
                    ),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: isAdded ? AppColors.accentPill : AppColors.primary,
                        foregroundColor: isAdded ? AppColors.primary : Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                          side: isAdded ? const BorderSide(color: AppColors.inProgressBorder) : BorderSide.none,
                        ),
                      ),
                      icon: Icon(isAdded ? Icons.add : Icons.add_rounded, size: 16),
                      label: Text(isAdded ? '+ Add More' : 'Add', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                      onPressed: () => notifier.addService(svc),
                    ),
                  ],
                ),
              );
            },
          ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── STEP 2: REVIEW & CONFIRM ──────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildStep2Review(NewJobCardState state, NewJobCardNotifier notifier) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Review & Confirm',
          style: AppTextStyles.displaySmall.copyWith(color: AppColors.textPrimary),
        ),
        const SizedBox(height: 4),
        Text(
          'Verify all details before creating the Job Card on the server.',
          style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textSecondary),
        ),
        const SizedBox(height: 16),

        if (state.submitError != null) ...[
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.errorLight,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.error),
            ),
            child: Text(
              state.submitError!,
              style: AppTextStyles.bodyMedium.copyWith(color: AppColors.errorDark),
            ),
          ),
          const SizedBox(height: 16),
        ],

        // Customer & Vehicle summary
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.person_pin_outlined, color: AppColors.primary, size: 18),
                  SizedBox(width: 8),
                  Text(
                    'Customer & Vehicle',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.textPrimary),
                  ),
                ],
              ),
              const Divider(height: 16, color: AppColors.border),
              Text(
                'Customer: ${state.customer?.name ?? ''} (${state.customer?.phoneNumber ?? ''})',
                style: const TextStyle(fontSize: 14, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 4),
              Text(
                'Vehicle: ${state.selectedVehicle?.registrationNumber ?? ''} — ${state.selectedVehicle?.displayName ?? ''}',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.primary),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Services summary
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.build_circle_outlined, color: AppColors.primary, size: 18),
                      const SizedBox(width: 8),
                      Text(
                        'Selected Services (${state.selectedServices.length})',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.textPrimary),
                      ),
                    ],
                  ),
                ],
              ),
              const Divider(height: 16, color: AppColors.border),
              ...state.selectedServices.values.map(
                (item) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('${item.service.name} (×${item.quantity})', style: const TextStyle(fontSize: 13, color: AppColors.textPrimary)),
                      Text('₹${item.subtotal.toStringAsFixed(2)}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // GST Switch & Notes
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Apply GST / Tax (18%)', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                subtitle: const Text('When disabled, generates a non-GST job card', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                value: state.isGstEnabled,
                activeTrackColor: AppColors.primary,
                onChanged: (val) => notifier.setGstEnabled(val),
              ),
              const Divider(height: 16, color: AppColors.border),
              AppTextField(
                controller: _notesController,
                label: 'Notes / Special Instructions (Optional)',
                hint: 'e.g. Extra care on front bumper scratch...',
                maxLines: 3,
                onChanged: (val) => notifier.setNotes(val),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Estimated Financial Totals (Display Preview)
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              _buildSummaryRow('Estimated Subtotal', '₹${state.previewSubtotal.toStringAsFixed(2)}'),
              const SizedBox(height: 6),
              _buildSummaryRow('Estimated GST (18%)', '₹${state.previewTax.toStringAsFixed(2)}'),
              const Divider(height: 18, color: AppColors.border),
              _buildSummaryRow(
                'Estimated Total',
                '₹${state.previewTotal.toStringAsFixed(2)}',
                isBold: true,
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildSummaryRow(String label, String value, {bool isBold = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
            fontSize: isBold ? 15 : 13,
            color: isBold ? AppColors.textPrimary : AppColors.textSecondary,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
            fontSize: isBold ? 18 : 14,
            color: isBold ? AppColors.primary : AppColors.textPrimary,
          ),
        ),
      ],
    );
  }

  Widget _buildCurrentStep(NewJobCardState state, NewJobCardNotifier notifier) {
    switch (state.step) {
      case 0:
        return _buildStep0CustomerVehicle(state, notifier);
      case 1:
        return _buildStep1Services(state, notifier);
      case 2:
        return _buildStep2Review(state, notifier);
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildBottomBar(NewJobCardState state, NewJobCardNotifier notifier) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.border, width: 1)),
      ),
      child: Row(
        children: [
          if (state.step > 0) ...[
            OutlinedButton(
              style: OutlinedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: AppColors.textPrimary,
                side: const BorderSide(color: AppColors.borderDark),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onPressed: state.isSubmitting ? null : () => notifier.setStep(state.step - 1),
              child: const Text('Back', style: TextStyle(fontWeight: FontWeight.w600)),
            ),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: AppButton(
              label: state.step == 2 ? 'Create Job Card' : 'Continue',
              isLoading: state.isSubmitting,
              onPressed: () async {
                if (state.step == 0) {
                  if (state.canProceedToServices) {
                    notifier.setStep(1);
                  } else {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Please select both a customer and a vehicle.')),
                    );
                  }
                } else if (state.step == 1) {
                  if (state.canProceedToReview) {
                    notifier.setStep(2);
                  } else {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Please add at least one service.')),
                    );
                  }
                } else if (state.step == 2) {
                  final created = await notifier.submitJobCard();
                  if (created != null && mounted) {
                    context.go('/job-cards/${created.id}');
                  }
                }
              },
            ),
          ),
        ],
      ),
    );
  }
}
