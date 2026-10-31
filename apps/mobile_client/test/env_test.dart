import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_client/core/config/env.dart';

void main() {
  group('Env.inferWebApiBase (web build without API_BASE_URL)', () {
    test('local hosts keep the dev API on port 4000', () {
      expect(Env.inferWebApiBase(Uri.parse('http://localhost:5173/')), 'http://localhost:4000/api/v1');
      expect(Env.inferWebApiBase(Uri.parse('http://127.0.0.1/')), 'http://127.0.0.1:4000/api/v1');
      expect(Env.inferWebApiBase(Uri.parse('http://192.168.1.10:8080/')), 'http://192.168.1.10:4000/api/v1');
      expect(Env.inferWebApiBase(Uri.parse('http://mypc/')), 'http://mypc:4000/api/v1');
    });

    test('a deployed domain maps to its api. sibling over https, never <host>:4000', () {
      expect(Env.inferWebApiBase(Uri.parse('https://client.ryadom.uz/shops/1')), 'https://api.ryadom.uz/api/v1');
      expect(Env.inferWebApiBase(Uri.parse('https://ryadom.uz/')), 'https://api.ryadom.uz/api/v1');
    });
  });

  group('Env media / socket roots', () {
    test('apiOrigin is the API host without the /api/v1 prefix', () {
      expect(Env.apiBaseUrl, endsWith('/api/v1'));
      expect(Env.apiOrigin, isNot(contains('/api')));
      expect(Env.apiBaseUrl, startsWith(Env.apiOrigin));
      expect(Env.socketUrl, Env.apiOrigin);
      expect(Env.mediaBaseUrl, Env.apiOrigin);
    });

    test('resolveMediaUrl joins server-relative paths and passes absolute urls through', () {
      expect(Env.resolveMediaUrl('/uploads/a.webp'), '${Env.apiOrigin}/uploads/a.webp');
      expect(Env.resolveMediaUrl('uploads/a.webp'), '${Env.apiOrigin}/uploads/a.webp');
      expect(Env.resolveMediaUrl('https://cdn.example.com/x.png'), 'https://cdn.example.com/x.png');
      expect(Env.resolveMediaUrl('//cdn.example.com/x.png'), startsWith('http'));
    });
  });
}
