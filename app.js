export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const PREVIEW_LINE_LIMIT = 80;

let currentDownloadUrl = null;

export function parseDateLine(line) {
  const slashMatch = line.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
  if (slashMatch) {
    const [, year, month, day] = slashMatch;
    return `${year}-${month}-${day}`;
  }

  const dottedMatch = line.match(/^(\d{4})\.(\d{2})\.(\d{2})\s+星期./);
  if (dottedMatch) {
    const [, year, month, day] = dottedMatch;
    return `${year}-${month}-${day}`;
  }

  return null;
}

export function convertAmPmTo24Hour(period, hour, minute) {
  const numericHour = Number.parseInt(hour, 10);

  if (period === "上午") {
    const adjustedHour = numericHour === 12 ? 0 : numericHour;
    return `${String(adjustedHour).padStart(2, "0")}:${minute}`;
  }

  const adjustedHour = numericHour === 12 ? 12 : numericHour + 12;
  return `${String(adjustedHour).padStart(2, "0")}:${minute}`;
}

export function parseTimeLine(line) {
  const amPmMatch = line.match(/^(上午|下午)(\d{1,2}):(\d{2})\s+(.+)$/);
  if (amPmMatch) {
    const [, period, hour, minute, rest] = amPmMatch;
    return {
      time: convertAmPmTo24Hour(period, hour, minute),
      rest
    };
  }

  const twentyFourMatch = line.match(/^(\d{2}:\d{2})\s+(.+)$/);
  if (twentyFourMatch) {
    const [, time, rest] = twentyFourMatch;
    return { time, rest };
  }

  return null;
}

export const SYSTEM_KEYWORDS = new Set(["通話時間", "未接來電", "無人接聽"]);

export function extractSender(rest) {
  if (!rest) {
    return null;
  }

  const tabIndex = rest.indexOf("\t");
  if (tabIndex !== -1) {
    const sender = rest.substring(0, tabIndex).trim();
    return SYSTEM_KEYWORDS.has(sender) ? null : sender;
  }

  const spaceMatch = rest.match(/\s/);
  if (spaceMatch) {
    const sender = rest.substring(0, spaceMatch.index).trim();
    return SYSTEM_KEYWORDS.has(sender) ? null : sender;
  }

  return null;
}

export function buildDownloadFileName(originalName) {
  if (!originalName) {
    return "line-date-fixer_processed.txt";
  }

  const extensionMatch = originalName.match(/^(.*?)(\.[^.]+)$/);
  if (!extensionMatch) {
    return `${originalName}_processed.txt`;
  }

  const [, baseName, extension] = extensionMatch;
  return `${baseName}_processed${extension}`;
}

function normalizeLine(rawLine) {
  return rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
}

function processLine(line, currentDate, summary) {
  const parsedDate = parseDateLine(line);
  if (parsedDate) {
    summary.dateLineCount += 1;
    return {
      nextDate: parsedDate,
      outputLine: line
    };
  }

  const parsedTime = parseTimeLine(line);
  if (parsedTime) {
    const sender = extractSender(parsedTime.rest);
    if (sender) {
      summary.senders.add(sender);
    }

    if (currentDate) {
      summary.updatedMessageLineCount += 1;
      return {
        nextDate: currentDate,
        outputLine: `${currentDate} ${parsedTime.time} ${parsedTime.rest}`
      };
    }

    summary.skippedTimeLineBeforeDateCount += 1;
  }

  return {
    nextDate: currentDate,
    outputLine: line
  };
}

export function processChatText(text, options = {}) {
  const { includeOutputText = true } = options;
  const outputLines = [];
  const previewLines = [];
  let currentDate = null;

  const summary = {
    totalLines: 0,
    dateLineCount: 0,
    updatedMessageLineCount: 0,
    skippedTimeLineBeforeDateCount: 0,
    senders: new Set()
  };

  let cursor = 0;

  while (cursor <= text.length) {
    const lineBreakIndex = text.indexOf("\n", cursor);
    const nextCursor = lineBreakIndex === -1 ? text.length + 1 : lineBreakIndex + 1;
    const rawLine = lineBreakIndex === -1 ? text.slice(cursor) : text.slice(cursor, lineBreakIndex);
    const line = normalizeLine(rawLine);
    const { nextDate, outputLine } = processLine(line, currentDate, summary);

    currentDate = nextDate;
    summary.totalLines += 1;
    outputLines.push(outputLine);

    if (previewLines.length < PREVIEW_LINE_LIMIT) {
      previewLines.push(outputLine);
    }

    cursor = nextCursor;
  }

  return {
    outputLines,
    outputText: includeOutputText ? outputLines.join("\n") : null,
    previewText: previewLines.join("\n"),
    summary
  };
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("read_failed"));

    reader.readAsText(file, "utf-8");
  });
}

function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function createBlobPartsFromLines(lines) {
  const parts = [];

  lines.forEach((line, index) => {
    if (index > 0) {
      parts.push("\n");
    }
    parts.push(line);
  });

  return parts;
}

