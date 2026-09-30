import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class BillingSuiteScope extends InheritedWidget {
  const BillingSuiteScope({super.key, required super.child});

  static bool maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<BillingSuiteScope>() != null;

  @override
  bool updateShouldNotify(BillingSuiteScope oldWidget) => false;
}

class AppShell extends ConsumerWidget {
  final Widget child;
  final String? currentLocation;

  const AppShell({super.key, required this.child, this.currentLocation});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return child;
  }
}
