import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_modal_header.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../models/staff_advance_model.dart';

class ObsoleteAdvanceBottomSheet extends StatefulWidget {
  final StaffAdvance advance;
  final Future<String?> Function(String advanceId, String reason) onObsolete;

  const ObsoleteAdvanceBottomSheet({
    super.key,
    required this.advance,
    required this.onObsolete,
  });

  @override
  State<ObsoleteAdvanceBottomSheet> createState() => _ObsoleteAdvanceBottomSheetState();
}

class _ObsoleteAdvanceBottomSheetState extends State<ObsoleteAdvanceBottomSheet> {
  final _customReasonController = TextEditingController();
  String _selectedReasonPreset = 'Wrongly entered';
  bool _isCustomReason = false;
  bool _isLoading = false;
  String? _errorMessage;

  static const List<String> _reasonPresets = [
    'Wrongly entered',
    'Wrong staff selected',
    'Incorrect amount',
    'Duplicate advance',
    'Entered by mistake',
    'Other (Custom)',
  ];

  @override
  void dispose() {
    _customReasonController.dispose();
    super.dispose();
  }

  String _formatCurrency(double amount) {
    final parts = amount.toStringAsFixed(2).split('.');
    final integerPart = parts[0];
    final decimalPart = parts[1];

    final reg = RegExp(r'(\d+?)(?=(\d\d)+(\d)(?!\d))');
    final formattedInt = integerPart.replaceAllMapped(reg, (Match m) => '${m[1]},');
    return '₹$formattedInt.$decimalPart';
  }

  Future<void> _handleSubmit() async {
    if (_isLoading) return;

    final reason = _isCustomReason
        ? _customReasonController.text.trim()
        : _selectedReasonPreset;

    if (reason.length < 3) {
      setState(() {
        _errorMessage = 'Reason must be at least 3 characters long.';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final error = await widget.onObsolete(widget.advance.id, reason);

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
            title: 'Mark Advance Obsolete',
            subtitle: 'Void this advance if created by mistake',
            icon: Icons.block_rounded,
            iconBgColor: Color(0x20EF4444),
            iconColor: AppColors.error,
            showDragHandle: true,
          ),
          const SizedBox(height: 14),

          Flexible(
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (_errorMessage != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 14),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.error.withAlpha(20),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.error.withAlpha(80)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline, color: AppColors.error, size: 16),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _errorMessage!,
                        style: AppTextStyles.bodySmall.copyWith(color: AppColors.error),
                      ),
                    ),
                  ],
                ),
              ),

            Text(
              'Marking this advance obsolete will exclude it from all active financial balances and reports. This action cannot be undone.',
              style: AppTextStyles.bodySmall.copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 12),

            // Advance mini info
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    widget.advance.staffName,
                    style: AppTextStyles.bodyMedium.copyWith(fontWeight: FontWeight.w600),
                  ),
                  Text(
                    _formatCurrency(widget.advance.amount),
                    style: AppTextStyles.bodyMedium.copyWith(
                      fontFamily: 'monospace',
                      fontWeight: FontWeight.w700,
                      color: AppColors.error,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Reason presets
            Text(
              'Reason for Obsoleting *',
              style: AppTextStyles.labelMedium.copyWith(
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: _reasonPresets.map((preset) {
                final isSelected = (_isCustomReason && preset == 'Other (Custom)') ||
                    (!_isCustomReason && _selectedReasonPreset == preset);
                return ChoiceChip(
                  label: Text(preset),
                  selected: isSelected,
                  selectedColor: AppColors.error.withAlpha(20),
                  backgroundColor: AppColors.surface,
                  labelStyle: TextStyle(
                    fontSize: 12,
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                    color: isSelected ? AppColors.error : AppColors.textPrimary,
                  ),
                  side: BorderSide(
                    color: isSelected ? AppColors.error : AppColors.border,
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
              const SizedBox(height: 10),
              AppTextField(
                controller: _customReasonController,
                hintText: 'Enter reason for obsoleting (min 3 chars)...',
                isEnabled: !_isLoading,
              ),
            ],
            const SizedBox(height: 24),

            // Action Buttons (Cancel + Confirm Obsolete)
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
                    label: 'Confirm Obsolete',
                    icon: Icons.block_rounded,
                    isLoading: _isLoading,
                    variant: AppButtonVariant.danger,
                    onPressed: _handleSubmit,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  ],
),
);
  }
}
