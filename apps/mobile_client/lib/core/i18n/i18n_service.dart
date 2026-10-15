import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:localshop_shared/localshop_shared.dart';

/// Loads assets/i18n/{uz,ru,en}.json once at startup and resolves dot-path
/// keys with uz-first fallback (mirrors resolveLocalizedText's fallback
/// order), plus {{placeholder}} interpolation — the same shape as the RN
/// app's i18next JSON files, kept intentionally simple (no build step).
class I18nService {
  final Map<SupportedLanguage, Map<String, dynamic>> _tables = {};

  Future<void> load() async {
    for (final lang in SupportedLanguage.values) {
      final raw = await rootBundle.loadString('assets/i18n/${lang.value}.json');
      _tables[lang] = json.decode(raw) as Map<String, dynamic>;
    }
  }

  String t(SupportedLanguage lang, String key, [Map<String, String>? params]) {
    final value = _lookup(_tables[lang], key) ?? _lookup(_tables[SupportedLanguage.uz], key) ?? key;
    if (params == null || params.isEmpty) return value;

    var result = value;
    for (final entry in params.entries) {
      result = result.replaceAll('{{${entry.key}}}', entry.value);
    }
    return result;
  }

  String? _lookup(Map<String, dynamic>? table, String dotPath) {
    dynamic current = table;
    for (final segment in dotPath.split('.')) {
      if (current is! Map<String, dynamic> || !current.containsKey(segment)) return null;
      current = current[segment];
    }
    return current is String ? current : null;
  }
}
