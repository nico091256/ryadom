import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../ui/ui.dart';

/// Six digit boxes driven by one invisible, autofill-friendly TextField.
/// The caller owns the controller; `onCompleted` fires when the 6th digit lands.
class OtpCodeField extends StatefulWidget {
  const OtpCodeField({
    super.key,
    required this.controller,
    this.length = 6,
    this.autofocus = true,
    this.enabled = true,
    this.hasError = false,
    this.shakeTick = 0,
    this.onChanged,
    this.onCompleted,
  });

  final TextEditingController controller;
  final int length;
  final bool autofocus;
  final bool enabled;
  final bool hasError;

  /// Bump to replay the shake animation (e.g. on every failed verification).
  final int shakeTick;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onCompleted;

  static const double boxWidth = 48;
  static const double boxHeight = 56;

  @override
  State<OtpCodeField> createState() => _OtpCodeFieldState();
}

class _OtpCodeFieldState extends State<OtpCodeField> {
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(_onFocus);
    widget.controller.addListener(_onText);
  }

  @override
  void didUpdateWidget(OtpCodeField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_onText);
      widget.controller.addListener(_onText);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onText);
    _focusNode
      ..removeListener(_onFocus)
      ..dispose();
    super.dispose();
  }

  void _onFocus() => setState(() {});

  // Interactive selection is disabled on the hidden field, so the caret stays
  // at the end and the "active" box is always the next empty one.
  void _onText() => setState(() {});

  void _handleChanged(String value) {
    widget.onChanged?.call(value);
    if (value.length == widget.length) widget.onCompleted?.call(value);
  }

  @override
  Widget build(BuildContext context) {
    final text = widget.controller.text;
    final focused = _focusNode.hasFocus;
    final activeIndex = text.length.clamp(0, widget.length - 1);

    Widget boxes = Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        for (var i = 0; i < widget.length; i++)
          _CodeBox(
            digit: i < text.length ? text[i] : null,
            active: focused && widget.enabled && i == activeIndex && text.length < widget.length,
            error: widget.hasError,
          ),
      ],
    );
    if (widget.shakeTick > 0) {
      boxes = boxes
          .animate(key: ValueKey(widget.shakeTick))
          .shake(duration: AppDurations.slow, hz: 5, offset: const Offset(6, 0), rotation: 0);
    }

    return SizedBox(
      height: OtpCodeField.boxHeight,
      child: Stack(
        fit: StackFit.expand,
        children: [
          boxes,
          // Invisible input: receives taps, keyboard and SMS autofill.
          Opacity(
            opacity: 0,
            child: TextField(
              controller: widget.controller,
              focusNode: _focusNode,
              autofocus: widget.autofocus,
              enabled: widget.enabled,
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.done,
              autofillHints: const [AutofillHints.oneTimeCode],
              inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(widget.length)],
              maxLength: widget.length,
              showCursor: false,
              enableInteractiveSelection: false,
              enableSuggestions: false,
              autocorrect: false,
              onChanged: _handleChanged,
              style: AppText.body.copyWith(color: Colors.transparent),
              cursorColor: Colors.transparent,
              decoration: const InputDecoration(
                counterText: '',
                filled: false,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                disabledBorder: InputBorder.none,
                contentPadding: EdgeInsets.zero,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CodeBox extends StatelessWidget {
  const _CodeBox({required this.digit, required this.active, required this.error});

  final String? digit;
  final bool active;
  final bool error;

  @override
  Widget build(BuildContext context) {
    final borderColor = error
        ? AppColors.danger
        : active
            ? AppColors.brand
            : AppColors.border;
    return AnimatedContainer(
      duration: AppDurations.fast,
      curve: AppCurves.standard,
      width: OtpCodeField.boxWidth,
      height: OtpCodeField.boxHeight,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppColors.ink50,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        border: Border.all(color: borderColor, width: active || error ? 1.5 : 1),
      ),
      child: AnimatedSwitcher(
        duration: AppDurations.fast,
        transitionBuilder: (child, anim) => FadeTransition(
          opacity: anim,
          child: ScaleTransition(scale: Tween(begin: 0.7, end: 1.0).animate(anim), child: child),
        ),
        child: digit == null
            ? const SizedBox.shrink(key: ValueKey('empty'))
            : Text(digit!, key: ValueKey('d$digit'), style: AppText.h2.copyWith(color: error ? AppColors.danger : AppColors.textPrimary)),
      ),
    );
  }
}
