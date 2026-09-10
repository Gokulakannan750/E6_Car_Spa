import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_modal_header.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../../core/errors/api_exception.dart';
import '../../data/vehicle_repository.dart';
import '../../models/vehicle_model.dart';
import '../../../../core/utils/uppercase_formatter.dart';

class VehicleConflictInfo {
  final String vehicleId;
  final String registrationNumber;
  final String make;
  final String model;
  final String? variant;
  final String currentCustomerId;
  final String currentCustomerName;

  const VehicleConflictInfo({
    required this.vehicleId,
    required this.registrationNumber,
    required this.make,
    required this.model,
    this.variant,
    required this.currentCustomerId,
    required this.currentCustomerName,
  });
}

class AddVehicleDialog extends ConsumerStatefulWidget {
  final String customerId;
  final String? customerName;
  final String? initialRegNumber;
  final Function(Vehicle)? onCreated;

  const AddVehicleDialog({
    super.key,
    required this.customerId,
    this.customerName,
    this.initialRegNumber,
    this.onCreated,
  });

  static Future<Vehicle?> show(
    BuildContext context, {
    required String customerId,
    String? customerName,
    String? initialRegNumber,
    Function(Vehicle)? onCreated,
  }) {
    return showModalBottomSheet<Vehicle>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => AddVehicleDialog(
        customerId: customerId,
        customerName: customerName,
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
  String? _transferError;
  VehicleConflictInfo? _vehicleConflict;

  @override
  void initState() {
    super.initState();
    _regController = TextEditingController(text: normalizeRegistration(widget.initialRegNumber));
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
      _transferError = null;
      _vehicleConflict = null;
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
        VehicleConflictInfo? conflict;
        if (e is ConflictException) {
          final details = e.details;
          String? existingVehId;
          String? existingCustId;
          String? existingCustName;
          String? make;
          String? model;
          String? variant;

          if (details is Map) {
            existingVehId = details['existingVehicleId']?.toString();
            existingCustId = details['existingCustomerId']?.toString();
            existingCustName = details['existingCustomerName']?.toString();
            make = details['make']?.toString();
            model = details['model']?.toString();
            variant = details['variant']?.toString();
          }

          if (existingVehId == null || existingCustId == null) {
            try {
              final existing = await ref
                  .read(vehicleRepositoryProvider)
                  .getVehicleByRegistration(_regController.text.trim().toUpperCase());
              if (existing != null) {
                existingVehId = existing.id;
                existingCustId = existing.customerId;
                existingCustName = existing.customerName;
                make = existing.make;
                model = existing.model;
                variant = existing.variant;
              }
            } catch (_) {}
          }

          if (existingVehId != null &&
              existingCustId != null &&
              existingCustId != widget.customerId) {
            conflict = VehicleConflictInfo(
              vehicleId: existingVehId,
              registrationNumber: _regController.text.trim().toUpperCase(),
              make: make ?? _makeController.text.trim(),
              model: model ?? _modelController.text.trim(),
              variant: variant ?? (_variantController.text.trim().isEmpty ? null : _variantController.text.trim()),
              currentCustomerId: existingCustId,
              currentCustomerName: existingCustName ?? 'Another Customer',
            );
          } else if (existingVehId != null &&
              existingCustId != null &&
              existingCustId == widget.customerId) {
            // CASE 1: Vehicle belongs to currently selected customer
            Vehicle? existingVehicle;
            try {
              existingVehicle = await ref
                  .read(vehicleRepositoryProvider)
                  .getVehicleByRegistration(_regController.text.trim().toUpperCase());
            } catch (_) {}

            existingVehicle ??= Vehicle(
              id: existingVehId,
              registrationNumber: _regController.text.trim().toUpperCase(),
              make: make ?? _makeController.text.trim(),
              model: model ?? _modelController.text.trim(),
              variant: variant ?? (_variantController.text.trim().isEmpty ? null : _variantController.text.trim()),
              customerId: widget.customerId,
              customerName: widget.customerName ?? existingCustName,
              createdAt: DateTime.now(),
            );

            widget.onCreated?.call(existingVehicle);
            if (mounted) {
              Navigator.of(context).pop(existingVehicle);
            }
            return;
          }
        }

        setState(() {
          _isSubmitting = false;
          _vehicleConflict = conflict;
          if (conflict != null) {
            _errorMessage = 'Vehicle ${conflict.registrationNumber} is already registered to ${conflict.currentCustomerName}.';
          } else {
            _errorMessage = e is ApiException ? e.message : e.toString().replaceAll('ApiException: ', '');
          }
        });
      }
    }
  }

