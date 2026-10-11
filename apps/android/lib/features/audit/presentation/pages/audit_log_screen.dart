import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/format_utils.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/app_screen_scaffold.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../models/audit_log_model.dart';
import '../../providers/audit_providers.dart';
import '../widgets/audit_log_detail_sheet.dart';

/// Who did what and when, newest first. Read-only; the server keeps the log append-only.
class AuditLogScreen extends ConsumerStatefulWidget {
  const AuditLogScreen({super.key});

  @override
  ConsumerState<AuditLogScreen> createState() => _AuditLogScreenState();
}

class _AuditLogScreenState extends ConsumerState<AuditLogScreen> {
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _pickRange(AuditFilters current) async {
    final now = DateTime.now();
    final range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 5),
      lastDate: now,
      initialDateRange: current.from != null && current.to != null
          ? DateTimeRange(start: current.from!, end: current.to!)
          : null,
    );
    if (range == null || !mounted) return;
    ref
        .read(auditLogProvider.notifier)
        .applyFilters(current.copyWith(from: range.start, to: range.end));
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    final allowed = user?.hasPermission('audit.view') ?? false;

    return AppScreenScaffold(
      title: 'Audit Trail',
      onBackPressed: () => context.go(AppRoutes.settings),
      body: allowed
          ? _buildList()
          : const AppEmptyState(
              key: Key('audit_restricted'),
              icon: Icons.lock_outline,
              title: 'Access restricted',
              message: 'You do not have permission to view the audit trail.',
            ),
    );
  }

  Widget _buildList() {
    final state = ref.watch(auditLogProvider);
    final notifier = ref.read(auditLogProvider.notifier);
    final filters = state.filters;

    return RefreshIndicator(
      onRefresh: notifier.load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            key: const Key('audit_search'),
            controller: _search,
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: 'Search description, user or record',
              prefixIcon: const Icon(Icons.search),
              isDense: true,
              border: const OutlineInputBorder(),
              suffixIcon: _search.text.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () {
                        _search.clear();
                        notifier.applyFilters(filters.copyWith(search: ''));
                        setState(() {});
                      },
                    ),
            ),
            onChanged: (_) => setState(() {}),
            onSubmitted: (value) =>
                notifier.applyFilters(filters.copyWith(search: value.trim())),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  key: const Key('audit_module_filter'),
                  initialValue: filters.module,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    isDense: true,
                    border: OutlineInputBorder(),
                    labelText: 'Module',
                  ),
                  items: [
                    for (final o in auditModuleOptions)
                      DropdownMenuItem(value: o.value, child: Text(o.label)),
                  ],
                  onChanged: (value) => notifier.applyFilters(
                    filters.copyWith(module: value ?? ''),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: DropdownButtonFormField<String>(
                  key: const Key('audit_outcome_filter'),
                  initialValue: filters.outcome,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    isDense: true,
                    border: OutlineInputBorder(),
                    labelText: 'Outcome',
                  ),
                  items: const [
                    DropdownMenuItem(value: '', child: Text('All outcomes')),
                    DropdownMenuItem(value: 'Success', child: Text('Success')),
                    DropdownMenuItem(value: 'Failure', child: Text('Failure')),
                  ],
                  onChanged: (value) => notifier.applyFilters(
                    filters.copyWith(outcome: value ?? ''),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              OutlinedButton.icon(
                key: const Key('audit_date_filter'),
                icon: const Icon(Icons.date_range, size: 18),
                label: Text(
                  filters.from == null || filters.to == null
                      ? 'Any date'
                      : '${FormatUtils.formatDate(filters.from!)} – ${FormatUtils.formatDate(filters.to!)}',
                ),
                onPressed: () => _pickRange(filters),
              ),
              const Spacer(),
              if (!filters.isEmpty)
                TextButton(
                  key: const Key('audit_clear_filters'),
                  onPressed: () {
                    _search.clear();
                    notifier.applyFilters(const AuditFilters());
                  },
                  child: const Text('Clear filters'),
                ),
            ],
          ),
          const SizedBox(height: 8),
          if (state.isLoading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: AppLoadingState(message: 'Loading audit trail...'),
            )
          else if (state.error != null && state.items.isEmpty)
            AppErrorState(
              title: 'Could not load the audit trail',
              message: state.error!,
              retryLabel: 'Retry',
              onRetry: notifier.load,
            )
          else if (state.items.isEmpty)
            const AppEmptyState(
              key: Key('audit_empty'),
              icon: Icons.history,
              title: 'Nothing recorded',
              message: 'No activity matches these filters.',
            )
          else ...[
            Text(
              '${state.totalCount} ${state.totalCount == 1 ? 'record' : 'records'}',
              key: const Key('audit_count'),
              style: AppTextStyles.caption.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 6),
            for (final entry in state.items) _AuditTile(entry: entry),
            if (state.error != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  state.error!,
                  style: AppTextStyles.bodySmall.copyWith(
                    color: AppColors.error,
                  ),
                ),
              ),
            if (state.hasMore)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: OutlinedButton(
                  key: const Key('audit_load_more'),
                  onPressed: state.isLoadingMore ? null : notifier.loadMore,
                  child: state.isLoadingMore
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Load more'),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _AuditTile extends StatelessWidget {
  final AuditLogEntry entry;

  const _AuditTile({required this.entry});

  Color get _accent {
    final a = entry.action.toUpperCase();
    if (entry.isFailure ||
        a.contains('FAILED') ||
        a.contains('DELETE') ||
        a.contains('CANCEL') ||
        a.contains('VOID')) {
      return AppColors.error;
    }
    if (a.contains('CREATE') || a.contains('SUCCESS')) {
      return AppColors.success;
    }
    return AppColors.primary;
  }

  @override
  Widget build(BuildContext context) {
    final who = [
      if (entry.userName?.isNotEmpty ?? false) entry.userName!,
      if (entry.userRole?.isNotEmpty ?? false) entry.userRole!,
    ].join(' · ');

    return Card(
      key: Key('audit_entry_${entry.id}'),
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: const BorderSide(color: AppColors.border),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: () => AuditLogDetailSheet.show(context, entry),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: _accent.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      entry.action,
                      style: AppTextStyles.caption.copyWith(
                        color: _accent,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      entry.module,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.caption.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                  Icon(
                    entry.isFailure
                        ? Icons.cancel_outlined
                        : Icons.check_circle_outline,
                    size: 16,
                    color: entry.isFailure
                        ? AppColors.error
                        : AppColors.success,
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(entry.description, style: AppTextStyles.bodyMedium),
              const SizedBox(height: 4),
              Text(
                [
                  if (who.isNotEmpty) who,
                  FormatUtils.formatDateTime(entry.timestamp),
                ].join('  ·  '),
                style: AppTextStyles.caption.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
