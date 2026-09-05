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

class EditServiceBottomSheet extends ConsumerStatefulWidget {
  final Service service;
  final VoidCallback? onSaved;

  const EditServiceBottomSheet({
    super.key,
    required this.service,
    this.onSaved,
  });

  static Future<bool?> show(
    BuildContext context, {
    required Service service,
    VoidCallback? onSaved,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => EditServiceBottomSheet(
        service: service,
        onSaved: onSaved,
      ),
    );
  }

  @override
  ConsumerState<EditServiceBottomSheet> createState() => _EditServiceBottomSheetState();
}

class _EditServiceBottomSheetState extends ConsumerState<EditServiceBottomSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _priceController;
  late final TextEditingController _durationController;
  late final TextEditingController _descriptionController;

  String? _selectedCategory;
  late bool _isActive;
  bool _isSubmitting = false;
  String? _errorMessage;

  static const List<String> _fallbackCategories = [
    'Exterior Detailing',
    'Interior Care',
    'Protection Packages',
    'Others',
  ];

  @override
  void initState() {
    super.initState();
    final s = widget.service;
    _nameController = TextEditingController(text: s.name);
    _priceController = TextEditingController(text: s.price.toStringAsFixed(2));
    _durationController = TextEditingController(text: s.durationMinutes != null ? s.durationMinutes.toString() : '');
    _descriptionController = TextEditingController(text: s.description ?? '');
    _selectedCategory = s.category;
    _isActive = s.isActive;
  }

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

    final price = double.tryParse(_priceController.text.trim());
    if (price == null || price < 0) {
      setState(() => _errorMessage = 'Please enter a valid price');
      return;
    }

    final duration = int.tryParse(_durationController.text.trim());

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final request = UpdateServiceRequest(
        name: _nameController.text.trim(),
        price: price,
        taxPercentage: widget.service.taxPercentage,
        category: _selectedCategory?.trim(),
        durationMinutes: duration,
        description: _descriptionController.text.trim().isEmpty ? null : _descriptionController.text.trim(),
        isActive: _isActive,
      );

      await ref.read(catalogueProvider.notifier).updateService(widget.service.id, request);
      widget.onSaved?.call();

      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _errorMessage = e.statusCode == 403
            ? 'Permission denied. You do not have permission to edit catalogue services.'
            : e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _errorMessage = 'Failed to update service. Please try again.';
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
    if (_selectedCategory != null && _selectedCategory!.isNotEmpty) {
      allCategories.add(_selectedCategory!);
    }
    final categoryList = allCategories.toList()..sort();

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
            title: 'Edit Service',
            subtitle: 'Update service pricing, details and category',
            icon: Icons.edit_outlined,
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
                      label: 'Service Name',
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
                        labelText: 'Category',
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
                      label: 'Price (₹)',
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
                      label: 'Estimated Duration (Minutes)',
                      hint: 'e.g. 60',
                      keyboardType: TextInputType.number,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      prefixIcon: const Icon(Icons.schedule),
                      validator: (val) {
                        if (val != null && val.trim().isNotEmpty) {
                          final num = int.tryParse(val.trim());
                          if (num == null || num < 1 || num > 1440) return 'Enter 1 to 1440 minutes';
                        }
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
                            label: 'Save Changes',
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
