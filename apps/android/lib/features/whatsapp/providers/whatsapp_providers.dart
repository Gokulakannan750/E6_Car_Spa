import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/providers/auth_provider.dart';
import '../data/whatsapp_repository.dart';
import '../models/whatsapp_models.dart';

// Each one watches the signed-in user so a different user or company never sees the previous one's data.

final whatsAppConfigProvider = FutureProvider.autoDispose<WhatsAppConfig>((
  ref,
) {
  ref.watch(currentUserProvider);
  return ref.watch(whatsAppRepositoryProvider).getConfig();
});

final managedTemplatesProvider = FutureProvider.autoDispose<ManagedTemplates>((
  ref,
) {
  ref.watch(currentUserProvider);
  return ref.watch(whatsAppRepositoryProvider).getManagedTemplates();
});

final whatsAppUsageProvider =
    FutureProvider.autoDispose<List<WhatsAppUsageMonth>>((ref) {
      ref.watch(currentUserProvider);
      return ref.watch(whatsAppRepositoryProvider).getUsage();
    });
