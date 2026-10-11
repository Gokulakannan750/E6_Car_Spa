import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_screen_scaffold.dart';
import '../../../auth/providers/auth_provider.dart';
import '../widgets/whatsapp_connection_tab.dart';
import '../widgets/whatsapp_templates_tab.dart';
import '../widgets/whatsapp_usage_tab.dart';

/// Set up the company's WhatsApp, follow its message templates, and see what was sent. Anyone who can view settings can
/// look; changing things needs the business-settings permission.
class WhatsAppSettingsScreen extends ConsumerWidget {
  const WhatsAppSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final canView = user?.hasPermission('settings.view') ?? false;
    final canManage = user?.hasPermission('settings.business') ?? false;

    return AppScreenScaffold(
      title: 'WhatsApp',
      onBackPressed: () => context.go(AppRoutes.settings),
      body: !canView
          ? const AppEmptyState(
              key: Key('whatsapp_restricted'),
              icon: Icons.lock_outline,
              title: 'Access restricted',
              message: 'You do not have permission to view WhatsApp settings.',
            )
          : DefaultTabController(
              length: 3,
              child: Column(
                children: [
                  const TabBar(
                    tabs: [
                      Tab(
                        key: Key('whatsapp_tab_connection'),
                        text: 'Connection',
                      ),
                      Tab(
                        key: Key('whatsapp_tab_templates'),
                        text: 'Templates',
                      ),
                      Tab(key: Key('whatsapp_tab_usage'), text: 'Usage'),
                    ],
                  ),
                  Expanded(
                    child: TabBarView(
                      children: [
                        WhatsAppConnectionTab(canManage: canManage),
                        WhatsAppTemplatesTab(canManage: canManage),
                        const WhatsAppUsageTab(),
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
