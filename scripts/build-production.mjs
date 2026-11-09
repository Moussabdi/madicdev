import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify } from 'terser';
import CleanCSS from 'clean-css';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
const cssMinifier = new CleanCSS({level: 0, rebase: false});
const allowRoot = new Set(['.html', '.webmanifest', '.json', '.txt', '.xml', '.ico', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.pdf']);
const allowDirs = new Set(['assets', 'img']);
const deny = /(^|\/)(?:\.git|\.env(?:\.|$)|node_modules|dist|sql|supabase)(?:\/|$)|(?:\.map|\.bak|\.backup|\.sql|\.log|\.7z|\.zip|\.ps1|\.sh)$/i;
let copied = 0, jsCount = 0, cssCount = 0;

async function processFile(source, target, relative) {
  if (deny.test(relative)) return;
  const ext = path.extname(source).toLowerCase();
  if (!allowRoot.has(ext) && ext !== '.js' && ext !== '.css') return;
  if (relative === 'assets/config.example.js') return;
  await fs.mkdir(path.dirname(target), {recursive: true});
  if (ext === '.js') {
    const code = await fs.readFile(source, 'utf8');
    // No identifier mangling or compression: preserve cross-file globals and runtime semantics.
    const result = await minify(code, {module: false, compress: false, mangle: false, format: {beautify: false, comments: false}});
    if (result.error || typeof result.code !== 'string') throw new Error(`JavaScript minification failed: ${relative}`);
    await fs.writeFile(target, result.code, 'utf8'); jsCount++;
  } else if (ext === '.css') {
    const css = await fs.readFile(source, 'utf8');
    const result = cssMinifier.minify(css);
    if (result.errors.length) throw new Error(`CSS minification failed: ${relative}: ${result.errors.join('; ')}`);
    await fs.writeFile(target, result.styles, 'utf8'); cssCount++;
  } else { await fs.copyFile(source, target); copied++; }
}
async function walk(sourceDir, destDir, prefix = '') {
  for (const item of await fs.readdir(sourceDir, {withFileTypes: true})) {
    const relative = prefix ? `${prefix}/${item.name}` : item.name;
    if (deny.test(relative)) continue;
    const source = path.join(sourceDir, item.name);
    const target = path.join(destDir, item.name);
    if (item.isDirectory()) {
      if (!prefix && allowDirs.has(item.name)) await walk(source, target, relative);
      else if (prefix && prefix.split('/')[0] && allowDirs.has(prefix.split('/')[0])) await walk(source, target, relative);
    } else if (item.isFile()) {
      if (prefix || allowRoot.has(path.extname(item.name).toLowerCase())) await processFile(source, target, relative);
    }
  }
}
await fs.rm(output, {recursive: true, force: true});
await fs.mkdir(output, {recursive: true});
await walk(root, output);
if (!(await fs.stat(path.join(output, 'index.html')).catch(() => null))) throw new Error('index.html missing in output');
console.log(`MADIC build complete: ${copied} static files, ${jsCount} JS, ${cssCount} CSS. Output: dist/`);
