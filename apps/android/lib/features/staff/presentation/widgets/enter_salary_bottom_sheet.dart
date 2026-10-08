import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../models/staff_salary_models.dart';
import '../../providers/staff_salary_providers.dart';
import 'settle_salary_bottom_sheet.dart';

class EnterSalaryBottomSheet extends ConsumerStatefulWidget {
  final StaffSalaryItem item;
  final bool canSettle;

  const EnterSalaryBottomSheet({
    super.key,
    required this.item,
    this.canSettle = false,
  });

  static Future<void> show(
    BuildContext context,
    StaffSalaryItem item, {
    bool canSettle = false,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) =>
          EnterSalaryBottomSheet(item: item, canSettle: canSettle),
    );
  }

  @override
  ConsumerState<EnterSalaryBottomSheet> createState() =>
      _EnterSalaryBottomSheetState();
}

class _EnterSalaryBottomSheetState
    extends ConsumerState<EnterSalaryBottomSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _salaryController;
  late final TextEditingController _notesController;
  double _enteredSalary = 0.0;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _enteredSalary = widget.item.enteredSalary ?? 0.0;
    _salaryController = TextEditingController(
      text: widget.item.enteredSalary != null
          ? widget.item.enteredSalary!.toStringAsFixed(0)
          : '',
    );
    _notesController = TextEditingController(text: widget.item.notes ?? '');
    _salaryController.addListener(_onSalaryChanged);
  }

  void _onSalaryChanged() {
    final parsed = double.tryParse(_salaryController.text.trim()) ?? 0.0;
    if (parsed != _enteredSalary) {
      setState(() {
        _enteredSalary = parsed;
      });
    }
  }

  @override
  void dispose() {
    _salaryController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _errorMessage = null;
    });

    final error = await ref
        .read(salaryActionProvider.notifier)
        .saveEnteredSalary(
          staffId: widget.item.staffId,
          periodFrom: widget.item.periodFrom,
          periodTo: widget.item.periodTo,
          enteredSalary: _enteredSalary,
          notes: _notesController.text.trim().isEmpty
              ? null
              : _notesController.text.trim(),
        );

    if (!mounted) return;

    if (error != null) {
      setState(() {
        _errorMessage = error;
      });
    } else {
      Navigator.pop(context);
    }
  }

  void _handleProceedToSettle() {
    if (!_formKey.currentState!.validate()) return;

    final updatedItem = StaffSalaryItem(
      staffId: widget.item.staffId,
      staffName: widget.item.staffName,
      staffRole: widget.item.staffRole,
      staffPhoneNumber: widget.item.staffPhoneNumber,
      isActive: widget.item.isActive,
      periodFrom: widget.item.periodFrom,
      periodTo: widget.item.periodTo,
      enteredSalary: _enteredSalary,
      outstandingAdvance: widget.item.outstandingAdvance,
      advanceDeduction: min(widget.item.outstandingAdvance, _enteredSalary),
      finalSalary: max(
        0.0,
        _enteredSalary - min(widget.item.outstandingAdvance, _enteredSalary),
      ),
      remainingAdvance: max(
        0.0,
        widget.item.outstandingAdvance -
            min(widget.item.outstandingAdvance, _enteredSalary),
      ),
      status: 'Ready',
      notes: _notesController.text.trim().isEmpty
          ? null
          : _notesController.text.trim(),
      settlementId: widget.item.settlementId,
    );

    Navigator.pop(context);
    SettleSalaryBottomSheet.show(context, updatedItem);
  }

  @override
  Widget build(BuildContext context) {
    final actionState = ref.watch(salaryActionProvider);
    final advance = widget.item.outstandingAdvance;
    final advanceDeduction = min(advance, _enteredSalary);
    final finalSalary = max(0.0, _enteredSalary - advanceDeduction);
    final remainingAdvance = max(0.0, advance - advanceDeduction);
    final isEditing = widget.item.isReady;

    return Container(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        top: 20,
        left: 20,
        right: 20,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isEditing ? 'Edit Staff Salary' : 'Enter Staff Salary',
                        style: AppTextStyles.headingMedium.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        '${widget.item.staffName} (${widget.item.periodFrom} to ${widget.item.periodTo})',
                        style: AppTextStyles.bodySmall.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(
                      Icons.close_rounded,
                      color: AppColors.textSecondary,
                    ),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const Divider(height: 24, color: AppColors.border),

              if (_errorMessage != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.errorLight,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.error.withAlpha(60)),
                  ),
                  child: Text(
                    _errorMessage!,
                    style: const TextStyle(
                      color: AppColors.error,
                      fontSize: 12,
                    ),
                  ),
                ),

              // Salary input field
              AppTextField(
                controller: _salaryController,
                label: 'Entered Salary Amount (₹) *',
                hintText: 'e.g. 18000',
                keyboardType: TextInputType.number,
                prefixIcon: const Icon(Icons.currency_rupee_rounded, size: 18),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Please enter a salary amount';
                  }
                  final numVal = double.tryParse(val.trim());
                  if (numVal == null || numVal < 0) {
                    return 'Please enter a valid salary amount (₹0 or greater)';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 14),

              // Notes
              AppTextField(
                controller: _notesController,
                label: 'Payroll Notes (Optional)',
                hintText: 'e.g. Regular monthly payout or adjustment',
                maxLines: 2,
              ),
              const SizedBox(height: 16),

              // Live Calculation Card
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Live Payroll Calculation Breakdown',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const Divider(height: 16, color: AppColors.border),
                    _buildCalcRow(
                      'Entered Gross Salary',
                      '₹${_enteredSalary.toStringAsFixed(2)}',
                      isBold: false,
                    ),
                    const SizedBox(height: 6),
                    _buildCalcRow(
                      'Applicable Advance (through Period To)',
                      '₹${advance.toStringAsFixed(2)}',
                      color: AppColors.warningDark,
                    ),
                    const SizedBox(height: 6),
                    _buildCalcRow(
                      'Advance Recovery Deduction',
                      '- ₹${advanceDeduction.toStringAsFixed(2)}',
                      color: AppColors.error,
                      isBold: true,
                    ),
                    const Divider(height: 14, color: AppColors.border),
                    _buildCalcRow(
                      'Net Final Payable Salary',
                      '₹${finalSalary.toStringAsFixed(2)}',
                      color: AppColors.success,
                      isBold: true,
                      fontSize: 14,
                    ),
                    const SizedBox(height: 4),
                    _buildCalcRow(
                      'Remaining Advance Balance',
                      '₹${remainingAdvance.toStringAsFixed(2)}',
                      color: AppColors.textSecondary,
                      fontSize: 11,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Action Buttons
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        side: BorderSide(color: AppColors.primary),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      onPressed: actionState.isSubmitting
                          ? null
                          : _handleSubmit,
                      child: actionState.isSubmitting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(
                              'Save Salary',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: AppColors.primary,
                              ),
                            ),
                    ),
                  ),
                  if (widget.canSettle) ...[
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.success,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        icon: const Icon(
                          Icons.check_circle_outline_rounded,
                          size: 16,
                        ),
                        label: const Text(
                          'Proceed to Settle',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                        onPressed: actionState.isSubmitting
                            ? null
                            : _handleProceedToSettle,
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCalcRow(
    String label,
    String value, {
    Color? color,
    bool isBold = false,
    double fontSize = 12,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
              color: AppColors.textSecondary,
            ),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: fontSize,
            fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
            color: color ?? AppColors.textPrimary,
          ),
        ),
      ],
    );
  }
}
