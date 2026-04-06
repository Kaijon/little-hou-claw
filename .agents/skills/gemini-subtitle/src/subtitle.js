#!/usr/bin/env node
/**
 * Chinese Subtitle Generator
 *
 * Takes a YouTube URL, video URL, or local video file and generates
 * Traditional Chinese (zh-TW) subtitles in SRT format using Gemini.
 *
 * Usage:
 * node scripts/subtitle.js <url-or-file>
 * node scripts/subtitle.js --output <file.srt> <url-or-file>
 * node scripts/subtitle.js --format vtt <url-or-file>
 */

import { GoogleGenAI } from "@google/genai";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = "gemini-3-flash-preview";
const FETCH_TIMEOUT_MS = 30_000;

const VIDEO_EXTENSIONS = new Set([
  ".3gp", ".avi", ".m4v", ".mkv", ".mov",
  ".mp4", ".mpeg", ".mpg", ".ogv", ".webm",
]);

const VIDEO_MIME_TYPES = {
  ".3gp": "video/3gpp",
  ".avi": "video/x-msvideo",
  ".m4v": "video/x-m4v",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".mpeg": "video/mpeg",
  ".mpg": "video/mpeg",
  ".ogv": "video/ogg",
  ".webm": "video/webm",
};

const YOUTUBE_HOSTS = new Set([
  "youtube.com", "www.youtube.com", "m.youtube.com",
  "youtu.be", "www.youtu.be",
]);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DRY_RUN_LOCAL_FILE_PLACEHOLDER = "(local-file base64)";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function printUsage() {
  console.error("用法：node scripts/subtitle.js [--output <file.srt>] [--format srt|vtt] <input>");
  console.error("");
  console.error("範例：");
  console.error('  node scripts/subtitle.js "https://www.youtube.com/watch?v=abc123"');
  console.error('  node scripts/subtitle.js "./clips/demo.mp4"');
  console.error('  node scripts/subtitle.js --output subtitles.srt "https://youtu.be/abc123"');
  console.error('  node scripts/subtitle.js --format vtt "https://youtu.be/abc123"');
}

function ensureApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "缺少 GEMINI_API_KEY。請先執行 export GEMINI_API_KEY=your_api_key"
    );
  }
  return apiKey;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`抓取逾時（${FETCH_TIMEOUT_MS / 1000} 秒）：${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function isRemoteUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isYouTubeUrl(value) {
  try {
    return YOUTUBE_HOSTS.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

function getVideoMimeType(filePath) {
  return VIDEO_MIME_TYPES[path.extname(filePath).toLowerCase()] || "video/mp4";
}

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

function parseCliArgs() {
  const args = process.argv.slice(2);
  let outputFile = null;
  let format = "srt";
  let input = null;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--output" || args[i] === "-o") && i + 1 < args.length) {
      outputFile = args[++i];
    } else if (args[i] === "--format" && i + 1 < args.length) {
      format = args[++i];
      if (!["srt", "vtt"].includes(format)) {
        throw new Error(`不支援的格式：${format}（可用：srt, vtt）`);
      }
    } else if (!input) {
      input = args[i];
    }
  }

  return { input, outputFile, format };
}

// ---------------------------------------------------------------------------
// Input Detection
// ---------------------------------------------------------------------------

function detectInputType(input) {
  if (!input) throw new Error("請提供輸入（YouTube URL 或影片檔案路徑）。");

  if (input.startsWith("data:")) return "data-uri";

  if (isRemoteUrl(input)) {
    if (isYouTubeUrl(input)) return "youtube";
    const ext = path.extname(new URL(input).pathname).toLowerCase();
    if (VIDEO_EXTENSIONS.has(ext)) return "remote-video";
    // Fallback: treat any remote URL as a potential video stream.
    // Gemini will reject the request at API level if it cannot process the URL.
    return "remote-video";
  }

  let localPath = input;
  if (input.startsWith("file://")) localPath = fileURLToPath(input);
  const ext = path.extname(localPath).toLowerCase();
  if (VIDEO_EXTENSIONS.has(ext)) return "local-file";

  throw new Error(
    `無法辨識輸入類型：${input}。支援的格式：YouTube URL、影片 URL、影片檔案（${[...VIDEO_EXTENSIONS].join(", ")}）`
  );
}

// ---------------------------------------------------------------------------
// Subtitle Prompt
// ---------------------------------------------------------------------------

function buildSubtitlePrompt(format) {
  const formatName = format === "vtt" ? "WebVTT" : "SRT";
  const headerExample = format === "vtt"
    ? "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\n字幕文字"
    : "1\n00:00:01,000 --> 00:00:04,000\n字幕文字";
  const timeFormat = format === "vtt"
    ? "HH:MM:SS.mmm --> HH:MM:SS.mmm（使用句點分隔毫秒，例如 00:00:01.000 --> 00:00:04.000）"
    : "HH:MM:SS,mmm --> HH:MM:SS,mmm（使用逗號分隔毫秒，例如 00:00:01,000 --> 00:00:04,000）";

  return `你是一位專業的影片字幕製作員，擅長為影片產生精準的繁體中文（zh-TW）字幕。

