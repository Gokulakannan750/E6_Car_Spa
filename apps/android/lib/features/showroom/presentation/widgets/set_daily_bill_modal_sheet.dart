import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../models/showroom_billing_model.dart';

class SetDailyBillModalSheet extends StatefulWidget {
  final ShowroomDailyBill? currentBill;
  final Future<bool> Function(SetShowroomDailyBillRequest request) onSave;

  const SetDailyBillModalSheet({
    super.key,
    this.currentBill,
    required this.onSave,
  });

  @override
  State<SetDailyBillModalSheet> createState() => _SetDailyBillModalSheetState();
}

class _SetDailyBillModalSheetState extends State<SetDailyBillModalSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _amountController;
  late final TextEditingController _notesController;

  bool _isSaving = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    final initialAmount = widget.currentBill?.amount;
    _amountController = TextEditingController(
      text: initialAmount != null && initialAmount > 0
          ? initialAmount.toStringAsFixed(2).replaceAll(RegExp(r'\.00$'), '')
          : '',
    );
    _notesController = TextEditingController(
      text: widget.currentBill?.notes ?? '',
    );
  }

  @override
  void dispose() {
    _amountController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    setState(() => _errorMessage = null);

    if (!_formKey.currentState!.validate()) {
      return;
    }

    final amt = double.tryParse(_amountController.text.trim());
    if (amt == null || amt < 0) {
      setState(() {
        _errorMessage =
            'Please enter a valid bill amount greater than or equal to 0.';
      });
      return;
    }

    setState(() => _isSaving = true);

    final request = SetShowroomDailyBillRequest(
      amount: amt,
      notes: _notesController.text.trim().isNotEmpty
          ? _notesController.text.trim()
          : null,
    );

    final success = await widget.onSave(request);

    if (!mounted) return;
    setState(() => _isSaving = false);

    if (success) {
      Navigator.of(context).pop(true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final isEditing =
        widget.currentBill != null && widget.currentBill!.amount > 0;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: bottomInset + 20,
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withAlpha(25),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      Icons.receipt_long_rounded,
                      color: AppColors.primary,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      isEditing ? 'Update Daily Bill' : 'Set Daily Bill',
                      style: AppTextStyles.headingSmall.copyWith(
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(
                      Icons.close,
                      color: AppColors.textSecondary,
                    ),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Error Banner
              if (_errorMessage != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.error.withAlpha(20),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.error.withAlpha(60)),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.error_outline,
                        color: AppColors.error,
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: AppTextStyles.bodySmall.copyWith(
                            color: AppColors.error,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Bill Amount Field
              Text(
                'Daily Bill Amount (₹) *',
                style: AppTextStyles.labelMedium.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _amountController,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
                ],
                decoration: InputDecoration(
                  hintText: '0.00',
                  prefixIcon: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    child: Text(
                      '₹',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(
                      color: AppColors.primary,
                      width: 1.5,
                    ),
                  ),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Bill amount is required';
                  }
                  final parsed = double.tryParse(value.trim());
                  if (parsed == null || parsed < 0) {
                    return 'Please enter a valid amount (>= 0)';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Notes Field
              Text(
                'Notes (Optional)',
                style: AppTextStyles.labelMedium.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _notesController,
                maxLines: 2,
                decoration: InputDecoration(
                  hintText: 'Add any remarks or details for this daily bill...',
                  hintStyle: AppTextStyles.bodyMedium.copyWith(
                    color: AppColors.textSecondary.withAlpha(150),
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(
                      color: AppColors.primary,
                      width: 1.5,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Save Button
              AppButton(
                label: isEditing ? 'Update Bill' : 'Save Daily Bill',
                isLoading: _isSaving,
                onPressed: _handleSubmit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
