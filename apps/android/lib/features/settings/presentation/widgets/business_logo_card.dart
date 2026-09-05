import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/utils/app_environment.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_confirm_dialog.dart';

class BusinessLogoCard extends StatelessWidget {
  final String? logoPath;
  final bool isUploading;
  final bool canManage;
  final ValueChanged<XFile> onUploadLogo;
  final VoidCallback onRemoveLogo;

  const BusinessLogoCard({
    super.key,
    this.logoPath,
    required this.isUploading,
    required this.canManage,
    required this.onUploadLogo,
    required this.onRemoveLogo,
  });

  String? _resolveFullLogoUrl(String? path) {
    if (path == null || path.trim().isEmpty) return null;
    final trimmed = path.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    final baseServerUrl =
        AppEnvironment.apiBaseUrl.replaceAll(RegExp(r'/api/?$'), '');
    return '$baseServerUrl${trimmed.startsWith('/') ? '' : '/'}$trimmed';
  }

  Future<void> _handlePickImage(BuildContext context) async {
    if (!canManage || isUploading) return;

    try {
      final picker = ImagePicker();
      final pickedFile = await picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 85,
      );

      if (pickedFile != null) {
        onUploadLogo(pickedFile);
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to select image: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  Future<void> _handleConfirmRemove(BuildContext context) async {
    if (!canManage || isUploading) return;

    final confirmed = await AppConfirmDialog.show(
      context: context,
      title: 'Remove Business Logo',
      message: 'Are you sure you want to remove the business logo?',
      confirmLabel: 'Remove',
      isDestructive: true,
    );

    if (confirmed == true) {
      onRemoveLogo();
    }
  }

  @override
  Widget build(BuildContext context) {
    final fullUrl = _resolveFullLogoUrl(logoPath);
    final hasLogo = fullUrl != null && fullUrl.isNotEmpty;

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
                  Icons.image_outlined,
                  color: AppColors.primary,
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              const Text(
                'Brand Logo',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Logo Preview
              Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    height: 80,
                    width: hasLogo ? null : 80,
                    constraints: const BoxConstraints(minWidth: 80, maxWidth: 180),
                    padding: hasLogo ? const EdgeInsets.all(4) : EdgeInsets.zero,
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: hasLogo
                        ? Image.network(
                            fullUrl,
                            height: 72,
                            fit: BoxFit.contain,
                            errorBuilder: (context, error, stackTrace) =>
                                const Center(
                              child: Icon(
                                Icons.storefront_outlined,
                                size: 36,
                                color: AppColors.textTertiary,
                              ),
                            ),
                            loadingBuilder: (context, child, loadingProgress) {
                              if (loadingProgress == null) return child;
                              return const Center(
                                child: SizedBox(
                                  width: 24,
                                  height: 24,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation<Color>(
                                      AppColors.primary,
                                    ),
                                  ),
                                ),
                              );
                            },
                          )
                        : const Center(
                            child: Icon(
                              Icons.storefront_outlined,
                              size: 36,
                              color: AppColors.textTertiary,
                            ),
                          ),
                  ),
                  if (isUploading)
                    Positioned.fill(
                      child: Container(
                        decoration: BoxDecoration(
                          color: Colors.black38,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Center(
                          child: SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation<Color>(
                                Colors.white,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 16),
              // Action buttons
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (canManage) ...[
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          AppButton(
                            label: hasLogo ? 'Change Logo' : 'Upload Logo',
                            icon: Icons.upload_file_outlined,
                            variant: AppButtonVariant.secondary,
                            isLoading: isUploading,
                            onPressed: isUploading
                                ? null
                                : () => _handlePickImage(context),
                          ),
                          if (hasLogo)
                            AppButton(
                              label: 'Remove',
                              icon: Icons.delete_outline,
                              variant: AppButtonVariant.danger,
                              isLoading: isUploading,
                              onPressed: isUploading
                                  ? null
                                  : () => _handleConfirmRemove(context),
                            ),
                        ],
                      ),
                      const SizedBox(height: 8),
                    ],
                    const Text(
                      'Formats: PNG, JPEG, WebP • Max 5 MB',
                      style: TextStyle(
                        fontSize: 11,
                        color: AppColors.textTertiary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
