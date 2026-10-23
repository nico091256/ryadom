import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { fromBuffer } from 'file-type';
import type { OutputInfo } from 'sharp';
import { UserRole } from '@localshop/shared';
import { Roles } from '../../common/decorators/roles.decorator';

// sharp ships ESM-style typings (`export default`) but a CommonJS build (`module.exports = sharp`);
// without esModuleInterop a default import would be `undefined` at runtime, so bind it explicitly.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp: typeof import('sharp').default = require('sharp');

/** Real (byte-sniffed) MIME types we accept; the client-declared mimetype is ignored. */
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
/** Decompression-bomb guard: refuse to decode anything above ~40 megapixels. */
const MAX_INPUT_PIXELS = 40_000_000;
const MAX_DIMENSION = 1200;
const WEBP_QUALITY = 85;
/** Uploads: 30 per 15 minutes per client (the ThrottlerGuard is global). */
const UPLOAD_THROTTLE = { default: { limit: 30, ttl: 15 * 60 * 1000 } };

function uploadDir(): string {
  // resolve() honours an absolute UPLOAD_DIR; relative paths are taken from the cwd.
  const dir = resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function invalidFileType(): BadRequestException {
  return new BadRequestException({ code: 'INVALID_FILE_TYPE', message: 'Only JPEG, PNG or WEBP images are allowed.' });
}

@ApiTags('Uploads')
@ApiBearerAuth()
@Controller('uploads')
// Only staff upload (product photos, shop logo/cover); enforced by the global RolesGuard.
@Roles(UserRole.SELLER, UserRole.ADMIN)
export class UploadsController {
  @Post('image')
  @Throttle(UPLOAD_THROTTLE)
  @ApiOperation({
    summary:
      'Upload an image (product photo, shop logo/cover). The file is type-checked by its bytes, re-encoded to WEBP (max 1200px, metadata stripped) and returned as a server-relative URL.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary', description: 'JPEG, PNG or WEBP, max 5 MB' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
    }),
  )
  async uploadImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'No file was uploaded under the "file" field.' });
    }

    // 1. Trust the bytes, not the declared mimetype / extension.
    const detected = await fromBuffer(file.buffer);
    if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
      throw invalidFileType();
    }

    // 2. Re-encode: strips EXIF/ICC/XMP and any trailing payload (polyglot files),
    //    normalises orientation and bounds the output size.
    let data: Buffer;
    let info: OutputInfo;
    try {
      ({ data, info } = await sharp(file.buffer, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true }));
    } catch (err: any) {
      if (/pixel limit/i.test(String(err?.message))) {
        throw new BadRequestException({ code: 'IMAGE_TOO_LARGE', message: 'Image exceeds the 40 megapixel limit.' });
      }
      // Valid magic bytes but undecodable content (truncated, corrupt or crafted file).
      throw invalidFileType();
    }

    const filename = `${randomUUID()}.webp`;
    await writeFile(join(uploadDir(), filename), data);

    return { url: `/uploads/${filename}`, width: info.width, height: info.height, bytes: info.size };
  }
}
