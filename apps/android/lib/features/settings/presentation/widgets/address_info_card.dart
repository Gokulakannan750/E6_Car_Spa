import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../shared/widgets/app_text_field.dart';

class AddressInfoCard extends StatelessWidget {
  final TextEditingController address1Controller;
  final TextEditingController address2Controller;
  final TextEditingController cityController;
  final TextEditingController stateController;
  final TextEditingController postalCodeController;
  final bool isEnabled;

  const AddressInfoCard({
    super.key,
    required this.address1Controller,
    required this.address2Controller,
    required this.cityController,
    required this.stateController,
    required this.postalCodeController,
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
                  Icons.location_on_outlined,
                  color: AppColors.primary,
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              const Text(
                'Registered Address',
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
            controller: address1Controller,
            label: 'Address Line 1',
            hintText: 'e.g. 36, Geetha Nagar Main Road',
            isRequired: true,
            isEnabled: isEnabled,
            prefixIcon: const Icon(Icons.home_outlined, size: 20),
            validator: (val) {
              if (val == null || val.trim().isEmpty) {
                return 'Address Line 1 is required';
              }
              if (val.trim().length > 200) {
                return 'Address Line 1 cannot exceed 200 characters';
              }
              return null;
            },
          ),
          const SizedBox(height: 14),
          AppTextField(
            controller: address2Controller,
            label: 'Address Line 2 (Optional)',
            hintText: 'e.g. Behind Sakthi Mahal, Perundurai Road',
            isRequired: false,
            isEnabled: isEnabled,
            prefixIcon: const Icon(Icons.signpost_outlined, size: 20),
            validator: (val) {
              if (val != null && val.trim().length > 200) {
                return 'Address Line 2 cannot exceed 200 characters';
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
                  controller: cityController,
                  label: 'City',
                  hintText: 'e.g. Erode',
                  isRequired: true,
                  isEnabled: isEnabled,
                  prefixIcon: const Icon(Icons.location_city_outlined, size: 20),
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) {
                      return 'City is required';
                    }
                    if (val.trim().length > 100) {
                      return 'City cannot exceed 100 chars';
                    }
                    return null;
                  },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: AppTextField(
                  controller: stateController,
                  label: 'State',
                  hintText: 'e.g. Tamil Nadu',
                  isRequired: true,
                  isEnabled: isEnabled,
                  prefixIcon: const Icon(Icons.map_outlined, size: 20),
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) {
                      return 'State is required';
                    }
                    if (val.trim().length > 100) {
                      return 'State cannot exceed 100 chars';
                    }
                    return null;
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          AppTextField(
            controller: postalCodeController,
            label: 'PIN / Postal Code',
            hintText: 'e.g. 638011',
            isRequired: true,
            isEnabled: isEnabled,
            keyboardType: TextInputType.number,
            prefixIcon: const Icon(Icons.pin_drop_outlined, size: 20),
            validator: (val) {
              if (val == null || val.trim().isEmpty) {
                return 'PIN code is required';
              }
              if (val.trim().length > 20) {
                return 'PIN code cannot exceed 20 chars';
              }
              return null;
            },
          ),
        ],
      ),
    );
  }
}
