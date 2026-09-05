import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_modal_header.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../catalogue/data/service_repository.dart';
import '../../../catalogue/models/service_model.dart';
import '../../models/job_card_model.dart';
import '../../providers/job_card_providers.dart';
import 'add_custom_service_dialog.dart';

class EditJobCardSheet extends ConsumerStatefulWidget {
  final JobCard jobCard;
  final VoidCallback? onSaved;

  const EditJobCardSheet({
    super.key,
    required this.jobCard,
    this.onSaved,
  });

  static Future<bool?> show(
    BuildContext context, {
    required JobCard jobCard,
    VoidCallback? onSaved,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => EditJobCardSheet(
        jobCard: jobCard,
        onSaved: onSaved,
      ),
    );
  }

  @override
  ConsumerState<EditJobCardSheet> createState() => _EditJobCardSheetState();
}

class _EditableServiceRow {
  final String serviceId;
  final String serviceName;
  final double unitPrice;
  final double taxPercentage;
  int quantity;
  double discountAmount;

  _EditableServiceRow({
    required this.serviceId,
    required this.serviceName,
    required this.unitPrice,
    required this.taxPercentage,
    required this.quantity,
    this.discountAmount = 0.0,
  });

  double get lineTotal {
    final base = unitPrice * quantity;
    final tax = base * (taxPercentage / 100);
    return base + tax - discountAmount;
  }
}

