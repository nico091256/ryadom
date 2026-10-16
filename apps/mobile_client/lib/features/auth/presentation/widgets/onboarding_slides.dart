import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show ScrollDirection;

import '../../../../ui/ui.dart';

class OnboardingSlide {
  const OnboardingSlide({required this.illustration, required this.title, required this.subtitle});

  final AppIllustration illustration;
  final String title;
  final String subtitle;
}

/// Auto-advancing PageView of illustrated slides with an animated dots
/// indicator. Auto-advance pauses while the user is swiping and restarts
/// from a full interval afterwards.
class OnboardingSlides extends StatefulWidget {
  const OnboardingSlides({
    super.key,
    required this.slides,
    this.interval = const Duration(milliseconds: 3500),
    this.illustrationSize = 200,
  });

  final List<OnboardingSlide> slides;
  final Duration interval;
  final double illustrationSize;

  @override
  State<OnboardingSlides> createState() => _OnboardingSlidesState();
}

class _OnboardingSlidesState extends State<OnboardingSlides> {
  final _controller = PageController();
  Timer? _timer;
  int _page = 0;
  bool _userScrolling = false;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _startTimer() {
    _timer?.cancel();
    if (widget.slides.length < 2) return;
    _timer = Timer.periodic(widget.interval, (_) => _advance());
  }

  void _advance() {
    if (_userScrolling || !mounted || !_controller.hasClients) return;
    final next = (_page + 1) % widget.slides.length;
    _controller.animateToPage(next, duration: AppDurations.slow, curve: AppCurves.standard);
  }

  bool _onScroll(ScrollNotification n) {
    if (n is UserScrollNotification) {
      final scrolling = n.direction != ScrollDirection.idle;
      if (scrolling != _userScrolling) {
        _userScrolling = scrolling;
        if (!scrolling) _startTimer(); // give the user a full interval after a swipe
      }
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: NotificationListener<ScrollNotification>(
            onNotification: _onScroll,
            child: PageView.builder(
              controller: _controller,
              itemCount: widget.slides.length,
              onPageChanged: (i) => setState(() => _page = i),
              itemBuilder: (context, i) => _Slide(slide: widget.slides[i], illustrationSize: widget.illustrationSize),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        _Dots(count: widget.slides.length, active: _page),
      ],
    );
  }
}

class _Slide extends StatelessWidget {
  const _Slide({required this.slide, required this.illustrationSize});

  final OnboardingSlide slide;
  final double illustrationSize;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xxxl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(child: Illustration(slide.illustration, size: illustrationSize)),
              const SizedBox(height: AppSpacing.xxl),
              Text(slide.title, textAlign: TextAlign.center, style: AppText.h2, maxLines: 2, overflow: TextOverflow.ellipsis),
              const SizedBox(height: AppSpacing.sm),
              Text(slide.subtitle, textAlign: TextAlign.center, style: AppText.body.secondary, maxLines: 2, overflow: TextOverflow.ellipsis),
            ],
          ),
        ),
      ),
    );
  }
}

class _Dots extends StatelessWidget {
  const _Dots({required this.count, required this.active});

  final int count;
  final int active;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (var i = 0; i < count; i++)
          AnimatedContainer(
            duration: AppDurations.normal,
            curve: AppCurves.standard,
            margin: const EdgeInsets.symmetric(horizontal: 3),
            width: i == active ? 24 : 8,
            height: 8,
            decoration: BoxDecoration(
              color: i == active ? AppColors.brand : AppColors.ink200,
              borderRadius: BorderRadius.circular(AppRadius.pill),
            ),
          ),
      ],
    );
  }
}
