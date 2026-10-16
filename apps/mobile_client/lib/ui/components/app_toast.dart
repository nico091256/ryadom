import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../tokens.dart';
import '../typography.dart';

enum ToastTone { neutral, success, error }

/// Top-anchored toast (slides in under the status bar) — replaces SnackBars,
/// which collide with the bottom cart bar on most screens.
void showAppToast(BuildContext context, String message, {ToastTone tone = ToastTone.neutral, Duration duration = const Duration(milliseconds: 2200)}) {
  final overlay = Overlay.maybeOf(context, rootOverlay: true);
  if (overlay == null) return;
  _ToastEntry.show(overlay, message, tone, duration);
}

class _ToastEntry {
  static OverlayEntry? _current;
  static Timer? _timer;

  static void show(OverlayState overlay, String message, ToastTone tone, Duration duration) {
    _timer?.cancel();
    _current?.remove();
    late OverlayEntry entry;
    entry = OverlayEntry(builder: (_) => _Toast(message: message, tone: tone, onDismiss: () => _dismiss(entry)));
    _current = entry;
    overlay.insert(entry);
    _timer = Timer(duration, () => _dismiss(entry));
  }

  static void _dismiss(OverlayEntry entry) {
    if (_current == entry) {
      entry.remove();
      _current = null;
    }
  }
}

class _Toast extends StatefulWidget {
  const _Toast({required this.message, required this.tone, required this.onDismiss});
  final String message;
  final ToastTone tone;
  final VoidCallback onDismiss;

  @override
  State<_Toast> createState() => _ToastState();
}

class _ToastState extends State<_Toast> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: AppDurations.slow)..forward();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final (bg, fg, icon) = switch (widget.tone) {
      ToastTone.neutral => (AppColors.ink900, AppColors.white, LucideIcons.info),
      ToastTone.success => (AppColors.green700, AppColors.white, LucideIcons.checkCircle2),
      ToastTone.error => (AppColors.danger, AppColors.white, LucideIcons.alertCircle),
    };
    final top = MediaQuery.paddingOf(context).top + AppSpacing.sm;
    return Positioned(
      top: top,
      left: AppSpacing.lg,
      right: AppSpacing.lg,
      child: SlideTransition(
        position: Tween<Offset>(begin: const Offset(0, -1.2), end: Offset.zero).animate(CurvedAnimation(parent: _c, curve: AppCurves.emphasized)),
        child: FadeTransition(
          opacity: _c,
          child: Material(
            color: Colors.transparent,
            child: GestureDetector(
              onTap: widget.onDismiss,
              onVerticalDragEnd: (_) => widget.onDismiss(),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
                decoration: BoxDecoration(color: bg, borderRadius: AppRadius.control, boxShadow: AppShadows.lg),
                child: Row(
                  children: [
                    Icon(icon, size: 18, color: fg),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(child: Text(widget.message, style: AppText.bodyMedium.copyWith(color: fg), maxLines: 2, overflow: TextOverflow.ellipsis)),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
