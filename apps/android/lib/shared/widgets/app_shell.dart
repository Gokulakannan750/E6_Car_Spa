import 'package:flutter/material.dart';

/// Shell wrapper for authenticated routes.
/// In the pure 2-level suite launcher architecture, bottom navigation is removed.
/// Dashboard acts as the Level-1 Suite Launcher, and all Level-2 applications
/// provide top AppBar back navigation directly back to the Dashboard.
class AppShell extends StatelessWidget {
  final Widget child;
  final String? currentLocation;

  const AppShell({
    super.key,
    required this.child,
    this.currentLocation,
  });

  @override
  Widget build(BuildContext context) {
    return child;
  }
}
