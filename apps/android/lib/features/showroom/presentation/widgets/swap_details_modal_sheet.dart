import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../models/showroom_staff_assignment_model.dart';
import '../../providers/daily_staff_provider.dart';

class SwapDetailsModalSheet extends ConsumerStatefulWidget {
  final String showroomId;
  final String swapId;
  final bool canReverse;

  const SwapDetailsModalSheet({
    super.key,
    required this.showroomId,
    required this.swapId,
    this.canReverse = true,
  });

  @override
  ConsumerState<SwapDetailsModalSheet> createState() =>
      _SwapDetailsModalSheetState();
}

class _SwapDetailsModalSheetState extends ConsumerState<SwapDetailsModalSheet> {
  ShowroomStaffSwap? _swap;
  bool _isLoading = true;
  String? _error;
  bool _isReversing = false;

  @override
  void initState() {
    super.initState();
    _fetchDetails();
  }

  Future<void> _fetchDetails() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final details = await ref
          .read(dailyStaffProvider(widget.showroomId).notifier)
          .getSwapDetails(widget.swapId);
      if (!mounted) return;
      setState(() {
        _swap = details;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load swap traceability details.';
        _isLoading = false;
      });
    }
  }

  Future<void> _handleReverse() async {
    final reasonController = TextEditingController();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reverse Staff Swap'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'This will restore both Staff A and Staff B to their original showroom assignments for Swap #${widget.swapId}.',
              style: AppTextStyles.bodyMedium,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              decoration: const InputDecoration(
                labelText: 'Reason for Reversal (Optional)',
                hintText: 'e.g. Schedule adjustment / cancelled',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Reverse Swap'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      setState(() => _isReversing = true);
      try {
        await ref
            .read(dailyStaffProvider(widget.showroomId).notifier)
            .reverseSwap(
              swapId: widget.swapId,
              reason: reasonController.text.trim().isNotEmpty
                  ? reasonController.text.trim()
                  : null,
            );

        if (!mounted) return;
        Navigator.of(context).pop(true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Staff swap #${widget.swapId} reversed successfully.',
            ),
            backgroundColor: AppColors.primary,
          ),
        );
      } catch (e) {
        if (!mounted) return;
        setState(() => _isReversing = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to reverse swap: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('dd MMM yyyy');
    final dateTimeFormat = DateFormat('dd MMM yyyy, hh:mm a');

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 10, bottom: 8),
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.purple.withAlpha(25),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.swap_horiz,
                    color: Colors.purple,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Staff Swap Traceability',
                        style: AppTextStyles.headingSmall.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        'Swap ID: #${widget.swapId}',
                        style: const TextStyle(
                          fontSize: 11,
                          fontFamily: 'monospace',
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close),
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // Content
          Flexible(
            child: _isLoading
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(40),
                      child: CircularProgressIndicator(),
                    ),
                  )
                : _error != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.error_outline,
                            size: 40,
                            color: AppColors.error,
                          ),
                          const SizedBox(height: 10),
                          Text(
                            _error!,
                            style: const TextStyle(color: AppColors.error),
                          ),
                          const SizedBox(height: 12),
                          OutlinedButton(
                            onPressed: _fetchDetails,
                            child: const Text('Retry'),
                          ),
                        ],
                      ),
                    ),
                  )
                : SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Status Banner
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.purple.withAlpha(15),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: Colors.purple.withAlpha(50),
                            ),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Effective Date',
                                    style: AppTextStyles.bodySmall.copyWith(
                                      color: AppColors.textSecondary,
                                      fontSize: 11,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    dateFormat.format(_swap!.date),
                                    style: AppTextStyles.bodyMedium.copyWith(
                                      fontWeight: FontWeight.w700,
                                      color: Colors.purple.shade900,
                                    ),
                                  ),
                                ],
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: _swap!.status == 'Completed'
                                      ? AppColors.readyBg
                                      : Colors.amber.shade50,
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: _swap!.status == 'Completed'
                                        ? AppColors.readyBorder
                                        : Colors.amber.shade300,
                                  ),
                                ),
                                child: Text(
                                  _swap!.status.toUpperCase(),
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: _swap!.status == 'Completed'
                                        ? AppColors.success
                                        : Colors.amber.shade900,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Coverage Period Card (if present)
                        if (_swap!.coverageStartTime != null &&
                            _swap!.coverageEndTime != null) ...[
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.purple.withAlpha(12),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: Colors.purple.withAlpha(45),
                              ),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: Colors.purple.withAlpha(20),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Icon(
                                    Icons.access_time,
                                    color: Colors.purple,
                                    size: 20,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'SWAP COVERAGE PERIOD',
                                        style: AppTextStyles.bodySmall.copyWith(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 10,
                                          letterSpacing: 0.5,
                                          color: Colors.purple.shade900,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        '${_swap!.coverageStartTime} – ${_swap!.coverageEndTime} (${_swap!.coverageDurationFormatted ?? (_swap!.coverageDurationHours != null ? "${_swap!.coverageDurationHours} hours" : "")})',
                                        style: AppTextStyles.bodyMedium
                                            .copyWith(
                                              fontWeight: FontWeight.w700,
                                              color: Colors.purple.shade900,
                                            ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],

                        // Staff A & B Cards
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Staff A
                            Expanded(
                              child: _buildStaffCard(
                                badge: 'Staff A',
                                name: _swap!.staffAName,
                                masterId: _swap!.staffAMasterId,
                                role: _swap!.staffARole,
                                origShowroom: _swap!.showroomAName,
                                assignedShowroom: _swap!.showroomBName,
                              ),
                            ),
                            const Padding(
                              padding: EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 30,
                              ),
                              child: Icon(
                                Icons.swap_horiz,
                                color: Colors.purple,
                                size: 24,
                              ),
                            ),
                            // Staff B
                            Expanded(
                              child: _buildStaffCard(
                                badge: 'Staff B',
                                name: _swap!.staffBName,
                                masterId: _swap!.staffBMasterId,
                                role: _swap!.staffBRole,
                                origShowroom: _swap!.showroomBName,
                                assignedShowroom: _swap!.showroomAName,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),

                        // Audit Metadata Card
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceAlt,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'AUDIT TRAIL METADATA',
                                style: AppTextStyles.bodySmall.copyWith(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 10,
                                  letterSpacing: 0.5,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                              const SizedBox(height: 8),
                              _buildAuditRow(
                                'Performed By:',
                                _swap!.performedByName ?? 'Admin User',
                              ),
                              const SizedBox(height: 6),
                              _buildAuditRow(
                                'Timestamp:',
                                dateTimeFormat.format(
                                  _swap!.createdAt.toLocal(),
                                ),
                              ),
                              if (_swap!.reason != null &&
                                  _swap!.reason!.isNotEmpty) ...[
                                const SizedBox(height: 6),
                                _buildAuditRow('Reason:', _swap!.reason!),
                              ],
                              if (_swap!.notes != null &&
                                  _swap!.notes!.isNotEmpty) ...[
                                const SizedBox(height: 6),
                                _buildAuditRow('Notes:', _swap!.notes!),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Action: Reverse Swap
                        if (widget.canReverse && _swap!.status == 'Completed')
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton.icon(
                              style: OutlinedButton.styleFrom(
                                foregroundColor: Colors.amber.shade900,
                                side: BorderSide(color: Colors.amber.shade700),
                                padding: const EdgeInsets.symmetric(
                                  vertical: 12,
                                ),
                              ),
                              onPressed: _isReversing ? null : _handleReverse,
                              icon: _isReversing
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Icon(Icons.undo),
                              label: Text(
                                _isReversing
                                    ? 'Reversing...'
                                    : 'Reverse Staff Swap',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                        if (!widget.canReverse && _swap!.status == 'Completed')
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 10,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceAlt,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Row(
                              children: [
                                const Icon(
                                  Icons.lock_outline,
                                  size: 16,
                                  color: AppColors.textSecondary,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'Locked after attendance confirmation. Unlock for Correction before reversing this swap.',
                                    style: AppTextStyles.bodySmall.copyWith(
                                      color: AppColors.textSecondary,
                                      fontStyle: FontStyle.italic,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildStaffCard({
    required String badge,
    required String name,
    required String masterId,
    String? role,
    required String origShowroom,
    required String assignedShowroom,
  }) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.primary.withAlpha(20),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  badge,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                  ),
                ),
              ),
              if (masterId.isNotEmpty)
                Text(
                  '#$masterId',
                  style: const TextStyle(
                    fontSize: 10,
                    fontFamily: 'monospace',
                    color: AppColors.textSecondary,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            name,
            style: AppTextStyles.bodyMedium.copyWith(
              fontWeight: FontWeight.w700,
              fontSize: 12,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          if (role != null && role.isNotEmpty)
            Text(
              role,
              style: const TextStyle(
                fontSize: 10,
                color: AppColors.textSecondary,
              ),
            ),
          const SizedBox(height: 8),
          Text(
            'From: $origShowroom',
            style: const TextStyle(
              fontSize: 10,
              color: AppColors.textSecondary,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            'To: $assignedShowroom',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: Colors.purple.shade900,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildAuditRow(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 90,
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: AppTextStyles.bodySmall.copyWith(
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
        ),
      ],
    );
  }
}
