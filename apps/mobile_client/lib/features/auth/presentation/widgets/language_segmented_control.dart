import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:localshop_shared/localshop_shared.dart';

import '../../../../ui/ui.dart';

/// Three-way language picker: a white thumb slides inside an ink100 track.
/// Language names are intentionally not translated.
class LanguageSegmentedControl extends StatelessWidget {
  const LanguageSegmentedControl({super.key, required this.value, required this.onChanged});

  final SupportedLanguage value;
  final ValueChanged<SupportedLanguage> onChanged;

  static const _options = [
    (SupportedLanguage.uz, "O'zbekcha"),
    (SupportedLanguage.ru, 'Русский'),
    (SupportedLanguage.en, 'English'),
  ];

  static const double _height = 48;
  static const double _inset = 4;

  @override
  Widget build(BuildContext context) {
    final index = _options.indexWhere((o) => o.$1 == value).clamp(0, _options.length - 1);
    return Container(
      height: _height,
      padding: const EdgeInsets.all(_inset),
      decoration: BoxDecoration(color: AppColors.ink100, borderRadius: BorderRadius.circular(AppRadius.md)),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final segmentWidth = constraints.maxWidth / _options.length;
          return Stack(
            children: [
              AnimatedPositioned(
                duration: AppDurations.normal,
                curve: AppCurves.standard,
                left: index * segmentWidth,
                top: 0,
                bottom: 0,
                width: segmentWidth,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                    boxShadow: AppShadows.sm,
                  ),
                ),
              ),
              Row(
                children: [
                  for (final (lang, label) in _options)
                    Expanded(
                      child: Semantics(
                        button: true,
                        selected: lang == value,
                        label: label,
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () {
                            if (lang == value) return;
                            HapticFeedback.selectionClick();
                            onChanged(lang);
                          },
                          child: MouseRegion(
                            cursor: SystemMouseCursors.click,
                            child: Center(
                              child: AnimatedDefaultTextStyle(
                                duration: AppDurations.normal,
                                curve: AppCurves.standard,
                                style: lang == value ? AppText.bodyStrong : AppText.bodyMedium.copyWith(color: AppColors.ink500),
                                child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}
