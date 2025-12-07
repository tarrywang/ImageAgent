# 像素化萌系贴纸生成器

## 项目背景
- 为用户提供一个简单的网页入口，上传任意图片后自动生成 chibi 贴纸风格的像素化版本，便于制作串珠/像素手工。
- 后端基于 Node + Express，调用 OpenAI GPT 5.1（图像模型 gpt-image-1）完成像素化生成。
- 前端为单页表单，提供原图与生成结果的并排预览。

## 项目功能
- 图片上传：支持 png/jpg/webp，大小上限 10MB。
- AI 生成：使用固定提示词：
  - “Make the image into a chibi sticker set. And convert it into a pixel art style, making sure each grid is clearly visible so I can use it for bead sprites. Try to use as few grids as possible while fully preserving the original design.”
- 结果展示：返回生成的 PNG（Base64 Data URL），页面即时预览。

## 项目启动方式
1) 环境准备：Node.js 18+。
2) 安装依赖：`npm install`
3) 配置环境变量：复制 `.env.example` 为 `.env`，填入 `OPENAI_API_KEY=你的key`（请勿提交 `.env`）。
4) 启动服务：`npm run dev`（或 `npm start`），默认端口 `3000`。
5) 访问页面：在浏览器打开 `http://localhost:3000`，上传图片并生成像素化贴纸。
