import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../tokens.dart';
import '../typography.dart';

/// Labelled text field with optional leading icon, helper/error text and
/// a clear button. Styling comes from the theme's InputDecorationTheme.
class AppTextField extends StatelessWidget {
  const AppTextField({
    super.key,
    this.controller,
    this.label,
    this.hint,
    this.helper,
    this.error,
    this.icon,
    this.suffix,
    this.keyboardType,
    this.inputFormatters,
    this.textInputAction,
    this.obscure = false,
    this.autofocus = false,
    this.enabled = true,
    this.maxLines = 1,
    this.maxLength,
    this.onChanged,
    this.onSubmitted,
    this.textCapitalization = TextCapitalization.none,
    this.showClear = false,
    this.focusNode,
  });

  final TextEditingController? controller;
  final String? label;
  final String? hint;
  final String? helper;
  final String? error;
  final IconData? icon;
  final Widget? suffix;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? inputFormatters;
  final TextInputAction? textInputAction;
  final bool obscure;
  final bool autofocus;
  final bool enabled;
  final int maxLines;
  final int? maxLength;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final TextCapitalization textCapitalization;
  final bool showClear;
  final FocusNode? focusNode;

  @override
  Widget build(BuildContext context) {
    final field = TextField(
      controller: controller,
      focusNode: focusNode,
      keyboardType: keyboardType,
      inputFormatters: inputFormatters,
      textInputAction: textInputAction,
      obscureText: obscure,
      autofocus: autofocus,
      enabled: enabled,
      maxLines: maxLines,
      maxLength: maxLength,
      onChanged: onChanged,
      onSubmitted: onSubmitted,
      textCapitalization: textCapitalization,
      style: AppText.bodyLg.copyWith(fontSize: 15),
      cursorColor: AppColors.brand,
      decoration: InputDecoration(
        hintText: hint,
        counterText: '',
        errorText: error,
        prefixIcon: icon == null ? null : Icon(icon, size: 20, color: AppColors.ink400),
        prefixIconConstraints: const BoxConstraints(minWidth: 44, minHeight: 44),
        suffixIcon: suffix ??
            (showClear && controller != null
                ? ValueListenableBuilder<TextEditingValue>(
                    valueListenable: controller!,
                    builder: (_, value, _) => value.text.isEmpty
                        ? const SizedBox.shrink()
                        : IconButton(
                            icon: const Icon(LucideIcons.xCircle, size: 18, color: AppColors.ink400),
                            onPressed: () {
                              controller!.clear();
                              onChanged?.call('');
                            },
                          ),
                  )
                : null),
      ),
    );

    if (label == null && helper == null) return field;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (label != null) ...[
          Padding(padding: const EdgeInsets.only(left: AppSpacing.xs), child: Text(label!, style: AppText.label)),
          const SizedBox(height: 6),
        ],
        field,
        if (helper != null && error == null) ...[
          const SizedBox(height: 6),
          Padding(padding: const EdgeInsets.only(left: AppSpacing.xs), child: Text(helper!, style: AppText.caption)),
        ],
      ],
    );
  }
}

/// Rounded search bar used on Home and Shop.
class AppSearchBar extends StatelessWidget {
  const AppSearchBar({super.key, required this.hint, this.onChanged, this.controller, this.autofocus = false, this.trailing});

  final String hint;
  final ValueChanged<String>? onChanged;
  final TextEditingController? controller;
  final bool autofocus;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 48,
      decoration: BoxDecoration(color: AppColors.ink100, borderRadius: AppRadius.control),
      padding: const EdgeInsets.only(left: AppSpacing.md),
      child: Row(
        children: [
          const Icon(LucideIcons.search, size: 20, color: AppColors.ink400),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: TextField(
              controller: controller,
              autofocus: autofocus,
              onChanged: onChanged,
              style: AppText.bodyLg.copyWith(fontSize: 15),
              cursorColor: AppColors.brand,
              decoration: InputDecoration(
                hintText: hint,
                filled: false,
                isDense: true,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                contentPadding: EdgeInsets.zero,
                hintStyle: AppText.body.copyWith(color: AppColors.textTertiary, fontSize: 15),
              ),
            ),
          ),
          if (trailing != null) trailing! else const SizedBox(width: AppSpacing.md),
        ],
      ),
    );
  }
}
