import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../tokens.dart';

/// Tap wrapper that scales down slightly while pressed and optionally fires
/// haptics — the "alive" feel every interactive surface in the app shares.
class Pressable extends StatefulWidget {
  const Pressable({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.scale = 0.97,
    this.haptic = false,
    this.enabled = true,
    this.borderRadius,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final double scale;
  final bool haptic;
  final bool enabled;
  final BorderRadius? borderRadius;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;

  bool get _interactive => widget.enabled && (widget.onTap != null || widget.onLongPress != null);

  void _set(bool v) {
    if (_down != v && mounted) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    final child = AnimatedScale(
      scale: _down ? widget.scale : 1,
      duration: AppDurations.fast,
      curve: Curves.easeOut,
      child: widget.child,
    );
    if (!_interactive) return child;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => _set(true),
      onTapCancel: () => _set(false),
      onTapUp: (_) => _set(false),
      onTap: () {
        if (widget.haptic) HapticFeedback.lightImpact();
        widget.onTap?.call();
      },
      onLongPress: widget.onLongPress,
      child: MouseRegion(cursor: SystemMouseCursors.click, child: child),
    );
  }
}
