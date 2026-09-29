import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../models/outside_job_model.dart';

class VehicleLocationBadge extends StatelessWidget {
  final VehicleLocation? location;

  const VehicleLocationBadge({
    super.key,
    required this.location,
  });

  @override
  Widget build(BuildContext context) {
    final bool isOutside = location?.isOutside == true;
    final bool isOverdue = location?.isOverdue == true;
    final String? vendorName = location?.vendorName?.trim();
    final bool hasVendor = vendorName != null && vendorName.isNotEmpty;

    final Color bg;
    final Color border;
    final Color text;
    final Color dot;

    if (!isOutside) {
      bg = AppColors.successLight;
      border = AppColors.success;
      text = AppColors.successDark;
      dot = AppColors.success;
    } else if (isOverdue) {
      bg = AppColors.errorLight;
      border = AppColors.error;
      text = AppColors.errorDark;
      dot = AppColors.error;
    } else {
      bg = AppColors.warningLight;
      border = AppColors.warning;
      text = AppColors.warningDark;
      dot = AppColors.warning;
    }

    if (!isOutside) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: border.withValues(alpha: 0.35)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(color: dot, shape: BoxShape.circle),
            ),
            const SizedBox(width: 5),
            Text(
              'Our Showroom',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: text,
              ),
            ),
          ],
        ),
      );
    }

    // Wrapped in 2 lines for Outside Workshop
    return Container(
      constraints: const BoxConstraints(maxWidth: 190),
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3.5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: border.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(color: dot, shape: BoxShape.circle),
              ),
              const SizedBox(width: 5),
              Flexible(
                child: Text(
                  isOverdue ? 'Outside Workshop • Overdue' : 'Outside Workshop',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: text,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          if (hasVendor)
            Padding(
              padding: const EdgeInsets.only(left: 11, top: 1),
              child: Text(
                vendorName,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                  color: text.withValues(alpha: 0.85),
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
        ],
      ),
    );
  }
}