任務目標：
1. 仔細聆聽影片的每一段對話與旁白，並轉錄為準確的繁體中文字幕。
2. 如果影片語言不是中文，請翻譯成自然流暢的繁體中文（zh-TW）。
3. 如果影片語言是中文（普通話或廣東話），請直接轉錄並轉換為繁體中文。
4. 字幕要符合閱讀節奏：每段字幕不超過 2 行，每行不超過 25 個中文字。
5. 時間戳記必須與影片實際語音精準對齊，不可憑空估算。
6. 保留影片中出現的人名、品牌名、專有名詞（可附加原文在括號內）。

格式規範（嚴格遵守）：
- 輸出格式必須是完整且合法的 ${formatName} 格式，不可包含任何額外說明文字。
- 不要在輸出前後加上任何說明、標題或解釋。
- 只輸出純粹的 ${formatName} 字幕內容。
${format === "vtt" ? "- 第一行必須是「WEBVTT」，後接空行再開始字幕。" : "- 每條字幕以序號開始（1, 2, 3, ...）。"}
- 時間格式：${timeFormat}
- 每段字幕之間以空行分隔。

範例輸出：
${headerExample}

完整輸出 ${formatName} 字幕：`;
}

// ---------------------------------------------------------------------------
// Video Input Resolver
// ---------------------------------------------------------------------------

async function resolveVideoInput(input, inputType) {
  if (inputType === "data-uri") {
    return {
      source: "data-uri",
      uri: input,
      mimeType: input.match(/^data:([^;]+);base64,/)?.[1] || "video/mp4",
    };
  }

  if (inputType === "youtube" || inputType === "remote-video") {
    return {
      source: "remote-url",
      uri: input,
      mimeType: "video/mp4",
    };
  }

  if (inputType === "local-file") {
    let localPath = input;
    if (input.startsWith("file://")) localPath = fileURLToPath(input);
    const resolvedPath = path.resolve(localPath);

    try {
      const fileBuffer = await readFile(resolvedPath);
      const mimeType = getVideoMimeType(resolvedPath);
      return {
        source: "local-file",
        uri: `data:${mimeType};base64,${fileBuffer.toString("base64")}`,
        mimeType,
        localPath: resolvedPath,
      };
    } catch (error) {
      if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
        throw new Error(`找不到影片檔案：${resolvedPath}`);
      }
      throw new Error(`無法讀取影片檔案 "${resolvedPath}"：${error.message}`);
    }
  }

  throw new Error(`不支援的輸入類型：${inputType}`);
}

// ---------------------------------------------------------------------------
// Streaming Output
// ---------------------------------------------------------------------------

async function streamSubtitle(stream, outputFile) {
  let fullContent = "";

  for await (const chunk of stream) {
    if (
      chunk.event_type === "content.delta" &&
      chunk.delta?.type === "text" &&
      chunk.delta.text
    ) {
      process.stdout.write(chunk.delta.text);
      if (outputFile) {
        fullContent += chunk.delta.text;
      }
    }
  }
  process.stdout.write("\n");

  if (outputFile) {
    await writeFile(outputFile, fullContent, "utf8");
    console.error(`\n✅ 字幕已儲存至：${outputFile}`);
  }
}

// ---------------------------------------------------------------------------
// Main Entry
// ---------------------------------------------------------------------------

async function main() {
  const { input, outputFile, format } = parseCliArgs();

  if (!input) {
    printUsage();
    process.exit(1);
  }

  const inputType = detectInputType(input);
  console.error(`偵測到輸入類型：${inputType}`);
  console.error(`輸出格式：${format.toUpperCase()}`);

  const isDryRun = process.env.SUBTITLE_DRY_RUN === "1";

  if (isDryRun) {
    const videoInput = await resolveVideoInput(input, inputType).catch(() => ({
      source: inputType,
      uri: inputType === "local-file" ? "(local file)" : input,
    }));
    process.stdout.write(
      `${JSON.stringify(
        {
          detectedType: inputType,
          source: videoInput.source,
          uri: videoInput.source === "local-file" ? DRY_RUN_LOCAL_FILE_PLACEHOLDER : videoInput.uri,
          format,
          outputFile: outputFile || null,
        },
        null,
        2
      )}\n`
    );
    return;
  }

  const apiKey = ensureApiKey();
  const client = new GoogleGenAI({ apiKey });

  console.error("正在解析影片來源...");
  const videoInput = await resolveVideoInput(input, inputType);

  console.error("正在請 Gemini 產生繁體中文字幕...");
  const stream = await client.interactions.create({
    model: MODEL,
    input: [
      { type: "text", text: buildSubtitlePrompt(format) },
      { type: "video", uri: videoInput.uri, mime_type: videoInput.mimeType },
    ],
    generation_config: { max_output_tokens: 65536 },
    stream: true,
  });

  await streamSubtitle(stream, outputFile);
}

main().catch((error) => {
  console.error(`錯誤：${error.message || error}`);
  process.exit(1);
});
