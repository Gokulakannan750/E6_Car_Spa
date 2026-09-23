import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../../auth/providers/auth_state.dart';
import '../../data/staff_repository.dart';
import '../../models/staff_model.dart';
import '../../providers/staff_provider.dart';
import 'add_edit_staff_bottom_sheet.dart';

class StaffDetailsBottomSheet extends ConsumerStatefulWidget {
  final Staff staff;

  const StaffDetailsBottomSheet({
    super.key,
    required this.staff,
  });

  static Future<void> show(BuildContext context, Staff staff) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StaffDetailsBottomSheet(staff: staff),
    );
  }

  @override
  ConsumerState<StaffDetailsBottomSheet> createState() => _StaffDetailsBottomSheetState();
}

class _StaffDetailsBottomSheetState extends ConsumerState<StaffDetailsBottomSheet> {
  String? _revealedAadhaar;
  bool _isRevealing = false;
  bool _isDeletingDoc = false;
  String? _errorMessage;

  Future<void> _handleRevealAadhaar() async {
    setState(() {
      _isRevealing = true;
      _errorMessage = null;
    });
    try {
      final unmasked = await ref.read(staffRepositoryProvider).revealAadhaar(widget.staff.id);
      if (!mounted) return;
      setState(() {
        _revealedAadhaar = unmasked;
        _isRevealing = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Failed to reveal Aadhaar: $e';
        _isRevealing = false;
      });
    }
  }

  Future<void> _handleDeleteDocument() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Aadhaar Document?'),
        content: const Text('Are you sure you want to remove the stored document file? This cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() {
      _isDeletingDoc = true;
      _errorMessage = null;
    });

    try {
      await ref.read(staffRepositoryProvider).deleteAadhaarDocument(widget.staff.id);
      ref.read(staffProvider.notifier).loadStaff(refresh: true);
      if (!mounted) return;
      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Failed to delete document: $e';
        _isDeletingDoc = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);
    final user = authState is Authenticated ? authState.user : null;
    final canViewSensitive = user?.isOwner == true || (user?.permissions.contains('staff.view_sensitive') ?? false);
    final canEdit = user?.isOwner == true || (user?.permissions.contains('staff.edit') ?? false);

    final staff = widget.staff;

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
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header with Name & Role
            Row(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundColor: AppColors.accentPill,
                  child: Text(
                    staff.name.isNotEmpty ? staff.name.substring(0, 1).toUpperCase() : 'S',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: AppColors.primary,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        staff.name,
                        style: AppTextStyles.headingSmall.copyWith(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Text(
                            staff.role ?? 'General Staff',
                            style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textSecondary),
                          ),
                          const SizedBox(width: 8),
                          StatusBadge(
                            label: staff.isActive ? 'Active' : 'Inactive',
                            type: staff.isActive ? StatusType.completed : StatusType.cancelled,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: AppColors.textSecondary),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const Divider(height: 28, color: AppColors.border),

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

            // Contact Information
            Text('Contact & Profile', style: AppTextStyles.labelLarge.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 10),
            _buildInfoTile(Icons.phone_outlined, 'Phone Number', staff.phoneNumber),
            if (staff.email != null && staff.email!.isNotEmpty)
              _buildInfoTile(Icons.email_outlined, 'Email Address', staff.email!),
            if (staff.address != null && staff.address!.isNotEmpty)
              _buildInfoTile(Icons.location_on_outlined, 'Residential Address', staff.address!),

            const SizedBox(height: 16),

            // Aadhaar Verification Section
            Text('Aadhaar Identification & Compliance', style: AppTextStyles.labelLarge.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 10),
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
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.shield_outlined, size: 20, color: AppColors.primary),
                          const SizedBox(width: 8),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Aadhaar Number', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                              const SizedBox(height: 2),
                              Text(
                                _revealedAadhaar ?? staff.aadhaarMasked ?? 'Not Registered',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontFamily: 'monospace',
                                  fontSize: 14,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      if (canViewSensitive && _revealedAadhaar == null && staff.aadhaarMasked != null)
                        TextButton.icon(
                          onPressed: _isRevealing ? null : _handleRevealAadhaar,
                          icon: _isRevealing
                              ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                              : const Icon(Icons.visibility_outlined, size: 16),
                          label: const Text('Reveal'),
                        ),
                    ],
                  ),
                  const Divider(height: 18, color: AppColors.border),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Icon(
                            staff.hasAadhaarDocument ? Icons.check_circle_rounded : Icons.info_outline_rounded,
                            size: 18,
                            color: staff.hasAadhaarDocument ? AppColors.success : AppColors.textSecondary,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            staff.hasAadhaarDocument
                                ? (staff.aadhaarDocumentFileName ?? 'Document Uploaded')
                                : 'No Document Uploaded',
                            style: TextStyle(
                              fontSize: 12,
                              color: staff.hasAadhaarDocument ? AppColors.textPrimary : AppColors.textSecondary,
                              fontWeight: staff.hasAadhaarDocument ? FontWeight.w600 : FontWeight.normal,
                            ),
                          ),
                        ],
                      ),
                      if (staff.hasAadhaarDocument && canEdit)
                        IconButton(
                          icon: _isDeletingDoc
                              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                              : const Icon(Icons.delete_outline_rounded, size: 18, color: AppColors.error),
                          tooltip: 'Delete Document',
                          onPressed: _isDeletingDoc ? null : _handleDeleteDocument,
                        ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Advances & Financial Summary
            Text('Advance Summary', style: AppTextStyles.labelLarge.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.accentPill,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Advances Taken', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                        const SizedBox(height: 4),
                        Text(
                          '${staff.totalAdvances} Records',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.primary),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.warningLight,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Total Advances (All-time)', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                        const SizedBox(height: 4),
                        Text(
                          '₹${staff.totalAdvanceAmount.toStringAsFixed(2)}',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.warningDark),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 24),

            // Bottom Buttons
            if (canEdit)
              AppButton(
                label: 'Edit Staff Member',
                icon: Icons.edit_outlined,
                onPressed: () {
                  Navigator.pop(context);
                  showModalBottomSheet<void>(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder: (_) => AddEditStaffBottomSheet(
                      staff: staff,
                      onUpdate: (id, req) => ref.read(staffProvider.notifier).updateStaff(id, req),
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoTile(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: AppColors.textSecondary),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
