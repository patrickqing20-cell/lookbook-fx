#!/bin/bash
# Lookbook FX Skill — 首次安装脚本
# 自动检查并安装所有依赖
set -e

echo "=========================================="
echo "  Lookbook FX Skill — Setup"
echo "=========================================="

SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
PUBLIC_DIR="/workspace/public"
MODELS_DIR="$PUBLIC_DIR/face-models"

# 1. Check Chromium
echo ""
echo "[1/5] Chromium (port 9222)..."
if curl -s http://127.0.0.1:9222/json/version > /dev/null 2>&1; then
  echo "  ✅ Chromium running"
else
  echo "  ❌ Chromium not found on port 9222"
  echo "  → 宝子沙箱通常已预装。如果没有，运行:"
  echo "    chromium-browser --headless --no-sandbox --disable-gpu --remote-debugging-port=9222 &"
  exit 1
fi

# 2. Check puppeteer-core
echo ""
echo "[2/5] puppeteer-core..."
if node -e "require('puppeteer-core')" 2>/dev/null; then
  echo "  ✅ puppeteer-core installed"
else
  echo "  ⏳ Installing puppeteer-core..."
  cd /workspace && npm install --no-save puppeteer-core 2>&1 | tail -1
  echo "  ✅ Done"
fi

# 3. Check static file server (8080)
echo ""
echo "[3/5] Static file server (port 8080)..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/ | grep -q "200"; then
  echo "  ✅ Static server running on 8080"
else
  echo "  ❌ Port 8080 not serving files"
  echo "  → 宝子沙箱通常已配置 /workspace/public → :8080/artifacts/"
  exit 1
fi

# 4. Deploy HTML + face-models
echo ""
echo "[4/5] HTML + face-api models..."

# Copy HTML
if [ -f "$PUBLIC_DIR/lookbook-fx.html" ]; then
  echo "  ✅ lookbook-fx.html exists"
else
  if [ -f "$SKILL_DIR/../../public/lookbook-fx.html" ]; then
    cp "$SKILL_DIR/../../public/lookbook-fx.html" "$PUBLIC_DIR/"
    echo "  ✅ lookbook-fx.html deployed"
  else
    echo "  ❌ lookbook-fx.html not found in package"
    echo "  → 需要将 lookbook-fx.html 放到 $PUBLIC_DIR/"
    exit 1
  fi
fi

# Copy face models
mkdir -p "$MODELS_DIR"
if [ -f "$MODELS_DIR/face-api.min.js" ]; then
  echo "  ✅ face-api models exist"
else
  # Try to find in package
  if [ -d "$SKILL_DIR/../../public/face-models" ]; then
    cp "$SKILL_DIR/../../public/face-models/"* "$MODELS_DIR/"
    echo "  ✅ face-api models deployed"
  else
    # Download from CDN
    echo "  ⏳ Downloading face-api.js + models from CDN..."
    curl -sL "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js" -o "$MODELS_DIR/face-api.min.js"
    # Download TinyFaceDetector (smallest, ~190KB)
    for f in tiny_face_detector_model-shard1 tiny_face_detector_model-weights_manifest.json; do
      curl -sL "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights/$f" -o "$MODELS_DIR/$f"
    done
    echo "  ✅ Downloaded (TinyFaceDetector only, ~190KB)"
    echo "  → 可选: SSD MobilenetV1 精度更高但 5MB，需额外下载"
  fi
fi

# 5. Check ImageMagick (optional)
echo ""
echo "[5/5] ImageMagick (optional, for large image compression)..."
if which convert > /dev/null 2>&1; then
  echo "  ✅ ImageMagick available"
else
  echo "  ⚠️ ImageMagick not found (optional — large images may timeout)"
fi

# Verify
echo ""
echo "=========================================="
echo "  ✅ Setup complete!"
echo ""
echo "  Usage:"
echo "    1. Say 'lookbook' + upload a photo"
echo "    2. Or run manually:"
echo "       node $SKILL_DIR/render.js --image photo.jpg --name KAI --top 'DENIM JACKET' --bottom 'CARGO PANTS' --output out.png"
echo ""
echo "  Web UI:"
echo "    http://localhost:8080/artifacts/lookbook-fx.html"
echo "=========================================="