class _EditJobCardSheetState extends ConsumerState<EditJobCardSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _notesController;
  late List<_EditableServiceRow> _services;

  List<Service> _availableServices = [];
  bool _isLoadingCatalogue = false;
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _notesController = TextEditingController(text: widget.jobCard.notes ?? '');
    _services = widget.jobCard.services.map((s) {
      return _EditableServiceRow(
        serviceId: s.serviceId,
        serviceName: s.serviceName,
        unitPrice: s.unitPrice,
        taxPercentage: s.taxPercentage,
        quantity: s.quantity,
        discountAmount: s.discountAmount,
      );
    }).toList();

    _loadAvailableServices();
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadAvailableServices() async {
    setState(() => _isLoadingCatalogue = true);
    try {
      final res = await ref.read(serviceRepositoryProvider).getServices(isActive: true, pageSize: 100);
      if (mounted) {
        setState(() {
          _availableServices = res.items;
          _isLoadingCatalogue = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isLoadingCatalogue = false);
      }
    }
  }

  double get _subtotal => _services.fold(0.0, (sum, s) => sum + (s.unitPrice * s.quantity));
  double get _taxAmount => _services.fold(0.0, (sum, s) => sum + (s.unitPrice * s.quantity * (s.taxPercentage / 100)));
  double get _discountAmount => _services.fold(0.0, (sum, s) => sum + s.discountAmount);
  double get _totalAmount => _subtotal + _taxAmount - _discountAmount;

  void _addService(Service svc) {
    final existingIndex = _services.indexWhere((s) => s.serviceId == svc.id);
    setState(() {
      if (existingIndex >= 0) {
        _services[existingIndex].quantity += 1;
      } else {
        _services.add(_EditableServiceRow(
          serviceId: svc.id,
          serviceName: svc.name,
          unitPrice: svc.price,
          taxPercentage: svc.taxPercentage,
          quantity: 1,
        ));
      }
    });
  }

  void _removeService(int index) {
    setState(() {
      _services.removeAt(index);
    });
  }

  void _updateQuantity(int index, int qty) {
    if (qty <= 0) {
      _removeService(index);
    } else {
      setState(() {
        _services[index].quantity = qty;
      });
    }
  }

  Future<void> _openServicePicker() async {
    final selected = await showModalBottomSheet<Service>(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.all(20),
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(ctx).size.height * 0.7,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const AppModalHeader(
              title: 'Add Service from Catalogue',
              subtitle: 'Select an active detailing service',
              icon: Icons.add_circle_outline,
              showDragHandle: true,
            ),
            const SizedBox(height: 12),
            if (_isLoadingCatalogue)
              const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator()))
            else if (_availableServices.isEmpty)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Text('No active catalogue services available.', textAlign: TextAlign.center),
              )
            else
              Expanded(
                child: ListView.separated(
                  itemCount: _availableServices.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (c, i) {
                    final svc = _availableServices[i];
                    return ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      title: Text(svc.name, style: AppTextStyles.bodyMedium.copyWith(fontWeight: FontWeight.w600)),
                      subtitle: svc.category != null ? Text(svc.category!, style: AppTextStyles.bodySmall) : null,
                      trailing: Text(
                        '₹${svc.price.toStringAsFixed(2)}',
                        style: AppTextStyles.bodyLarge.copyWith(fontWeight: FontWeight.w700, color: AppColors.primary),
                      ),
                      onTap: () => Navigator.of(ctx).pop(svc),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );

    if (selected != null) {
      _addService(selected);
    }
  }

  Future<void> _openCreateCustomService() async {
    final customSvc = await AddCustomServiceDialog.show(context);
    if (customSvc != null) {
      _addService(customSvc);
    }
  }

  Future<void> _handleSubmit() async {
    if (_services.isEmpty) {
      setState(() => _errorMessage = 'At least one service is required on a job card.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final request = UpdateJobCardServicesRequest(
        services: _services.map((s) {
          return JobCardServiceItemRequest(
            serviceId: s.serviceId,
            quantity: s.quantity,
            discountAmount: s.discountAmount,
          );
        }).toList(),
        notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
      );

      await ref.read(jobCardDetailsProvider(widget.jobCard.id).notifier).updateServices(request);
      ref.read(jobCardListProvider.notifier).loadJobCards();
      widget.onSaved?.call();

      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.statusCode == 409 || e.message.toLowerCase().contains('locked') || e.message.toLowerCase().contains('invoice')) {
        setState(() {
          _isSubmitting = false;
          _errorMessage = 'This job card is locked because its invoice has already been generated.';
        });
        ref.read(jobCardDetailsProvider(widget.jobCard.id).notifier).loadDetails();
      } else if (e.statusCode == 403) {
        setState(() {
          _isSubmitting = false;
          _errorMessage = 'Permission denied. You do not have permission to edit job cards.';
        });
      } else {
        setState(() {
          _isSubmitting = false;
          _errorMessage = e.message;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _errorMessage = 'Failed to update job card services. Please try again.';
      });
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
        left: 20,
        right: 20,
        top: 16,
        bottom: 24 + bottomInset,
      ),
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.9,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppModalHeader(
            title: 'Edit Job Card',
            subtitle: '${widget.jobCard.jobCardNumber} · ${widget.jobCard.vehicle.registrationNumber}',
            icon: Icons.edit_note_rounded,
            iconBgColor: AppColors.accentPill,
            iconColor: AppColors.primary,
            showDragHandle: true,
          ),
          const SizedBox(height: 12),

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
            const SizedBox(height: 12),
          ],

          Expanded(
            child: Form(
              key: _formKey,
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Services List Section
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Services (${_services.length})',
                          style: AppTextStyles.headingSmall,
                        ),
                        Row(
                          children: [
                            TextButton.icon(
                              key: const Key('add_custom_service_button'),
                              onPressed: _isSubmitting ? null : _openCreateCustomService,
                              icon: const Icon(Icons.add, size: 16),
                              label: const Text('Custom Service', style: TextStyle(fontSize: 12)),
                            ),
                            const SizedBox(width: 4),
                            FilledButton.tonalIcon(
                              key: const Key('add_catalogue_service_button'),
                              onPressed: _isSubmitting ? null : _openServicePicker,
                              icon: const Icon(Icons.add, size: 16),
                              label: const Text('Catalogue', style: TextStyle(fontSize: 12)),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),

                    if (_services.isEmpty) ...[
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceAlt,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: const Center(
                          child: Text(
                            'No services added. Click Catalogue or Custom Service to add.',
                            style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                          ),
                        ),
                      ),
                    ] else ...[
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: _services.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 8),
                        itemBuilder: (context, index) {
                          final item = _services[index];
                          return Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        item.serviceName,
                                        style: AppTextStyles.bodyMedium.copyWith(fontWeight: FontWeight.w600),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        '₹${item.unitPrice.toStringAsFixed(2)}',
                                        style: AppTextStyles.bodySmall,
                                      ),
                                    ],
                                  ),
                                ),
                                // Quantity selector
                                Row(
                                  children: [
                                    IconButton(
                                      icon: const Icon(Icons.remove_circle_outline, size: 20),
                                      visualDensity: VisualDensity.compact,
                                      onPressed: () => _updateQuantity(index, item.quantity - 1),
                                    ),
                                    Text(
                                      '${item.quantity}',
                                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.add_circle_outline, size: 20),
                                      visualDensity: VisualDensity.compact,
                                      onPressed: () => _updateQuantity(index, item.quantity + 1),
                                    ),
                                  ],
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  '₹${item.lineTotal.toStringAsFixed(2)}',
                                  style: AppTextStyles.bodyMedium.copyWith(
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.primary,
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.delete_outline, size: 18, color: AppColors.error),
                                  visualDensity: VisualDensity.compact,
                                  onPressed: () => _removeService(index),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ],
                    const SizedBox(height: 16),

                    // Notes Section
                    AppTextField(
                      controller: _notesController,
                      label: 'Job Notes / Instructions (Optional)',
                      hint: 'Special requests, vehicle condition remarks...',
                      prefixIcon: const Icon(Icons.note_alt_outlined),
                      maxLines: 3,
                    ),
                    const SizedBox(height: 16),

                    // Financial Summary Box
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceAlt,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Column(
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Subtotal', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                              Text('₹${_subtotal.toStringAsFixed(2)}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Tax (GST)', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                              Text('₹${_taxAmount.toStringAsFixed(2)}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                            ],
                          ),
                          const Divider(height: 16, color: AppColors.border),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Total Amount', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                              Text(
                                '₹${_totalAmount.toStringAsFixed(2)}',
                                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.primary),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ),
          ),

          // Actions
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
                  label: 'Save Changes',
                  isLoading: _isSubmitting,
                  onPressed: _handleSubmit,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
