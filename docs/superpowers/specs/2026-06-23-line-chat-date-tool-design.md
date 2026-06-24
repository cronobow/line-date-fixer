# LINE Chat 日期補齊工具 Design

## 目標

建立一個可部署到 GitHub Pages 的純前端單頁工具，讓使用者將 LINE 匯出的聊天文字檔拖曳或選入瀏覽器後，自動補齊每則時間訊息前方缺失的日期，並下載新的處理後文字檔。

## 範圍

- 純前端實作，只使用 HTML5、CSS3、JavaScript ES6+ 與瀏覽器內建 API。
- 不使用後端、資料庫、遠端 API、AJAX、build step。
- 正式交付為可直接部署到 GitHub Pages 的工具頁。
- 不另外建立測試頁、管理頁或示範頁。

## 非目標

- 不修改使用者本機檔案的檔案系統日期。
- 不支援所有可能的 LINE 匯出地區格式。
- 不處理非文字檔或超過 20 MB 的檔案。
- 不追求行動裝置完整最佳化。

## 使用流程

1. 使用者開啟工具頁。
2. 使用者拖曳 `.txt` 檔案到拖曳區，或點擊選取檔案。
3. 前端先檢查是否有檔案、檔案大小是否超過 20 MB。
4. 使用 `FileReader.readAsText()` 以 UTF-8 讀取內容。
5. 逐行解析日期行與時間行，產生新的文字內容與摘要。
6. 畫面更新狀態訊息、摘要與前 80 行預覽。
7. 使用者按下載按鈕，下載 `_processed.txt` 檔案。

## UI 結構

單頁工具使用垂直卡片式版面，包含以下區塊：

- Header：標題與簡短說明，清楚告知檔案只在瀏覽器端處理。
- Upload Panel：拖曳區與隱藏檔案 input。
- Status Panel：顯示初始、處理中、成功、警告、錯誤狀態。
- Summary Panel：顯示檔名、原始大小、日期行數、成功補值數、跳過數。
- Actions Panel：下載按鈕，只在成功處理後可見與可按。
- Preview Panel：使用 `pre` 顯示前 80 行處理結果。

## 視覺方向

- 採用簡潔但有辨識度的正式工具風格。
- 使用暖白背景搭配深藍灰文字與青綠色強調。
- 拖曳區需有清楚的 hover 與 drag-over 狀態。
- 狀態訊息以不同色塊區分 `info`、`success`、`warning`、`error`。

## 架構

### 檔案規劃

- `index.html`
  - 頁面骨架與 UI 區塊。
  - 掛載所有互動所需的 DOM 節點。
- `style.css`
  - 頁面版面、拖曳區、按鈕、狀態、摘要、預覽樣式。
- `app.js`
  - 檔案輸入、拖曳事件、聊天文字處理、摘要與下載流程。
- `tests/process-chat-text.test.mjs`
  - 以 Node 內建 `assert` 驗證核心純函式邏輯，供本機驗證使用。

### 模組責任

`app.js` 內維持單檔，但以責任分區：

- DOM initialization：查找節點、綁定事件、維護畫面狀態。
- File handling：檔案檢查、讀取、下載 URL 建立與釋放。
- Parsing helpers：日期解析、時間解析、上午下午轉換、檔名產生。
- Processing core：以單次掃描逐行處理聊天文字並產生摘要、預覽與輸出行陣列，避免先把整份文字 `split` 成大型陣列。
- Rendering helpers：狀態、摘要、預覽、下載按鈕更新。

## 資料流

1. `handleFile(file)` 驗證檔案。
2. `readFileAsText(file)` 讀取內容。
3. `processChatText(text)` 回傳：
   - `outputText`
   - `summary`
4. `renderSummary(...)`、`renderPreview(...)`、`setDownload(...)` 更新畫面。
5. 若 `summary.dateLineCount === 0`，仍可下載，但狀態顯示 warning。

## 解析規則

### 日期行

支援：

- `YYYY/MM/DD（日）`
- `YYYY.MM.DD 星期一`

兩者皆轉成內部格式 `YYYY-MM-DD`，但原日期行保留原樣輸出。

### 時間行

支援：

- `上午10:30 ...`
- `下午3:05 ...`
- `07:57 ...`
- `13:18 ...`

輸出統一為 `YYYY-MM-DD HH:MM ...`。

### 邊界條件

- 第一個日期行前的時間訊息保留原樣，並累計 `skippedTimeLineBeforeDateCount`。
- 多行訊息續行不補日期。
- 空白行保留。
- 未匹配日期或時間格式的行保留原樣。

## 錯誤與警告處理

- 無檔案：顯示 `請先選擇或拖曳一個 LINE 對話文字檔。`
- 超過 20 MB：顯示 `檔案超過 20 MB，請先分割檔案後再處理。`
- 讀取失敗：顯示 `檔案讀取失敗，請確認檔案是否為文字檔。`
- 無日期行：顯示 warning `沒有辨識到日期行，因此未補上任何日期。請確認檔案格式是否正確。`

## 驗證策略

### 自動驗證

用 `tests/process-chat-text.test.mjs` 驗證以下案例：

- 點號日期 + 24 小時制
- 斜線日期 + 上午下午
- 第一個日期前時間行不補值
- 多行訊息保留
- 上午 12 點轉 `00`
- 下午 12 點維持 `12`
- 下載檔名 `_processed` 規則

### 手動驗證

- 用本機靜態伺服器開啟頁面。
- 實際載入 workspace 內既有 LINE 匯出檔。
- 確認摘要、預覽、下載按鈕與下載結果正常。
- 用 `17.6 MB` 的 `[LINE] 模擬群組聊天的聊天.txt` 驗證可處理路徑。

## 部署

- 交付檔案可直接放在 GitHub repo root。
- GitHub Pages 從 `main` branch root 部署即可。
- 不需要任何 build 或 predeploy 指令。
