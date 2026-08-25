import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../catalogue/data/service_repository.dart';
import '../../../catalogue/models/service_model.dart';

class AddCustomServiceDialog extends ConsumerStatefulWidget {
  final Function(Service)? onCreated;

  const AddCustomServiceDialog({
    super.key,
    this.onCreated,
  });

  static Future<Service?> show(
    BuildContext context, {
    Function(Service)? onCreated,
  }) {
    return showModalBottomSheet<Service>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => AddCustomServiceDialog(onCreated: onCreated),
    );
  }

  @override
  ConsumerState<AddCustomServiceDialog> createState() => _AddCustomServiceDialogState();
}

class _AddCustomServiceDialogState extends ConsumerState<AddCustomServiceDialog> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _priceController = TextEditingController();
  final _categoryController = TextEditingController(text: 'General Detailing');
  final _descriptionController = TextEditingController();

  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _nameController.dispose();
    _priceController.dispose();
    _categoryController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final price = double.tryParse(_priceController.text.trim());
    if (price == null || price < 0) {
      setState(() => _errorMessage = 'Please enter a valid price amount');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final request = CreateServiceRequest(
        name: _nameController.text.trim(),
        price: price,
        category: _categoryController.text.trim().isEmpty ? 'General Detailing' : _categoryController.text.trim(),
        description: _descriptionController.text.trim().isEmpty ? null : _descriptionController.text.trim(),
        taxPercentage: 18.0,
        isActive: true,
      );

      final service = await ref.read(serviceRepositoryProvider).createService(request);
      widget.onCreated?.call(service);

      if (mounted) {
        Navigator.of(context).pop(service);
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
        top: 24,
        bottom: 24 + bottomInset,
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppColors.accentPill,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.add_task_rounded, color: AppColors.primary, size: 20),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        'Add Custom Service',
                        style: AppTextStyles.headingLarge,
                      ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const SizedBox(height: 16),
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
                label: 'Service Name',
                hint: 'e.g. Custom Scratch Removal & Polish',
                prefixIcon: const Icon(Icons.build_circle_outlined),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) return 'Service name is required';
                  return null;
                },
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: AppTextField(
                      controller: _priceController,
                      label: 'Price (₹)',
                      hint: 'e.g. 1500',
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      prefixIcon: const Icon(Icons.currency_rupee),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) return 'Price is required';
                        if (double.tryParse(val.trim()) == null) return 'Enter a number';
                        return null;
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: AppTextField(
                      controller: _categoryController,
                      label: 'Category (Optional)',
                      hint: 'e.g. Detailing',
                      prefixIcon: const Icon(Icons.category_outlined),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              AppTextField(
                controller: _descriptionController,
                label: 'Description / Scope (Optional)',
                hint: 'e.g. Specific panel polishing and compound work',
                prefixIcon: const Icon(Icons.notes_rounded),
                maxLines: 2,
              ),
              const SizedBox(height: 24),
              AppButton(
                label: 'Add to Job Card',
                isLoading: _isSubmitting,
                onPressed: _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
