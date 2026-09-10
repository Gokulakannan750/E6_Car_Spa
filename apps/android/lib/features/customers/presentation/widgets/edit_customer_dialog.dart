import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_modal_header.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../models/customer_model.dart';
import '../../providers/customer_providers.dart';

class EditCustomerDialog extends ConsumerStatefulWidget {
  final Customer customer;
  final ValueChanged<Customer>? onUpdated;

  const EditCustomerDialog({
    super.key,
    required this.customer,
    this.onUpdated,
  });

  static Future<Customer?> show(
    BuildContext context, {
    required Customer customer,
    ValueChanged<Customer>? onUpdated,
  }) {
    return showModalBottomSheet<Customer>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => EditCustomerDialog(
        customer: customer,
        onUpdated: onUpdated,
      ),
    );
  }

  @override
  ConsumerState<EditCustomerDialog> createState() => _EditCustomerDialogState();
}

class _EditCustomerDialogState extends ConsumerState<EditCustomerDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;
  late final TextEditingController _emailController;
  late final TextEditingController _addressController;

  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.customer.name);
    _phoneController = TextEditingController(text: widget.customer.phoneNumber);
    _emailController = TextEditingController(text: widget.customer.email ?? '');
    _addressController = TextEditingController(text: widget.customer.address ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (_isSubmitting) return;

    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    final trimmedName = _nameController.text.trim();
    final trimmedPhone = _phoneController.text.trim();
    final trimmedEmail = _emailController.text.trim();
    final trimmedAddress = _addressController.text.trim();

    final request = UpdateCustomerRequest(
      name: trimmedName,
      phoneNumber: trimmedPhone,
      email: trimmedEmail.isNotEmpty ? trimmedEmail : null,
      address: trimmedAddress.isNotEmpty ? trimmedAddress : null,
    );

    try {
      final updated = await ref
          .read(customerDetailsProvider(widget.customer.id).notifier)
          .updateCustomer(request);

      // Invalidate customer list cache so list reflects updated details immediately
      ref.invalidate(customerListProvider);

      widget.onUpdated?.call(updated);

      if (mounted) {
        Navigator.of(context).pop(updated);
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _errorMessage = e.message;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          final msg = e.toString().replaceAll('ApiException: ', '').replaceAll('Exception: ', '');
          _errorMessage = msg.isNotEmpty ? msg : 'Unable to update customer details.';
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
          // Pinned Header
          const AppModalHeader(
            title: 'Edit Details',
            subtitle: 'Update customer contact profile',
            icon: Icons.edit_note_rounded,
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
                          color: AppColors.error.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline, size: 18, color: AppColors.error),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _errorMessage!,
                                style: const TextStyle(
                                  color: AppColors.error,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                    ],

                    // Full Name Field
                    AppTextField(
                      controller: _nameController,
                      label: 'Full Name',
                      hintText: 'e.g. Ramesh Kumar',
                      isRequired: true,
                      prefixIcon: const Icon(Icons.person_outline, size: 20),
                      textInputAction: TextInputAction.next,
                      onFieldSubmitted: (_) => _handleSubmit(),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) {
                          return 'Customer name is required.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),

                    // Phone Number Field (10 digits numeric only)
                    AppTextField(
                      controller: _phoneController,
                      label: 'Phone Number',
                      hintText: '10-digit mobile number',
                      isRequired: true,
                      keyboardType: TextInputType.phone,
                      maxLength: 10,
                      prefixIcon: const Icon(Icons.phone_outlined, size: 20),
                      textInputAction: TextInputAction.next,
                      onFieldSubmitted: (_) => _handleSubmit(),
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(10),
                      ],
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) {
                          return 'Phone number is required.';
                        }
                        if (val.trim().length != 10) {
                          return 'Phone number must be exactly 10 digits.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),

                    // Email Address Field (Optional)
                    AppTextField(
                      controller: _emailController,
                      label: 'Email Address',
                      hintText: 'e.g. ramesh@example.com (Optional)',
                      keyboardType: TextInputType.emailAddress,
                      prefixIcon: const Icon(Icons.email_outlined, size: 20),
                      textInputAction: TextInputAction.next,
                      onFieldSubmitted: (_) => _handleSubmit(),
                    ),
                    const SizedBox(height: 14),

                    // Address / City Field (Optional)
                    AppTextField(
                      controller: _addressController,
                      label: 'Address / City',
                      hintText: 'e.g. 12 Anna Salai, Chennai (Optional)',
                      prefixIcon: const Icon(Icons.location_on_outlined, size: 20),
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _handleSubmit(),
                    ),
                    const SizedBox(height: 20),

                    // Action Buttons
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              side: const BorderSide(color: AppColors.border),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: const Text(
                              'Cancel',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 2,
                          child: AppButton(
                            key: const Key('save_customer_button'),
                            label: 'Save Changes',
                            icon: Icons.save_rounded,
                            isLoading: _isSubmitting,
                            onPressed: _isSubmitting ? null : _handleSubmit,
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
