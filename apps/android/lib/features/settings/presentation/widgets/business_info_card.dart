import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../shared/widgets/app_text_field.dart';

class BusinessInfoCard extends StatelessWidget {
  final TextEditingController nameController;
  final TextEditingController phoneController;
  final TextEditingController emailController;
  final TextEditingController gstinController;
  final bool isEnabled;

  const BusinessInfoCard({
    super.key,
    required this.nameController,
    required this.phoneController,
    required this.emailController,
    required this.gstinController,
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
                  Icons.business_outlined,
                  color: AppColors.primary,
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              const Text(
                'Business Details',
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
            controller: nameController,
            label: 'Business Name',
            hintText: 'e.g. E6 Car Spa',
            isRequired: true,
            isEnabled: isEnabled,
            prefixIcon: const Icon(Icons.store_outlined, size: 20),
            validator: (val) {
              if (val == null || val.trim().isEmpty) {
                return 'Business name is required';
              }
              if (val.trim().length > 150) {
                return 'Business name cannot exceed 150 characters';
              }
              return null;
            },
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: AppTextField(
                  controller: phoneController,
                  label: 'Phone Number',
                  hintText: 'e.g. +91 9578749449',
                  isRequired: true,
                  isEnabled: isEnabled,
                  keyboardType: TextInputType.phone,
                  prefixIcon: const Icon(Icons.phone_outlined, size: 20),
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) {
                      return 'Phone number is required';
                    }
                    if (val.trim().length > 30) {
                      return 'Phone cannot exceed 30 chars';
                    }
                    return null;
                  },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: AppTextField(
                  controller: emailController,
                  label: 'Email Address',
                  hintText: 'e.g. e6carspaerd@gmail.com',
                  isRequired: true,
                  isEnabled: isEnabled,
                  keyboardType: TextInputType.emailAddress,
                  prefixIcon: const Icon(Icons.email_outlined, size: 20),
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) {
                      return 'Email is required';
                    }
                    final emailRegex = RegExp(
                      r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
                    );
                    if (!emailRegex.hasMatch(val.trim())) {
                      return 'Enter a valid email';
                    }
                    return null;
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          AppTextField(
            controller: gstinController,
            label: 'GSTIN (Tax Identification Number)',
            hintText: 'e.g. 33AAAAA0000A1Z5',
            isRequired: false,
            isEnabled: isEnabled,
            textCapitalization: TextCapitalization.characters,
            prefixIcon: const Icon(Icons.receipt_outlined, size: 20),
            helperText: 'Optional 15-character Indian GST format',
            validator: (val) {
              if (val != null && val.trim().isNotEmpty) {
                final gstinRegex = RegExp(
                  r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$',
                  caseSensitive: false,
                );
                if (!gstinRegex.hasMatch(val.trim())) {
                  return 'Invalid GSTIN format (e.g. 33AAAAA0000A1Z5)';
                }
              }
              return null;
            },
          ),
        ],
      ),
    );
  }
}
