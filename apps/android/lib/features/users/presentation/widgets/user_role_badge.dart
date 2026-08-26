import 'package:flutter/material.dart';

class UserRoleBadge extends StatelessWidget {
  final String role;
  final double fontSize;

  const UserRoleBadge({
    super.key,
    required this.role,
    this.fontSize = 11,
  });

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color border;
    Color text;
    IconData icon;
    String label;

    switch (role.toLowerCase()) {
      case 'owner':
        bg = const Color(0xFFF3E8FF);
        border = const Color(0xFFE9D5FF);
        text = const Color(0xFF6B21A8);
        icon = Icons.shield_outlined;
        label = 'Owner';
        break;
      case 'manager':
        bg = const Color(0xFFDBEAFE);
        border = const Color(0xFFBFDBFE);
        text = const Color(0xFF1E40AF);
        icon = Icons.vpn_key_outlined;
        label = 'Manager';
        break;
      case 'staff':
      default:
        bg = const Color(0xFFF1F5F9);
        border = const Color(0xFFE2E8F0);
        text = const Color(0xFF475569);
        icon = Icons.person_outline;
        label = 'Staff';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: border, width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: fontSize + 2, color: text),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: FontWeight.w700,
              color: text,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}
