const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 5;
const ALLOWED_HOSTS = new Set([
  "dnp-solution.com",
  "www.dnp-solution.com",
  "dnp-solution.kny09508.workers.dev"
]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}
function safeText(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}
function base64(bytes) {
  // Avoid large spread arguments / stack overflow.
  let result = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(result);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/contact") {
      // These are implementation files, not public site content.
      if (url.pathname.startsWith("/src/") ||
          url.pathname === "/wrangler.jsonc" ||
          url.pathname === "/wrangler.toml" ||
          url.pathname.startsWith("/.git/")) {
        return new Response("Not Found", { status: 404 });
      }
      return env.ASSETS.fetch(request);
    }

    if (request.method !== "POST") return json({ success: false, message: "POST 요청만 허용됩니다." }, 405);
    if (!env.RESEND_API_KEY) return json({ success: false, message: "메일 발송 설정이 완료되지 않았습니다." }, 503);

    // Browser-origin check. Also blocks most cross-site scripted submissions.
    const origin = request.headers.get("Origin");
    if (!origin) return json({ success: false, message: "요청 출처를 확인할 수 없습니다." }, 403);
    let originUrl;
    try { originUrl = new URL(origin); } catch { return json({ success: false, message: "잘못된 요청 출처입니다." }, 403); }
    if (originUrl.protocol !== "https:" || !ALLOWED_HOSTS.has(originUrl.hostname)) {
      return json({ success: false, message: "허용되지 않은 요청 출처입니다." }, 403);
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_REQUEST_BYTES) return json({ success: false, message: "요청 크기가 너무 큽니다." }, 413);

    try {
      const form = await request.formData();
      const name = safeText(form.get("name"), 100);
      const company = safeText(form.get("company"), 150);
      const phone = safeText(form.get("phone"), 60);
      const email = safeText(form.get("email"), 254);
      const field = safeText(form.get("field"), 150);
      const message = safeText(form.get("message"), 5000);
      const keyword = safeText(form.get("keyword"), 300);
      const submittedAt = safeText(form.get("submitted_at"), 100);

      if (!name || !phone || !EMAIL_PATTERN.test(email)) {
        return json({ success: false, message: "성함, 연락처, 이메일을 확인해 주세요." }, 400);
      }
      const files = form.getAll("attachments").filter(f => f instanceof File && f.size > 0);
      if (files.length > MAX_FILES) return json({ success: false, message: "첨부파일은 최대 5개까지 가능합니다." }, 400);
      if (files.some(f => f.size > MAX_FILE_BYTES) ||
          files.reduce((sum, f) => sum + f.size, 0) > MAX_FILE_BYTES) {
        return json({ success: false, message: "첨부파일 합계는 5MB 이하여야 합니다." }, 413);
      }
      const attachments = [];
      for (const file of files) {
        const filename = file.name.replace(/[\\/\r\n]/g, "_").slice(0, 180) || "attachment";
        attachments.push({
          filename,
          content: base64(new Uint8Array(await file.arrayBuffer()))
        });
      }

      const rows = [
        ["신청 일시", submittedAt || new Date().toISOString()],
        ["성함", name], ["회사명", company], ["연락처", phone],
        ["이메일", email], ["사업분야", field], ["문의 내용", message],
        ["포털 검색 키워드", keyword || "확인되지 않음"]
      ];
      const text = rows.map(([key, value]) => `${key}: ${value}`).join("\n");
      const html = `<h2>DNP Solution 상담 신청</h2><table cellpadding="8" border="1" style="border-collapse:collapse">` +
        rows.map(([key, value]) => `<tr><th align="left">${escapeHtml(key)}</th><td style="white-space:pre-wrap">${escapeHtml(value)}</td></tr>`).join("") +
        `</table>`;

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: "DNP Solution <contact@dnp-solution.com>",
          to: ["dnps@st-group1.com"],
          reply_to: email,
          subject: `[상담신청] ${name} - ${company} - ${field}`.slice(0, 240),
          text, html, attachments
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.id) {
        console.error("Resend request failed", response.status, result);
        return json({ success: false, message: "메일 발송 요청이 실패했습니다. 잠시 후 다시 시도해 주세요." }, 502);
      }
      console.log("Resend accepted message", result.id);
      return json({ success: true, message: "상담 신청이 접수되었습니다." });
    } catch (err) {
      console.error("Contact handler error", err);
      return json({ success: false, message: "처리 중 오류가 발생했습니다." }, 500);
    }
  }
};
