import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../models/showroom_billing_model.dart';

class RecordPaymentModalSheet extends StatefulWidget {
  final double remainingBalance;
  final Future<bool> Function(RecordShowroomPaymentRequest request) onSave;

  const RecordPaymentModalSheet({
    super.key,
    required this.remainingBalance,
    required this.onSave,
  });

  @override
  State<RecordPaymentModalSheet> createState() =>
      _RecordPaymentModalSheetState();
}

class _RecordPaymentModalSheetState extends State<RecordPaymentModalSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _amountController;
  final TextEditingController _referenceController = TextEditingController();
  final TextEditingController _notesController = TextEditingController();

  String _paymentMethod = 'Cash';
  bool _isSaving = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    final initialAmount = widget.remainingBalance > 0
        ? widget.remainingBalance
              .toStringAsFixed(2)
              .replaceAll(RegExp(r'\.00$'), '')
        : '';
    _amountController = TextEditingController(text: initialAmount);
  }

  @override
  void dispose() {
    _amountController.dispose();
    _referenceController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  String _formatCurrency(double val) {
    return NumberFormat.currency(
      locale: 'en_IN',
      symbol: '₹',
      decimalDigits: 2,
    ).format(val);
  }

  Future<void> _handleSubmit() async {
    setState(() => _errorMessage = null);

    if (!_formKey.currentState!.validate()) {
      return;
    }

    final amt = double.tryParse(_amountController.text.trim());
    if (amt == null || amt <= 0) {
      setState(() {
        _errorMessage =
            'Please enter a valid payment amount greater than zero.';
      });
      return;
    }

    if (amt > widget.remainingBalance) {
      setState(() {
        _errorMessage =
            'Payment amount cannot exceed remaining balance of ${_formatCurrency(widget.remainingBalance)}';
      });
      return;
    }

    setState(() => _isSaving = true);

    final request = RecordShowroomPaymentRequest(
      amount: amt,
      paymentMethod: _paymentMethod,
      reference: _referenceController.text.trim().isNotEmpty
          ? _referenceController.text.trim()
          : null,
      notes: _notesController.text.trim().isNotEmpty
          ? _notesController.text.trim()
          : null,
      paymentDate: DateTime.now(),
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
                      color: AppColors.success.withAlpha(25),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.payments_rounded,
                      color: AppColors.success,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Record Payment',
                          style: AppTextStyles.headingSmall.copyWith(
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        Text(
                          'Remaining Balance: ${_formatCurrency(widget.remainingBalance)}',
                          style: AppTextStyles.bodySmall.copyWith(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
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

              // Payment Amount Field
              Text(
                'Payment Amount (₹) *',
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
                    return 'Payment amount is required';
                  }
                  final parsed = double.tryParse(value.trim());
                  if (parsed == null || parsed <= 0) {
                    return 'Please enter an amount greater than 0';
                  }
                  if (parsed > widget.remainingBalance) {
                    return 'Payment amount cannot exceed remaining balance of ${_formatCurrency(widget.remainingBalance)}';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Payment Method Selector
              Text(
                'Payment Method *',
                style: AppTextStyles.labelMedium.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _buildMethodChip('Cash', Icons.money_rounded),
                  _buildMethodChip('UPI', Icons.qr_code_2_rounded),
                  _buildMethodChip('Card', Icons.credit_card_rounded),
                  _buildMethodChip(
                    'Bank Transfer',
                    Icons.account_balance_rounded,
                    valueOverride: 'BankTransfer',
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Reference / Txn ID
              Text(
                'Transaction Reference (Optional)',
                style: AppTextStyles.labelMedium.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _referenceController,
                decoration: InputDecoration(
                  hintText: 'e.g. UPI Ref, Cheque No, Auth Code',
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
              const SizedBox(height: 16),

              // Notes
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
                  hintText: 'Add remarks regarding this payment...',
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

              // Submit Button
              AppButton(
                label: 'Record Payment',
                isLoading: _isSaving,
                onPressed: _handleSubmit,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMethodChip(
    String label,
    IconData icon, {
    String? valueOverride,
  }) {
    final value = valueOverride ?? label;
    final isSelected = _paymentMethod == value;

    return ChoiceChip(
      avatar: Icon(
        icon,
        size: 16,
        color: isSelected ? Colors.white : AppColors.textSecondary,
      ),
      label: Text(label),
      selected: isSelected,
      onSelected: (selected) {
        if (selected) {
          setState(() => _paymentMethod = value);
        }
      },
      selectedColor: AppColors.primary,
      backgroundColor: Colors.white,
      labelStyle: TextStyle(
        fontSize: 13,
        fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
        color: isSelected ? Colors.white : AppColors.textPrimary,
      ),
      side: BorderSide(
        color: isSelected ? AppColors.primary : AppColors.border,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    );
  }
}
