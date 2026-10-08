import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/brand_palette.dart';
import '../../../../shared/widgets/app_business_logo.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../../auth/providers/auth_state.dart';
import '../../providers/settings_provider.dart';
import '../../providers/settings_state.dart';

/// "App colours" tab of System Preferences: the company picks its app, sidebar/login and document colours,
/// with a preview of the app, the login page and an invoice that repaints as colours are chosen.
class AppColoursTab extends ConsumerStatefulWidget {
  const AppColoursTab({super.key});

  @override
  ConsumerState<AppColoursTab> createState() => _AppColoursTabState();
}

class _AppColoursTabState extends ConsumerState<AppColoursTab> {
  late final TextEditingController _app;
  late final TextEditingController _side;
  late final TextEditingController _doc;
  String _saved = '||';
  bool _loadedFromProfile = false;

  @override
  void initState() {
    super.initState();
    _app = TextEditingController();
    _side = TextEditingController();
    _doc = TextEditingController();
    for (final c in [_app, _side, _doc]) {
      c.addListener(() => setState(() {}));
    }
    Future.microtask(() {
      if (mounted && ref.read(settingsNotifierProvider) is! SettingsLoaded) {
        ref.read(settingsNotifierProvider.notifier).loadProfile();
      }
    });
  }

  @override
  void dispose() {
    _app.dispose();
    _side.dispose();
    _doc.dispose();
    super.dispose();
  }

  String get _draft => '${_app.text}|${_side.text}|${_doc.text}';
  bool get _dirty => _draft != _saved;

  bool _valid(String text) =>
      text.trim().isEmpty || BrandPalette.parse(text) != null;
  bool get _allValid =>
      _valid(_app.text) && _valid(_side.text) && _valid(_doc.text);

  void _loadFrom(SettingsLoaded loaded) {
    final p = loaded.profile;
    _app.text = p.appColor ?? '';
    _side.text = p.sidebarColor ?? '';
    _doc.text = p.brandColor ?? '';
    _saved = _draft;
    _loadedFromProfile = true;
  }

  Future<void> _save() async {
    final ok = await ref
        .read(settingsNotifierProvider.notifier)
        .updateAppearance(
          appColor: _app.text.trim().toUpperCase(),
          sidebarColor: _side.text.trim().toUpperCase(),
          brandColor: _doc.text.trim().toUpperCase(),
        );
    if (!mounted) return;
    final state = ref.read(settingsNotifierProvider);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok
              ? 'Colours saved. They now apply to everyone using this company.'
              : (state is SettingsLoaded && state.errorMessage != null
                    ? state.errorMessage!
                    : 'Failed to save colours.'),
        ),
        backgroundColor: ok ? AppColors.success : AppColors.error,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);
    final user = authState is Authenticated ? authState.user : null;
    final canEdit =
        user != null &&
        (user.isOwner || user.hasPermission('settings.business'));

    final state = ref.watch(settingsNotifierProvider);
    if (state is SettingsLoaded && !_loadedFromProfile) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && !_loadedFromProfile) setState(() => _loadFrom(state));
      });
    }
    final saving = state is SettingsLoaded && state.isSaving;
    final businessName = state is SettingsLoaded
        ? state.profile.businessName
        : '';

    return ListView(
      key: const Key('app_colours_tab'),
      padding: const EdgeInsets.all(16),
      children: [
        _card(
          title: 'App colours',
          subtitle:
              'Make the app, login page and documents match your company.',
          children: [
            _ColourRow(
              keyPrefix: 'app',
              label: 'App colour',
              description: 'Buttons, links and highlights across the app.',
              controller: _app,
              fallback: BrandPalette.defaultApp,
              enabled: canEdit && !saving,
            ),
            _ColourRow(
              keyPrefix: 'sidebar',
              label: 'Login page and dark surfaces',
              description: 'The sign-in screen and dark panels.',
              controller: _side,
              fallback: BrandPalette.defaultSidebar,
              enabled: canEdit && !saving,
            ),
            _ColourRow(
              keyPrefix: 'document',
              label: 'Invoices and job cards',
              description: 'Headings and accents on invoice and job card PDFs.',
              controller: _doc,
              fallback: BrandPalette.defaultDocument,
              enabled: canEdit && !saving,
              last: true,
            ),
            const SizedBox(height: 12),
            if (canEdit)
              Row(
                children: [
                  TextButton(
                    key: const Key('discard_colours_button'),
                    onPressed: _dirty && !saving
                        ? () => setState(() {
                            final parts = _saved.split('|');
                            _app.text = parts[0];
                            _side.text = parts[1];
                            _doc.text = parts[2];
                          })
                        : null,
                    child: const Text('Discard'),
                  ),
                  const Spacer(),
                  AppButton(
                    key: const Key('save_colours_button'),
                    label: 'Save colours',
                    icon: Icons.save_outlined,
                    isLoading: saving,
                    onPressed: _dirty && _allValid && !saving ? _save : null,
                  ),
                ],
              )
            else
              const Text(
                'Only an owner or administrator can change the company colours.',
                style: TextStyle(fontSize: 12, color: AppColors.textTertiary),
              ),
          ],
        ),
        const SizedBox(height: 16),
        _ColourPreview(
          app: BrandPalette.parse(_app.text) ?? BrandPalette.defaultApp,
          side: BrandPalette.parse(_side.text) ?? BrandPalette.defaultSidebar,
          doc: BrandPalette.parse(_doc.text) ?? BrandPalette.defaultDocument,
          businessName: businessName,
        ),
        const SizedBox(height: 16),
        _LoginImageCard(canEdit: canEdit),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _card({
    required String title,
    required String subtitle,
    required List<Widget> children,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.accentPill,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  Icons.palette_outlined,
                  size: 18,
                  color: AppColors.accent,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ...children,
        ],
      ),
    );
  }
}

