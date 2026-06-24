import assert from "node:assert/strict";
import {
  MAX_FILE_SIZE,
  buildDownloadFileName,
  processChatText
} from "../app.js";

assert.equal(MAX_FILE_SIZE, 20 * 1024 * 1024);

{
  const input = "2025.09.22 星期一\n07:57 陳小明 陳小明已加入群組。\n08:42 林戴維 David 圖片";
  const result = processChatText(input);

  assert.equal(
    result.outputText,
    "2025.09.22 星期一\n2025-09-22 07:57 陳小明 陳小明已加入群組。\n2025-09-22 08:42 林戴維 David 圖片"
  );
  assert.equal(result.summary.dateLineCount, 1);
  assert.equal(result.summary.updatedMessageLineCount, 2);
}

{
  const input = "2023/09/10（日）\n上午10:30 王小明 早安\n下午3:05 王小明 下午好";
  const result = processChatText(input);

  assert.equal(
    result.outputText,
    "2023/09/10（日）\n2023-09-10 10:30 王小明 早安\n2023-09-10 15:05 王小明 下午好"
  );
}

{
  const input = "13:18 林戴維 David 這是前一天的訊息\n2025.09.22 星期一\n07:57 陳小明 陳小明已加入群組。";
  const result = processChatText(input);

  assert.equal(
    result.outputText,
    "13:18 林戴維 David 這是前一天的訊息\n2025.09.22 星期一\n2025-09-22 07:57 陳小明 陳小明已加入群組。"
  );
  assert.equal(result.summary.skippedTimeLineBeforeDateCount, 1);
}

{
  const input = "2025.09.22 星期一\n13:24 林戴維 David 照片的部分\n\n以前是一段時間，會一口氣傳，可能是老師比較有空的時間\n\n不會即時每週更新";
  const result = processChatText(input);

  assert.equal(
    result.outputText,
    "2025.09.22 星期一\n2025-09-22 13:24 林戴維 David 照片的部分\n\n以前是一段時間，會一口氣傳，可能是老師比較有空的時間\n\n不會即時每週更新"
  );
}

{
  const input = "2023/09/10（日）\n上午12:05 王小明 凌晨訊息\n下午12:05 王小明 中午訊息";
  const result = processChatText(input);

  assert.equal(
    result.outputText,
    "2023/09/10（日）\n2023-09-10 00:05 王小明 凌晨訊息\n2023-09-10 12:05 王小明 中午訊息"
  );
}

{
  const input = Array.from({ length: 85 }, (_, index) => `2025.09.22 星期一 ${index + 1}`).join("\n");
  const result = processChatText(input);

  assert.equal(result.summary.totalLines, 85);
  assert.equal(result.previewText.split("\n").length, 80);
  assert.equal(result.previewText.split("\n")[79], "2025.09.22 星期一 80");
}

assert.equal(buildDownloadFileName("chat_1.txt"), "chat_1_processed.txt");
assert.equal(buildDownloadFileName("linechat"), "linechat_processed.txt");
assert.equal(buildDownloadFileName(""), "line-date-fixer_processed.txt");

{
  // 測試發言者提取功能（使用 tab 分隔符）
  const input = "2025.09.22 星期一\n07:57\t陳小明\t早安\n08:42\t林戴維 David\t圖片\n08:43\t陳小明\t哈哈";
  const result = processChatText(input);
  assert.equal(result.summary.senders.size, 2);
  assert.ok(result.summary.senders.has("陳小明"));
  assert.ok(result.summary.senders.has("林戴維 David"));
}

{
  // 測試發言者提取功能（使用空格分隔符）
  const input = "2025.09.22 星期一\n07:57 陳小明 早安\n08:42 林戴維 David 圖片";
  const result = processChatText(input);
  assert.equal(result.summary.senders.size, 2);
  assert.ok(result.summary.senders.has("陳小明"));
  assert.ok(result.summary.senders.has("林戴維")); // 因為使用空格分隔，所以 "林戴維" 會被切出來
}

{
  // 測試排除系統關鍵字
  const input = "2025.09.22 星期一\n07:57 通話時間 1:30\n08:42 林戴維 David 圖片";
  const result = processChatText(input);
  assert.equal(result.summary.senders.size, 1);
  assert.ok(result.summary.senders.has("林戴維"));
  assert.ok(!result.summary.senders.has("通話時間"));
}

console.log("All assertions passed.");
