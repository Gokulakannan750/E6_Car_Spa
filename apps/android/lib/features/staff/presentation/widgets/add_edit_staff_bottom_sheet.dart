import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_modal_header.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../models/staff_model.dart';
import '../../models/staff_request_models.dart';

class AddEditStaffBottomSheet extends StatefulWidget {
  final Staff? staff;
  final Future<String?> Function(CreateStaffRequest request)? onCreate;
  final Future<String?> Function(String staffId, UpdateStaffRequest request)? onUpdate;

  const AddEditStaffBottomSheet({
    super.key,
    this.staff,
    this.onCreate,
    this.onUpdate,
  });

  @override
  State<AddEditStaffBottomSheet> createState() => _AddEditStaffBottomSheetState();
}

class _AddEditStaffBottomSheetState extends State<AddEditStaffBottomSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;
  late final TextEditingController _emailController;
  late final TextEditingController _addressController;
  late final TextEditingController _roleController;

  late bool _isActive;
  bool _isLoading = false;
  String? _errorMessage;

  bool get isEdit => widget.staff != null;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.staff?.name ?? '');
    _phoneController = TextEditingController(text: widget.staff?.phoneNumber ?? '');
    _emailController = TextEditingController(text: widget.staff?.email ?? '');
    _addressController = TextEditingController(text: widget.staff?.address ?? '');
    _roleController = TextEditingController(text: widget.staff?.role ?? '');
    _isActive = widget.staff?.isActive ?? true;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _addressController.dispose();
    _roleController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (_isLoading) return;

    final name = _nameController.text.trim();
    final phone = _phoneController.text.trim();

    if (name.isEmpty) {
      setState(() {
        _errorMessage = 'Please enter the staff member\'s name.';
      });
      return;
    }

    final cleanPhone = phone.replaceAll(RegExp(r'\D'), '');
    if (cleanPhone.isEmpty || cleanPhone.length != 10) {
      setState(() {
        _errorMessage = 'Phone number must be exactly 10 digits without country code.';
      });
      return;
    }

    final email = _emailController.text.trim();
    final address = _addressController.text.trim();
    final role = _roleController.text.trim();

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    String? error;

    if (isEdit) {
      final request = UpdateStaffRequest(
        name: name,
        phoneNumber: cleanPhone,
        email: email.isEmpty ? null : email,
        address: address.isEmpty ? null : address,
        role: role.isEmpty ? null : role,
        isActive: _isActive,
      );
      error = await widget.onUpdate?.call(widget.staff!.id, request);
    } else {
      final request = CreateStaffRequest(
        name: name,
        phoneNumber: cleanPhone,
        email: email.isEmpty ? null : email,
        address: address.isEmpty ? null : address,
        role: role.isEmpty ? null : role,
        isActive: _isActive,
      );
      error = await widget.onCreate?.call(request);
    }

    if (!mounted) return;

    if (error == null) {
      Navigator.of(context).pop(true);
    } else {
      setState(() {
        _isLoading = false;
        _errorMessage = error;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final keyboardPadding = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: 20 + keyboardPadding,
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
            title: isEdit ? 'Edit Staff Member' : 'Add Staff Member',
            subtitle: isEdit ? 'Update staff member profile & role' : 'Add an employee to the workshop directory',
            icon: isEdit ? Icons.edit_outlined : Icons.person_add_outlined,
            iconBgColor: AppColors.inProgressBg,
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
                    if (_errorMessage != null)
                      Container(
                        margin: const EdgeInsets.only(bottom: 14),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.error.withAlpha(20),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.error.withAlpha(80)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: AppColors.error, size: 16),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: AppTextStyles.bodySmall.copyWith(color: AppColors.error),
                        ),
                      ),
                    ],
                  ),
                ),

              // Field 1: Name
              Text(
                'Full Name *',
                style: AppTextStyles.labelMedium.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              AppTextField(
                controller: _nameController,
                hintText: 'e.g. Ramesh Kumar',
                prefixIcon: const Icon(Icons.person_outline, size: 18, color: AppColors.textSecondary),
                isEnabled: !_isLoading,
              ),
              const SizedBox(height: 12),

              // Field 2: Phone Number
              Text(
                'Phone Number *',
                style: AppTextStyles.labelMedium.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              AppTextField(
                controller: _phoneController,
                hintText: 'e.g. 9840123456',
                keyboardType: TextInputType.phone,
                prefixIcon: const Icon(Icons.phone_outlined, size: 18, color: AppColors.textSecondary),
                isEnabled: !_isLoading,
              ),
              const SizedBox(height: 12),

              // Field 3: Role / Designation
              Text(
                'Role / Designation',
                style: AppTextStyles.labelMedium.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              AppTextField(
                controller: _roleController,
                hintText: 'e.g. Detailer, Supervisor, Technician',
                prefixIcon: const Icon(Icons.badge_outlined, size: 18, color: AppColors.textSecondary),
                isEnabled: !_isLoading,
              ),
              const SizedBox(height: 12),

              // Field 4: Email
              Text(
                'Email Address',
                style: AppTextStyles.labelMedium.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              AppTextField(
                controller: _emailController,
                hintText: 'e.g. ramesh@e6carspa.com',
                keyboardType: TextInputType.emailAddress,
                prefixIcon: const Icon(Icons.email_outlined, size: 18, color: AppColors.textSecondary),
                isEnabled: !_isLoading,
              ),
              const SizedBox(height: 12),

              // Field 5: Address
              Text(
                'Address',
                style: AppTextStyles.labelMedium.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              AppTextField(
                controller: _addressController,
                hintText: 'Street, city, area...',
                prefixIcon: const Icon(Icons.location_on_outlined, size: 18, color: AppColors.textSecondary),
                maxLines: 2,
                isEnabled: !_isLoading,
              ),
              const SizedBox(height: 14),

              // Active switch
              if (isEdit)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Active Status',
                            style: AppTextStyles.bodyMedium.copyWith(fontWeight: FontWeight.w600),
                          ),
                          Text(
                            _isActive ? 'Staff member can receive advances' : 'Staff member is inactive',
                            style: AppTextStyles.bodySmall.copyWith(color: AppColors.textSecondary, fontSize: 11),
                          ),
                        ],
                      ),
                      Switch(
                        value: _isActive,
                        activeThumbColor: AppColors.primary,
                        onChanged: _isLoading
                            ? null
                            : (val) {
                                setState(() {
                                  _isActive = val;
                                });
                              },
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 20),

              // Bottom action buttons (Cancel + Submit)
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      key: const Key('modal_cancel_button'),
                      onPressed: _isLoading
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
                      label: isEdit ? 'Save Changes' : 'Create Staff',
                      icon: isEdit ? Icons.save_outlined : Icons.check_rounded,
                      isLoading: _isLoading,
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
