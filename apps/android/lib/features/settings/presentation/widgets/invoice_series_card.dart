import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../data/settings_repository.dart';
import '../../models/invoice_series_model.dart';

/// Invoice Configuration: separate GST and non-GST numbering series.
/// Prefixes are editable by the Owner only (also enforced by the API); next numbers are read-only.
class InvoiceSeriesCard extends ConsumerStatefulWidget {
  final bool isOwner;

  const InvoiceSeriesCard({super.key, required this.isOwner});

  /// Mirrors backend InvoiceNumberRules.NormalizePrefix (provisional).
  static final RegExp prefixPattern = RegExp(r'^[A-Za-z0-9/-]{1,10}$');
  static const String prefixRule = "1–10 characters: letters, digits, '-' and '/'";

  @override
  ConsumerState<InvoiceSeriesCard> createState() => _InvoiceSeriesCardState();
}

class _InvoiceSeriesCardState extends ConsumerState<InvoiceSeriesCard> {
  final _gstController = TextEditingController();
  final _nonGstController = TextEditingController();
  InvoiceSeriesSettingsModel? _data;
  String? _loadError;
  String? _saveError;
  bool _saved = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _gstController.dispose();
    _nonGstController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await ref.read(settingsApiProvider).getInvoiceSeries();
      if (!mounted) return;
      _apply(data);
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadError = _message(e, 'Failed to load invoice numbering.'));
    }
  }

  void _apply(InvoiceSeriesSettingsModel data) {
    setState(() {
      _data = data;
      _gstController.text = data.gst.prefix;
      _nonGstController.text = data.nonGst.prefix;
    });
  }

  String _message(Object e, String fallback) {
    if (e is DioException) return ApiException.fromDio(e).message;
    if (e is ApiException) return e.message;
    return fallback;
  }

  String get _gst => _gstController.text.trim();
  String get _nonGst => _nonGstController.text.trim();

  String? _formatError(String value) =>
      value.isNotEmpty && !InvoiceSeriesCard.prefixPattern.hasMatch(value)
          ? 'Invalid prefix. Use ${InvoiceSeriesCard.prefixRule}.'
          : null;

  String? get _sameError => _gst.isNotEmpty && _gst.toUpperCase() == _nonGst.toUpperCase()
      ? 'GST and non-GST prefixes must be different.'
      : null;

  bool get _canSave {
    final data = _data;
    if (!widget.isOwner || data == null || _saving) return false;
    if (_gst.isEmpty || _nonGst.isEmpty) return false;
    if (_formatError(_gst) != null || _formatError(_nonGst) != null || _sameError != null) return false;
    return _gst.toUpperCase() != data.gst.prefix || _nonGst.toUpperCase() != data.nonGst.prefix;
  }

  Future<void> _save() async {
    if (!_canSave) return;
    setState(() {
      _saving = true;
      _saveError = null;
      _saved = false;
    });
    try {
      final data = await ref.read(settingsApiProvider).updateInvoiceSeries(
            gstPrefix: _gst.toUpperCase(),
            nonGstPrefix: _nonGst.toUpperCase(),
          );
      if (!mounted) return;
      _apply(data);
      setState(() {
        _saving = false;
        _saved = true;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _saveError = _message(e, 'Failed to save invoice number prefixes.');
      });
    }
  }

  Widget _seriesBlock({
    required String title,
    required InvoiceSeriesModel series,
    required TextEditingController controller,
    required String keyPrefix,
    String? extraError,
  }) {
    final prefix = controller.text.trim().toUpperCase();
    final example = InvoiceSeriesCard.prefixPattern.hasMatch(prefix) ? '$prefix${series.nextNumberDisplay}' : '—';
    return Container(
      key: Key('${keyPrefix}_series_block'),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
          const SizedBox(height: 10),
          AppTextField(
            key: Key('${keyPrefix}_prefix_field'),
            controller: controller,
            label: 'Prefix',
            isRequired: false,
            isEnabled: widget.isOwner && !_saving,
            maxLength: 10,
            textCapitalization: TextCapitalization.characters,
            prefixIcon: const Icon(Icons.tag_outlined, size: 20),
            errorText: _formatError(controller.text.trim()) ?? extraError,
            onChanged: (_) => setState(() {
              _saveError = null;
              _saved = false;
            }),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              const Text('Next Number: ', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
              Text(
                series.nextNumberDisplay,
                key: Key('${keyPrefix}_next_number'),
                style: const TextStyle(fontSize: 13, fontFamily: 'monospace', fontWeight: FontWeight.w700, color: AppColors.textPrimary),
              ),
              const Text('  (read-only)', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              const Text('Example: ', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
              Text(
                example,
                key: Key('${keyPrefix}_example'),
                style: const TextStyle(fontSize: 13, fontFamily: 'monospace', fontWeight: FontWeight.w600, color: AppColors.textPrimary),
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
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
                decoration: BoxDecoration(color: AppColors.accentPill, borderRadius: BorderRadius.circular(8)),
                child: const Icon(Icons.pin_outlined, color: AppColors.primary, size: 20),
              ),
              const SizedBox(width: 10),
              const Text(
                'Invoice Numbering',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (_loadError != null)
            Text(_loadError!, key: const Key('invoice_series_load_error'), style: const TextStyle(color: AppColors.error, fontSize: 12)),
          if (data == null && _loadError == null)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text('Loading invoice numbering…', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
            ),
          if (data != null) ...[
            _seriesBlock(title: 'GST Invoice Series', series: data.gst, controller: _gstController, keyPrefix: 'gst', extraError: _sameError),
            const SizedBox(height: 12),
            _seriesBlock(title: 'Non-GST Invoice Series', series: data.nonGst, controller: _nonGstController, keyPrefix: 'non_gst'),
            const SizedBox(height: 12),
            const Text('GST and non-GST documents use separate numbering sequences.',
                style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
            const Text('Invoice numbers are automatically assigned when an invoice is finalized.',
                style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
            const Text('GST invoice numbers can be changed by the Owner after the invoice is fully paid.',
                style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
            if (!widget.isOwner)
              const Padding(
                padding: EdgeInsets.only(top: 4),
                child: Text('Only the Owner can change prefixes.',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
              ),
            if (_saveError != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(_saveError!, key: const Key('invoice_series_save_error'), style: const TextStyle(color: AppColors.error, fontSize: 12)),
              ),
            if (_saved)
              const Padding(
                padding: EdgeInsets.only(top: 8),
                child: Text('Invoice number prefixes saved.', style: TextStyle(color: AppColors.success, fontSize: 12)),
              ),
            if (widget.isOwner) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  key: const Key('save_invoice_series_button'),
                  onPressed: _canSave ? _save : null,
                  icon: const Icon(Icons.save_outlined, size: 18),
                  label: Text(_saving ? 'Saving...' : 'Save Invoice Series'),
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}
