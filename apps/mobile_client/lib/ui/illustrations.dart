import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import 'tokens.dart';

/// Flat, brand-coloured spot illustrations for empty/error states. Authored
/// as inline SVG so they ship with the code (no asset pipeline, ~1 KB each)
/// and always match the palette.
enum AppIllustration { empty, emptyCart, noShops, noOrders, offline, success, location }

class Illustration extends StatelessWidget {
  const Illustration(this.kind, {super.key, this.size = 160});

  final AppIllustration kind;
  final double size;

  @override
  Widget build(BuildContext context) {
    return SvgPicture.string(_svg(kind), width: size, height: size, fit: BoxFit.contain);
  }
}

String _hex(Color c) => '#${(c.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';

String _svg(AppIllustration kind) {
  final g1 = _hex(AppColors.green100);
  final g2 = _hex(AppColors.green300);
  final g5 = _hex(AppColors.green500);
  final g7 = _hex(AppColors.green700);
  final n1 = _hex(AppColors.ink100);
  final n2 = _hex(AppColors.ink200);
  final n3 = _hex(AppColors.ink300);
  final n7 = _hex(AppColors.ink700);
  final or = _hex(AppColors.orange500);
  final o1 = _hex(AppColors.orange100);
  final wh = '#FFFFFF';

  const head = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">';
  const tail = '</svg>';
  final blob = '<circle cx="100" cy="104" r="78" fill="$g1"/>';

  switch (kind) {
    case AppIllustration.emptyCart:
      return '$head$blob'
          '<path d="M52 66h18l14 56h54l12-40H78" fill="none" stroke="$n7" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'
          '<rect x="80" y="82" width="68" height="40" rx="8" fill="$wh" stroke="$n7" stroke-width="7"/>'
          '<circle cx="92" cy="140" r="9" fill="$n7"/><circle cx="130" cy="140" r="9" fill="$n7"/>'
          '<path d="M100 98h28M100 108h18" stroke="$n3" stroke-width="5" stroke-linecap="round"/>'
          '<circle cx="152" cy="58" r="14" fill="$or"/><path d="M146 58h12M152 52v12" stroke="$wh" stroke-width="4" stroke-linecap="round"/>'
          '$tail';
    case AppIllustration.noShops:
      return '$head$blob'
          '<path d="M56 96h88v50a6 6 0 0 1-6 6H62a6 6 0 0 1-6-6z" fill="$wh" stroke="$n7" stroke-width="7" stroke-linejoin="round"/>'
          '<path d="M50 96l10-26h80l10 26" fill="$g2" stroke="$n7" stroke-width="7" stroke-linejoin="round"/>'
          '<path d="M50 96h100" stroke="$n7" stroke-width="7" stroke-linecap="round"/>'
          '<path d="M72 96v-14M100 96v-14M128 96v-14" stroke="$g7" stroke-width="5" stroke-linecap="round"/>'
          '<rect x="88" y="118" width="24" height="34" rx="4" fill="$g5"/>'
          '<circle cx="150" cy="60" r="20" fill="$wh" stroke="$n7" stroke-width="6"/><path d="M164 74l14 14" stroke="$n7" stroke-width="7" stroke-linecap="round"/>'
          '<path d="M143 60h14" stroke="$or" stroke-width="5" stroke-linecap="round"/>'
          '$tail';
    case AppIllustration.noOrders:
      return '$head$blob'
          '<rect x="62" y="48" width="76" height="104" rx="12" fill="$wh" stroke="$n7" stroke-width="7"/>'
          '<rect x="84" y="40" width="32" height="16" rx="6" fill="$n7"/>'
          '<path d="M80 84h40M80 102h40M80 120h24" stroke="$n2" stroke-width="7" stroke-linecap="round"/>'
          '<circle cx="138" cy="130" r="20" fill="$g5"/><path d="M130 130l6 6 12-12" fill="none" stroke="$wh" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>'
          '$tail';
    case AppIllustration.offline:
      return '$head$blob'
          '<path d="M46 92c30-28 78-28 108 0" fill="none" stroke="$n3" stroke-width="8" stroke-linecap="round"/>'
          '<path d="M64 112c20-18 52-18 72 0" fill="none" stroke="$n3" stroke-width="8" stroke-linecap="round"/>'
          '<path d="M82 132c10-9 26-9 36 0" fill="none" stroke="$n7" stroke-width="8" stroke-linecap="round"/>'
          '<circle cx="100" cy="150" r="8" fill="$n7"/>'
          '<path d="M60 64l80 80" stroke="$or" stroke-width="8" stroke-linecap="round"/>'
          '$tail';
    case AppIllustration.success:
      return '$head$blob'
          '<circle cx="100" cy="100" r="46" fill="$g5"/>'
          '<path d="M78 102l14 14 30-32" fill="none" stroke="$wh" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>'
          '<circle cx="46" cy="60" r="6" fill="$or"/><circle cx="160" cy="50" r="5" fill="$g2"/><circle cx="162" cy="150" r="7" fill="$o1"/><circle cx="40" cy="140" r="4" fill="$g7"/>'
          '$tail';
    case AppIllustration.location:
      return '$head$blob'
          '<ellipse cx="100" cy="156" rx="34" ry="8" fill="$n2"/>'
          '<path d="M100 150c-26-30-44-52-44-76a44 44 0 0 1 88 0c0 24-18 46-44 76z" fill="$g5" stroke="$g7" stroke-width="5" stroke-linejoin="round"/>'
          '<circle cx="100" cy="74" r="16" fill="$wh"/>'
          '<path d="M150 46l6 6M160 30v8M172 42h-8" stroke="$or" stroke-width="4" stroke-linecap="round"/>'
          '$tail';
    case AppIllustration.empty:
      return '$head$blob'
          '<rect x="54" y="70" width="92" height="72" rx="14" fill="$wh" stroke="$n7" stroke-width="7"/>'
          '<path d="M54 92h92" stroke="$n7" stroke-width="7"/>'
          '<circle cx="70" cy="81" r="4" fill="$or"/><circle cx="84" cy="81" r="4" fill="$g2"/>'
          '<path d="M74 112h30M74 124h52" stroke="$n1" stroke-width="7" stroke-linecap="round"/>'
          '$tail';
  }
}