function createDownloadUrl(content) {
  const blobParts = Array.isArray(content) ? createBlobPartsFromLines(content) : [content];
  const blob = new Blob(blobParts, { type: "text/plain;charset=utf-8" });
  return URL.createObjectURL(blob);
}

function createSummaryItems(file, summary) {
  const sendersArray = Array.from(summary.senders || []);
  const senderCount = sendersArray.length;
  let sendersHtml = "0 人";

  if (senderCount > 0) {
    sendersHtml = `
      <details class="senders-details">
        <summary>${senderCount} 人 (點擊查看名單)</summary>
        <div class="senders-list">${sendersArray.join(", ")}</div>
      </details>
    `;
  }

  return [
    ["檔案名稱", file.name || "未命名檔案"],
    ["原始檔案大小", formatFileSize(file.size)],
    ["偵測到發言人數", sendersHtml],
    ["辨識到日期行", `${summary.dateLineCount} 行`],
    ["補上日期的訊息行數", `${summary.updatedMessageLineCount} 行`],
    ["第一個日期前無法補值的時間行數", `${summary.skippedTimeLineBeforeDateCount} 行`]
  ];
}

function renderSummary(summaryList, file, summary) {
  const items = createSummaryItems(file, summary);
  summaryList.innerHTML = items
    .map(
      ([label, value]) => `
        <div>
          <dt>${label}</dt>
          <dd>${value}</dd>
        </div>
      `
    )
    .join("");
}

function renderPreview(previewContent, previewText) {
  previewContent.textContent = previewText;
}

function updateStatus(statusMessage, message, type = "info") {
  statusMessage.textContent = message;
  statusMessage.dataset.type = type;
}

function clearDownload(downloadButton) {
  downloadButton.hidden = true;
  downloadButton.removeAttribute("href");
  downloadButton.removeAttribute("download");

  if (currentDownloadUrl) {
    URL.revokeObjectURL(currentDownloadUrl);
    currentDownloadUrl = null;
  }
}

function setDownload(downloadButton, content, originalName) {
  clearDownload(downloadButton);
  currentDownloadUrl = createDownloadUrl(content);
  downloadButton.href = currentDownloadUrl;
  downloadButton.download = buildDownloadFileName(originalName);
  downloadButton.hidden = false;
}

async function handleFile(file, elements) {
  const {
    statusMessage,
    summaryPanel,
    summaryList,
    previewPanel,
    previewContent,
    downloadButton
  } = elements;

  clearDownload(downloadButton);
  summaryPanel.hidden = true;
  previewPanel.hidden = true;

  if (!file) {
    updateStatus(statusMessage, "請先選擇或拖曳一個 LINE 對話文字檔。", "error");
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    updateStatus(statusMessage, "檔案超過 20 MB，請先分割檔案後再處理。", "error");
    return;
  }

  updateStatus(statusMessage, "正在處理檔案...", "info");

  try {
    const text = await readFileAsText(file);
    const result = processChatText(text, { includeOutputText: false });

    renderSummary(summaryList, file, result.summary);
    renderPreview(previewContent, result.previewText);
    setDownload(downloadButton, result.outputLines, file.name);

    summaryPanel.hidden = false;
    previewPanel.hidden = false;

    if (result.summary.dateLineCount === 0) {
      updateStatus(
        statusMessage,
        "沒有辨識到日期行，因此未補上任何日期。請確認檔案格式是否正確。",
        "warning"
      );
    } else {
      updateStatus(statusMessage, "處理完成，可以下載檔案。", "success");
    }
  } catch {
    updateStatus(statusMessage, "檔案讀取失敗，請確認檔案是否為文字檔。", "error");
  }
}

function setupBrowserApp() {
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const statusMessage = document.getElementById("status-message");
  const summaryPanel = document.getElementById("summary-panel");
  const summaryList = document.getElementById("summary-list");
  const previewPanel = document.getElementById("preview-panel");
  const previewContent = document.getElementById("preview-content");
  const downloadButton = document.getElementById("download-button");

  if (!dropZone || !fileInput || !statusMessage || !summaryPanel || !summaryList || !previewPanel || !previewContent || !downloadButton) {
    return;
  }

  const elements = {
    statusMessage,
    summaryPanel,
    summaryList,
    previewPanel,
    previewContent,
    downloadButton
  };

  dropZone.addEventListener("click", () => {
    fileInput.click();
  });

  dropZone.addEventListener("dragenter", (event) => {
    event.preventDefault();
    dropZone.classList.add("drag-over");
  });

  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("drag-over");
  });

  dropZone.addEventListener("dragleave", (event) => {
    if (event.target === dropZone) {
      dropZone.classList.remove("drag-over");
    }
  });

  dropZone.addEventListener("drop", async (event) => {
    event.preventDefault();
    dropZone.classList.remove("drag-over");
    const [file] = event.dataTransfer?.files || [];
    await handleFile(file, elements);
  });

  fileInput.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    await handleFile(file, elements);
    fileInput.value = "";
  });
}

if (typeof document !== "undefined") {
  setupBrowserApp();
}
