import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../models/report_dashboard_model.dart';

class JobStatusChart extends StatelessWidget {
  final JobCardKpisModel jobCardKpis;

  const JobStatusChart({
    super.key,
    required this.jobCardKpis,
  });

  @override
  Widget build(BuildContext context) {
    final total = jobCardKpis.totalJobCards;
    final completed = jobCardKpis.completedJobCards;
    final inProgress = jobCardKpis.inProgressJobCards;
    final draft = jobCardKpis.newJobCards;
    final cancelled = jobCardKpis.cancelledJobCards;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppTheme.radiusLG),
        border: Border.all(color: AppColors.border),
        boxShadow: const [
          BoxShadow(
            color: Color(0x08000000),
            blurRadius: 4,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.pie_chart_outline, size: 18, color: AppColors.primary),
                  SizedBox(width: 8),
                  Text(
                    'Job Cards Distribution',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
              Text(
                '$total Total',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          if (total == 0)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: Center(
                child: Text(
                  'No job cards created in this period.',
                  style: TextStyle(fontSize: 12, color: AppColors.textTertiary, fontStyle: FontStyle.italic),
                ),
              ),
            )
          else ...[
            // Status breakdown segments
            _buildStatusItem(
              label: 'Completed / Delivered',
              count: completed,
              total: total,
              color: AppColors.success,
            ),
            const SizedBox(height: 8),
            _buildStatusItem(
              label: 'In Progress / QC',
              count: inProgress,
              total: total,
              color: AppColors.primary,
            ),
            const SizedBox(height: 8),
            _buildStatusItem(
              label: 'Draft',
              count: draft,
              total: total,
              color: AppColors.warning,
            ),
            const SizedBox(height: 8),
            _buildStatusItem(
              label: 'Cancelled',
              count: cancelled,
              total: total,
              color: AppColors.error,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStatusItem({
    required String label,
    required int count,
    required int total,
    required Color color,
  }) {
    final percentage = total > 0 ? (count / total) * 100 : 0.0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
            Text(
              '$count (${percentage.toStringAsFixed(1)}%)',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: (percentage / 100).clamp(0.0, 1.0),
            backgroundColor: AppColors.surfaceAlt,
            valueColor: AlwaysStoppedAnimation<Color>(color),
            minHeight: 6,
          ),
        ),
      ],
    );
  }
}
