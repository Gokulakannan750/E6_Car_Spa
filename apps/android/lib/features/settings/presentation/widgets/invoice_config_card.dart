import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../shared/widgets/app_text_field.dart';

class InvoiceConfigCard extends StatelessWidget {
  final TextEditingController prefixController;
  final TextEditingController termsController;
  final bool isEnabled;

  const InvoiceConfigCard({
    super.key,
    required this.prefixController,
    required this.termsController,
    required this.isEnabled,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.accentPill,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.receipt_long_outlined,
                  color: AppColors.primary,
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              const Text(
                'Invoice & Billing Configuration',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          AppTextField(
            controller: prefixController,
            label: 'Invoice Prefix',
            hintText: 'e.g. INV',
            isRequired: false,
            isEnabled: isEnabled,
            textCapitalization: TextCapitalization.characters,
            prefixIcon: const Icon(Icons.tag_outlined, size: 20),
            helperText: 'Default: INV (Generated numbers: INV-2026-000001)',
            validator: (val) {
              if (val != null && val.trim().length > 10) {
                return 'Prefix cannot exceed 10 characters';
              }
              return null;
            },
          ),
          const SizedBox(height: 14),
          AppTextField(
            controller: termsController,
            label: 'Standard Terms & Conditions',
            hintText: 'e.g. Payment due within 7 days. Goods once sold cannot be returned.',
            isRequired: false,
            isEnabled: isEnabled,
            maxLines: 3,
            prefixIcon: const Icon(Icons.description_outlined, size: 20),
            helperText: 'Appears at the footer of finalized PDF invoices',
            validator: (val) {
              if (val != null && val.trim().length > 2000) {
                return 'Terms cannot exceed 2000 characters';
              }
              return null;
            },
          ),
        ],
      ),
    );
  }
}
