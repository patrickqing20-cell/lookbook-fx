---
name: lookbook-fx
version: 1.1.0
description: 监控追踪风时尚效果图生成器。用户传一张人物照片，Agent 视觉识别服装信息，自动生成追踪框风格 Lookbook 效果图。
triggers:
  - lookbook
  - 追踪框
  - 监控风
  - lookbook-fx
  - 时尚追踪
  - surveillance lookbook
---

# Lookbook FX — 监控追踪风时尚效果图生成器

## 概述
用户传一张人物全身/半身照，Agent 用视觉能力识别服装信息，自动生成监控追踪框风格的时尚 Lookbook 效果图。

## 用户交互方式

### 方式1：纯传图（全自动）
用户只传一张图 → Agent 自动识别所有参数 → 直接出图

### 方式2：传图 + 文字指令（自定义）
用户可以在消息里附带任意自定义参数，Agent 解析后覆盖对应字段，其余仍自动识别：

**可自定义的参数**：
| 用户说 | 对应参数 | 示例 |
|--------|----------|------|
| 名字/name/叫XX | name | "名字叫 SAKURA" |
| 用绿色/红色/青色/橙色/白色 | hudColor | "用红色框" |
| 品牌/brand/ID | id | "品牌写 GUCCI" |
| 系列/project/collection | project | "系列 26SS" |
| 上衣/top | top | "上衣写 WHITE HOODIE" |
| 下装/bottom | bottom | "下装写 BLACK SKIRT" |
| 配饰/acc | acc | "配饰：墨镜" |
| 关键词/风格词/side | sideWords | "关键词：COOL DARK EDGY NIGHT" |

**颜色映射**：
- 绿/green → `#00ff00`（默认）
- 青/cyan/蓝绿 → `#00ffff`
- 红/red/粉红 → `#ff3366`
- 橙/orange/黄 → `#ffaa00`
- 白/white → `#ffffff`

**交互示例**：
- `"lookbook 名字YUKI 用青色"` + 图片
- `"追踪框 品牌PRADA 系列25FW 关键词MINIMAL CLEAN DARK CHIC"` + 图片
- `"监控风 上衣写LEATHER BIKER JACKET"` + 图片

### 方式3：出图后修改
用户看到效果图后可以要求修改，Agent 用**上一次的图片和参数**，只改用户指定的字段重新渲染：
- "名字改成 LUNA"
- "换成红色"
- "上衣改成 SILK BLOUSE"
- "关键词换成 BOLD FIERCE POWER QUEEN"

## 链路

### Step 1: 解析用户意图
1. 检查用户消息是否包含自定义参数（名字/颜色/品牌等）
2. 如果有 → 提取出来，作为覆盖值
3. 如果是"修改"指令 → 复用上次参数，只改指定字段

### Step 2: 视觉识别
用 Agent 自身多模态能力看用户传的图片，输出 JSON（用户已指定的字段直接用用户值，其余自动识别）：

```json
{
  "name": "人物代号（英文大写，2-10字符，如 LIANA / KAI / SUBJECT-A）",
  "id": "品牌或风格标签（英文大写，如 STREETWEAR / VINTAGE / Y2K）",
  "project": "系列代号（如 25SS / FW26 / CAPSULE）",
  "top": "上衣英文描述（简短，如 OVERSIZED DENIM JACKET）",
  "bottom": "下装英文描述（简短，如 WIDE LEG CARGO PANTS）",
  "acc": "配饰英文描述（可选，如 SILVER CHAIN NECKLACE），没有就留空",
  "sideWords": "4个英文风格关键词，换行分隔（如 STREET\nVINTAGE\nOVERSIZED\nCOOL）",
  "hudColor": "HUD颜色，默认 #00ff00"
}
```

**识别规则**：
- 上衣/下装：描述款式+材质+颜色，英文大写，简短（2-5个词）
- 配饰：项链/帽子/包/手表等，没有就空字符串
- 风格关键词：从穿搭整体感觉提取4个词
- 人物代号：不要用真名，用风格化代号
- 如果看不清某个部位，合理推测即可
- 如果图片过大（>2MB），先用 `convert` 压缩到 1200px 宽再处理

### Step 3: 渲染
调用渲染脚本：

```bash
node /workspace/skills/lookbook-fx/render.js \
  --image "/path/to/user/image.jpg" \
  --name "LIANA" \
  --id "STREETWEAR" \
  --project "25SS" \
  --top "OVERSIZED DENIM JACKET" \
  --bottom "WIDE LEG CARGO PANTS" \
  --acc "SILVER CHAIN" \
  --sideWords "STREET\nVINTAGE\nOVERSIZED\nCOOL" \
  --hudColor "#00ff00" \
  --output "/workspace/public/lookbook-output.png"
```

### Step 4: 返回
用 `file_send` 将生成的效果图发送给用户。

## 安装与依赖

### 首次安装
解压包后运行 setup 脚本，自动检查并安装所有依赖：
```bash
bash /workspace/skills/lookbook-fx/setup.sh
```

### 环境要求
| 依赖 | 说明 | 宝子沙箱 |
|------|------|---------|
| Chromium (port 9222) | Headless 浏览器渲染 | ✅ 预装 |
| puppeteer-core | Node.js 浏览器控制 | setup 自动装 |
| 8080 静态服务 | 页面托管 | ✅ 预装 |
| face-api.js + 模型 | 人脸检测 | setup 自动下载 |
| ImageMagick | 大图压缩（可选） | ✅ 通常预装 |
| Agent 多模态能力 | 看图识别服装 | ✅ 需要 LLM 支持视觉 |

### 包内文件
```
skills/lookbook-fx/
  SKILL.md          — Skill 定义
  render.js         — 渲染脚本
  setup.sh          — 首次安装脚本
public/
  lookbook-fx.html  — 前端页面
  face-models/      — face-api.js + 人脸检测模型权重
```

## 注意事项
- 输出约 1400×1900 高清 PNG
- 人物大图保持原色，只有卡片内小头像是黑白的
- 图片过大时先压缩，避免渲染超时
- **最低要求**：宝子沙箱环境 + Agent 有多模态（视觉）能力
