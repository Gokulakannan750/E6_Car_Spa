import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';

class AppKpiCard extends StatelessWidget {
 final String title;
 final String value;
 final String? subtitle;
 final IconData icon;
 final Color? iconColor;
 final VoidCallback? onTap;

 const AppKpiCard({
 super.key,
 required this.title,
 required this.value,
 this.subtitle,
 required this.icon,
 this.iconColor,
 this.onTap,
 });

 @override
 Widget build(BuildContext context) {
 final effectiveIconColor = iconColor ?? AppColors.accent;

 return Card(
 child: InkWell(
 onTap: onTap,
 borderRadius: BorderRadius.circular(8),
 child: Padding(
 padding: const EdgeInsets.all(16),
 child: Column(
 crossAxisAlignment: CrossAxisAlignment.start,
 children: [
 Row(
 children: [
 Container(
 padding: const EdgeInsets.all(8),
 decoration: BoxDecoration(
 color: effectiveIconColor.withValues(alpha: 0.1),
 borderRadius: BorderRadius.circular(8),
 ),
 child: Icon(icon, size: 20, color: effectiveIconColor),
 ),
 const Spacer(),
 if (subtitle != null)
 Icon(
 Icons.trending_up_rounded,
 size: 16,
 color: AppColors.success,
 ),
 ],
 ),
 const SizedBox(height: 12),
 Text(
 value,
 style: Theme.of(context).textTheme.headlineMedium?.copyWith(
 fontWeight: FontWeight.w700,
 color: AppColors.textPrimary,
 ),
 ),
 const SizedBox(height: 4),
 Text(
 title,
 style: Theme.of(context).textTheme.bodySmall?.copyWith(
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
