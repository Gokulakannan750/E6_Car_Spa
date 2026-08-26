import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../shared/widgets/app_modal_header.dart';
import '../../models/audit_log_model.dart';

class AuditLogDetailSheet extends StatelessWidget {
  final AuditLogModel log;

  const AuditLogDetailSheet({
    super.key,
    required this.log,
  });

  static Future<void> show(BuildContext context, AuditLogModel log) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => AuditLogDetailSheet(log: log),
    );
  }

  @override
  Widget build(BuildContext context) {
    final localTime = log.timestampUtc.toLocal();
    final formattedTime =
        DateFormat('dd MMM yyyy, hh:mm:ss a').format(localTime);
    final isSuccess = log.isSuccess;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.9,
      ),
      decoration: const BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: AppModalHeader(
              title: 'Audit Event Details',
              icon: Icons.history_rounded,
              iconBgColor: AppColors.accentPill,
              iconColor: AppColors.primary,
              showDragHandle: true,
            ),
          ),

          // Scrollable Body
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Overview Grid Box
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceAlt,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: _buildInfoItem(
                                'Timestamp',
                                formattedTime,
                              ),
                            ),
                            Expanded(
                              child: _buildInfoItem(
                                'Outcome',
                                log.outcome,
                                valueColor: isSuccess
                                    ? AppColors.success
                                    : AppColors.error,
                                isBold: true,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: _buildInfoItem(
                                'Module',
                                log.module,
                                isBold: true,
                              ),
                            ),
                            Expanded(
                              child: _buildInfoItem(
                                'Action',
                                log.action,
                                isBold: true,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: _buildInfoItem(
                                'User (Actor)',
                                log.userName ?? 'Anonymous / System',
                              ),
                            ),
                            Expanded(
                              child: _buildInfoItem(
                                'Role Snapshot',
                                log.userRole ?? '—',
                              ),
                            ),
                          ],
                        ),
                        if ((log.entityType != null &&
                                log.entityType!.isNotEmpty) ||
                            (log.entityReference != null &&
                                log.entityReference!.isNotEmpty) ||
                            (log.ipAddress != null &&
                                log.ipAddress!.isNotEmpty)) ...[
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: _buildInfoItem(
                                  'Entity Type',
                                  log.entityType ?? '—',
                                ),
                              ),
                              Expanded(
                                child: _buildInfoItem(
                                  'Entity Reference',
                                  log.entityReference ?? '—',
                                  valueColor: AppColors.primary,
                                  isBold: true,
                                ),
                              ),
                            ],
                          ),
                          if (log.ipAddress != null &&
                              log.ipAddress!.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Expanded(
                                  child: _buildInfoItem(
                                    'IP Address',
                                    log.ipAddress!,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Description
                  const Text(
                    'EVENT DESCRIPTION',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Text(
                      log.description,
                      style: const TextStyle(
                        fontSize: 13,
                        height: 1.4,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),

                  // Previous State (Old Values)
                  if (log.oldValues != null && log.oldValues!.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    const Text(
                      'PREVIOUS STATE (OLD VALUES)',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    _buildJsonBox(log.oldValues!),
                  ],

                  // New State (New Values)
                  if (log.newValues != null && log.newValues!.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    const Text(
                      'NEW STATE (NEW VALUES)',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    _buildJsonBox(log.newValues!),
                  ],

                  // Additional Metadata
                  if (log.metadata != null && log.metadata!.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    const Text(
                      'ADDITIONAL METADATA',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    _buildJsonBox(log.metadata!),
                  ],

                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),

          // Footer Notice & Close Button
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            decoration: const BoxDecoration(
              color: AppColors.surfaceAlt,
              border: Border(top: BorderSide(color: AppColors.border)),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.shield_outlined,
                  size: 16,
                  color: AppColors.textTertiary,
                ),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    'Immutable System Record — Append-only',
                    style: TextStyle(
                      fontSize: 11,
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryContainer,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 18,
                      vertical: 10,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: const Text('Close'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoItem(
    String label,
    String value, {
    Color? valueColor,
    bool isBold = false,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w500,
            color: AppColors.textTertiary,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
            color: valueColor ?? AppColors.textPrimary,
          ),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }

  Widget _buildJsonBox(String raw) {
    String displayContent = raw;
    try {
      final parsed = jsonDecode(raw);
      displayContent = const JsonEncoder.withIndent('  ').convert(parsed);
    } catch (_) {
      displayContent = raw;
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A), // Dark slate/navy
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFF1E293B)),
      ),
      child: Text(
        displayContent,
        style: const TextStyle(
          fontFamily: 'monospace',
          fontSize: 11.5,
          color: Color(0xFFE2E8F0),
          height: 1.4,
        ),
      ),
    );
  }
}