  Future<void> _showTransferConfirmation() async {
    if (_vehicleConflict == null) return;
    final conflict = _vehicleConflict!;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: const Text('Transfer Vehicle Ownership?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildDetailRow('Vehicle:', conflict.registrationNumber),
                  const SizedBox(height: 6),
                  _buildDetailRow(
                    'Make / Model:',
                    '${conflict.make} ${conflict.model} ${conflict.variant ?? ''}'.trim(),
                  ),
                  const SizedBox(height: 6),
                  _buildDetailRow('Current Owner:', conflict.currentCustomerName, isError: true),
                  const SizedBox(height: 6),
                  _buildDetailRow('New Owner:', widget.customerName ?? 'New Owner', isPrimary: true),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Existing service history, job cards, invoices and payments will not be deleted or changed.',
              style: AppTextStyles.bodySmall.copyWith(color: AppColors.textSecondary),
            ),
          ],
        ),
        actions: [
          TextButton(
            key: const Key('transfer_cancel_button'),
            onPressed: () => Navigator.of(dialogCtx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            key: const Key('transfer_confirm_button'),
            onPressed: () => Navigator.of(dialogCtx).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
            ),
            child: const Text('Transfer Ownership'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await _executeTransfer(conflict);
    }
  }

  Future<void> _executeTransfer(VehicleConflictInfo conflict) async {
    setState(() {
      _isSubmitting = true;
      _transferError = null;
    });

    try {
      final transferredVehicle = await ref
          .read(vehicleRepositoryProvider)
          .transferOwnership(conflict.vehicleId, widget.customerId);

      widget.onCreated?.call(transferredVehicle);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Vehicle ${transferredVehicle.registrationNumber} ownership transferred successfully.',
            ),
            backgroundColor: AppColors.success,
          ),
        );
        Navigator.of(context).pop(transferredVehicle);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _transferError = e is ApiException ? e.message : e.toString().replaceAll('ApiException: ', '');
        });
      }
    }
  }

  Widget _buildDetailRow(String label, String value, {bool isError = false, bool isPrimary = false}) {
    Color valueColor = AppColors.textPrimary;
    if (isError) valueColor = AppColors.error;
    if (isPrimary) valueColor = AppColors.primary;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: AppTextStyles.bodySmall.copyWith(color: AppColors.textSecondary)),
        Text(
          value,
          style: AppTextStyles.bodySmall.copyWith(
            color: valueColor,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
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
                    if (_errorMessage != null && _vehicleConflict == null) ...[
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
                    if (_vehicleConflict != null) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.warningLight,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.warning),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(
                                  Icons.warning_amber_rounded,
                                  color: AppColors.warning,
                                  size: 20,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'Vehicle Already Registered',
                                        style: AppTextStyles.bodyMedium.copyWith(
                                          color: AppColors.warningDark,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        'Vehicle ${_vehicleConflict!.registrationNumber} is already registered to ${_vehicleConflict!.currentCustomerName}.',
                                        style: AppTextStyles.bodySmall.copyWith(
                                          color: AppColors.warningDark,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        'This will transfer this vehicle to the new customer. Existing service history, job cards, invoices and payments will remain unchanged.',
                                        style: AppTextStyles.bodySmall.copyWith(
                                          color: AppColors.textSecondary,
                                        ),
                                      ),
                                      if (_transferError != null) ...[
                                        const SizedBox(height: 8),
                                        Container(
                                          padding: const EdgeInsets.all(8),
                                          decoration: BoxDecoration(
                                            color: AppColors.errorLight,
                                            borderRadius: BorderRadius.circular(6),
                                            border: Border.all(color: AppColors.error),
                                          ),
                                          child: Row(
                                            children: [
                                              const Icon(Icons.error_outline, color: AppColors.error, size: 16),
                                              const SizedBox(width: 6),
                                              Expanded(
                                                child: Text(
                                                  'Transfer failed: $_transferError',
                                                  style: AppTextStyles.bodySmall.copyWith(color: AppColors.errorDark),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                TextButton(
                                  onPressed: () {
                                    setState(() {
                                      _vehicleConflict = null;
                                      _errorMessage = null;
                                      _transferError = null;
                                    });
                                  },
                                  child: const Text('Dismiss'),
                                ),
                                const SizedBox(width: 8),
                                ElevatedButton(
                                  key: const Key('transfer_vehicle_button'),
                                  onPressed: _showTransferConfirmation,
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: AppColors.primary,
                                    foregroundColor: Colors.white,
                                  ),
                                  child: const Text('Transfer Vehicle'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                    AppTextField(
                      controller: _regController,
                      label: 'Registration Number',
                      hint: 'e.g. TN01AB1234',
                      textCapitalization: TextCapitalization.characters,
                      inputFormatters: const [
                        UpperCaseTextFormatter(),
                      ],
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
