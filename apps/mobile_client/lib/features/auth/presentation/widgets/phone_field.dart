import 'package:flutter/material.dart';

import '../../../../ui/ui.dart';
import 'uz_phone.dart';

/// Phone input with a fixed "+998" prefix chip. The controller only ever
/// holds the grouped national digits ("90 123 45 67"); read the E.164 value
/// with [uzNationalDigits] + the country code.
class PhoneField extends StatelessWidget {
  const PhoneField({
    super.key,
    required this.controller,
    this.hint,
    this.helper,
    this.autofocus = false,
    this.enabled = true,
    this.onChanged,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final String? hint;
  final String? helper;
  final bool autofocus;
  final bool enabled;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    final field = TextField(
      controller: controller,
      keyboardType: TextInputType.phone,
      textInputAction: TextInputAction.done,
      autofocus: autofocus,
      enabled: enabled,
      autofillHints: const [AutofillHints.telephoneNumberNational],
      inputFormatters: const [UzPhoneFormatter()],
      style: AppText.bodyLg.weight(600),
      cursorColor: AppColors.brand,
      onChanged: onChanged,
      onSubmitted: onSubmitted,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: AppText.bodyLg.copyWith(color: AppColors.textTertiary),
        prefixIcon: const _CountryPrefix(),
        prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
      ),
    );

    if (helper == null) return field;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        field,
        const SizedBox(height: AppSpacing.sm),
        Padding(
          padding: const EdgeInsets.only(left: AppSpacing.xs),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.only(top: 1),
                child: Icon(LucideIcons.messageSquare, size: 14, color: AppColors.textTertiary),
              ),
              const SizedBox(width: 6),
              Expanded(child: Text(helper!, style: AppText.caption)),
            ],
          ),
        ),
      ],
    );
  }
}

class _CountryPrefix extends StatelessWidget {
  const _CountryPrefix();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: AppSpacing.sm, right: AppSpacing.sm),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm + 2, vertical: 6),
        decoration: BoxDecoration(color: AppColors.ink100, borderRadius: BorderRadius.circular(AppRadius.xs)),
        child: Text('+998', style: AppText.bodyStrong.copyWith(color: AppColors.ink700)),
      ),
    );
  }
}
