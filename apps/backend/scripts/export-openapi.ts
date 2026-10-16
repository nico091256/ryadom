/**
 * Exports the live OpenAPI document to docs/openapi.json without booting a
 * listening HTTP server. Run after any API route/DTO change so the Flutter
 * apps' generated Dart clients/models (see docs/openapi.json consumers in
 * apps/mobile_client) stay in sync with the backend.
 *
 * Usage: pnpm --filter @localshop/backend export:openapi
 */
import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../src/app.module';
import { buildSwaggerDocument } from '../src/swagger.config';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.init();

  const document = buildSwaggerDocument(app);
  const outPath = join(__dirname, '../../../docs/openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2));
  console.log(`OpenAPI document written to ${outPath}`);

  await app.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
