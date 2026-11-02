// Hero video, posters, favicons and the default share image. Re-run only when a source changes.
// Usage: node tools/media.mjs
// ffmpeg: FFMPEG_PATH (bin dir) or the WinGet Gyan.FFmpeg install.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_VIDEO = join(ROOT, 'assets/index photos/casella-home.mp4');
const LOGO = join(ROOT, 'assets/logo.png');
const MEDIA = join(ROOT, 'assets/media');
const ICONS = join(ROOT, 'assets/icons');
const TMP = join(ROOT, '.tmp/media');
for (const d of [MEDIA, ICONS, TMP]) mkdirSync(d, { recursive: true });

const winget = join(process.env.LOCALAPPDATA || '', 'Microsoft/WinGet/Packages');
const wingetBin = existsSync(winget)
  ? readdirSync(winget).filter((d) => d.startsWith('Gyan.FFmpeg')).map((d) => join(winget, d)).flatMap((d) => readdirSync(d).filter((x) => x.startsWith('ffmpeg-')).map((x) => join(d, x, 'bin'))).sort().at(-1)
  : '';
const BIN = process.env.FFMPEG_PATH || wingetBin;
const FFMPEG = join(BIN, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
const ff = (args) => {
  const r = spawnSync(FFMPEG, ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(' ')}`);
};
const kb = (f) => `${Math.round(statSync(f).size / 1024)} KB`;

// Hero video: no audio, desktop 1280x720, phone portrait 540x960 (centre crop, the hero is taller than wide there).
const variants = [
  { name: 'desktop', vf: 'scale=1280:-2', av1crf: 40, x264crf: 28 },
  { name: 'mobile', vf: 'crop=ih*9/16:ih,scale=540:960', av1crf: 40, x264crf: 29 },
];
for (const v of process.argv.includes("--no-video") ? [] : variants) {
  const webm = join(MEDIA, `hero-${v.name}.webm`);
  const mp4 = join(MEDIA, `hero-${v.name}.mp4`);
  ff(['-i', SRC_VIDEO, '-an', '-vf', `${v.vf},fps=30`, '-c:v', 'libsvtav1', '-crf', String(v.av1crf), '-preset', '5', '-pix_fmt', 'yuv420p', '-g', '120', webm]);
  ff(['-i', SRC_VIDEO, '-an', '-vf', `${v.vf},fps=30`, '-c:v', 'libx264', '-crf', String(v.x264crf), '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
  // Poster = first frame, so the switch from image to video does not jump.
  // Desktop posters come from the full 1920 frame; phone posters from the portrait crop at its size.
  const frame = join(TMP, `poster-${v.name}.png`);
  ff(['-i', SRC_VIDEO, '-vf', v.name === 'desktop' ? 'null' : v.vf.replace('scale=540:960', 'scale=810:1440'), '-frames:v', '1', frame]);
  const widths = v.name === 'desktop' ? [960, 1280, 1920] : [540, 810];
  for (const w of widths) {
    const img = sharp(frame).resize({ width: w });
    await img.clone().webp({ quality: 70, effort: 6 }).toFile(join(MEDIA, `hero-${v.name}-${w}.webp`));
    await img.clone().avif({ quality: 50, effort: 6, chromaSubsampling: '4:2:0' }).toFile(join(MEDIA, `hero-${v.name}-${w}.avif`));
  }
  console.log(`hero ${v.name}: webm ${kb(webm)}, mp4 ${kb(mp4)}`);
}

// Favicons: the tractor from the logo (left part), on a square.
const logo = sharp(LOGO);
const { width: lw, height: lh } = await logo.metadata();
const mark = await sharp(await sharp(LOGO).extract({ left: 0, top: 0, width: Math.round(lw * 0.31), height: lh }).png().toBuffer()).trim().toBuffer();
const square = async (size, pad, bg) => {
  const inner = Math.round(size * (1 - pad * 2));
  const glyph = await sharp(mark).resize({ width: inner, height: inner, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: bg } }).composite([{ input: glyph, gravity: 'centre' }]).png({ compressionLevel: 9 });
};
const clear = { r: 0, g: 0, b: 0, alpha: 0 };
const white = { r: 255, g: 255, b: 255, alpha: 1 };
await (await square(48, 0.06, clear)).toFile(join(ICONS, 'favicon-48.png'));
await (await square(96, 0.06, clear)).toFile(join(ICONS, 'favicon-96.png'));
await (await square(192, 0.12, white)).toFile(join(ICONS, 'icon-192.png'));
await (await square(512, 0.12, white)).toFile(join(ICONS, 'icon-512.png'));
await (await square(180, 0.1, white)).toFile(join(ICONS, 'apple-touch-icon.png'));
// favicon.ico at the root: a 48 px PNG inside an ICO container (all current browsers and Google read it).
const png48 = await (await square(48, 0.06, clear)).toBuffer();
const ico = Buffer.alloc(22 + png48.length);
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico.writeUInt8(48, 6); ico.writeUInt8(48, 7); ico.writeUInt8(0, 8); ico.writeUInt8(0, 9);
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(png48.length, 14); ico.writeUInt32LE(22, 18);
png48.copy(ico, 22);
const { writeFileSync } = await import('node:fs');
writeFileSync(join(ROOT, 'favicon.ico'), ico);
// Header and footer logo at display size x2 (was a 664 px PNG shown at 110 px).
await sharp(LOGO).resize({ width: 240 }).webp({ quality: 90, alphaQuality: 90 }).toFile(join(ICONS, 'logo-240.webp'));
await sharp(LOGO).resize({ width: 440 }).webp({ quality: 90, alphaQuality: 90 }).toFile(join(ICONS, 'logo-440.webp'));

// Default share image 1200x630: a frame of the hero film with the logo on a white band.
ff(['-ss', '6', '-i', SRC_VIDEO, '-frames:v', '1', join(TMP, 'og-frame.png')]);
const band = await sharp({ create: { width: 1200, height: 150, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0.94 } } })
  .composite([{ input: await sharp(LOGO).resize({ height: 110 }).toBuffer(), gravity: 'centre' }]).png().toBuffer();
await sharp(join(TMP, 'og-frame.png')).resize(1200, 630, { fit: 'cover' })
  .composite([{ input: band, top: 480, left: 0 }])
  .jpeg({ quality: 82, mozjpeg: true }).toFile(join(ROOT, 'assets/og-image.jpg'));
console.log('icons, logo, og-image done');
