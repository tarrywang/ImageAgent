import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// 健康检查
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// 主页（防止静态托管未命中时返回 404）
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const AZURE_ENDPOINT = process.env.AZURE_ENDPOINT;
const AZURE_API_KEY = process.env.AZURE_API_KEY;
const DEPLOYMENT_NAME = process.env.AZURE_DEPLOYMENT_NAME || "gpt-image-1";
const API_VERSION = process.env.AZURE_API_VERSION || "2025-04-01-preview";

app.post("/api/pixelate", upload.single("image"), async (req, res) => {
  if (!AZURE_ENDPOINT || !AZURE_API_KEY) {
    return res.status(500).json({ error: "服务配置错误，请联系管理员" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "请上传图片文件" });
  }

  const prompt = `Convert the provided image into a professional Mard-style (豆画) cute chibi perler bead pattern.

STYLE REQUIREMENTS:

- Create in the popular "Mard" / "豆画" bead art style
- Character should be adorable, simplified, chibi-style with large head and cute features
- Clean, flat colors with no gradients, shadows, or anti-aliasing
- Simplified color palette (8-15 distinct bead colors maximum)
- Professional bead pattern format suitable for crafting

GRID REQUIREMENTS (CRITICAL - must follow exactly):

- The artwork MUST be rendered on a true 52 × 52 pixel matrix (52 columns and 52 rows)
- Each cell = exactly 1 pixel = 1 physical fuse bead
- Do NOT use coarse grids like 20×20, 22×22, or 30×30
- The character must be drawn using individual 52×52 pixels, not large blocks
- Grid lines should be thin, light gray, and clearly visible at every pixel boundary

LAYOUT REQUIREMENTS:

- White or light gray background
- Coordinate labels on all four sides (top, bottom, left, right): 1-52
- Grid lines align to every single pixel boundary of the 52×52 matrix
- Keep edges crisp and clean (no blur, no anti-aliasing)

COLOR REQUIREMENTS:

- Use simplified, distinct colors that represent real perler bead colors
- Limit palette to 8-15 colors for easy crafting
- Each color should be clearly distinguishable from others
- Avoid subtle color variations - use bold, solid colors

CHARACTER DESIGN:

- Cute chibi proportions (large head, small body)
- Simple, friendly facial features
- Clean outlines and shapes
- Centered in the 52×52 grid
- Appropriate size to show detail while fitting the grid

IMPORTANT - VERIFICATION:

If the result is not exactly 52×52 distinct cells, it is WRONG.
Do not reduce grid resolution or merge pixels into larger blocks.
The final output must be a ready-to-use bead pattern reference sheet in Mard/豆画 style.`;

  try {
    // 使用 images/edits 端点，multipart/form-data 格式
    const url = `${AZURE_ENDPOINT}/openai/deployments/${DEPLOYMENT_NAME}/images/edits?api-version=${API_VERSION}`;
    console.log("Calling Azure API:", url);

    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append("image[]", blob, req.file.originalname || "upload.png");
    formData.append("prompt", prompt);
    formData.append("model", DEPLOYMENT_NAME);
    formData.append("size", "1024x1024");
    formData.append("n", "1");
    formData.append("quality", "high");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "api-key": AZURE_API_KEY,
      },
      body: formData,
    });

    const data = await response.json();
    console.log("Azure response:", JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error("Azure API error:", data);
      return res.status(502).json({ error: data.error?.message || "生成失败，请稍后重试" });
    }

    const result = data.data?.[0];

    if (!result) {
      return res.status(502).json({ error: "未能生成像素化图片，请稍后重试" });
    }

    // gpt-image-1 返回 b64_json
    if (result.b64_json) {
      return res.json({ image: `data:image/png;base64,${result.b64_json}` });
    }

    return res.status(502).json({ error: "未能生成像素化图片，请稍后重试" });
  } catch (error) {
    console.error("Azure OpenAI image generation failed:", error);
    res.status(500).json({ error: "生成失败，请稍后重试" });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
