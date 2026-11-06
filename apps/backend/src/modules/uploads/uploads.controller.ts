import {
  BadRequestException,
  Controller,
  InternalServerErrorException,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { join, resolve } from 'path';
import { createHash, createHmac, randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { fromBuffer } from 'file-type';
import type { OutputInfo } from 'sharp';
import { UserRole } from '@localshop/shared';
import { Roles } from '../../common/decorators/roles.decorator';

let cachedSharp: any = undefined;
function getSharp(): any {
  if (cachedSharp !== undefined) return cachedSharp;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cachedSharp = require('sharp');
  } catch {
    cachedSharp = null;
  }
  return cachedSharp;
}

/** Real (byte-sniffed) MIME types we accept; the client-declared mimetype is ignored. */
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
/** Decompression-bomb guard: refuse to decode anything above ~40 megapixels. */
const MAX_INPUT_PIXELS = 40_000_000;
const MAX_DIMENSION = 1200;
const WEBP_QUALITY = 85;
/** Uploads: 30 per 15 minutes per client (the ThrottlerGuard is global). */
const UPLOAD_THROTTLE = { default: { limit: 30, ttl: 15 * 60 * 1000 } };

/** Where uploads are written — and, via main.ts, served from. */
export function uploadDir(): string {
  // resolve() honours an absolute UPLOAD_DIR; relative paths are taken from the cwd.
  const dir = resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function sha256Hex(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex');
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

async function uploadToS3(filename: string, data: Buffer): Promise<string> {
  const endpointRaw = process.env.S3_ENDPOINT?.replace(/\/+$/, '');
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION || 'auto';
  const accessKey = process.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY;

  if (!endpointRaw || !bucket || !accessKey || !secretKey) {
    throw new InternalServerErrorException({
      code: 'S3_CONFIG_MISSING',
      message: 'UPLOAD_DRIVER=s3 requires S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, and S3_SECRET_KEY.',
    });
  }

  const objectKey = `uploads/${filename}`;
  const targetUrl = new URL(`${endpointRaw}/${bucket}/${objectKey}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(data);

  const canonicalHeaders =
    `content-type:image/webp\n` +
    `host:${targetUrl.host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    'PUT',
    targetUrl.pathname,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmacSha256(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, 's3');
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(targetUrl.toString(), {
    method: 'PUT',
    headers: {
      'Content-Type': 'image/webp',
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: authorization,
    },
    body: new Uint8Array(data),
  });

  if (!response.ok) {
    throw new InternalServerErrorException({
      code: 'S3_UPLOAD_FAILED',
      message: `Failed to upload image to object storage (HTTP ${response.status})`,
    });
  }

  const publicBase = process.env.S3_PUBLIC_URL?.replace(/\/+$/, '');
  return publicBase ? `${publicBase}/${objectKey}` : `${endpointRaw}/${bucket}/${objectKey}`;
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
      'Upload an image (product photo, shop logo/cover). The file is type-checked by its bytes, re-encoded to WEBP (max 1200px, metadata stripped) and returned as a server-relative or CDN URL.',
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
    const sharp = getSharp();
    if (!sharp) {
      throw new BadRequestException({ code: 'IMAGE_PROCESSOR_ERROR', message: 'Image processor is currently unavailable' });
    }

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
    if (process.env.UPLOAD_DRIVER === 's3') {
      const url = await uploadToS3(filename, data);
      return { url, width: info.width, height: info.height, bytes: info.size };
    }

    await writeFile(join(uploadDir(), filename), data);

    return { url: `/uploads/${filename}`, width: info.width, height: info.height, bytes: info.size };
  }
}

