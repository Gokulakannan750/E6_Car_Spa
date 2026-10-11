import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/format_utils.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../data/whatsapp_repository.dart';
import '../../models/whatsapp_models.dart';
import '../../providers/whatsapp_providers.dart';
import 'whatsapp_widgets.dart';

const _monthNames = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/// How many messages went out each month, and who the failed or skipped ones were for.
class WhatsAppUsageTab extends ConsumerStatefulWidget {
  const WhatsAppUsageTab({super.key});

  @override
  ConsumerState<WhatsAppUsageTab> createState() => _WhatsAppUsageTabState();
}

class _WhatsAppUsageTabState extends ConsumerState<WhatsAppUsageTab> {
  String? _status; // null = failed and skipped together
  WhatsAppUsageMonth? _month;
  final List<WhatsAppLogItem> _items = [];
  int _total = 0;
  int _page = 0;
  bool _hasMore = false;
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool more = false}) async {
    setState(() {
      if (more) {
        _loadingMore = true;
      } else {
        _loading = true;
        _items.clear();
        _page = 0;
      }
      _error = null;
    });
    try {
      final result = await ref
          .read(whatsAppRepositoryProvider)
          .getMessages(
            status: _status,
            year: _month?.year,
            month: _month?.month,
            page: _page + 1,
          );
      if (!mounted) return;
      setState(() {
        _items.addAll(result.items);
        _total = result.totalCount;
        _page = result.page;
        _hasMore = result.hasMore;
      });
    } catch (e) {
      if (mounted) {
        setState(
          () => _error = e is ApiException
              ? e.message
              : 'Could not load the messages.',
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  Widget _stat(String label, int value, Color colour) => Expanded(
    child: Column(
      children: [
        Text(
          '$value',
          style: AppTextStyles.headingSmall.copyWith(color: colour),
        ),
        Text(
          label,
          style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final usage = ref.watch(whatsAppUsageProvider);

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(whatsAppUsageProvider);
        await _load();
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Messages sent', style: AppTextStyles.headingSmall),
          const SizedBox(height: 8),
          usage.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: AppLoadingState(message: 'Loading usage...'),
            ),
            error: (e, _) => AppErrorState(
              title: 'Could not load the usage',
              message: whatsAppErrorText(e),
              retryLabel: 'Retry',
              onRetry: () => ref.invalidate(whatsAppUsageProvider),
            ),
            data: (months) => months.isEmpty
                ? Text(
                    'No messages yet.',
                    key: const Key('whatsapp_usage_empty'),
                    style: AppTextStyles.bodySmall,
                  )
                : Column(
                    children: [
                      for (final m in months)
                        InkWell(
                          key: Key('whatsapp_month_${m.year}_${m.month}'),
                          borderRadius: BorderRadius.circular(12),
                          onTap: () {
                            setState(
                              () => _month =
                                  (_month?.year == m.year &&
                                      _month?.month == m.month)
                                  ? null
                                  : m,
                            );
                            _load();
                          },
                          child: WhatsAppCard(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      '${_monthNames[(m.month - 1).clamp(0, 11)]} ${m.year}',
                                      style: AppTextStyles.bodyMedium.copyWith(
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    const Spacer(),
                                    if (_month?.year == m.year &&
                                        _month?.month == m.month)
                                      Icon(
                                        Icons.filter_alt,
                                        size: 16,
                                        color: AppColors.primary,
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Row(
                                  children: [
                                    _stat(
                                      'Total',
                                      m.total,
                                      AppColors.textPrimary,
                                    ),
                                    _stat('Sent', m.sent, AppColors.success),
                                    _stat('Failed', m.failed, AppColors.error),
                                    _stat(
                                      'Skipped',
                                      m.skipped,
                                      const Color(0xFFD97706),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
          ),
          const SizedBox(height: 8),
          Text('Messages not sent', style: AppTextStyles.headingSmall),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            children: [
              for (final option in const [
                (label: 'All', value: null),
                (label: 'Failed', value: 'failed'),
                (label: 'Skipped', value: 'skipped'),
              ])
                ChoiceChip(
                  key: Key('whatsapp_log_${option.value ?? 'all'}'),
                  label: Text(option.label),
                  selected: _status == option.value,
                  onSelected: (_) {
                    setState(() => _status = option.value);
                    _load();
                  },
                ),
              if (_month != null)
                ActionChip(
                  key: const Key('whatsapp_log_clear_month'),
                  avatar: const Icon(Icons.close, size: 14),
                  label: Text(
                    '${_monthNames[(_month!.month - 1).clamp(0, 11)]} ${_month!.year}',
                  ),
                  onPressed: () {
                    setState(() => _month = null);
                    _load();
                  },
                ),
            ],
          ),
          const SizedBox(height: 8),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: AppLoadingState(message: 'Loading messages...'),
            )
          else if (_error != null)
            WhatsAppNotice(
              noticeKey: const Key('whatsapp_log_error'),
              text: _error!,
              isError: true,
            )
          else if (_items.isEmpty)
            Text(
              'Nothing here. Every message in this view was sent.',
              key: const Key('whatsapp_log_empty'),
              style: AppTextStyles.bodySmall.copyWith(
                color: AppColors.textSecondary,
              ),
            )
          else ...[
            Text(
              '$_total ${_total == 1 ? 'message' : 'messages'}',
              style: AppTextStyles.caption.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 6),
            for (final item in _items)
              WhatsAppCard(
                cardKey: Key('whatsapp_log_item_${item.id}'),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        WhatsAppStatusPill(
                          label: item.status,
                          colour: item.status.toLowerCase() == 'failed'
                              ? AppColors.error
                              : const Color(0xFFD97706),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            '${item.typeLabel}${item.invoiceNumber == null ? '' : ' · ${item.invoiceNumber}'}',
                            style: AppTextStyles.caption,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${item.customerName} · ${formatWhatsAppPhone(item.recipientPhone)}',
                      style: AppTextStyles.bodyMedium,
                    ),
                    if ((item.reason ?? '').isNotEmpty)
                      Text(
                        item.reason!,
                        style: AppTextStyles.bodySmall.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                    Text(
                      FormatUtils.formatDateTime(item.createdAt),
                      style: AppTextStyles.caption.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            if (_hasMore)
              OutlinedButton(
                key: const Key('whatsapp_log_more'),
                onPressed: _loadingMore ? null : () => _load(more: true),
                child: _loadingMore
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Load more'),
              ),
          ],
        ],
      ),
    );
  }
}
