# 🎬 Gemini Subtitle Skill — 執行結果報告

## ✅ 完成狀態

**gemini-subtitle** skill 已成功建立，可為 YouTube 影片、遠端影片 URL 或本地影片檔產生繁體中文（zh-TW）字幕。

---

## 📦 交付物清單

| 檔案 | 說明 |
|------|------|
| `.agents/skills/gemini-subtitle/src/subtitle.js` | 核心原始碼（可維護） |
| `.agents/skills/gemini-subtitle/scripts/subtitle.js` | 預建零依賴 bundle（直接執行） |
| `.agents/skills/gemini-subtitle/package.json` | 套件設定 |
| `.agents/skills/gemini-subtitle/githubclaw.json` | Skill 元數據 |
| `.agents/skills/gemini-subtitle/SKILL.md` | 技術文件與使用說明 |
| `.agents/skills/gemini-subtitle/README.md` | 使用者說明文件 |

---

## 🛠 功能說明

### 支援輸入類型
- YouTube URL（`https://www.youtube.com/watch?v=xxx` 或 `https://youtu.be/xxx`）
- 遠端影片 URL（`.mp4`, `.mkv`, `.webm`, `.mov`, `.avi` 等）
- 本地影片檔案

### 輸出格式
- **SRT**（預設）：標準字幕格式，相容大多數播放器
- **WebVTT**（`--format vtt`）：現代瀏覽器字幕格式

### 使用範例

```sh
# 為 YouTube 影片生成繁體中文字幕
node .agents/skills/gemini-subtitle/scripts/subtitle.js "https://www.youtube.com/watch?v=PQU9o_5rHC4"

# 儲存為 SRT 檔
node .agents/skills/gemini-subtitle/scripts/subtitle.js --output subtitles.srt "https://youtu.be/abc123"

# 輸出 WebVTT 格式
node .agents/skills/gemini-subtitle/scripts/subtitle.js --format vtt "https://youtu.be/abc123"
```

---

## 🧪 驗證結果

### Dry Run 測試（YouTube URL）
```
偵測到輸入類型：youtube
輸出格式：SRT
{
  "detectedType": "youtube",
  "source": "remote-url",
  "uri": "https://www.youtube.com/watch?v=PQU9o_5rHC4",
  "format": "srt",
  "outputFile": null
}
```

### Dry Run 測試（WebVTT + 儲存到檔案）
```
偵測到輸入類型：youtube
輸出格式：VTT
{
  "detectedType": "youtube",
  "source": "remote-url",
  "uri": "https://youtu.be/abc123",
  "format": "vtt",
  "outputFile": "test.vtt"
}
```

---

## ⚙️ 需求

- `GEMINI_API_KEY` 環境變數（Google Gemini API 金鑰）
- Node.js ≥ 20.0.0
