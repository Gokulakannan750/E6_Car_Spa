import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../models/staff_salary_models.dart';
import '../../providers/staff_salary_providers.dart';

class SettleSalaryBottomSheet extends ConsumerStatefulWidget {
  final StaffSalaryItem item;

  const SettleSalaryBottomSheet({
    super.key,
    required this.item,
  });

  static Future<void> show(BuildContext context, StaffSalaryItem item) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => SettleSalaryBottomSheet(item: item),
    );
  }

  @override
  ConsumerState<SettleSalaryBottomSheet> createState() => _SettleSalaryBottomSheetState();
}

class _SettleSalaryBottomSheetState extends ConsumerState<SettleSalaryBottomSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _notesController;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _notesController = TextEditingController(text: widget.item.notes ?? '');
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _handleSettle() async {
    final enteredSalary = widget.item.enteredSalary ?? 0.0;
    if (enteredSalary <= 0) {
      setState(() {
        _errorMessage = 'Entered salary must be greater than zero to settle.';
      });
      return;
    }

    setState(() {
      _errorMessage = null;
    });

    final error = await ref.read(salaryActionProvider.notifier).settleSalary(
      staffId: widget.item.staffId,
      periodFrom: widget.item.periodFrom,
      periodTo: widget.item.periodTo,
      enteredSalary: enteredSalary,
      notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
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

  @override
  Widget build(BuildContext context) {
    final actionState = ref.watch(salaryActionProvider);
    final item = widget.item;
    final enteredSalary = item.enteredSalary ?? 0.0;
    final advance = item.outstandingAdvance;
    final advanceDeduction = min(advance, enteredSalary);
    final finalSalary = max(0.0, enteredSalary - advanceDeduction);
    final remainingAdvance = max(0.0, advance - enteredSalary);

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
                        'Confirm Salary Settlement',
                        style: AppTextStyles.headingMedium.copyWith(fontWeight: FontWeight.w700),
                      ),
                      Text(
                        '${item.staffName} (${item.periodFrom} to ${item.periodTo})',
                        style: AppTextStyles.bodySmall.copyWith(color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: AppColors.textSecondary),
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
                    style: const TextStyle(color: AppColors.error, fontSize: 12),
                  ),
                ),

              // Settlement Summary Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  children: [
                    _buildRow('Gross Entered Salary', '₹${enteredSalary.toStringAsFixed(2)}'),
                    const SizedBox(height: 8),
                    _buildRow(
                      'Advance Recovery Deduction',
                      '-₹${advanceDeduction.toStringAsFixed(2)}',
                      color: AppColors.warningDark,
                      isBold: true,
                    ),
                    const Divider(height: 20, color: AppColors.border),
                    _buildRow(
                      'Final Payout Amount',
                      '₹${finalSalary.toStringAsFixed(2)}',
                      color: AppColors.success,
                      isBold: true,
                      fontSize: 16,
                    ),
                    const SizedBox(height: 8),
                    _buildRow('Remaining Advance After Settlement', '₹${remainingAdvance.toStringAsFixed(2)}'),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              // Notice
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.warningLight,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.warningDark.withAlpha(60)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Icon(Icons.info_outline_rounded, size: 18, color: AppColors.warningDark),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Settlement is authoritative and atomic. Recovered advances will be settled and this payroll record will be permanently locked.',
                        style: TextStyle(fontSize: 11, color: AppColors.warningDark),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              AppTextField(
                controller: _notesController,
                label: 'Settlement Remarks (Optional)',
                hintText: 'e.g. Bank transfer reference or payment mode',
                maxLines: 2,
              ),
              const SizedBox(height: 24),

              AppButton(
                label: 'Confirm & Disburse Settlement',
                icon: Icons.check_circle_outline_rounded,
                isLoading: actionState.isSubmitting,
                onPressed: actionState.isSubmitting ? null : _handleSettle,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRow(
    String label,
    String value, {
    Color? color,
    bool isBold = false,
    double fontSize = 13,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: fontSize,
            fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
            color: AppColors.textSecondary,
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
