import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../models/outside_job_model.dart';
import '../../providers/outside_job_providers.dart';
import '../../providers/job_card_providers.dart';
import '../../../staff/providers/staff_provider.dart';

/// Collapsible section inside the Job Card Details screen that shows
/// outside job lifecycle: send outside → track → mark returned / cancel.
class OutsideJobsSection extends ConsumerStatefulWidget {
  final String jobCardId;
  final String vehicleRegistration;
  final String vehicleModel;
  final bool isLocked;

  const OutsideJobsSection({
    super.key,
    required this.jobCardId,
    required this.vehicleRegistration,
    required this.vehicleModel,
    this.isLocked = false,
  });

  @override
  ConsumerState<OutsideJobsSection> createState() => _OutsideJobsSectionState();
}

class _OutsideJobsSectionState extends ConsumerState<OutsideJobsSection> {
  bool _isExpanded = true;

  // ── Formatters ──────────────────────────────────────────────────────────

  String _formatDateTime(DateTime? dt) {
    if (dt == null) return '-';
    return DateFormat('dd MMM yyyy, hh:mm a').format(dt.toLocal());
  }

  String _formatCurrency(double? amt) {
    if (amt == null) return '-';
    return NumberFormat.currency(
      locale: 'en_IN',
      symbol: '₹',
      decimalDigits: 2,
    ).format(amt);
  }

  // ── Dialogs ─────────────────────────────────────────────────────────────

