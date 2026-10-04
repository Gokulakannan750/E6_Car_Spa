import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';

/// Owner-only dialog to replace the number of a fully paid GST invoice.
///
/// The format rule is PROVISIONAL (pending client confirmation) and mirrors the
/// backend `InvoiceNumberRules`; the API enforces every rule regardless.
class EditInvoiceNumberDialog extends StatefulWidget {
  final String currentNumber;

  /// Saves the new number. Returns null on success or an error message.
  final Future<String?> Function(String invoiceNumber) onSave;

  const EditInvoiceNumberDialog({
    super.key,
    required this.currentNumber,
    required this.onSave,
  });

  static final RegExp allowedFormat = RegExp(r'^[A-Za-z0-9/-]{1,16}$');
  static const String formatHint =
      "1–16 characters: letters, digits, '-' and '/'";

  static Future<bool?> show(
    BuildContext context, {
    required String currentNumber,
    required Future<String?> Function(String invoiceNumber) onSave,
  }) {
    return showDialog<bool>(
      context: context,
      builder: (_) => EditInvoiceNumberDialog(
        currentNumber: currentNumber,
        onSave: onSave,
      ),
    );
  }

  @override
  State<EditInvoiceNumberDialog> createState() =>
      _EditInvoiceNumberDialogState();
}

class _EditInvoiceNumberDialogState extends State<EditInvoiceNumberDialog> {
  late final TextEditingController _controller;
  String? _serverError;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.currentNumber);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String get _trimmed => _controller.text.trim();
  bool get _isValid => EditInvoiceNumberDialog.allowedFormat.hasMatch(_trimmed);
  bool get _canSave =>
      _isValid && _trimmed != widget.currentNumber && !_saving;

  Future<void> _save() async {
    if (!_canSave) return;
    setState(() {
      _saving = true;
      _serverError = null;
    });
    final error = await widget.onSave(_trimmed);
    if (!mounted) return;
    if (error == null) {
      Navigator.of(context).pop(true);
    } else {
      setState(() {
        _saving = false;
        _serverError = error;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final showFormatError = _trimmed.isNotEmpty && !_isValid;
    return AlertDialog(
      backgroundColor: AppColors.card,
      title: const Text(
        'Change Invoice Number',
        style: TextStyle(color: AppColors.textPrimary),
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Current number: ${widget.currentNumber}',
            style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 12),
          TextField(
            key: const Key('edit_invoice_number_field'),
            controller: _controller,
            autofocus: true,
            maxLength: 16,
            textInputAction: TextInputAction.done,
            onChanged: (_) => setState(() => _serverError = null),
            onSubmitted: (_) => _save(),
            decoration: InputDecoration(
              labelText: 'New invoice number',
              helperText: EditInvoiceNumberDialog.formatHint,
              errorText: showFormatError
                  ? 'Invalid format. Use ${EditInvoiceNumberDialog.formatHint}.'
                  : null,
            ),
          ),
          if (_serverError != null) ...[
            const SizedBox(height: 8),
            Text(
              _serverError!,
              key: const Key('edit_invoice_number_error'),
              style: const TextStyle(fontSize: 12, color: AppColors.error),
            ),
          ],
          const SizedBox(height: 8),
          const Text(
            'The number must be unique. Copies already sent to the customer keep the old number.',
            style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          key: const Key('save_invoice_number_button'),
          onPressed: _canSave ? _save : null,
          child: Text(_saving ? 'Saving...' : 'Save Number'),
        ),
      ],
    );
  }
}
