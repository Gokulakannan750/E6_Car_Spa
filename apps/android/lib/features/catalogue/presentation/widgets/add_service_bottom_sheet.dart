import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_modal_header.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../models/service_model.dart';
import '../providers/catalogue_providers.dart';

class AddServiceBottomSheet extends ConsumerStatefulWidget {
  final VoidCallback? onCreated;

  const AddServiceBottomSheet({
    super.key,
    this.onCreated,
  });

  static Future<bool?> show(
    BuildContext context, {
    VoidCallback? onCreated,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => AddServiceBottomSheet(
        onCreated: onCreated,
      ),
    );
  }

  @override
  ConsumerState<AddServiceBottomSheet> createState() => _AddServiceBottomSheetState();
}

class _AddServiceBottomSheetState extends ConsumerState<AddServiceBottomSheet> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _priceController = TextEditingController();
  final _durationController = TextEditingController(text: '60');
  final _descriptionController = TextEditingController();

  String? _selectedCategory;
  bool _isActive = true;
  bool _isSubmitting = false;
  String? _errorMessage;

  static const List<String> _fallbackCategories = [
    'Exterior Detailing',
    'Interior Care',
    'Protection Packages',
    'Others',
  ];

  @override
  void dispose() {
    _nameController.dispose();
    _priceController.dispose();
    _durationController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    if (_selectedCategory == null || _selectedCategory!.trim().isEmpty) {
      setState(() => _errorMessage = 'Please select a service category.');
      return;
    }

    final price = double.tryParse(_priceController.text.trim());
    if (price == null || price < 0) {
      setState(() => _errorMessage = 'Please enter a valid price amount');
      return;
    }

    final durationText = _durationController.text.trim();
    final duration = int.tryParse(durationText);
    if (duration == null || duration < 1 || duration > 1440) {
      setState(() => _errorMessage = 'Please enter a valid duration between 1 and 1440 minutes');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final request = CreateServiceRequest(
        name: _nameController.text.trim(),
        category: _selectedCategory!.trim(),
        price: price,
        durationMinutes: duration,
        description: _descriptionController.text.trim().isEmpty ? null : _descriptionController.text.trim(),
        taxPercentage: 18.0,
        isActive: _isActive,
      );

      await ref.read(catalogueProvider.notifier).createService(request);
      widget.onCreated?.call();

      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _errorMessage = e.statusCode == 403
            ? 'Permission denied. You do not have permission to create catalogue services.'
            : e.statusCode == 409
                ? 'A service with this name already exists.'
                : e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _errorMessage = 'Failed to create service. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final categoriesAsync = ref.watch(serviceCategoriesProvider);

    final Set<String> allCategories = {};
    categoriesAsync.whenData((cats) => allCategories.addAll(cats));
    if (allCategories.isEmpty) {
      allCategories.addAll(_fallbackCategories);
    }
    final categoryList = allCategories.toList()..sort();
    if (_selectedCategory == null && categoryList.isNotEmpty) {
      _selectedCategory = categoryList.first;
    }

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
          // Modal Header
          const AppModalHeader(
            title: 'Add Service',
            subtitle: 'Create a new service for your catalogue',
            icon: Icons.add_circle_outline,
            iconBgColor: AppColors.accentPill,
            iconColor: AppColors.primary,
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

                    // Service Name
                    AppTextField(
                      controller: _nameController,
                      label: 'Service Name *',
                      hint: 'e.g. Premium Foam Wash',
                      prefixIcon: const Icon(Icons.build_circle_outlined),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) return 'Service name is required';
                        if (val.trim().length > 100) return 'Name cannot exceed 100 characters';
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),

                    // Category Dropdown
                    DropdownButtonFormField<String>(
                      initialValue: _selectedCategory != null && categoryList.contains(_selectedCategory)
                          ? _selectedCategory
                          : (categoryList.isNotEmpty ? categoryList.first : null),
                      decoration: InputDecoration(
                        labelText: 'Category *',
                        prefixIcon: const Icon(Icons.category_outlined, color: AppColors.textSecondary),
                        border: const OutlineInputBorder(),
                        enabledBorder: const OutlineInputBorder(
                          borderSide: BorderSide(color: AppColors.border),
                        ),
                        focusedBorder: const OutlineInputBorder(
                          borderSide: BorderSide(color: AppColors.accent, width: 2),
                        ),
                        filled: true,
                        fillColor: AppColors.card,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      ),
                      items: categoryList.map((cat) {
                        return DropdownMenuItem<String>(
                          value: cat,
                          child: Text(cat, style: AppTextStyles.bodyMedium),
                        );
                      }).toList(),
                      onChanged: (val) {
                        setState(() {
                          _selectedCategory = val;
                        });
                      },
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) return 'Category is required';
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),

                    // Price
                    AppTextField(
                      controller: _priceController,
                      label: 'Price (₹) *',
                      hint: 'e.g. 650',
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      prefixIcon: const Icon(Icons.currency_rupee),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) return 'Price is required';
                        final num = double.tryParse(val.trim());
                        if (num == null || num < 0) return 'Enter valid amount';
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),

                    // Duration (Minutes)
                    AppTextField(
                      controller: _durationController,
                      label: 'Estimated Duration (Minutes) *',
                      hint: 'e.g. 60',
                      keyboardType: TextInputType.number,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      prefixIcon: const Icon(Icons.schedule),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) return 'Duration is required';
                        final num = int.tryParse(val.trim());
                        if (num == null || num < 1 || num > 1440) return 'Enter 1 to 1440 minutes';
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),

                    // Description
                    AppTextField(
                      controller: _descriptionController,
                      label: 'Description / Scope (Optional)',
                      hint: 'Details about the service package...',
                      prefixIcon: const Icon(Icons.notes_rounded),
                      maxLines: 2,
                      validator: (val) {
                        if (val != null && val.trim().length > 500) {
                          return 'Description cannot exceed 500 characters';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),

                    // Active Toggle
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
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Service Active Status',
                                style: AppTextStyles.labelLarge.copyWith(fontWeight: FontWeight.w600),
                              ),
                              Text(
                                _isActive ? 'Available for job card booking' : 'Hidden from new job cards',
                                style: AppTextStyles.bodySmall.copyWith(color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                          Switch.adaptive(
                            value: _isActive,
                            activeTrackColor: AppColors.primary,
                            onChanged: (val) => setState(() => _isActive = val),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Buttons
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
                            child: const Text(
                              'Cancel',
                              style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 2,
                          child: AppButton(
                            key: const Key('modal_add_service_button'),
                            label: 'Add Service',
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
