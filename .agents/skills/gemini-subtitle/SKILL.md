---
name: gemini-subtitle
description: Use this skill when a user provides a YouTube URL, video URL, or video file and wants Traditional Chinese subtitles (SRT or VTT format). Prefer this skill for requests like "幫影片加中文字幕", "生成繁體中文字幕", "add Chinese subtitles", "幫我把這個 YouTube 影片加字幕", or any request to generate zh-TW subtitles for a video.
---

# 繁體中文字幕生成 Skill

為 YouTube 影片、遠端影片 URL 或本地影片檔產生繁體中文（zh-TW）字幕，輸出為標準 SRT 或 WebVTT 格式。

## 需求條件

- **GEMINI_API_KEY**：有效的 Google Gemini API 金鑰（設為環境變數）
- **Node.js** ≥ 20.0.0
- `scripts/subtitle.js` 為預先建置的零依賴 bundle，不需 `npm install`

## 支援的輸入類型

| 類型 | 輸入格式 |
|------|----------|
| YouTube 影片 | `https://www.youtube.com/watch?v=xxx` 或 `https://youtu.be/xxx` |
| 遠端影片 URL | `https://example.com/video.mp4` |
| 本地影片檔 | `./clips/demo.mp4`（支援 .mp4, .mkv, .webm, .mov, .avi 等） |

### 支援的影片格式
`.mp4`, `.mkv`, `.webm`, `.mov`, `.avi`, `.3gp`, `.m4v`, `.mpeg`, `.mpg`, `.ogv`

## 使用方式

直接執行預建好的腳本，不需要先安裝依賴：

> ⚠️ **路徑安全**：skill 腳本位於 **repo 根目錄**的 `.agents/skills/` 下。若 cwd 不在 repo root，請先執行 `git rev-parse --show-toplevel` 取得絕對路徑，再 `cd` 到該路徑後執行。**禁止**在指令中使用 `$(...)` 語法。

```sh
node .agents/skills/gemini-subtitle/scripts/subtitle.js <input>
```

### 範例

```sh
# YouTube 字幕
node .agents/skills/gemini-subtitle/scripts/subtitle.js "https://www.youtube.com/watch?v=abc123"

# YouTube 短網址
node .agents/skills/gemini-subtitle/scripts/subtitle.js "https://youtu.be/abc123"

# 遠端影片 URL
node .agents/skills/gemini-subtitle/scripts/subtitle.js "https://example.com/video.mp4"

# 本地影片檔
node .agents/skills/gemini-subtitle/scripts/subtitle.js "./clips/demo.mp4"

# 儲存為 SRT 檔案
node .agents/skills/gemini-subtitle/scripts/subtitle.js --output subtitles.srt "https://youtu.be/abc123"

# 輸出 WebVTT 格式
node .agents/skills/gemini-subtitle/scripts/subtitle.js --format vtt "https://youtu.be/abc123"

# 輸出 WebVTT 並儲存
node .agents/skills/gemini-subtitle/scripts/subtitle.js --format vtt --output subtitles.vtt "https://youtu.be/abc123"
```

### Dry Run

設定 `SUBTITLE_DRY_RUN=1` 可在不呼叫 Gemini API 的情況下，預覽輸入偵測結果：

```sh
SUBTITLE_DRY_RUN=1 node .agents/skills/gemini-subtitle/scripts/subtitle.js "https://youtu.be/abc123"
```

## 輸出格式

### SRT 格式（預設）

```
1
00:00:01,000 --> 00:00:04,500
歡迎來到今天的節目。

2
00:00:04,800 --> 00:00:08,200
今天我們將探討人工智慧的最新發展。
```

### WebVTT 格式（`--format vtt`）

```
WEBVTT

00:00:01.000 --> 00:00:04.500
歡迎來到今天的節目。

00:00:04.800 --> 00:00:08.200
今天我們將探討人工智慧的最新發展。
```

## Instructions for the Agent

⚠️ skill 腳本位於 **repo 根目錄**。若 cwd 不在 repo root，先獨立執行 `git rev-parse --show-toplevel` 取得路徑，再 `cd` 到該路徑後執行。禁止使用 `$(...)` 語法。

1. 確認使用者提供了 YouTube URL、影片 URL 或本地影片檔案路徑。
2. 確認環境中已設定 `GEMINI_API_KEY`。
3. 決定輸出格式（預設 SRT，若使用者要求 WebVTT 則加 `--format vtt`）。
4. 決定是否需要儲存到檔案（若使用者要求儲存，則加 `--output <filename>`）。
5. 執行指令：
   ```sh
   node .agents/skills/gemini-subtitle/scripts/subtitle.js "<input>"
   ```
6. 字幕內容以串流方式輸出到 stdout。進度與錯誤訊息輸出到 stderr。
7. 如果 exit code 為 1，表示發生錯誤，請檢查 stderr 的錯誤訊息，不要自行編造字幕。
8. 可先用 `SUBTITLE_DRY_RUN=1` 測試輸入偵測是否正確。
9. 若使用者要求儲存字幕檔案，務必加上 `--output <filename>` 參數。
10. 輸出字幕時，直接呈現 SRT/VTT 內容，不要加上任何額外說明文字。

## 限制

- 遠端 URL 有 30 秒逾時限制
- 本地檔案會轉為 Base64 data URI，過大的檔案可能超出記憶體限制
- 字幕時間精確度取決於 Gemini 模型的影片理解能力
- 不支援僅有背景音樂而無語音的影片

## 錯誤處理

| 錯誤訊息 | 說明 |
|---------|------|
| `缺少 GEMINI_API_KEY` | 未設定 API 金鑰環境變數 |
| `無法辨識輸入類型` | 輸入不是支援的 URL 或影片格式 |
| `找不到影片檔案` | 本地檔案路徑不存在 |
| `抓取逾時（30 秒）` | 遠端資源下載超過 30 秒 |

## 重建方式

`scripts/subtitle.js` 是已提交的預建可執行產物；`src/subtitle.js` 是可維護的原始碼。重建方式：

```sh
cd .agents/skills/gemini-subtitle
bun install
bun run build
```
