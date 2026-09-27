import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../models/showroom_staff_assignment_model.dart';
import '../../providers/daily_staff_provider.dart';
import 'swap_details_modal_sheet.dart';

class ShowroomSwapHistoryModalSheet extends ConsumerStatefulWidget {
  final String showroomId;
  final String showroomName;
  final bool canReverse;

  const ShowroomSwapHistoryModalSheet({
    super.key,
    required this.showroomId,
    required this.showroomName,
    this.canReverse = true,
  });

  @override
  ConsumerState<ShowroomSwapHistoryModalSheet> createState() =>
      _ShowroomSwapHistoryModalSheetState();
}

class _ShowroomSwapHistoryModalSheetState
    extends ConsumerState<ShowroomSwapHistoryModalSheet> {
  List<ShowroomStaffSwap> _swaps = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final history = await ref
          .read(dailyStaffProvider(widget.showroomId).notifier)
          .getSwapHistory();
      if (!mounted) return;
      setState(() {
        _swaps = history;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load swap history.';
        _isLoading = false;
      });
    }
  }

  void _openSwapDetails(String swapId) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => SwapDetailsModalSheet(
        showroomId: widget.showroomId,
        swapId: swapId,
        canReverse: widget.canReverse,
      ),
    ).then((_) => _loadHistory());
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('dd MMM yyyy');

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
                  child: const Icon(Icons.history, color: Colors.purple, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Swap History',
                        style: AppTextStyles.headingSmall.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        widget.showroomName,
                        style: AppTextStyles.bodySmall.copyWith(
                          color: AppColors.textSecondary,
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
                              const Icon(Icons.error_outline, size: 40, color: AppColors.error),
                              const SizedBox(height: 10),
                              Text(_error!, style: const TextStyle(color: AppColors.error)),
                              const SizedBox(height: 12),
                              OutlinedButton(
                                onPressed: _loadHistory,
                                child: const Text('Retry'),
                              ),
                            ],
                          ),
                        ),
                      )
                    : _swaps.isEmpty
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.all(32),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(
                                    Icons.swap_horiz,
                                    size: 48,
                                    color: AppColors.textSecondary,
                                  ),
                                  const SizedBox(height: 12),
                                  Text(
                                    'No staff swaps recorded for this showroom.',
                                    textAlign: TextAlign.center,
                                    style: AppTextStyles.bodyMedium.copyWith(
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.all(16),
                            itemCount: _swaps.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 10),
                            itemBuilder: (ctx, index) {
                              final swap = _swaps[index];
                              return InkWell(
                                onTap: () => _openSwapDetails(swap.swapId),
                                borderRadius: BorderRadius.circular(10),
                                child: Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: AppColors.surfaceAlt,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: AppColors.border),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceBetween,
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 8,
                                              vertical: 2,
                                            ),
                                            decoration: BoxDecoration(
                                              color: Colors.purple.withAlpha(25),
                                              borderRadius:
                                                  BorderRadius.circular(4),
                                            ),
                                            child: Text(
                                              '#${swap.swapId}',
                                              style: TextStyle(
                                                fontSize: 11,
                                                fontFamily: 'monospace',
                                                fontWeight: FontWeight.w700,
                                                color: Colors.purple.shade900,
                                              ),
                                            ),
                                          ),
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 8,
                                              vertical: 2,
                                            ),
                                            decoration: BoxDecoration(
                                              color: swap.status == 'Completed'
                                                  ? AppColors.readyBg
                                                  : Colors.amber.shade50,
                                              borderRadius:
                                                  BorderRadius.circular(12),
                                              border: Border.all(
                                                color: swap.status == 'Completed'
                                                    ? AppColors.readyBorder
                                                    : Colors.amber.shade300,
                                              ),
                                            ),
                                            child: Text(
                                              swap.status,
                                              style: TextStyle(
                                                fontSize: 10,
                                                fontWeight: FontWeight.w700,
                                                color: swap.status == 'Completed'
                                                    ? AppColors.success
                                                    : Colors.amber.shade900,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 8),
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              '${swap.staffAName} ⇄ ${swap.staffBName}',
                                              style: AppTextStyles.bodyMedium
                                                  .copyWith(
                                                fontWeight: FontWeight.w700,
                                                fontSize: 13,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        '${swap.showroomAName} ⇄ ${swap.showroomBName}',
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: AppColors.textSecondary,
                                        ),
                                      ),
                                      if (swap.coverageStartTime != null && swap.coverageEndTime != null) ...[
                                        const SizedBox(height: 6),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: Colors.purple.withAlpha(12),
                                            borderRadius: BorderRadius.circular(6),
                                            border: Border.all(color: Colors.purple.withAlpha(35)),
                                          ),
                                          child: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              const Icon(Icons.access_time, size: 12, color: Colors.purple),
                                              const SizedBox(width: 4),
                                              Text(
                                                'Coverage: ${swap.coverageStartTime} – ${swap.coverageEndTime} (${swap.coverageDurationFormatted ?? (swap.coverageDurationHours != null ? "${swap.coverageDurationHours} hours" : "")})',
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.w600,
                                                  color: Colors.purple.shade900,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                      const SizedBox(height: 6),
                                      Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceBetween,
                                        children: [
                                          Text(
                                            dateFormat.format(swap.date),
                                            style: const TextStyle(
                                              fontSize: 11,
                                              color: AppColors.textSecondary,
                                            ),
                                          ),
                                          const Text(
                                            'View Details ›',
                                            style: TextStyle(
                                              fontSize: 11,
                                              color: Colors.purple,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}
