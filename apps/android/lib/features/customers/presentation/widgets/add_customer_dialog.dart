import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/phone_validator.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_modal_header.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../models/customer_model.dart';
import '../../providers/customer_providers.dart';

class AddCustomerDialog extends ConsumerStatefulWidget {
  final String? initialPhone;
  final Function(Customer)? onCreated;

  const AddCustomerDialog({
    super.key,
    this.initialPhone,
    this.onCreated,
  });

  static Future<Customer?> show(BuildContext context, {String? initialPhone, Function(Customer)? onCreated}) {
    return showModalBottomSheet<Customer>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => AddCustomerDialog(
        initialPhone: initialPhone,
        onCreated: onCreated,
      ),
    );
  }

  @override
  ConsumerState<AddCustomerDialog> createState() => _AddCustomerDialogState();
}

class _AddCustomerDialogState extends ConsumerState<AddCustomerDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;
  final _emailController = TextEditingController();
  final _addressController = TextEditingController();

  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController();
    _phoneController = TextEditingController(text: widget.initialPhone ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final request = CreateCustomerRequest(
        name: _nameController.text.trim(),
        phoneNumber: PhoneValidator.clean(_phoneController.text.trim()),
        email: _emailController.text.trim().isEmpty ? null : _emailController.text.trim(),
        address: _addressController.text.trim().isEmpty ? null : _addressController.text.trim(),
      );

      final customer = await ref.read(customerListProvider.notifier).createCustomer(request);
      widget.onCreated?.call(customer);

      if (mounted) {
        Navigator.of(context).pop(customer);
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
            title: 'Add New Customer',
            subtitle: 'Register customer contact details',
            icon: Icons.person_add_outlined,
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
                controller: _nameController,
                label: 'Full Name',
                hint: 'e.g. Ramesh Kumar',
                prefixIcon: const Icon(Icons.person_outline),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) return 'Customer name is required';
                  return null;
                },
              ),
              const SizedBox(height: 16),
              AppTextField(
                controller: _phoneController,
                label: 'Phone Number',
                hint: 'e.g. 9876543210',
                keyboardType: TextInputType.phone,
                inputFormatters: PhoneValidator.formatters,
                maxLength: 10,
                prefixIcon: const Icon(Icons.phone_outlined),
                validator: (val) => PhoneValidator.validate(val, isRequired: true),
              ),
              const SizedBox(height: 16),
              AppTextField(
                controller: _emailController,
                label: 'Email (Optional)',
                hint: 'e.g. ramesh@example.com',
                keyboardType: TextInputType.emailAddress,
                prefixIcon: const Icon(Icons.email_outlined),
              ),
              const SizedBox(height: 16),
              AppTextField(
                controller: _addressController,
                label: 'Address (Optional)',
                hint: 'e.g. 12, Main Street, Chennai',
                prefixIcon: const Icon(Icons.location_on_outlined),
              ),
              const SizedBox(height: 24),
              // Action Buttons (Cancel + Create Customer)
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
                      label: 'Create Customer',
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