class _ColourRow extends StatelessWidget {
  final String keyPrefix;
  final String label;
  final String description;
  final TextEditingController controller;
  final Color fallback;
  final bool enabled;
  final bool last;

  const _ColourRow({
    required this.keyPrefix,
    required this.label,
    required this.description,
    required this.controller,
    required this.fallback,
    required this.enabled,
    this.last = false,
  });

  @override
  Widget build(BuildContext context) {
    final parsed = BrandPalette.parse(controller.text);
    final shown = parsed ?? fallback;
    final invalid = controller.text.trim().isNotEmpty && parsed == null;
    final tooLight = !invalid && BrandPalette.contrastWithWhite(shown) < 3;

    return Container(
      padding: EdgeInsets.only(bottom: last ? 0 : 14, top: 0),
      margin: EdgeInsets.only(bottom: last ? 0 : 14),
      decoration: BoxDecoration(
        border: last
            ? null
            : const Border(bottom: BorderSide(color: AppColors.borderLight)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    Text(
                      description,
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                key: Key('${keyPrefix}_colour_swatch'),
                width: 56,
                height: 32,
                decoration: BoxDecoration(
                  color: shown,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.border),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final preset in BrandPalette.presets)
                GestureDetector(
                  key: Key('${keyPrefix}_preset_${preset.name}'),
                  onTap: enabled
                      ? () => controller.text = BrandPalette.toHex(preset.color)
                      : null,
                  child: Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: preset.color,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color:
                            parsed != null &&
                                BrandPalette.toHex(parsed) ==
                                    BrandPalette.toHex(preset.color)
                            ? AppColors.textPrimary
                            : Colors.white,
                        width: 2,
                      ),
                      boxShadow: const [
                        BoxShadow(
                          color: AppColors.border,
                          blurRadius: 1,
                          spreadRadius: 1,
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              SizedBox(
                width: 130,
                child: TextField(
                  key: Key('${keyPrefix}_colour_field'),
                  controller: controller,
                  enabled: enabled,
                  maxLength: 7,
                  textCapitalization: TextCapitalization.characters,
                  style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
                  decoration: InputDecoration(
                    counterText: '',
                    isDense: true,
                    hintText: BrandPalette.toHex(fallback),
                    errorText: invalid ? 'Use a code like #1E293B' : null,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              if (controller.text.isNotEmpty && enabled)
                TextButton.icon(
                  key: Key('${keyPrefix}_colour_reset'),
                  onPressed: () => controller.clear(),
                  icon: const Icon(Icons.restart_alt_rounded, size: 16),
                  label: const Text('Use default'),
                ),
            ],
          ),
          if (tooLight)
            const Padding(
              padding: EdgeInsets.only(top: 6),
              child: Text(
                'This colour is quite light, so white text on it may be hard to read. A darker colour works better.',
                style: TextStyle(fontSize: 11, color: AppColors.warningDark),
              ),
            ),
        ],
      ),
    );
  }
}

/// Small drawings of the app, the login page and an invoice that follow the colours being chosen.
class _ColourPreview extends StatelessWidget {
  final Color app;
  final Color side;
  final Color doc;
  final String businessName;

  const _ColourPreview({
    required this.app,
    required this.side,
    required this.doc,
    required this.businessName,
  });

  @override
  Widget build(BuildContext context) {
    final appScale = BrandPalette.buildScale(app);
    final sideScale = BrandPalette.buildScale(side);
    final name = businessName.trim().isEmpty
        ? 'Your Company'
        : businessName.trim();

    Widget frame(String title, Widget child) => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title.toUpperCase(),
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.6,
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: AppColors.border),
              borderRadius: BorderRadius.circular(12),
            ),
            child: AspectRatio(aspectRatio: 16 / 9, child: child),
          ),
        ),
      ],
    );

    Widget bar(double w, Color c, {double h = 5}) => Container(
      width: w,
      height: h,
      decoration: BoxDecoration(
        color: c,
        borderRadius: BorderRadius.circular(2),
      ),
    );

    LinearGradient dark({bool reverse = false}) => LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: reverse
          ? [sideScale[950]!, Colors.black, sideScale[950]!]
          : [sideScale[900]!, Colors.black, sideScale[950]!],
    );

    return Container(
      key: const Key('colour_preview'),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Live preview',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const Text(
            'Updates as you choose. Save colours to keep them.',
            style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 12),
          frame(
            'The app',
            Container(
              color: const Color(0xFFF8FAFC),
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      bar(60, AppColors.textPrimary, h: 7),
                      Container(
                        key: const Key('preview_button'),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: appScale[600],
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          '+ New Job Card',
                          style: TextStyle(
                            fontSize: 8,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      for (var i = 0; i < 3; i++) ...[
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                bar(24, AppColors.outline, h: 3),
                                const SizedBox(height: 4),
                                bar(
                                  32,
                                  i == 0 ? appScale[600]! : appScale[200]!,
                                  h: 7,
                                ),
                              ],
                            ),
                          ),
                        ),
                        if (i < 2) const SizedBox(width: 6),
                      ],
                    ],
                  ),
                  const Spacer(),
                  Container(
                    height: 22,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        for (var i = 0; i < 4; i++)
                          Container(
                            width: 14,
                            height: 6,
                            decoration: BoxDecoration(
                              color: i == 0 ? appScale[700] : AppColors.outline,
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          frame(
            'Login page',
            Container(
              key: const Key('preview_login'),
              decoration: BoxDecoration(gradient: dark(reverse: true)),
              padding: const EdgeInsets.all(14),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      bar(40, AppColors.textTertiary),
                      const SizedBox(height: 5),
                      Container(
                        height: 10,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceAlt,
                          borderRadius: BorderRadius.circular(3),
                          border: Border.all(color: AppColors.border),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Container(
                        height: 10,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceAlt,
                          borderRadius: BorderRadius.circular(3),
                          border: Border.all(color: AppColors.border),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        key: const Key('preview_signin'),
                        height: 14,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: sideScale[600],
                          borderRadius: BorderRadius.circular(3),
                        ),
                        child: const Text(
                          'Sign In',
                          style: TextStyle(
                            fontSize: 7,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          frame(
            'Invoice and job card',
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Flexible(
                        child: Text(
                          name.toUpperCase(),
                          key: const Key('preview_invoice_title'),
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            color: doc,
                          ),
                        ),
                      ),
                      Text(
                        'TAX INVOICE',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          color: doc,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Container(
                    key: const Key('preview_invoice_rule'),
                    height: 2,
                    color: doc,
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          height: 10,
                          color: BrandPalette.buildScale(doc)[50],
                        ),
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Container(
                          height: 10,
                          color: BrandPalette.buildScale(doc)[50],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 5),
                  Container(height: 6, color: AppColors.surfaceAlt),
                  const SizedBox(height: 3),
                  Container(height: 5, color: AppColors.surfaceAlt),
                  const Spacer(),
                  Align(
                    alignment: Alignment.centerRight,
                    child: Text(
                      'Grand Total  Rs. 14,160.00',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        color: doc,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Lets the company upload its own picture for the login page.
class _LoginImageCard extends ConsumerWidget {
  final bool canEdit;

  const _LoginImageCard({required this.canEdit});

  Future<void> _pick(BuildContext context, WidgetRef ref) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 85,
      );
      if (picked == null) return;
      final bytes = await picked.readAsBytes();
      final ok = await ref
          .read(settingsNotifierProvider.notifier)
          .uploadLoginImage(bytes: bytes, filename: picked.name);
      messenger.showSnackBar(
        _snack(
          ref,
          ok,
          'Login page picture updated.',
          'Failed to upload the picture.',
        ),
      );
    } catch (e) {
      messenger.showSnackBar(
        SnackBar(
          content: Text('Failed to select image: $e'),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _remove(BuildContext context, WidgetRef ref) async {
    final messenger = ScaffoldMessenger.of(context);
    final ok = await ref
        .read(settingsNotifierProvider.notifier)
        .removeLoginImage();
    messenger.showSnackBar(
      _snack(
        ref,
        ok,
        'Login page picture removed.',
        'Failed to remove the picture.',
      ),
    );
  }

  SnackBar _snack(WidgetRef ref, bool ok, String success, String failure) {
    final state = ref.read(settingsNotifierProvider);
    final error = state is SettingsLoaded ? state.errorMessage : null;
    return SnackBar(
      content: Text(ok ? success : (error ?? failure)),
      backgroundColor: ok ? AppColors.success : AppColors.error,
      behavior: SnackBarBehavior.floating,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(settingsNotifierProvider);
    final profile = state is SettingsLoaded ? state.profile : null;
    final busy = state is SettingsLoaded && state.isUploadingLogo;
    final url = AppBusinessLogo.resolveLogoUrl(
      profile?.loginImagePath,
      profile?.updatedAt,
    );

    return Container(
      key: const Key('login_image_card'),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Login page picture',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 2),
          const Text(
            'Shown behind the sign-in screen. Without one, the page uses your login colour.',
            style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Container(
              height: 140,
              width: double.infinity,
              color: AppColors.surfaceAlt,
              child: url == null
                  ? const Center(
                      child: Text(
                        'NO PICTURE',
                        key: Key('login_image_empty'),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textTertiary,
                        ),
                      ),
                    )
                  : Image.network(
                      url,
                      key: const Key('login_image_preview'),
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) =>
                          const Center(
                            child: Icon(
                              Icons.broken_image_outlined,
                              color: AppColors.textTertiary,
                            ),
                          ),
                    ),
            ),
          ),
          const SizedBox(height: 12),
          if (canEdit)
            Row(
              children: [
                Expanded(
                  child: AppButton(
                    key: const Key('upload_login_image_button'),
                    label: url == null ? 'Upload picture' : 'Change picture',
                    icon: Icons.upload_rounded,
                    isLoading: busy,
                    onPressed: busy ? null : () => _pick(context, ref),
                  ),
                ),
                if (url != null) ...[
                  const SizedBox(width: 8),
                  TextButton.icon(
                    key: const Key('remove_login_image_button'),
                    onPressed: busy ? null : () => _remove(context, ref),
                    icon: const Icon(Icons.delete_outline_rounded, size: 18),
                    label: const Text('Remove'),
                    style: TextButton.styleFrom(
                      foregroundColor: AppColors.error,
                    ),
                  ),
                ],
              ],
            )
          else
            const Text(
              'Only an owner or administrator can change the login page picture.',
              style: TextStyle(fontSize: 12, color: AppColors.textTertiary),
            ),
        ],
      ),
    );
  }
}
