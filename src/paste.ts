/**
 * Làm sạch HTML dán từ Word / Google Docs / trang web trước khi trình soạn đọc:
 * - định dạng viết bằng style (Google Docs: span font-weight:700…) → thẻ ngữ nghĩa (strong, em, u, s, sup, sub);
 * - bỏ style/class/id/màu chữ/font, thẻ Office (o:p), chú thích điều kiện, meta/style/script;
 * - đoạn danh sách của Word (mso-list) → ul/ol lồng theo cấp;
 * - bỏ thẻ bọc của Google Docs (b#docs-internal-guid…), đoạn trống chỉ có &nbsp;.
 * Nội dung chép từ chính trình soạn (có data-pm-slice) giữ nguyên.
 */
const KEEP_ATTRS: Record<string, string[]> = { a: ["href"], img: ["src", "alt", "width", "height"], td: ["colspan", "rowspan"], th: ["colspan", "rowspan"], ol: ["start"] };
const DROP = "style, meta, link, script, title, xml, o\\:p, colgroup";

/** Định dạng (đậm, nghiêng…) suy ra từ style của một thẻ. */
function formatsOf(style: string): string[] {
  const s = style.toLowerCase().replace(/\s+/g, "");
  const out: string[] = [];
  if (/font-weight:(bold|[6-9]00)/.test(s)) out.push("strong");
  if (/font-style:italic/.test(s)) out.push("em");
  if (/text-decoration[^;]*underline/.test(s)) out.push("u");
  if (/text-decoration[^;]*line-through/.test(s)) out.push("s");
  if (/vertical-align:super/.test(s)) out.push("sup");
  if (/vertical-align:sub/.test(s)) out.push("sub");
  return out;
}

function unwrap(el: Element) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

/** Đoạn danh sách của Word → ul/ol (gom các đoạn liền nhau, lồng theo level). */
function wordLists(doc: Document) {
  const items = [...doc.querySelectorAll("p")].filter((p) => /mso-list:\s*l\d+\s+level\d+/i.test(p.getAttribute("style") ?? ""));
  let stack: Array<{ list: HTMLElement; level: number }> = [];
  for (const p of items) {
    const level = Number(/level(\d+)/i.exec(p.getAttribute("style") ?? "")?.[1] ?? 1);
    const marker = p.querySelector('[style*="mso-list:Ignore" i], [style*="mso-list: Ignore" i]');
    const mark = (marker?.textContent ?? "").trim();
    const ordered = /^(\d+|[a-z]{1,4})[.)]/i.test(mark);
    marker?.remove();
    // Đoạn danh sách nằm ngay sau danh sách đang dựng → cùng danh sách; không thì bắt đầu danh sách mới
    if (!stack.length || p.previousElementSibling !== stack[0].list) stack = [];
    while (stack.length && stack[stack.length - 1].level > level) stack.pop();
    let top = stack[stack.length - 1];
    if (!top || top.level < level) {
      const list = doc.createElement(ordered ? "ol" : "ul");
      if (top) (top.list.lastElementChild ?? top.list).appendChild(list);
      else p.parentNode!.insertBefore(list, p);
      top = { list, level };
      stack.push(top);
    }
    const li = doc.createElement("li");
    li.innerHTML = p.innerHTML;
    top.list.appendChild(li);
    p.remove();
  }
}

export function cleanPastedHtml(html: string): string {
  if (typeof DOMParser === "undefined" || html.includes("data-pm-slice")) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.body;

  // Chú thích (gồm chú thích điều kiện của Word), thẻ không phải nội dung
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
  const comments: globalThis.Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach((c) => c.parentNode?.removeChild(c));
  body.querySelectorAll(DROP).forEach((el) => el.remove());

  wordLists(doc);

  // Thẻ bọc của Google Docs: <b style="font-weight:normal" id="docs-internal-guid-…">
  body.querySelectorAll('b[id^="docs-internal-guid"]').forEach(unwrap);
  // b/strong/i có style "normal" (Google Docs) không phải định dạng thật
  body.querySelectorAll("b, strong").forEach((el) => { if (/font-weight:\s*(normal|[1-4]00)/i.test(el.getAttribute("style") ?? "")) unwrap(el); });

  // Định dạng viết bằng style → thẻ ngữ nghĩa
  body.querySelectorAll("span, font").forEach((el) => {
    const formats = formatsOf(el.getAttribute("style") ?? "");
    let inner: Element = el;
    for (const f of formats) { const w = doc.createElement(f); while (inner.firstChild) w.appendChild(inner.firstChild); inner.appendChild(w); inner = w; }
  });
  body.querySelectorAll("span, font").forEach(unwrap);

  // Thuộc tính: chỉ giữ thứ có nghĩa (link, ảnh, gộp ô)
  body.querySelectorAll("*").forEach((el) => {
    const keep = KEEP_ATTRS[el.tagName.toLowerCase()] ?? [];
    for (const name of [...el.getAttributeNames()]) if (!keep.includes(name)) el.removeAttribute(name);
  });

  // Đoạn trống (Word: <p>&nbsp;</p>), <br> đứng riêng giữa các khối (Google Docs)
  body.querySelectorAll("p, h1, h2, h3, h4, h5, h6").forEach((el) => { if (!el.textContent?.replace(/ /g, "").trim() && !el.querySelector("img")) el.remove(); });
  [...body.children].forEach((el) => { if (el.tagName === "BR") el.remove(); });
  return body.innerHTML;
}

/** Chuỗi chỉ là một đường dẫn http(s). */
export const isUrl = (text: string) => /^https?:\/\/[^\s<>"]+$/i.test(text.trim());
