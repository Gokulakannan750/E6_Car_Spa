import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_modal_header.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../staff/models/staff_model.dart';
import '../../models/staff_advance_request_models.dart';

class CreateAdvanceBottomSheet extends StatefulWidget {
  final List<Staff> activeStaff;
  final Future<String?> Function(CreateStaffAdvanceRequest request) onSubmit;
  final String? initialStaffId;

  const CreateAdvanceBottomSheet({
    super.key,
    required this.activeStaff,
    required this.onSubmit,
    this.initialStaffId,
  });

  @override
  State<CreateAdvanceBottomSheet> createState() => _CreateAdvanceBottomSheetState();
}

class _CreateAdvanceBottomSheetState extends State<CreateAdvanceBottomSheet> {
  final _formKey = GlobalKey<FormState>();
  String? _selectedStaffId;
  final _amountController = TextEditingController();
  final _customReasonController = TextEditingController();
  final _notesController = TextEditingController();

  DateTime _selectedDate = DateTime.now();
  String _selectedReasonPreset = 'Personal Advance';
  bool _isCustomReason = false;
  bool _isLoading = false;
  String? _errorMessage;

  static const List<String> _reasonPresets = [
    'Personal Advance',
    'Medical',
    'Emergency',
    'Salary Advance',
    'Festival Advance',
    'Other (Custom)',
  ];

  @override
  void initState() {
    super.initState();
    if (widget.initialStaffId != null &&
        widget.activeStaff.any((s) => s.id == widget.initialStaffId)) {
      _selectedStaffId = widget.initialStaffId;
    } else if (widget.activeStaff.isNotEmpty) {
      _selectedStaffId = widget.activeStaff.first.id;
    }
  }

  @override
  void dispose() {
    _amountController.dispose();
    _customReasonController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 30)),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: AppColors.primary,
              onPrimary: Colors.white,
              onSurface: AppColors.textPrimary,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _selectedDate = picked;
      });
    }
  }

  Future<void> _handleSubmit() async {
    if (_isLoading) return;

    if (_selectedStaffId == null || _selectedStaffId!.isEmpty) {
      setState(() {
        _errorMessage = 'Please select a staff member.';
      });
      return;
    }

    final rawAmount = double.tryParse(_amountController.text.trim()) ?? 0.0;
    if (rawAmount <= 0.0) {
      setState(() {
        _errorMessage = 'Please enter a valid advance amount greater than ₹0.';
      });
      return;
    }

    if (rawAmount > 999999.99) {
      setState(() {
        _errorMessage = 'Amount cannot exceed ₹999,999.99.';
      });
      return;
    }

    final reason = _isCustomReason
        ? _customReasonController.text.trim()
        : _selectedReasonPreset;

    if (reason.isEmpty) {
      setState(() {
        _errorMessage = 'Please specify a reason for the advance.';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final request = CreateStaffAdvanceRequest(
      staffId: _selectedStaffId!,
      amount: rawAmount,
      advanceDate: _selectedDate,
      reason: reason,
      notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
    );

    final error = await widget.onSubmit(request);

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

  String _formatDate(DateTime date) {
    final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${date.day} ${months[date.month - 1]} ${date.year}';
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
          const AppModalHeader(
            title: 'Disburse Staff Advance',
            subtitle: 'Issue an advance to an employee for salary recovery',
            icon: Icons.payments_outlined,
            iconBgColor: AppColors.readyBg,
            iconColor: AppColors.success,
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
                    if (_errorMessage != null)
                      Container(
                        margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: AppColors.error.withAlpha(20),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.error.withAlpha(80)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: AppColors.error, size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: AppTextStyles.bodySmall.copyWith(
                            color: AppColors.error,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

              // Field 1: Staff Selector
              Text(
                'Staff Member *',
                style: AppTextStyles.labelMedium.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              if (widget.activeStaff.isEmpty)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.qualityCheckBg,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.qualityCheckBorder),
                  ),
                  child: Text(
                    'No active staff found. Please add a staff member first.',
                    style: AppTextStyles.bodySmall.copyWith(color: AppColors.warning),
                  ),
                )
              else
                DropdownButtonFormField<String>(
                  initialValue: _selectedStaffId,
                  decoration: InputDecoration(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                    ),
                  ),
                  items: widget.activeStaff.map((staff) {
                    return DropdownMenuItem<String>(
                      value: staff.id,
                      child: Text(
                        '${staff.name}${staff.role != null && staff.role!.isNotEmpty ? ' (${staff.role})' : ''}',
                        style: AppTextStyles.bodyMedium,
                      ),
                    );
                  }).toList(),
                  onChanged: _isLoading
                      ? null
                      : (val) {
                          setState(() {
                            _selectedStaffId = val;
                          });
                        },
                ),
              const SizedBox(height: 14),

              // Field 2: Amount
              Text(
                'Advance Amount (₹) *',
                style: AppTextStyles.labelMedium.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              AppTextField(
                controller: _amountController,
                hintText: 'e.g. 3000.00',
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                prefixIcon: const Icon(Icons.currency_rupee_rounded, size: 18, color: AppColors.textSecondary),
                isEnabled: !_isLoading,
              ),
              const SizedBox(height: 14),

              // Field 3: Date Picker
              Text(
                'Advance Date *',
                style: AppTextStyles.labelMedium.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              InkWell(
                onTap: _isLoading ? null : _pickDate,
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        _formatDate(_selectedDate),
                        style: AppTextStyles.bodyMedium.copyWith(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const Icon(Icons.calendar_today_outlined, size: 18, color: AppColors.primary),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // Field 4: Reason Preset
              Text(
                'Reason *',
                style: AppTextStyles.labelMedium.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: _reasonPresets.map((preset) {
                  final isSelected = (_isCustomReason && preset == 'Other (Custom)') ||
                      (!_isCustomReason && _selectedReasonPreset == preset);
                  return ChoiceChip(
                    label: Text(preset),
                    selected: isSelected,
                    selectedColor: AppColors.primary.withAlpha(30),
                    backgroundColor: AppColors.surface,
                    labelStyle: TextStyle(
                      fontSize: 12,
                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                      color: isSelected ? AppColors.primary : AppColors.textPrimary,
                    ),
                    side: BorderSide(
                      color: isSelected ? AppColors.primary : AppColors.border,
                    ),
                    onSelected: _isLoading
                        ? null
                        : (selected) {
                            if (selected) {
                              setState(() {
                                if (preset == 'Other (Custom)') {
                                  _isCustomReason = true;
                                } else {
                                  _isCustomReason = false;
                                  _selectedReasonPreset = preset;
                                }
                              });
                            }
                          },
                  );
                }).toList(),
              ),

              if (_isCustomReason) ...[
                const SizedBox(height: 8),
                AppTextField(
                  controller: _customReasonController,
                  hintText: 'Enter custom reason...',
                  isEnabled: !_isLoading,
                ),
              ],
              const SizedBox(height: 14),

              // Field 5: Notes
              Text(
                'Notes (Optional)',
                style: AppTextStyles.labelMedium.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              AppTextField(
                controller: _notesController,
                hintText: 'Additional notes or context...',
                maxLines: 2,
                isEnabled: !_isLoading,
              ),
              const SizedBox(height: 24),

              // Submit & Cancel Buttons
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
                      label: 'Disburse Advance',
                      icon: Icons.check_rounded,
                      isLoading: _isLoading,
                      onPressed: widget.activeStaff.isEmpty ? null : _handleSubmit,
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
