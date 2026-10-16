import 'package:flutter/services.dart';

/// Number of national digits after the +998 country code.
const int kUzPhoneDigits = 9;

final RegExp _nonDigit = RegExp(r'\D');

/// Strips everything but digits and drops a pasted leading country code so
/// "+998 90 123 45 67" and "901234567" both become "901234567".
String uzNationalDigits(String input) {
  var digits = input.replaceAll(_nonDigit, '');
  if (digits.length > kUzPhoneDigits && digits.startsWith('998')) digits = digits.substring(3);
  return digits.length > kUzPhoneDigits ? digits.substring(0, kUzPhoneDigits) : digits;
}

/// "901234567" → "90 123 45 67" (partial input is grouped as far as it goes).
String groupUzDigits(String digits) {
  final buf = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i == 2 || i == 5 || i == 7) buf.write(' ');
    buf.write(digits[i]);
  }
  return buf.toString();
}

/// "+998901234567" → "+998 90 123 45 67" for display. Unknown shapes are returned as-is.
String formatUzPhone(String e164) {
  final digits = e164.replaceAll(_nonDigit, '');
  if (digits.length == 12 && digits.startsWith('998')) return '+998 ${groupUzDigits(digits.substring(3))}';
  return e164;
}

/// Live "90 123 45 67" grouping for the national part of an Uzbek number.
/// Keeps the caret attached to the digit the user was editing.
class UzPhoneFormatter extends TextInputFormatter {
  const UzPhoneFormatter();

  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final digits = uzNationalDigits(newValue.text);
    final caret = newValue.selection.baseOffset.clamp(0, newValue.text.length);
    final digitsBeforeCaret = newValue.text.substring(0, caret).replaceAll(_nonDigit, '').length.clamp(0, digits.length);

    final buf = StringBuffer();
    var caretOffset = 0;
    for (var i = 0; i < digits.length; i++) {
      if (i == 2 || i == 5 || i == 7) buf.write(' ');
      buf.write(digits[i]);
      if (i + 1 == digitsBeforeCaret) caretOffset = buf.length;
    }
    final text = buf.toString();
    return TextEditingValue(text: text, selection: TextSelection.collapsed(offset: caretOffset.clamp(0, text.length)));
  }
}
