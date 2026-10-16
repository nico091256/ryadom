import 'package:url_launcher/url_launcher.dart';

Future<void> launchCallerUrl(String phone) async {
  final uri = Uri(scheme: 'tel', path: phone);
  await launchUrl(uri);
}

Future<void> launchMapsUrl(double lat, double lng) async {
  final uri = Uri.parse('https://yandex.uz/maps/?text=$lat,$lng');
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}
