import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/format_utils.dart';
import '../../models/audit_log_model.dart';

/// Everything recorded about one action, including the values before and after when there were any.
class AuditLogDetailSheet extends StatelessWidget {
  final AuditLogEntry entry;

  const AuditLogDetailSheet({super.key, required this.entry});

  static Future<void> show(BuildContext context, AuditLogEntry entry) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => AuditLogDetailSheet(entry: entry),
    );
  }

  Widget _row(String label, String? value) {
    if (value == null || value.trim().isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 96,
            child: Text(
              label,
              style: AppTextStyles.caption.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          ),
          Expanded(child: Text(value, style: AppTextStyles.bodySmall)),
        ],
      ),
    );
  }

  Widget _values(String label, String? raw, Key key) {
    final text = AuditLogEntry.prettyValues(raw);
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: AppTextStyles.caption.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 4),
          Container(
            key: key,
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(8),
            ),
            child: SelectableText(
              text.isEmpty ? 'None' : text,
              style: const TextStyle(
                fontFamily: 'monospace',
                fontSize: 11,
                color: Color(0xFFE2E8F0),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final record = [
      if (entry.entityType?.isNotEmpty ?? false) entry.entityType!,
      if (entry.entityReference?.isNotEmpty ?? false) entry.entityReference!,
    ].join(' · ');

    return Padding(
      padding: const EdgeInsets.all(16),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(entry.action, style: AppTextStyles.headingMedium),
            const SizedBox(height: 4),
            Text(entry.description, style: AppTextStyles.bodyMedium),
            const SizedBox(height: 12),
            _row('When', FormatUtils.formatDateTime(entry.timestamp)),
            _row('Who', entry.userName),
            _row('Role', entry.userRole),
            _row('Module', entry.module),
            _row('Record', record),
            _row('Outcome', entry.outcome),
            _row('Device address', entry.ipAddress),
            _values(
              'Before',
              entry.oldValues,
              const Key('audit_detail_before'),
            ),
            _values('After', entry.newValues, const Key('audit_detail_after')),
            if (entry.metadata?.trim().isNotEmpty ?? false)
              _values(
                'Extra details',
                entry.metadata,
                const Key('audit_detail_metadata'),
              ),
          ],
        ),
      ),
    );
  }
}
