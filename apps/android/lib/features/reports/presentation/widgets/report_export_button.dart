import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../settings/providers/settings_provider.dart';
import '../../export/report_file_service.dart';

/// Builds a report's Excel file(s) and opens the phone's share sheet so they can be saved or sent.
/// [build] receives the company name to put in titles and file names.
class ReportExportButton extends ConsumerStatefulWidget {
  final Future<List<ReportFile>> Function(WidgetRef ref, String? companyName)
  build;

  /// When set, shows a labelled button instead of an icon (for use inside a screen rather than the top bar).
  final String? label;

  const ReportExportButton({super.key, required this.build, this.label});

  @override
  ConsumerState<ReportExportButton> createState() => _ReportExportButtonState();
}

class _ReportExportButtonState extends ConsumerState<ReportExportButton> {
  bool _busy = false;

  Future<void> _export() async {
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    try {
      final name = ref.read(businessProfileProvider)?.businessName;
      final files = await widget.build(ref, name);
      await ref.read(reportFileServiceProvider).share(files);
    } catch (e) {
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            e is ApiException ? e.message : 'Could not create the Excel file.',
          ),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final label = widget.label;
    if (label != null) {
      return OutlinedButton.icon(
        key: const Key('report_export_button'),
        onPressed: _busy ? null : _export,
        icon: _busy
            ? const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Icon(Icons.file_download_outlined, size: 18),
        label: Text(_busy ? 'Preparing…' : label),
      );
    }
    if (_busy) {
      return const Padding(
        padding: EdgeInsets.all(14),
        child: SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      );
    }
    return IconButton(
      key: const Key('report_export_button'),
      icon: const Icon(
        Icons.file_download_outlined,
        color: AppColors.textPrimary,
      ),
      tooltip: 'Export to Excel',
      onPressed: _export,
    );
  }
}