  Future<void> _showSendOutsideSheet() async {
    if (widget.isLocked) return;
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _SendOutsideSheet(
        jobCardId: widget.jobCardId,
        vehicleRegistration: widget.vehicleRegistration,
        vehicleModel: widget.vehicleModel,
      ),
    );
    if (result == true && mounted) {
      ref.read(outsideJobsProvider(widget.jobCardId).notifier).load();
      ref.read(jobCardDetailsProvider(widget.jobCardId).notifier).loadDetails();
      ref.read(jobCardListProvider.notifier).loadJobCards();
    }
  }

  Future<void> _showReturnSheet(OutsideJob activeJob) async {
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _MarkReturnedSheet(
        outsideJob: activeJob,
        jobCardId: widget.jobCardId,
      ),
    );
    if (result == true && mounted) {
      ref.read(outsideJobsProvider(widget.jobCardId).notifier).load();
      ref.read(jobCardDetailsProvider(widget.jobCardId).notifier).loadDetails();
      ref.read(jobCardListProvider.notifier).loadJobCards();
    }
  }

  Future<void> _showCancelDialog(OutsideJob activeJob) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => _CancelOutsideJobDialog(
        outsideJob: activeJob,
        jobCardId: widget.jobCardId,
      ),
    );
    if (result == true && mounted) {
      ref.read(outsideJobsProvider(widget.jobCardId).notifier).load();
      ref.read(jobCardDetailsProvider(widget.jobCardId).notifier).loadDetails();
      ref.read(jobCardListProvider.notifier).loadJobCards();
    }
  }

  Future<void> _showEditCostDialog(OutsideJob job) async {
    if (widget.isLocked) return;
    final costCtrl = TextEditingController(
      text: job.vendorCost != null ? job.vendorCost!.toStringAsFixed(2) : '',
    );
    String? errorText;

    final updated = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          title: const Row(
            children: [
              Icon(Icons.edit_rounded, color: AppColors.primary, size: 20),
              SizedBox(width: 8),
              Text(
                'Edit Vendor Cost',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Service: ${job.serviceName}',
                style: AppTextStyles.caption.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text('Vendor: ${job.vendorName}', style: AppTextStyles.caption),
              const SizedBox(height: 12),
              TextField(
                key: const Key('input_edit_vendor_cost'),
                controller: costCtrl,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: InputDecoration(
                  labelText: 'Vendor Cost (₹) *',
                  errorText: errorText,
                  prefixText: '₹ ',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              key: const Key('btn_save_vendor_cost'),
              onPressed: () async {
                final costVal = double.tryParse(costCtrl.text.trim());
                if (costVal == null || costVal < 0) {
                  setDialogState(() {
                    errorText = 'Enter a valid non-negative cost.';
                  });
                  return;
                }
                final success = await ref
                    .read(outsideJobsProvider(widget.jobCardId).notifier)
                    .updateCost(job.id, costVal);
                if (success && ctx.mounted) {
                  Navigator.of(ctx).pop(true);
                } else if (ctx.mounted) {
                  final st = ref.read(outsideJobsProvider(widget.jobCardId));
                  setDialogState(() {
                    errorText = st.submitError ?? 'Failed to update cost.';
                  });
                }
              },
              child: const Text('Save Cost'),
            ),
          ],
        ),
      ),
    );

    if (updated == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vendor cost updated successfully.'),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
        ),
      );
      ref.read(outsideJobsProvider(widget.jobCardId).notifier).load();
      ref.read(jobCardDetailsProvider(widget.jobCardId).notifier).loadDetails();
    }
  }

  Future<void> _showDeleteMovementDialog(OutsideJob job) async {
    if (widget.isLocked) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: AppColors.error, size: 22),
            SizedBox(width: 8),
            Text(
              'Remove Movement',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Are you sure you want to remove the outside job movement record for "${job.serviceName}" at ${job.vendorName}?',
              style: AppTextStyles.bodySmall,
            ),
            const SizedBox(height: 8),
            Text(
              'This movement will be marked obsolete and excluded from invoice calculations and history.',
              style: AppTextStyles.caption.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            key: const Key('btn_confirm_delete_movement'),
            style: FilledButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Confirm Remove'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      final success = await ref
          .read(outsideJobsProvider(widget.jobCardId).notifier)
          .deleteJob(job.id);
      if (!mounted) return;
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Movement record removed.'),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
          ),
        );
        ref.read(outsideJobsProvider(widget.jobCardId).notifier).load();
        ref
            .read(jobCardDetailsProvider(widget.jobCardId).notifier)
            .loadDetails();
        ref.read(jobCardListProvider.notifier).loadJobCards();
      } else {
        final st = ref.read(outsideJobsProvider(widget.jobCardId));
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              st.submitError ?? 'Failed to remove movement record.',
            ),
            backgroundColor: AppColors.error,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  // ── Build ───────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(outsideJobsProvider(widget.jobCardId));

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.border, width: 1),
      ),
      color: AppColors.card,
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Section Header ─────────────────────────────────────────
          InkWell(
            onTap: () => setState(() => _isExpanded = !_isExpanded),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: const BoxDecoration(
                color: AppColors.surfaceAlt,
                border: Border(
                  bottom: BorderSide(color: AppColors.border, width: 1),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(7),
                    decoration: BoxDecoration(
                      color: AppColors.primaryContainer,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      Icons.local_shipping_rounded,
                      color: AppColors.textOnPrimary,
                      size: 18,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              'Outside Jobs & Vehicle Movement',
                              style: AppTextStyles.headingSmall,
                            ),
                            const SizedBox(width: 8),
                            _buildLocationBadge(state),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Track external vendor work',
                          style: AppTextStyles.caption,
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    _isExpanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    color: AppColors.textSecondary,
                  ),
                ],
              ),
            ),
          ),

          // ── Expanded Content ───────────────────────────────────────
          if (_isExpanded) _buildBody(state),
        ],
      ),
    );
  }

  Widget _buildLocationBadge(OutsideJobsState state) {
    if (state.isLoading) {
      return const SizedBox(
        width: 12,
        height: 12,
        child: CircularProgressIndicator(strokeWidth: 1.5),
      );
    }

    if (state.isVehicleOutside) {
      final isOverdue = state.activeJob?.isOverdue ?? false;
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: isOverdue ? AppColors.errorLight : AppColors.warningLight,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(
            color: isOverdue
                ? AppColors.error.withValues(alpha: 0.4)
                : AppColors.warning.withValues(alpha: 0.4),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                color: isOverdue ? AppColors.error : AppColors.warning,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 4),
            Text(
              isOverdue ? 'OVERDUE' : 'Outside',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: isOverdue ? AppColors.error : AppColors.warningDark,
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.successLight,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: AppColors.success.withValues(alpha: 0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: const BoxDecoration(
              color: AppColors.success,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 4),
          const Text(
            'Showroom',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: AppColors.successDark,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(OutsideJobsState state) {
    if (state.isLoading) {
      return const Padding(
        padding: EdgeInsets.all(24),
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }

    if (state.errorMessage != null) {
      return Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Text(
              state.errorMessage!,
              style: AppTextStyles.bodySmall.copyWith(color: AppColors.error),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => ref
                  .read(outsideJobsProvider(widget.jobCardId).notifier)
                  .load(),
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Active job card
          if (state.activeJob != null) _buildActiveJobCard(state.activeJob!),

          // Send Outside button (only when no active job)
          if (state.activeJob == null)
            Padding(
              padding: EdgeInsets.only(
                bottom: state.historicalJobs.isNotEmpty ? 16 : 0,
              ),
              child: OutlinedButton.icon(
                key: const Key('btn_send_outside'),
                onPressed: widget.isLocked ? null : _showSendOutsideSheet,
                icon: Icon(
                  widget.isLocked
                      ? Icons.lock_outline_rounded
                      : Icons.add_rounded,
                  size: 18,
                ),
                label: Text(
                  widget.isLocked
                      ? 'Send Vehicle Outside (Locked)'
                      : 'Send Vehicle Outside',
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: widget.isLocked
                      ? AppColors.textSecondary
                      : AppColors.primary,
                  side: BorderSide(
                    color: widget.isLocked
                        ? AppColors.border
                        : AppColors.primary,
                  ),
                  padding: const EdgeInsets.symmetric(
                    vertical: 12,
                    horizontal: 20,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            ),

          // History
          if (state.historicalJobs.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              'MOVEMENT HISTORY (${state.historicalJobs.length})',
              style: AppTextStyles.overline,
            ),
            const SizedBox(height: 8),
            ...state.historicalJobs.map(_buildHistoryTile),
          ],

          // Empty state
          if (state.jobs.isEmpty)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Column(
                children: [
                  Icon(
                    Icons.local_shipping_outlined,
                    size: 36,
                    color: AppColors.textTertiary,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'No external jobs recorded',
                    style: AppTextStyles.bodySmall.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Click "Send Vehicle Outside" for denting,\npainting, alignment work, etc.',
                    style: AppTextStyles.caption,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildActiveJobCard(OutsideJob job) {
    final isOverdue = job.isOverdue;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isOverdue ? AppColors.errorLight : AppColors.warningLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isOverdue
              ? AppColors.error.withValues(alpha: 0.4)
              : AppColors.warning.withValues(alpha: 0.3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header row
          Row(
            children: [
              Icon(
                Icons.local_shipping_rounded,
                size: 18,
                color: isOverdue ? AppColors.error : AppColors.warning,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  job.serviceName,
                  style: AppTextStyles.headingSmall.copyWith(
                    color: isOverdue
                        ? AppColors.errorDark
                        : AppColors.warningDark,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: isOverdue
                      ? AppColors.error
                      : AppColors.warning.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  isOverdue ? 'OVERDUE' : 'At Outside Shop',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: isOverdue ? Colors.white : AppColors.warningDark,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Vendor
          Row(
            children: [
              const Icon(
                Icons.store_outlined,
                size: 14,
                color: AppColors.textSecondary,
              ),
              const SizedBox(width: 6),
              Text(
                'Vendor: ${job.vendorName}',
                style: AppTextStyles.bodySmall.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (job.vendorPhone != null && job.vendorPhone!.isNotEmpty) ...[
                const SizedBox(width: 8),
                Icon(
                  Icons.phone_outlined,
                  size: 12,
                  color: AppColors.textTertiary,
                ),
                const SizedBox(width: 3),
                Text(job.vendorPhone!, style: AppTextStyles.caption),
              ],
            ],
          ),
          const SizedBox(height: 8),

          // Metadata grid
          Wrap(
            spacing: 16,
            runSpacing: 6,
            children: [
              _buildMeta('Sent', _formatDateTime(job.sentAt)),
              _buildMeta(
                'Expected Return',
                _formatDateTime(job.expectedReturnAt),
                isHighlighted: isOverdue,
              ),
              if (job.vendorCost != null)
                _buildMeta('Est. Cost', _formatCurrency(job.vendorCost)),
              if (job.sentByUserName != null)
                _buildMeta('Sent By', job.sentByUserName!),
            ],
          ),

          if (job.notes != null && job.notes!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text('Notes: ${job.notes}', style: AppTextStyles.caption),
          ],

          const SizedBox(height: 12),
          // Action buttons
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  key: const Key('btn_mark_returned'),
                  onPressed: () => _showReturnSheet(job),
                  icon: const Icon(
                    Icons.check_circle_outline_rounded,
                    size: 16,
                  ),
                  label: const Text('Mark Returned'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.success,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    textStyle: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                key: const Key('btn_cancel_outside'),
                onPressed: () => _showCancelDialog(job),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.error,
                  side: BorderSide(
                    color: AppColors.error.withValues(alpha: 0.4),
                  ),
                  padding: const EdgeInsets.symmetric(
                    vertical: 10,
                    horizontal: 16,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: const Text(
                  'Cancel',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                ),
              ),
              if (!widget.isLocked) ...[
                const SizedBox(width: 8),
                IconButton(
                  key: Key('btn_delete_active_${job.id}'),
                  icon: const Icon(
                    Icons.delete_outline_rounded,
                    size: 18,
                    color: AppColors.error,
                  ),
                  tooltip: 'Remove Movement',
                  onPressed: () => _showDeleteMovementDialog(job),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMeta(String label, String value, {bool isHighlighted = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppTextStyles.overline),
        const SizedBox(height: 1),
        Text(
          value,
          style: AppTextStyles.caption.copyWith(
            fontWeight: FontWeight.w600,
            color: isHighlighted ? AppColors.error : AppColors.textPrimary,
          ),
        ),
      ],
    );
  }

  Widget _buildHistoryTile(OutsideJob job) {
    final isReturned = job.status == OutsideJobStatus.returned;
    final isCancelled = job.status == OutsideJobStatus.cancelled;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  job.serviceName,
                  style: AppTextStyles.bodySmall.copyWith(
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: isReturned
                      ? AppColors.successLight
                      : (isCancelled
                            ? AppColors.surfaceAlt
                            : AppColors.warningLight),
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(
                    color: isReturned
                        ? AppColors.success.withValues(alpha: 0.4)
                        : (isCancelled
                              ? AppColors.border
                              : AppColors.warning.withValues(alpha: 0.4)),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isReturned
                          ? Icons.check_circle_rounded
                          : (isCancelled
                                ? Icons.cancel_rounded
                                : Icons.local_shipping_rounded),
                      size: 12,
                      color: isReturned
                          ? AppColors.success
                          : (isCancelled
                                ? AppColors.textSecondary
                                : AppColors.warning),
                    ),
                    const SizedBox(width: 3),
                    Text(
                      isReturned
                          ? 'Returned'
                          : (isCancelled ? 'Cancelled' : job.statusName),
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: isReturned
                            ? AppColors.successDark
                            : (isCancelled
                                  ? AppColors.textSecondary
                                  : AppColors.warningDark),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 16,
            runSpacing: 4,
            children: [
              _buildMiniMeta('Vendor', job.vendorName),
              _buildMiniMeta('Sent', _formatDateTime(job.sentAt)),
              if (isReturned)
                _buildMiniMeta('Returned', _formatDateTime(job.returnedAt)),
              if (job.vendorCost != null)
                _buildMiniMeta('Cost', _formatCurrency(job.vendorCost)),
            ],
          ),
          if (job.returnNotes != null && job.returnNotes!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text('Return: ${job.returnNotes}', style: AppTextStyles.caption),
          ],
          if (job.cancellationReason != null &&
              job.cancellationReason!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'Reason: ${job.cancellationReason}',
              style: AppTextStyles.caption.copyWith(color: AppColors.error),
            ),
          ],
          if (!widget.isLocked) ...[
            const SizedBox(height: 8),
            const Divider(height: 1, color: AppColors.border),
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (!isCancelled)
                  TextButton.icon(
                    key: Key('btn_edit_cost_${job.id}'),
                    onPressed: () => _showEditCostDialog(job),
                    icon: const Icon(
                      Icons.edit_outlined,
                      size: 14,
                      color: AppColors.primary,
                    ),
                    label: const Text(
                      'Edit Cost',
                      style: TextStyle(fontSize: 12, color: AppColors.primary),
                    ),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      visualDensity: VisualDensity.compact,
                    ),
                  ),
                const SizedBox(width: 8),
                TextButton.icon(
                  key: Key('btn_delete_movement_${job.id}'),
                  onPressed: () => _showDeleteMovementDialog(job),
                  icon: const Icon(
                    Icons.delete_outline_rounded,
                    size: 14,
                    color: AppColors.error,
                  ),
                  label: const Text(
                    'Remove',
                    style: TextStyle(fontSize: 12, color: AppColors.error),
                  ),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    visualDensity: VisualDensity.compact,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildMiniMeta(String label, String value) {
    return RichText(
      text: TextSpan(
        style: AppTextStyles.caption,
        children: [
          TextSpan(
            text: '$label: ',
            style: const TextStyle(fontWeight: FontWeight.w500),
          ),
          TextSpan(text: value),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SEND OUTSIDE BOTTOM SHEET
// ═══════════════════════════════════════════════════════════════════════════════

class _SendOutsideSheet extends ConsumerStatefulWidget {
  final String jobCardId;
  final String vehicleRegistration;
  final String vehicleModel;

  const _SendOutsideSheet({
    required this.jobCardId,
    required this.vehicleRegistration,
    required this.vehicleModel,
  });

  @override
  ConsumerState<_SendOutsideSheet> createState() => _SendOutsideSheetState();
}

class _SendOutsideSheetState extends ConsumerState<_SendOutsideSheet> {
  final _formKey = GlobalKey<FormState>();
  final _serviceNameCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();

  String? _selectedVendorId;
  DateTime _sentAt = DateTime.now();
  String _sentByType = 'Owner';
  String? _selectedStaffId;
  bool _isSubmitting = false;
  String? _error;

  // New vendor form
  bool _showNewVendorForm = false;
  final _newVendorNameCtrl = TextEditingController();
  final _newVendorPhoneCtrl = TextEditingController();
  final _newVendorSpecialtyCtrl = TextEditingController();
  String? _newVendorPhoneError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(staffProvider.notifier).loadStaff();
    });
  }

  @override
  void dispose() {
    _serviceNameCtrl.dispose();
    _notesCtrl.dispose();
    _newVendorNameCtrl.dispose();
    _newVendorPhoneCtrl.dispose();
    _newVendorSpecialtyCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickSentAt() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _sentAt,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 1)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_sentAt),
    );
    if (time == null || !mounted) return;
    setState(() {
      _sentAt = DateTime(
        date.year,
        date.month,
        date.day,
        time.hour,
        time.minute,
      );
    });
  }

  Future<void> _handleCreateVendor() async {
    final name = _newVendorNameCtrl.text.trim();
    if (name.isEmpty) return;

    final phone = _newVendorPhoneCtrl.text.trim();
    if (phone.isNotEmpty && !RegExp(r'^[0-9]{10}$').hasMatch(phone)) {
      setState(() {
        _newVendorPhoneError = 'Phone number must be exactly 10 digits.';
      });
      return;
    } else {
      setState(() {
        _newVendorPhoneError = null;
      });
    }

    final vendor = await ref
        .read(vendorsProvider.notifier)
        .createVendor(
          CreateVendorRequest(
            name: name,
            phone: phone.isEmpty ? null : phone,
            serviceSpecialty: _newVendorSpecialtyCtrl.text.trim().isEmpty
                ? null
                : _newVendorSpecialtyCtrl.text.trim(),
          ),
        );

    if (vendor != null && mounted) {
      setState(() {
        _selectedVendorId = vendor.id;
        _showNewVendorForm = false;
        _newVendorNameCtrl.clear();
        _newVendorPhoneCtrl.clear();
        _newVendorPhoneError = null;
        _newVendorSpecialtyCtrl.clear();
      });
    }
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedVendorId == null || _selectedVendorId!.isEmpty) {
      setState(() => _error = 'Please select a vendor.');
      return;
    }
    if (_sentByType == 'Staff' &&
        (_selectedStaffId == null || _selectedStaffId!.isEmpty)) {
      setState(() => _error = 'Please select a staff member.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    final staffList = ref.read(staffProvider).activeStaff;
    final selectedStaff = staffList
        .where((s) => s.id == _selectedStaffId)
        .firstOrNull;

    final success = await ref
        .read(outsideJobsProvider(widget.jobCardId).notifier)
        .sendOutside(
          CreateOutsideJobRequest(
            vendorId: _selectedVendorId!,
            serviceName: _serviceNameCtrl.text.trim(),
            sentAt: _sentAt,
            sentByType: _sentByType,
            sentByStaffId: _sentByType == 'Staff' ? _selectedStaffId : null,
            sentByStaffName: _sentByType == 'Staff'
                ? selectedStaff?.name
                : null,
            notes: _notesCtrl.text.trim().isEmpty
                ? null
                : _notesCtrl.text.trim(),
          ),
        );

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (success) {
      Navigator.of(context).pop(true);
    } else {
      final state = ref.read(outsideJobsProvider(widget.jobCardId));
      setState(
        () => _error = state.submitError ?? 'Failed to send vehicle outside.',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final vendorsState = ref.watch(vendorsProvider);
    final staffState = ref.watch(staffProvider);
    final activeStaff = staffState.activeStaff;
    final dateFormat = DateFormat('dd-MM-yyyy HH:mm');

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: DraggableScrollableSheet(
        initialChildSize: 0.75,
        minChildSize: 0.4,
        maxChildSize: 0.95,
        expand: false,
        builder: (ctx, scrollController) => SingleChildScrollView(
          controller: scrollController,
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 8,
            bottom: MediaQuery.of(context).viewInsets.bottom + 20,
          ),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Handle
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.border,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Title
                Row(
                  children: [
                    const Icon(
                      Icons.local_shipping_rounded,
                      size: 22,
                      color: AppColors.primary,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Send Vehicle Outside',
                            style: AppTextStyles.headingMedium,
                          ),
                          Text(
                            '${widget.vehicleRegistration} • ${widget.vehicleModel}',
                            style: AppTextStyles.caption,
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                ),
                const Divider(height: 24, color: AppColors.border),

                // Error
                if (_error != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.errorLight,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: AppColors.error.withValues(alpha: 0.3),
                      ),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.error_outline_rounded,
                          size: 16,
                          color: AppColors.error,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _error!,
                            style: AppTextStyles.caption.copyWith(
                              color: AppColors.error,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                // 1. Outside Service *
                Text(
                  'Outside Service *',
                  style: AppTextStyles.labelMedium.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _serviceNameCtrl,
                  validator: (v) => (v == null || v.trim().isEmpty)
                      ? 'Outside service is required'
                      : null,
                  decoration: InputDecoration(
                    hintText: 'e.g. Denting & Painting, Wheel Alignment',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // 2. Outside Shop / Vendor *
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Outside Shop / Vendor *',
                      style: AppTextStyles.labelMedium.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    TextButton.icon(
                      key: const Key('btn_toggle_new_vendor'),
                      onPressed: () => setState(
                        () => _showNewVendorForm = !_showNewVendorForm,
                      ),
                      icon: Icon(
                        _showNewVendorForm ? Icons.close : Icons.add,
                        size: 14,
                      ),
                      label: Text(
                        _showNewVendorForm ? 'Cancel' : 'New Vendor',
                        style: const TextStyle(fontSize: 12),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),

                if (_showNewVendorForm) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceAlt,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        TextFormField(
                          key: const Key('input_new_vendor_name'),
                          controller: _newVendorNameCtrl,
                          decoration: InputDecoration(
                            labelText: 'Vendor Name *',
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 10,
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: TextFormField(
                                key: const Key('input_new_vendor_phone'),
                                controller: _newVendorPhoneCtrl,
                                keyboardType: TextInputType.phone,
                                decoration: InputDecoration(
                                  labelText: 'Phone',
                                  errorText: _newVendorPhoneError,
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 10,
                                  ),
                                ),
                                onChanged: (_) {
                                  if (_newVendorPhoneError != null) {
                                    setState(() => _newVendorPhoneError = null);
                                  }
                                },
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextFormField(
                                key: const Key('input_new_vendor_specialty'),
                                controller: _newVendorSpecialtyCtrl,
                                decoration: InputDecoration(
                                  labelText: 'Specialty',
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 10,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        FilledButton(
                          key: const Key('btn_create_vendor'),
                          onPressed: vendorsState.isSubmitting
                              ? null
                              : _handleCreateVendor,
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.primary,
                          ),
                          child: Text(
                            vendorsState.isSubmitting
                                ? 'Creating…'
                                : 'Create Vendor',
                          ),
                        ),
                        if (vendorsState.submitError != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              vendorsState.submitError!,
                              style: AppTextStyles.caption.copyWith(
                                color: AppColors.error,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                ],

                DropdownButtonFormField<String>(
                  key: ValueKey('vendor_select_$_selectedVendorId'),
                  initialValue:
                      vendorsState.vendors.any((v) => v.id == _selectedVendorId)
                      ? _selectedVendorId
                      : null,
                  validator: (v) => (v == null || v.isEmpty)
                      ? 'Please select a vendor'
                      : null,
                  decoration: InputDecoration(
                    hintText: 'Select Vendor',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                  ),
                  items: vendorsState.vendors.map((v) {
                    return DropdownMenuItem(
                      value: v.id,
                      child: Text(
                        '${v.name}${v.serviceSpecialty != null ? " (${v.serviceSpecialty})" : ""}',
                        style: const TextStyle(fontSize: 14),
                      ),
                    );
                  }).toList(),
                  onChanged: (v) => setState(() => _selectedVendorId = v),
                ),
                const SizedBox(height: 16),

                // 3. Sent Date & Time *
                Text(
                  'Sent Date & Time *',
                  style: AppTextStyles.labelMedium.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 6),
                InkWell(
                  onTap: _pickSentAt,
                  borderRadius: BorderRadius.circular(10),
                  child: InputDecorator(
                    decoration: InputDecoration(
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      suffixIcon: const Icon(
                        Icons.calendar_today_rounded,
                        size: 16,
                      ),
                    ),
                    child: Text(
                      dateFormat.format(_sentAt),
                      style: const TextStyle(fontSize: 14),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // 4. Sent By *
                Text(
                  'Sent By *',
                  style: AppTextStyles.labelMedium.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  initialValue: _sentByType,
                  decoration: InputDecoration(
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                  ),
                  items: const [
                    DropdownMenuItem(
                      value: 'Owner',
                      child: Text('Owner', style: TextStyle(fontSize: 14)),
                    ),
                    DropdownMenuItem(
                      value: 'Staff',
                      child: Text('Staff', style: TextStyle(fontSize: 14)),
                    ),
                  ],
                  onChanged: (val) {
                    if (val != null) {
                      setState(() {
                        _sentByType = val;
                        if (_sentByType == 'Owner') {
                          _selectedStaffId = null;
                        }
                      });
                    }
                  },
                ),
                if (_sentByType == 'Staff') ...[
                  const SizedBox(height: 12),
                  Text(
                    'Staff Member *',
                    style: AppTextStyles.labelMedium.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<String>(
                    initialValue: _selectedStaffId,
                    validator: (v) {
                      if (_sentByType == 'Staff' && (v == null || v.isEmpty)) {
                        return 'Please select a staff member';
                      }
                      return null;
                    },
                    decoration: InputDecoration(
                      hintText: activeStaff.isEmpty
                          ? (staffState.isLoading
                                ? 'Loading staff…'
                                : 'No active staff available')
                          : 'Select Staff Member',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                    ),
                    items: activeStaff.map((s) {
                      return DropdownMenuItem(
                        value: s.id,
                        child: Text(
                          '${s.name}${s.role != null ? " (${s.role})" : ""}',
                          style: const TextStyle(fontSize: 14),
                        ),
                      );
                    }).toList(),
                    onChanged: (val) => setState(() => _selectedStaffId = val),
                  ),
                ],
                const SizedBox(height: 16),

                // 5. Notes
                Text(
                  'Notes',
                  style: AppTextStyles.labelMedium.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _notesCtrl,
                  maxLines: 2,
                  decoration: InputDecoration(
                    hintText:
                        'e.g. Specific work requested, customer instructions, etc.',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Action Buttons: [Cancel] [Send Outside]
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.of(context).pop(),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                          side: const BorderSide(color: AppColors.border),
                        ),
                        child: const Text(
                          'Cancel',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: _isSubmitting ? null : _handleSubmit,
                        icon: _isSubmitting
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Icon(Icons.send_rounded, size: 16),
                        label: Text(
                          _isSubmitting ? 'Sending…' : 'Send Outside',
                        ),
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                          textStyle: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MARK RETURNED BOTTOM SHEET
// ═══════════════════════════════════════════════════════════════════════════════

class _MarkReturnedSheet extends ConsumerStatefulWidget {
  final OutsideJob outsideJob;
  final String jobCardId;

  const _MarkReturnedSheet({required this.outsideJob, required this.jobCardId});

  @override
  ConsumerState<_MarkReturnedSheet> createState() => _MarkReturnedSheetState();
}

class _MarkReturnedSheetState extends ConsumerState<_MarkReturnedSheet> {
  final _finalCostCtrl = TextEditingController();
  final _returnNotesCtrl = TextEditingController();
  DateTime _returnedAt = DateTime.now();
  bool _isSubmitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.outsideJob.vendorCost != null) {
      _finalCostCtrl.text = widget.outsideJob.vendorCost!.toStringAsFixed(2);
    }
  }

  @override
  void dispose() {
    _finalCostCtrl.dispose();
    _returnNotesCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickReturnedAt() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _returnedAt,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 1)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_returnedAt),
    );
    if (time == null || !mounted) return;
    setState(() {
      _returnedAt = DateTime(
        date.year,
        date.month,
        date.day,
        time.hour,
        time.minute,
      );
    });
  }

  Future<void> _handleSubmit() async {
    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    final success = await ref
        .read(outsideJobsProvider(widget.jobCardId).notifier)
        .markReturned(
          widget.outsideJob.id,
          MarkOutsideJobReturnedRequest(
            returnedAt: _returnedAt,
            vendorCost: _finalCostCtrl.text.trim().isNotEmpty
                ? double.tryParse(_finalCostCtrl.text.trim())
                : null,
            returnNotes: _returnNotesCtrl.text.trim().isEmpty
                ? null
                : _returnNotesCtrl.text.trim(),
          ),
        );

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (success) {
      Navigator.of(context).pop(true);
    } else {
      final state = ref.read(outsideJobsProvider(widget.jobCardId));
      setState(() => _error = state.submitError ?? 'Failed to mark returned.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('dd MMM yyyy, hh:mm a');

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 12,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),

            Row(
              children: [
                const Icon(
                  Icons.check_circle_outline_rounded,
                  size: 22,
                  color: AppColors.success,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Mark Vehicle Returned',
                        style: AppTextStyles.headingMedium,
                      ),
                      Text(
                        '${widget.outsideJob.serviceName} • ${widget.outsideJob.vendorName}',
                        style: AppTextStyles.caption,
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
            const Divider(height: 24, color: AppColors.border),

            if (_error != null)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.errorLight,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _error!,
                  style: AppTextStyles.caption.copyWith(color: AppColors.error),
                ),
              ),

            // Return date
            Text(
              'Returned Date & Time *',
              style: AppTextStyles.labelMedium.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 6),
            InkWell(
              onTap: _pickReturnedAt,
              borderRadius: BorderRadius.circular(10),
              child: InputDecorator(
                decoration: InputDecoration(
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  suffixIcon: const Icon(
                    Icons.calendar_today_rounded,
                    size: 16,
                  ),
                ),
                child: Text(
                  dateFormat.format(_returnedAt),
                  style: const TextStyle(fontSize: 13),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Final Cost
            Text(
              'Final Vendor Cost (₹)',
              style: AppTextStyles.labelMedium.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 6),
            TextFormField(
              controller: _finalCostCtrl,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: InputDecoration(
                hintText: 'Final bill from vendor',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Notes
            Text(
              'Inspection / Return Notes',
              style: AppTextStyles.labelMedium.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 6),
            TextFormField(
              controller: _returnNotesCtrl,
              maxLines: 2,
              decoration: InputDecoration(
                hintText: 'e.g. Work inspected, quality ok',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
              ),
            ),
            const SizedBox(height: 20),

            FilledButton.icon(
              onPressed: _isSubmitting ? null : _handleSubmit,
              icon: _isSubmitting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.check_circle_rounded, size: 18),
              label: Text(
                _isSubmitting ? 'Recording…' : 'Confirm Vehicle Returned',
              ),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.success,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                textStyle: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CANCEL OUTSIDE JOB DIALOG
// ═══════════════════════════════════════════════════════════════════════════════

class _CancelOutsideJobDialog extends ConsumerStatefulWidget {
  final OutsideJob outsideJob;
  final String jobCardId;

  const _CancelOutsideJobDialog({
    required this.outsideJob,
    required this.jobCardId,
  });

  @override
  ConsumerState<_CancelOutsideJobDialog> createState() =>
      _CancelOutsideJobDialogState();
}

class _CancelOutsideJobDialogState
    extends ConsumerState<_CancelOutsideJobDialog> {
  final _reasonCtrl = TextEditingController();
  bool _isSubmitting = false;
  String? _error;

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleCancel() async {
    if (_reasonCtrl.text.trim().isEmpty) {
      setState(() => _error = 'Please specify a reason.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    final success = await ref
        .read(outsideJobsProvider(widget.jobCardId).notifier)
        .cancelJob(
          widget.outsideJob.id,
          CancelOutsideJobRequest(reason: _reasonCtrl.text.trim()),
        );

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (success) {
      Navigator.of(context).pop(true);
    } else {
      final state = ref.read(outsideJobsProvider(widget.jobCardId));
      setState(() => _error = state.submitError ?? 'Failed to cancel.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Row(
        children: [
          const Icon(
            Icons.warning_amber_rounded,
            color: AppColors.error,
            size: 22,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Cancel Outside Job',
              style: AppTextStyles.headingMedium.copyWith(
                color: AppColors.error,
              ),
            ),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Cancel "${widget.outsideJob.serviceName}" at ${widget.outsideJob.vendorName}?',
            style: AppTextStyles.bodySmall,
          ),
          const SizedBox(height: 12),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                _error!,
                style: AppTextStyles.caption.copyWith(color: AppColors.error),
              ),
            ),
          TextFormField(
            controller: _reasonCtrl,
            maxLines: 2,
            decoration: InputDecoration(
              labelText: 'Cancellation Reason *',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
              ),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 14,
                vertical: 12,
              ),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Dismiss'),
        ),
        FilledButton(
          onPressed: _isSubmitting ? null : _handleCancel,
          style: FilledButton.styleFrom(backgroundColor: AppColors.error),
          child: Text(_isSubmitting ? 'Cancelling…' : 'Cancel Job'),
        ),
      ],
    );
  }
}
