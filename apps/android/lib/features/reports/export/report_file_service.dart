import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

/// A finished workbook, ready to save or send.
class ReportFile {
  final String fileName;
  final List<int> bytes;

  const ReportFile(this.fileName, this.bytes);
}

const _xlsxMime =
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/// Hands report files to the phone's share sheet (save to Files, WhatsApp, email, Drive...). Replaceable in tests.
class ReportFileService {
  const ReportFileService();

  Future<void> share(List<ReportFile> files, {String? subject}) async {
    final dir = await getTemporaryDirectory();
    final paths = <XFile>[];
    for (final file in files) {
      final path = '${dir.path}${Platform.pathSeparator}${file.fileName}';
      await File(path).writeAsBytes(file.bytes, flush: true);
      paths.add(XFile(path, mimeType: _xlsxMime, name: file.fileName));
    }
    await SharePlus.instance.share(ShareParams(files: paths, subject: subject));
  }
}

final reportFileServiceProvider = Provider<ReportFileService>(
  (ref) => const ReportFileService(),
);
