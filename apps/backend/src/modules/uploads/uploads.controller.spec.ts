import { BadRequestException } from '@nestjs/common';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fromBuffer } from 'file-type';
import { UploadsController } from './uploads.controller';

// See uploads.controller.ts: sharp is CJS at runtime but typed as an ESM default export.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp: typeof import('sharp').default = require('sharp');

function asMulterFile(buffer: Buffer, originalname: string, mimetype: string): Express.Multer.File {
  return { buffer, originalname, mimetype, size: buffer.length, fieldname: 'file' } as Express.Multer.File;
}

async function errorCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(BadRequestException);
    return ((err as BadRequestException).getResponse() as any).code;
  }
  throw new Error('expected the upload to be rejected');
}

describe('UploadsController', () => {
  let controller: UploadsController;
  let dir: string;
  let previousUploadDir: string | undefined;

  beforeEach(() => {
    controller = new UploadsController();
    dir = mkdtempSync(join(tmpdir(), 'ryadom-uploads-'));
    previousUploadDir = process.env.UPLOAD_DIR;
    process.env.UPLOAD_DIR = dir; // absolute: resolve() keeps it as is
  });

  afterEach(() => {
    if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = previousUploadDir;
    rmSync(dir, { recursive: true, force: true });
  });

  const makeImage = (width: number, height: number) =>
    sharp({ create: { width, height, channels: 3, background: { r: 200, g: 30, b: 30 } } });

  it('re-encodes a PNG to WEBP, keeps its dimensions and writes <uuid>.webp into the upload dir', async () => {
    const png = await makeImage(64, 48).png().toBuffer();

    const result = await controller.uploadImage(asMulterFile(png, 'photo.png', 'image/png'));

    expect(result.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.webp$/);
    expect(result).toMatchObject({ width: 64, height: 48 });
    expect(result.bytes).toBeGreaterThan(0);

    const written = readdirSync(dir);
    expect(written).toHaveLength(1);
    expect(`/uploads/${written[0]}`).toBe(result.url);

    const bytes = readFileSync(join(dir, written[0]));
    expect(bytes.length).toBe(result.bytes);
    expect((await fromBuffer(bytes))?.mime).toBe('image/webp');
    expect(await sharp(bytes).metadata()).toMatchObject({ format: 'webp', width: 64, height: 48 });
  });

  it('accepts a JPEG even when the client lies about the mimetype, and strips metadata', async () => {
    const jpeg = await makeImage(40, 30).jpeg().withMetadata({ exif: { IFD0: { Copyright: 'secret' } } }).toBuffer();
    expect((await sharp(jpeg).metadata()).exif).toBeDefined();

    const result = await controller.uploadImage(asMulterFile(jpeg, 'photo.jpg', 'application/octet-stream'));

    expect(result).toMatchObject({ width: 40, height: 30 });
    const stored = readFileSync(join(dir, result.url.replace('/uploads/', '')));
    const meta = await sharp(stored).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.exif).toBeUndefined();
  });

  it('downsizes large images to fit 1200px while keeping the aspect ratio', async () => {
    const big = await makeImage(2400, 600).png().toBuffer();

    const result = await controller.uploadImage(asMulterFile(big, 'wide.png', 'image/png'));

    expect(result).toMatchObject({ width: 1200, height: 300 });
  });

  it('rejects text bytes renamed to .png with INVALID_FILE_TYPE (declared mimetype is ignored)', async () => {
    const fake = Buffer.from('<?php echo "not an image"; ?>\n'.repeat(20), 'utf8');

    expect(await errorCode(controller.uploadImage(asMulterFile(fake, 'evil.png', 'image/png')))).toBe('INVALID_FILE_TYPE');
    expect(readdirSync(dir)).toHaveLength(0);
  });

  it('rejects non-image formats that file-type does recognise (e.g. PDF, GIF)', async () => {
    const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(64, 0x20)]);
    const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(64, 0)]);

    expect(await errorCode(controller.uploadImage(asMulterFile(pdf, 'doc.png', 'image/png')))).toBe('INVALID_FILE_TYPE');
    expect(await errorCode(controller.uploadImage(asMulterFile(gif, 'anim.png', 'image/png')))).toBe('INVALID_FILE_TYPE');
  });

  it('rejects a buffer with valid PNG magic bytes but undecodable content', async () => {
    const png = await makeImage(16, 16).png().toBuffer();
    const truncated = png.subarray(0, 24); // signature + IHDR header only

    expect(await errorCode(controller.uploadImage(asMulterFile(truncated, 'broken.png', 'image/png')))).toBe('INVALID_FILE_TYPE');
    expect(readdirSync(dir)).toHaveLength(0);
  });

  it('rejects a missing or empty file with FILE_REQUIRED', async () => {
    expect(await errorCode(controller.uploadImage(undefined))).toBe('FILE_REQUIRED');
    expect(await errorCode(controller.uploadImage(asMulterFile(Buffer.alloc(0), 'x.png', 'image/png')))).toBe('FILE_REQUIRED');
  });

  it('creates the upload dir when it does not exist yet', async () => {
    const nested = join(dir, 'nested', 'deeper');
    process.env.UPLOAD_DIR = nested;
    expect(existsSync(nested)).toBe(false);

    const png = await makeImage(8, 8).png().toBuffer();
    const result = await controller.uploadImage(asMulterFile(png, 'a.png', 'image/png'));

    expect(existsSync(join(nested, result.url.replace('/uploads/', '')))).toBe(true);
  });
});
