/**
 * core-service/src/services/aiAnalyzer.js
 * Phân tích intent + sentiment bằng Groq API (llama3-70b)
 *
 * Intent theo tài liệu:
 *   - ask_price: "Shop ơi giá bao nhiêu?" → hỏi giá
 *   - complaint: "Mình chưa nhận được hàng" → khiếu nại / hỗ trợ
 *   - praise: "Bài viết hay quá" → khen / tương tác tích cực
 *   - ask_product: hỏi về sản phẩm
 *   - greeting: chào hỏi
 *   - spam: spam
 *   - other: khác
 *
 * Sentiment: positive | neutral | negative
 */
const Groq = require("groq-sdk");
const config = require("../config");
const { createLogger } = require("../utils/logger");

const logger = createLogger("ai-analyzer");
const groq   = new Groq({ apiKey: config.groq.apiKey });

const PROMPT_TEMPLATE = (message) => `
Bạn là chuyên gia phân tích ngôn ngữ tiếng Việt cho mạng xã hội Facebook.
Phân tích bình luận sau và trả về JSON hợp lệ (KHÔNG có text ngoài JSON):

Bình luận: "${message}"

Ví dụ kết quả:
- "Shop ơi giá bao nhiêu?" → intent: ask_price, sentiment: neutral
- "Mình chưa nhận được hàng" → intent: complaint, sentiment: negative
- "Bài viết hay quá" → intent: praise, sentiment: positive
- "Dịch vụ rất tốt, mình sẽ quay lại" → intent: praise, sentiment: positive
- "Sản phẩm tạm ổn" → intent: other, sentiment: neutral
- "Trải nghiệm quá tệ" → intent: complaint, sentiment: negative

Trả về đúng schema JSON:
{
  "intent": "<một trong: ask_price|ask_product|complaint|praise|greeting|spam|other>",
  "sentiment": "<một trong: positive|negative|neutral>",
  "confidence": <số 0.0-1.0>,
  "reply_text": "<câu trả lời tự động bằng tiếng Việt phù hợp nếu cần, hoặc null>"
}

Quy tắc reply_text:
- ask_price: gợi ý inbox hoặc xem bảng giá
- ask_product: hướng dẫn tìm hiểu sản phẩm
- greeting: chào lại thân thiện
- praise: cảm ơn
- complaint hoặc negative: KHÔNG tự động reply, đặt null để con người xử lý
- spam: null
`.trim();

/**
 * @param {string} message
 * @returns {{ intent, sentiment, confidence, reply_text }}
 */
async function analyze(message) {
  if (!message || !message.trim()) {
    return { intent: "other", sentiment: "neutral", confidence: 1, reply_text: null };
  }

  const completion = await groq.chat.completions.create({
    model:       config.groq.model,
    temperature: 0.1,
    max_tokens:  300,
    messages: [{ role: "user", content: PROMPT_TEMPLATE(message) }],
  });

  const raw = completion.choices[0]?.message?.content || "{}";

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed    = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    logger.debug(`AI result: intent=${parsed.intent} sentiment=${parsed.sentiment} conf=${parsed.confidence}`);
    return {
      intent:     parsed.intent      || "other",
      sentiment:  parsed.sentiment   || "neutral",
      confidence: parsed.confidence  ?? 0.5,
      reply_text: parsed.reply_text  || null,
    };
  } catch (err) {
    logger.warn(`Failed to parse AI response: ${raw}`);
    return { intent: "other", sentiment: "neutral", confidence: 0, reply_text: null };
  }
}

module.exports = { analyze };
