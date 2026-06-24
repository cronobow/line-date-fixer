# LINE Chat 日期補齊工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一個可部署到 GitHub Pages 的純前端工具頁，讓使用者在瀏覽器內補齊 LINE 聊天文字檔的日期並下載新檔案。

**Architecture:** 採用單頁靜態應用，`index.html` 提供 UI 骨架，`style.css` 提供樣式，`app.js` 實作拖放、檔案讀取、逐行解析、摘要與下載邏輯。核心文字處理會抽成可重用的純函式，供本機 Node 驗證腳本直接 import。

**Tech Stack:** HTML5, CSS3, JavaScript ES modules, Browser File API, Node.js built-in `assert` for local verification only

## Global Constraints

- 使用 HTML5、CSS3、JavaScript ES6+。
- 專案可直接部署到 GitHub Pages。
- 不使用 Node.js build step。
- 不使用後端服務。
- 不使用資料庫。
- 不使用 AJAX 或任何遠端 API。
- 檔案內容只在使用者瀏覽器中處理。
- 支援 Chrome、Edge、Safari。
- 檔案大小上限為 `10 * 1024 * 1024` bytes。
- 只交付正式工具頁，不另外建立測試頁。

---

### Task 1: 建立靜態頁骨架與樣式

**Files:**
- Create: `index.html`
- Create: `style.css`

**Interfaces:**
- Consumes: none
- Produces: DOM ids `drop-zone`, `file-input`, `status-message`, `summary-panel`, `summary-list`, `download-button`, `preview-panel`, `preview-content`

- [ ] **Step 1: 建立頁面骨架**

```html
<main class="app-shell">
  <section class="hero">...</section>
  <section class="tool-card">
    <button id="drop-zone" type="button">...</button>
    <input id="file-input" type="file" accept=".txt,text/plain" hidden>
    <p id="status-message">尚未選擇檔案</p>
    <section id="summary-panel" hidden>...</section>
    <div class="actions">
      <a id="download-button" hidden>下載處理後檔案</a>
    </div>
    <section id="preview-panel" hidden>
      <pre id="preview-content"></pre>
    </section>
  </section>
</main>
```

- [ ] **Step 2: 建立樣式**

```css
:root {
  --bg: #f6f1e8;
  --panel: #fffdf8;
  --ink: #1f2a37;
  --accent: #0f766e;
}

.drop-zone.drag-over { ... }
.status[data-type="error"] { ... }
.summary-grid { ... }
```

- [ ] **Step 3: 手動檢查頁面可開啟**

Run: `python3 -m http.server 4173`
Expected: 啟動靜態伺服器，稍後可用瀏覽器開啟 `http://127.0.0.1:4173`

### Task 2: 實作核心聊天文字解析函式

**Files:**
- Create: `app.js`
- Test: `tests/process-chat-text.test.mjs`

**Interfaces:**
- Consumes: none
- Produces:
  - `parseDateLine(line: string): string | null`
  - `parseTimeLine(line: string): { time: string, rest: string } | null`
  - `convertAmPmTo24Hour(period: string, hour: string, minute: string): string`
  - `buildDownloadFileName(originalName: string): string`
  - `processChatText(text: string): { outputText: string, summary: { totalLines: number, dateLineCount: number, updatedMessageLineCount: number, skippedTimeLineBeforeDateCount: number } }`

- [ ] **Step 1: 先寫 failing tests**

```js
import assert from "node:assert/strict";
import {
  buildDownloadFileName,
  processChatText
} from "../app.js";

assert.equal(
  processChatText("2025.09.22 星期一\n07:57 陳小明 陳小明已加入群組。").outputText,
  "2025.09.22 星期一\n2025-09-22 07:57 陳小明 陳小明已加入群組。"
);
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node tests/process-chat-text.test.mjs`
Expected: FAIL，因為 `app.js` 尚未提供對應 export

- [ ] **Step 3: 寫最小可用實作**

```js
export function parseDateLine(line) { ... }
export function parseTimeLine(line) { ... }
export function convertAmPmTo24Hour(period, hour, minute) { ... }
export function buildDownloadFileName(originalName) { ... }
export function processChatText(text) { ... }
```

- [ ] **Step 4: 重新跑測試確認通過**

Run: `node tests/process-chat-text.test.mjs`
Expected: PASS，輸出 `All assertions passed.`

### Task 3: 串接瀏覽器檔案處理與畫面更新

**Files:**
- Modify: `app.js`
- Modify: `index.html`

**Interfaces:**
- Consumes:
  - `processChatText(text: string)`
  - `buildDownloadFileName(originalName: string)`
- Produces:
  - `handleFile(file: File): Promise<void>`
  - `updateStatus(message: string, type?: string): void`
  - `renderSummary(summaryData: object): void`
  - `renderPreview(text: string): void`
  - `setDownload(text: string, originalName: string): void`

- [ ] **Step 1: 寫出檔案讀取與 UI 更新流程**

```js
async function handleFile(file) {
  if (!file) {
    updateStatus("請先選擇或拖曳一個 LINE 對話文字檔。", "error");
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    updateStatus("檔案超過 10 MB，請先分割檔案後再處理。", "error");
    return;
  }
  const text = await readFileAsText(file);
  const result = processChatText(text);
  renderSummary(...);
  renderPreview(result.outputText);
  setDownload(result.outputText, file.name);
}
```

- [ ] **Step 2: 綁定拖曳與選檔事件**

```js
dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("dragover", onDragOver);
dropZone.addEventListener("drop", onDrop);
fileInput.addEventListener("change", onFileChange);
```

- [ ] **Step 3: 手動測試正常檔案流程**

Run: `python3 -m http.server 4173`
Expected: 可在瀏覽器載入頁面、選取文字檔後看到摘要、預覽與下載按鈕

### Task 4: 補齊錯誤狀態與最終驗證

**Files:**
- Modify: `app.js`
- Modify: `style.css`

**Interfaces:**
- Consumes:
  - `handleFile(file: File)`
  - `updateStatus(message: string, type?: string)`
- Produces: 完整的成功、警告、錯誤與 drag-over UI 行為

- [ ] **Step 1: 補齊 warning/error 狀態**

```js
if (result.summary.dateLineCount === 0) {
  updateStatus("沒有辨識到日期行，因此未補上任何日期。請確認檔案格式是否正確。", "warning");
} else {
  updateStatus("處理完成，可以下載檔案。", "success");
}
```

- [ ] **Step 2: 補齊對應樣式**

```css
.status[data-type="warning"] { ... }
.status[data-type="success"] { ... }
.drop-zone.drag-over { ... }
```

- [ ] **Step 3: 執行完整驗證**

Run: `node tests/process-chat-text.test.mjs`
Expected: PASS，涵蓋規格中的核心文字處理案例

Run: `python3 -m http.server 4173`
Expected: 可在瀏覽器手動驗證正常檔案與超過 10 MB 檔案兩條路徑
