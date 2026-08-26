import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_modal_header.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../models/showroom_model.dart';

class ShowroomFormSheet extends StatefulWidget {
  final Showroom? showroom;
  final Future<void> Function(CreateShowroomRequest request)? onCreate;
  final Future<void> Function(String id, UpdateShowroomRequest request)? onUpdate;

  const ShowroomFormSheet({
    super.key,
    this.showroom,
    this.onCreate,
    this.onUpdate,
  }) : assert(
          showroom == null ? onCreate != null : onUpdate != null,
          'Either onCreate or onUpdate must be provided',
        );

  @override
  State<ShowroomFormSheet> createState() => _ShowroomFormSheetState();
}

class _ShowroomFormSheetState extends State<ShowroomFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _addressController;
  late final TextEditingController _phoneController;
  late bool _isActive;

  bool _isSubmitting = false;
  String? _errorMessage;

  bool get _isEditing => widget.showroom != null;

  @override
  void initState() {
    super.initState();
    final sr = widget.showroom;
    _nameController = TextEditingController(text: sr?.name ?? '');
    _addressController = TextEditingController(text: sr?.address ?? '');
    _phoneController = TextEditingController(text: sr?.phone ?? '');
    _isActive = sr?.isActive ?? true;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _addressController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      if (_isEditing) {
        final request = UpdateShowroomRequest(
          name: _nameController.text.trim(),
          address: _addressController.text.trim(),
          phone: _phoneController.text.trim().isEmpty ? null : _phoneController.text.trim(),
          isActive: _isActive,
        );
        await widget.onUpdate!(widget.showroom!.id, request);
      } else {
        final request = CreateShowroomRequest(
          name: _nameController.text.trim(),
          address: _addressController.text.trim(),
          phone: _phoneController.text.trim().isEmpty ? null : _phoneController.text.trim(),
          isActive: _isActive,
        );
        await widget.onCreate!(request);
      }

      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _errorMessage = e.toString().replaceAll('Exception:', '').trim();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: 20 + bottomInset,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Pinned Fixed Header
          AppModalHeader(
            title: _isEditing ? 'Edit Showroom' : 'Add New Showroom',
            subtitle: _isEditing ? 'Update showroom branch details' : 'Register a new showroom branch',
            icon: _isEditing ? Icons.edit_outlined : Icons.add_business_outlined,
            iconBgColor: AppColors.primary.withAlpha(20),
            iconColor: AppColors.primary,
            showDragHandle: true,
          ),
          const SizedBox(height: 14),

          Flexible(
            child: SingleChildScrollView(
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Error Banner
                    if (_errorMessage != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.errorLight,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.error.withAlpha(80)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, size: 18, color: AppColors.error),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: AppTextStyles.bodySmall.copyWith(
                            color: AppColors.errorDark,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Showroom Name Field
              AppTextField(
                controller: _nameController,
                label: 'Showroom Name *',
                hintText: 'e.g. E6 Car Spa - Anna Nagar',
                prefixIcon: const Icon(Icons.storefront_outlined),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Showroom name is required';
                  }
                  if (val.trim().length > 150) {
                    return 'Showroom name must be 150 characters or less';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 14),

              // Address Field
              AppTextField(
                controller: _addressController,
                label: 'Address *',
                hintText: 'e.g. Plot 12, 2nd Avenue, Anna Nagar, Chennai - 600040',
                prefixIcon: const Icon(Icons.location_on_outlined),
                maxLines: 2,
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Address is required';
                  }
                  if (val.trim().length > 500) {
                    return 'Address must be 500 characters or less';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 14),

              // Contact Phone Field
              AppTextField(
                controller: _phoneController,
                label: 'Contact Phone (Optional)',
                hintText: 'e.g. 9840154321',
                prefixIcon: const Icon(Icons.phone_outlined),
                keyboardType: TextInputType.phone,
                validator: (val) {
                  if (val != null && val.trim().isNotEmpty) {
                    if (val.trim().length > 20) {
                      return 'Phone number cannot exceed 20 digits';
                    }
                  }
                  return null;
                },
              ),
              const SizedBox(height: 14),

              // Active Switch Card
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Active Status',
                            style: AppTextStyles.bodyMedium.copyWith(
                              fontWeight: FontWeight.w600,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Showroom is operational & accepts staff roster',
                            style: AppTextStyles.bodySmall.copyWith(
                              color: AppColors.textSecondary,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Switch.adaptive(
                      value: _isActive,
                      activeTrackColor: AppColors.primary,
                      onChanged: (val) => setState(() => _isActive = val),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),

              // Bottom action buttons (Cancel + Submit)
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
                      label: _isEditing ? 'Save Changes' : 'Create Showroom',
                      icon: _isEditing ? Icons.save_outlined : Icons.add_business_outlined,
                      isLoading: _isSubmitting,
                      onPressed: _handleSubmit,
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
