import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../models/job_card_model.dart';

class JobCardPrintPreviewDialog extends StatelessWidget {
  final JobCard jobCard;

  const JobCardPrintPreviewDialog({
    super.key,
    required this.jobCard,
  });

  static Future<void> show(BuildContext context, JobCard jobCard) {
    return showDialog(
      context: context,
      builder: (context) => JobCardPrintPreviewDialog(jobCard: jobCard),
    );
  }

  String _formatDate(DateTime? date) {
    if (date == null) return '—';
    final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${date.day} ${months[date.month - 1]} ${date.year}';
  }

  String _formatCurrency(double amount) {
    return '₹${amount.toStringAsFixed(2)}';
  }

  @override
  Widget build(BuildContext context) {
    final vehicleDetails = [
      if (jobCard.vehicle.make.isNotEmpty) jobCard.vehicle.make,
      jobCard.vehicle.model,
      if (jobCard.vehicle.variant != null && jobCard.vehicle.variant!.isNotEmpty)
        '(${jobCard.vehicle.variant})',
      if (jobCard.vehicle.color != null && jobCard.vehicle.color!.isNotEmpty)
        '- ${jobCard.vehicle.color}',
    ].join(' ').trim();

    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 500, maxHeight: 750),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            // Action Bar (Top)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: const BoxDecoration(
                color: Color(0xFF0B1228),
                borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.print_outlined, color: Colors.white, size: 20),
                      const SizedBox(width: 8),
                      Text(
                        'Job Card Print Preview',
                        style: AppTextStyles.headingSmall.copyWith(color: Colors.white),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      IconButton(
                        key: const Key('print_action_button'),
                        tooltip: 'Print',
                        icon: const Icon(Icons.print, color: Colors.white),
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Sent ${jobCard.jobCardNumber} to printer.'),
                              backgroundColor: AppColors.success,
                            ),
                          );
                        },
                      ),
                      IconButton(
                        key: const Key('modal_close_button'),
                        tooltip: 'Close',
                        icon: const Icon(Icons.close, color: Colors.white),
                        onPressed: () {
                          FocusScope.of(context).unfocus();
                          Navigator.of(context, rootNavigator: true).pop();
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // Document Body (Scrollable printable page matching Desktop)
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: const Color(0xFFCBD5E1)),
                    borderRadius: BorderRadius.circular(8),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withAlpha(8),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Header: Brand & Work Order Title
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    width: 28,
                                    height: 28,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFA11A1A),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: const Center(
                                      child: Text(
                                        'E6',
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  const Text(
                                    'E6 Car Spa',
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w800,
                                      color: Color(0xFFA11A1A),
                                      letterSpacing: -0.5,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 2),
                              Text(
                                jobCard.jobCardNumber,
                                style: const TextStyle(
                                  fontFamily: 'monospace',
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF475569),
                                ),
                              ),
                            ],
                          ),
                          const Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                'JOB CARD',
                                style: TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w900,
                                  color: Color(0xFFA11A1A),
                                  letterSpacing: 0.5,
                                ),
                              ),
                              Text(
                                'Workshop work order',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: Color(0xFF64748B),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),

                      // Red Accent Divider Line (#A11A1A)
                      Container(
                        height: 3,
                        color: const Color(0xFFA11A1A),
                        margin: const EdgeInsets.symmetric(vertical: 12),
                      ),

                      // Customer / Vehicle Info Table (Desktop Parity)
                      Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: const Color(0xFF94A3B8)),
                        ),
                        child: Column(
                          children: [
                            // Row 1: Date & Customer Name
                            _buildInfoTableRow(
                              label1: 'Date',
                              value1: _formatDate(jobCard.createdAt),
                              label2: 'Customer',
                              value2: jobCard.customer.name,
                              isFirst: true,
                            ),
                            // Row 2: Customer Phone & Vehicle Reg No
                            _buildInfoTableRow(
                              label1: 'Phone',
                              value1: jobCard.customer.phoneNumber.isNotEmpty
                                  ? jobCard.customer.phoneNumber
                                  : '—',
                              label2: 'Vehicle No',
                              value2: jobCard.vehicle.registrationNumber.isNotEmpty
                                  ? jobCard.vehicle.registrationNumber
                                  : '—',
                              isBold2: true,
                            ),
                            // Row 3: Vehicle Model
                            Container(
                              decoration: const BoxDecoration(
                                border: Border(
                                  top: BorderSide(color: Color(0xFF94A3B8)),
                                ),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 75,
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                                    color: const Color(0xFFEBEBEB),
                                    child: const Text(
                                      'Model',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFF1E293B),
                                      ),
                                    ),
                                  ),
                                  Container(
                                    width: 1,
                                    height: 32,
                                    color: const Color(0xFF94A3B8),
                                  ),
                                  Expanded(
                                    child: Padding(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                                      child: Text(
                                        vehicleDetails.isNotEmpty ? vehicleDetails : '—',
                                        style: const TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w500,
                                          color: Color(0xFF0F172A),
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Jobs to be Done Section
                      const Text(
                        'Jobs to be done',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFFA11A1A),
                        ),
                      ),
                      const SizedBox(height: 6),

                      // Services Table
                      Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: const Color(0xFF94A3B8)),
                        ),
                        child: Column(
                          children: [
                            // Table Header
                            Container(
                              color: const Color(0xFFDCDCDC),
                              child: Row(
                                children: const [
                                  SizedBox(
                                    width: 32,
                                    child: Padding(
                                      padding: EdgeInsets.symmetric(vertical: 6),
                                      child: Text('#', textAlign: TextAlign.center, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                                    ),
                                  ),
                                  Expanded(
                                    child: Padding(
                                      padding: EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                                      child: Text('Service', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                                    ),
                                  ),
                                  SizedBox(
                                    width: 44,
                                    child: Padding(
                                      padding: EdgeInsets.symmetric(vertical: 6),
                                      child: Text('Qty', textAlign: TextAlign.center, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                                    ),
                                  ),
                                  SizedBox(
                                    width: 48,
                                    child: Padding(
                                      padding: EdgeInsets.symmetric(vertical: 6),
                                      child: Text('Done', textAlign: TextAlign.center, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            // Service Rows
                            if (jobCard.services.isEmpty)
                              const Padding(
                                padding: EdgeInsets.all(12),
                                child: Text('No services specified for this job card.', style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontStyle: FontStyle.italic)),
                              )
                            else
                              ...jobCard.services.asMap().entries.map((entry) {
                                final idx = entry.key;
                                final svc = entry.value;
                                return Container(
                                  decoration: const BoxDecoration(
                                    border: Border(top: BorderSide(color: Color(0xFFCBD5E1))),
                                  ),
                                  child: Row(
                                    children: [
                                      SizedBox(
                                        width: 32,
                                        child: Padding(
                                          padding: const EdgeInsets.symmetric(vertical: 6),
                                          child: Text('${idx + 1}', textAlign: TextAlign.center, style: const TextStyle(fontSize: 11)),
                                        ),
                                      ),
                                      Expanded(
                                        child: Padding(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                                          child: Text(svc.serviceName, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500)),
                                        ),
                                      ),
                                      SizedBox(
                                        width: 44,
                                        child: Padding(
                                          padding: const EdgeInsets.symmetric(vertical: 6),
                                          child: Text('${svc.quantity}', textAlign: TextAlign.center, style: const TextStyle(fontSize: 11)),
                                        ),
                                      ),
                                      SizedBox(
                                        width: 48,
                                        child: Center(
                                          child: Container(
                                            width: 14,
                                            height: 14,
                                            decoration: BoxDecoration(
                                              border: Border.all(color: const Color(0xFF64748B)),
                                              borderRadius: BorderRadius.circular(2),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              }),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Financial Summary
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Column(
                          children: [
                            _buildSummaryRow('Subtotal', _formatCurrency(jobCard.subtotal)),
                            if (jobCard.discountAmount > 0)
                              _buildSummaryRow('Discount', '-${_formatCurrency(jobCard.discountAmount)}', isDiscount: true),
                            _buildSummaryRow('Tax (GST 18%)', _formatCurrency(jobCard.taxAmount)),
                            const Divider(height: 10, color: Color(0xFFCBD5E1)),
                            _buildSummaryRow('Estimated Total', _formatCurrency(jobCard.totalAmount), isBold: true),
                          ],
                        ),
                      ),

                      // Notes (if present)
                      if (jobCard.notes != null && jobCard.notes!.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFFBEB),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(color: const Color(0xFFFDE68A)),
                          ),
                          child: Text(
                            'Notes: ${jobCard.notes!}',
                            style: const TextStyle(fontSize: 11, color: Color(0xFF92400E)),
                          ),
                        ),
                      ],
                      const SizedBox(height: 24),

                      // Signatures block
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(height: 1, color: const Color(0xFF94A3B8)),
                                const SizedBox(height: 4),
                                const Text('Customer Signature', style: TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                              ],
                            ),
                          ),
                          const SizedBox(width: 32),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(height: 1, color: const Color(0xFF94A3B8)),
                                const SizedBox(height: 4),
                                const Text('Technician Signature', style: TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoTableRow({
    required String label1,
    required String value1,
    required String label2,
    required String value2,
    bool isFirst = false,
    bool isBold2 = false,
  }) {
    return Container(
      decoration: BoxDecoration(
        border: isFirst ? null : const Border(top: BorderSide(color: Color(0xFF94A3B8))),
      ),
      child: Row(
        children: [
          // Col 1: Label
          Container(
            width: 75,
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            color: const Color(0xFFEBEBEB),
            child: Text(
              label1,
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
            ),
          ),
          Container(width: 1, height: 32, color: const Color(0xFF94A3B8)),
          // Col 1: Value
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              child: Text(
                value1,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Color(0xFF0F172A)),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
          Container(width: 1, height: 32, color: const Color(0xFF94A3B8)),
          // Col 2: Label
          Container(
            width: 75,
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            color: const Color(0xFFEBEBEB),
            child: Text(
              label2,
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
            ),
          ),
          Container(width: 1, height: 32, color: const Color(0xFF94A3B8)),
          // Col 2: Value
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              child: Text(
                value2,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: isBold2 ? FontWeight.w800 : FontWeight.w500,
                  fontFamily: isBold2 ? 'monospace' : null,
                  color: const Color(0xFF0F172A),
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value, {bool isBold = false, bool isDiscount = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: isBold ? 13 : 11,
              fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
              color: isBold ? const Color(0xFF0F172A) : const Color(0xFF64748B),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: isBold ? 14 : 11,
              fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
              fontFamily: 'monospace',
              color: isBold
                  ? const Color(0xFFA11A1A)
                  : (isDiscount ? AppColors.error : const Color(0xFF0F172A)),
            ),
          ),
        ],
      ),
    );
  }
}
