import 'package:flutter/material.dart';

import '../../../../ui/ui.dart';

/// White rounded square with the bold green "R" — the app's logo mark.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 88});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(AppRadius.xl),
        boxShadow: AppShadows.lg,
      ),
      child: Text('R', style: AppText.display.brand.weight(900).copyWith(height: 1)),
    );
  }
}
