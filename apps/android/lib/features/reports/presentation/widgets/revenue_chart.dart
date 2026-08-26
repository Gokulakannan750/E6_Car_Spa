import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../models/report_dashboard_model.dart';

class RevenueChart extends StatelessWidget {
  final DashboardSalesModel sales;
  final DashboardPaymentCollectionModel paymentCollection;

  const RevenueChart({
    super.key,
    required this.sales,
    required this.paymentCollection,
  });

  String _formatCurrency(double value) {
    final formatter = NumberFormat.currency(
      locale: 'en_IN',
      symbol: '₹',
      decimalDigits: 2,
    );
    return formatter.format(value);
  }

  @override
  Widget build(BuildContext context) {
    final totalSales = sales.netSales;
    final totalCollected = paymentCollection.totalReceived;
    final collectionRate = totalSales > 0 ? (totalCollected / totalSales) * 100 : 0.0;

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
                  Icon(Icons.insights, size: 18, color: AppColors.primary),
                  SizedBox(width: 8),
                  Text(
                    'Revenue vs. Collections',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.success.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(AppTheme.radiusSM),
                  border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
                ),
                child: Text(
                  '${collectionRate.toStringAsFixed(1)}% Collected',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.success,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Total Comparison Bars
          _buildComparisonRow(
            label: 'Net Billed Sales',
            amount: totalSales,
            color: AppColors.primary,
            fraction: 1.0,
          ),
          const SizedBox(height: 10),
          _buildComparisonRow(
            label: 'Collections Received',
            amount: totalCollected,
            color: AppColors.success,
            fraction: totalSales > 0 ? (totalCollected / totalSales).clamp(0.0, 1.0) : (totalCollected > 0 ? 1.0 : 0.0),
          ),
          const SizedBox(height: 10),
          _buildComparisonRow(
            label: 'Outstanding Balance',
            amount: sales.outstanding,
            color: AppColors.warning,
            fraction: totalSales > 0 ? (sales.outstanding / totalSales).clamp(0.0, 1.0) : (sales.outstanding > 0 ? 1.0 : 0.0),
          ),

          const SizedBox(height: 20),
          const Divider(color: AppColors.border, height: 1),
          const SizedBox(height: 14),

          // Payment Methods Breakdown
          const Text(
            'Collections by Payment Method',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 10),

          if (paymentCollection.breakdownByMethod.isEmpty || totalCollected == 0)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text(
                'No payment transactions recorded in this period.',
                style: TextStyle(fontSize: 12, color: AppColors.textTertiary, fontStyle: FontStyle.italic),
              ),
            )
          else
            Column(
              children: paymentCollection.breakdownByMethod.map((item) {
                final percentage = totalCollected > 0 ? (item.amount / totalCollected) * 100 : 0.0;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 90,
                        child: Text(
                          item.method,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: (percentage / 100).clamp(0.0, 1.0),
                            backgroundColor: AppColors.surfaceAlt,
                            valueColor: AlwaysStoppedAnimation<Color>(_getMethodColor(item.method)),
                            minHeight: 6,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      SizedBox(
                        width: 75,
                        child: Text(
                          _formatCurrency(item.amount),
                          textAlign: TextAlign.right,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
        ],
      ),
    );
  }

  Color _getMethodColor(String method) {
    switch (method.toLowerCase()) {
      case 'cash':
        return AppColors.success;
      case 'upi':
        return AppColors.primary;
      case 'card':
        return const Color(0xFF7C3AED); // Purple
      case 'banktransfer':
      case 'bank transfer':
        return const Color(0xFF0284C7); // Sky Blue
      default:
        return AppColors.accent;
    }
  }

  Widget _buildComparisonRow({
    required String label,
    required double amount,
    required Color color,
    required double fraction,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: AppColors.textSecondary,
              ),
            ),
            Text(
              _formatCurrency(amount),
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: fraction,
            backgroundColor: AppColors.surfaceAlt,
            valueColor: AlwaysStoppedAnimation<Color>(color),
            minHeight: 8,
          ),
        ),
      ],
    );
  }
}
