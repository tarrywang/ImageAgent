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

  const prompt =
    "Make the image into a chibi sticker set. And convert it into a pixel art style, making sure each grid is clearly visible so I can use it for bead sprites. Try to use as few grids as possible while fully preserving the original design.";

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
