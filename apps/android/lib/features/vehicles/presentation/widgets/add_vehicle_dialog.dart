import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_modal_header.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../data/vehicle_repository.dart';
import '../../models/vehicle_model.dart';

class AddVehicleDialog extends ConsumerStatefulWidget {
  final String customerId;
  final String? initialRegNumber;
  final Function(Vehicle)? onCreated;

  const AddVehicleDialog({
    super.key,
    required this.customerId,
    this.initialRegNumber,
    this.onCreated,
  });

  static Future<Vehicle?> show(
    BuildContext context, {
    required String customerId,
    String? initialRegNumber,
    Function(Vehicle)? onCreated,
  }) {
    return showModalBottomSheet<Vehicle>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => AddVehicleDialog(
        customerId: customerId,
        initialRegNumber: initialRegNumber,
        onCreated: onCreated,
      ),
    );
  }

  @override
  ConsumerState<AddVehicleDialog> createState() => _AddVehicleDialogState();
}

class _AddVehicleDialogState extends ConsumerState<AddVehicleDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _regController;
  final _makeController = TextEditingController();
  final _modelController = TextEditingController();
  final _variantController = TextEditingController();

  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _regController = TextEditingController(text: widget.initialRegNumber ?? '');
  }

  @override
  void dispose() {
    _regController.dispose();
    _makeController.dispose();
    _modelController.dispose();
    _variantController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final request = CreateVehicleRequest(
        registrationNumber: _regController.text.trim().toUpperCase(),
        make: _makeController.text.trim(),
        model: _modelController.text.trim(),
        variant: _variantController.text.trim().isEmpty ? null : _variantController.text.trim(),
        color: null,
        customerId: widget.customerId,
      );

      final vehicle = await ref.read(vehicleRepositoryProvider).createVehicle(request);
      widget.onCreated?.call(vehicle);

      if (mounted) {
        Navigator.of(context).pop(vehicle);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _errorMessage = e.toString().replaceAll('ApiException: ', '');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 16,
        bottom: 24 + bottomInset,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Pinned Fixed Header
          const AppModalHeader(
            title: 'Register Vehicle',
            subtitle: 'Add vehicle details linked to customer',
            icon: Icons.directions_car_outlined,
            showDragHandle: true,
          ),
          const SizedBox(height: 14),

          Flexible(
            child: Form(
              key: _formKey,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_errorMessage != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.errorLight,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.error),
                  ),
                  child: Text(
                    _errorMessage!,
                    style: AppTextStyles.bodyMedium.copyWith(color: AppColors.errorDark),
                  ),
                ),
                const SizedBox(height: 16),
              ],
              AppTextField(
                controller: _regController,
                label: 'Registration Number',
                hint: 'e.g. TN01AB1234',
                textCapitalization: TextCapitalization.characters,
                prefixIcon: const Icon(Icons.directions_car_outlined),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) return 'Registration number is required';
                  return null;
                },
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: AppTextField(
                      controller: _makeController,
                      label: 'Make',
                      hint: 'e.g. Hyundai',
                      prefixIcon: const Icon(Icons.branding_watermark_outlined),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) return 'Make is required';
                        return null;
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: AppTextField(
                      controller: _modelController,
                      label: 'Model',
                      hint: 'e.g. Creta',
                      prefixIcon: const Icon(Icons.car_repair_outlined),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) return 'Model is required';
                        return null;
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              AppTextField(
                controller: _variantController,
                label: 'Variant (Optional)',
                hint: 'e.g. SX(O) / ZX CVT',
                prefixIcon: const Icon(Icons.tune_rounded),
              ),
              const SizedBox(height: 24),
              // Action Buttons (Cancel + Save Vehicle)
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      key: const Key('modal_cancel_button'),
                      onPressed: _isSubmitting
                          ? null
                          : () {
                              FocusScope.of(context).unfocus();
                              Navigator.of(context).pop();
                            },
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        side: const BorderSide(color: AppColors.borderDark),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: AppButton(
                      label: 'Save Vehicle',
                      isLoading: _isSubmitting,
                      onPressed: _submit,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    ),
  ],
),
);
  }
}
