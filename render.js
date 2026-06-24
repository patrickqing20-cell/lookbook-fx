#!/usr/bin/env node
/**
 * Lookbook FX 渲染脚本
 * 用 Puppeteer 打开 lookbook-fx.html → 填参数 → 上传图片 → 等渲染 → 截图导出
 *
 * Usage:
 *   node render.js --image /path/to/photo.jpg --name LIANA --top "DENIM JACKET" --bottom "CARGO PANTS" --output /tmp/out.png
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    image: '',
    name: 'SUBJECT',
    id: 'LOOKBOOK',
    project: '25SS',
    match: '95',
    top: 'TOP GARMENT',
    bottom: 'BOTTOM GARMENT',
    acc: '',
    sideWords: 'THIS\nBEST\nOUTFIT\nMY',
    hudColor: '#00ff00',
    output: '/workspace/public/lookbook-output.png',
  };
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    const val = args[i + 1] || '';
    if (key in opts) opts[key] = val;
  }
  return opts;
}

(async () => {
  const opts = parseArgs();

  if (!opts.image || !fs.existsSync(opts.image)) {
    console.error('ERROR: --image is required and file must exist');
    console.error('Usage: node render.js --image /path/to/photo.jpg [--name X] [--top X] [--bottom X] [--output /path/out.png]');
    process.exit(1);
  }

  const imagePath = path.resolve(opts.image);
  const outputPath = path.resolve(opts.output);

  console.log(`[lookbook-fx] Image: ${imagePath}`);
  console.log(`[lookbook-fx] Name: ${opts.name} | Top: ${opts.top} | Bottom: ${opts.bottom}`);
  console.log(`[lookbook-fx] Output: ${outputPath}`);

  // Connect to existing Chromium
  let browser;
  try {
    browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  } catch (e) {
    console.error('ERROR: Cannot connect to Chromium at port 9222. Is it running?');
    process.exit(1);
  }

  const page = await browser.newPage();
  // Use high DPR to get full-res canvas screenshot when toDataURL is tainted
  await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 2 });

  // Load page
  await page.goto('http://localhost:8080/artifacts/lookbook-fx.html', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  // Wait for face model to load
  try {
    await page.waitForFunction(() => {
      const el = document.getElementById('modelStatus');
      return el && (el.textContent.includes('就绪') || el.textContent.includes('失败') || el.textContent.includes('备用'));
    }, { timeout: 30000 });
  } catch (e) {
    console.log('[lookbook-fx] Model load timeout, continuing...');
  }

  // Fill form fields
  await page.evaluate((opts) => {
    document.getElementById('personName').value = opts.name;
    document.getElementById('personId').value = opts.id;
    document.getElementById('projectName').value = opts.project;
    document.getElementById('matchPct').value = opts.match;
    document.getElementById('topLabel').value = opts.top;
    document.getElementById('bottomLabel').value = opts.bottom;
    document.getElementById('accLabel').value = opts.acc;
    document.getElementById('sideWords').value = opts.sideWords.replace(/\\n/g, '\n');
  }, opts);

  // Set HUD color if not default
  if (opts.hudColor !== '#00ff00') {
    await page.evaluate((color) => {
      const dot = document.querySelector(`.color-dot[data-color="${color}"]`);
      if (dot) dot.click();
    }, opts.hudColor);
  }

  // Upload image
  const fileInput = await page.$('#fileInput');
  await fileInput.uploadFile(imagePath);
  console.log('[lookbook-fx] Image uploaded, waiting for render...');

  // Wait for rendering to complete
  try {
    await page.waitForFunction(() => {
      const el = document.getElementById('loadingOverlay');
      return !el || el.classList.contains('hidden');
    }, { timeout: 30000 });
    console.log('[lookbook-fx] Render complete');
  } catch (e) {
    console.log('[lookbook-fx] Render timeout, capturing anyway...');
  }

  // Extra wait for canvas paint
  await new Promise((r) => setTimeout(r, 1000));

  // Screenshot the canvas element directly
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Try canvas toDataURL first (best quality)
  // Note: file:// uploads taint the canvas, getImageData will throw even though toDataURL returns a blank PNG
  let saved = false;
  try {
    const result = await page.evaluate(() => {
      const c = document.getElementById('canvas');
      try {
        // This will throw if canvas is tainted
        c.getContext('2d').getImageData(0, 0, 1, 1);
        return { ok: true, data: c.toDataURL('image/png') };
      } catch(e) {
        return { ok: false, data: null };
      }
    });
    if (result.ok && result.data && result.data.length > 10000) {
      const base64Data = result.data.replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(outputPath, Buffer.from(base64Data, 'base64'));
      const sz = fs.statSync(outputPath).size;
      if (sz > 50000) {
        saved = true;
        console.log('[lookbook-fx] Canvas toDataURL export OK');
      }
    }
  } catch(e) { /* fallback to screenshot */ }

  // Fallback: screenshot the canvas element (with 2x DPR = ~1500x2000 output)
  if (!saved) {
    console.log('[lookbook-fx] Canvas tainted, using element screenshot fallback');
    const canvasEl = await page.$('#canvas');
    if (canvasEl) {
      await canvasEl.screenshot({ path: outputPath, type: 'png' });
    } else {
      await page.screenshot({ path: outputPath });
    }
  }

  const fileSize = fs.statSync(outputPath).size;
  console.log(`[lookbook-fx] Saved: ${outputPath} (${(fileSize / 1024).toFixed(0)}KB)`);

  await page.close();
  console.log('[lookbook-fx] Done');
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
