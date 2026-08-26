import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';

class AdvanceKpiSection extends StatelessWidget {
  final double outstandingAmount;
  final double settledAmount;
  final int activeCount;

  const AdvanceKpiSection({
    super.key,
    required this.outstandingAmount,
    required this.settledAmount,
    required this.activeCount,
  });

  String _formatCurrency(double amount) {
    final parts = amount.toStringAsFixed(2).split('.');
    final integerPart = parts[0];
    final decimalPart = parts[1];

    final reg = RegExp(r'(\d+?)(?=(\d\d)+(\d)(?!\d))');
    final formattedInt = integerPart.replaceAllMapped(reg, (Match m) => '${m[1]},');
    return '₹$formattedInt.$decimalPart';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          // KPI 1: Outstanding Advances
          Expanded(
            child: _KpiCard(
              title: 'Outstanding',
              value: _formatCurrency(outstandingAmount),
              subtitle: 'Active balance',
              icon: Icons.pending_actions_rounded,
              color: AppColors.warning,
              backgroundColor: AppColors.qualityCheckBg,
              borderColor: AppColors.qualityCheckBorder,
            ),
          ),
          const SizedBox(width: 8),

          // KPI 2: Settled Advances
          Expanded(
            child: _KpiCard(
              title: 'Settled',
              value: _formatCurrency(settledAmount),
              subtitle: 'Cleared advances',
              icon: Icons.check_circle_outline_rounded,
              color: AppColors.success,
              backgroundColor: AppColors.readyBg,
              borderColor: AppColors.readyBorder,
            ),
          ),
          const SizedBox(width: 8),

          // KPI 3: Active Count
          Expanded(
            child: _KpiCard(
              title: 'Active Total',
              value: '$activeCount',
              subtitle: 'Advances count',
              icon: Icons.account_balance_wallet_outlined,
              color: AppColors.primary,
              backgroundColor: AppColors.inProgressBg,
              borderColor: AppColors.inProgressBorder,
              isInteger: true,
            ),
          ),
        ],
      ),
    );
  }
}

class _KpiCard extends StatelessWidget {
  final String title;
  final String value;
  final String subtitle;
  final IconData icon;
  final Color color;
  final Color backgroundColor;
  final Color borderColor;
  final bool isInteger;

  const _KpiCard({
    required this.title,
    required this.value,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.backgroundColor,
    required this.borderColor,
    this.isInteger = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: borderColor, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: AppTextStyles.labelSmall.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                  fontSize: 11,
                ),
              ),
              Icon(icon, size: 14, color: color),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: AppTextStyles.headingSmall.copyWith(
              fontWeight: FontWeight.w700,
              fontFamily: isInteger ? null : 'monospace',
              color: color,
              fontSize: 13,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            style: AppTextStyles.labelSmall.copyWith(
              color: AppColors.textTertiary,
              fontSize: 10,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
