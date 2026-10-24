import { useEditorState, type Editor as TiptapEditor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";
import { normalizeStyle, type Box, type Device } from "@ecomcx/ecomweb-content";
import { useEffect, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from "react";
import { createPortal } from "react-dom";
import type { EditorLabels } from "./labels";

/** Khối kéo chỉnh khoảng đệm được (chọn cả khối). */
const PADDED = new Set(["group", "cover", "columns", "column", "callout", "mediaText", "details", "pullquote"]);
const SIDES = ["top", "right", "bottom", "left"] as const;
type Side = (typeof SIDES)[number];

interface Target { columns: { pos: number; node: PMNode } | null; padded: { pos: number; node: PMNode } | null }

function findTarget(editor: TiptapEditor): Target {
  const { selection, doc } = editor.state;
  let columns: Target["columns"] = null;
  const $p = selection.$from;
  for (let d = $p.depth; d >= 1 && !columns; d--) if ($p.node(d).type.name === "columns") columns = { pos: $p.before(d), node: $p.node(d) };
  let padded: Target["padded"] = null;
  if (selection instanceof NodeSelection) {
    const node = doc.nodeAt(selection.from);
    if (node && node.type.name === "columns") columns = { pos: selection.from, node };
    if (node && PADDED.has(node.type.name)) padded = { pos: selection.from, node };
  }
  return { columns, padded };
}

/** Theo dõi vị trí DOM của khối (cuộn, đổi cỡ, sửa nội dung). */
function useTick(editor: TiptapEditor, on: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!on) return;
    let frame = 0;
    const update = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => setTick((x) => x + 1)); };
    editor.on("transaction", update);
    window.addEventListener("scroll", update, true); window.addEventListener("resize", update);
    return () => { cancelAnimationFrame(frame); editor.off("transaction", update); window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [editor, on]);
}

/** Kéo theo con trỏ: gọi `move(dx, dy)` khi rê, `end()` khi thả. */
function drag(e: ReactPointerEvent, move: (dx: number, dy: number) => void, end?: () => void) {
  e.preventDefault(); e.stopPropagation();
  const x0 = e.clientX, y0 = e.clientY;
  const onMove = (ev: PointerEvent) => { ev.preventDefault(); move(ev.clientX - x0, ev.clientY - y0); };
  const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); window.removeEventListener("pointercancel", onUp); end?.(); };
  window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp); window.addEventListener("pointercancel", onUp);
}

const device = (editor: TiptapEditor): Device => (editor.storage as any).cmsEditorContext?.device ?? "base";

/**
 * Kéo chỉnh ngay trên khung soạn: thanh giữa các cột (bộ cột chứa con trỏ) đổi độ rộng cột;
 * chọn cả khối bố cục (nhóm, ảnh bìa, cột…) → kéo 4 cạnh đổi khoảng đệm theo khổ màn hình đang sửa ở tab Kiểu dáng.
 */
export function CanvasHandles({ editor, t }: { editor: TiptapEditor; t: EditorLabels }) {
  const target = useEditorState({ editor, selector: ({ editor: e }) => (e.isEditable ? findTarget(e) : null),
    equalityFn: (a, b) => a?.columns?.pos === b?.columns?.pos && a?.columns?.node === b?.columns?.node && a?.padded?.pos === b?.padded?.pos && a?.padded?.node === b?.padded?.node });
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  useTick(editor, !!(target?.columns || target?.padded));
  if (!target || (!target.columns && !target.padded)) return null;

  const handles: ReactElement[] = [];
  const view = editor.view;

  // Độ rộng cột: thanh kéo ở khe giữa hai cột liền nhau (bỏ qua khi cột đang xếp chồng)
  if (target.columns) {
    const { pos, node } = target.columns;
    const cols: Array<{ pos: number; rect: DOMRect }> = [];
    let p = pos + 1;
    node.forEach((col) => { const dom = view.nodeDOM(p) as HTMLElement | null; if (dom?.getBoundingClientRect) cols.push({ pos: p, rect: dom.getBoundingClientRect() }); p += col.nodeSize; });
    const side = cols.length === node.childCount && cols.every((c, i) => i === 0 || c.rect.left >= cols[i - 1].rect.right - 1);
    if (side) {
      const total = cols.reduce((s, c) => s + c.rect.width, 0);
      for (let i = 0; i < cols.length - 1; i++) {
        const a = cols[i].rect, b = cols[i + 1].rect;
        const x = (a.right + b.left) / 2, top = Math.min(a.top, b.top), height = Math.max(a.bottom, b.bottom) - top;
        handles.push(<div key={`c${i}`} className="cms-ed-colhandle" role="separator" aria-orientation="vertical" aria-label={t.resizeColumns} title={t.resizeColumns}
          style={{ left: x - 5, top, height }}
          onPointerDown={(e) => {
            const start = cols.map((c) => (c.rect.width / total) * 100), pair = start[i] + start[i + 1];
            drag(e, (dx) => {
              const left = Math.round(Math.min(pair - 10, Math.max(10, start[i] + (dx / total) * 100)));
              const widths = start.map((w) => Math.round(w));
              widths[i] = left; widths[i + 1] = Math.round(pair) - left;
              const cur = editor.state.doc.nodeAt(pos);
              if (!cur || cur.type.name !== "columns") return;
              const tr = editor.state.tr;
              let q = pos + 1;
              cur.forEach((col, _o, k) => { if (col.attrs.width !== widths[k]) tr.setNodeMarkup(q, undefined, { ...col.attrs, width: widths[k] }); q += col.nodeSize; });
              if (tr.docChanged) view.dispatch(tr);
              setTip({ x: e.clientX + dx, y: top - 28, text: widths.map((w) => `${w}%`).join(" · ") });
            }, () => setTip(null));
          }} />);
      }
    }
  }

  // Khoảng đệm: 4 dải ở mép trong của khối, rộng bằng khoảng đệm hiện tại
  if (target.padded) {
    const { pos } = target.padded;
    const dom = view.nodeDOM(pos) as HTMLElement | null;
    if (dom?.getBoundingClientRect) {
      const r = dom.getBoundingClientRect(), cs = getComputedStyle(dom);
      const pad: Record<Side, number> = { top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0, bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0 };
      for (const s of SIDES) {
        const size = Math.max(6, pad[s]);
        const box = s === "top" ? { left: r.left, top: r.top, width: r.width, height: size }
          : s === "bottom" ? { left: r.left, top: r.bottom - size, width: r.width, height: size }
          : s === "left" ? { left: r.left, top: r.top, width: size, height: r.height }
          : { left: r.right - size, top: r.top, width: size, height: r.height };
        handles.push(<div key={`p${s}`} className={`cms-ed-padhandle is-${s}`} role="separator" aria-orientation={s === "top" || s === "bottom" ? "horizontal" : "vertical"}
          aria-label={`${t.style_padding} · ${t[`side_${s}` as keyof EditorLabels]}`} title={t.dragPadding} style={box}
          onPointerDown={(e) => {
            const d = device(editor), start = pad[s], sign = s === "right" ? -1 : 1; // kéo xuống / sang phải = tăng; cạnh phải kéo vào trong = tăng
            drag(e, (dx, dy) => {
              const delta = s === "top" || s === "bottom" ? dy : dx;
              const value = Math.max(0, Math.min(400, Math.round(start + sign * delta)));
              setPadding(editor, pos, d, s, `${value}px`, pad);
              setTip({ x: e.clientX + dx, y: e.clientY + dy - 32, text: `${value}px${d !== "base" ? ` · ${t[`device_${d}` as keyof EditorLabels]}` : ""}` });
            }, () => setTip(null));
          }} />);
      }
    }
  }

  return createPortal(
    <div className="cms-ed-handles">
      {handles}
      {tip && <div className="cms-ed-handletip" style={{ left: tip.x, top: Math.max(4, tip.y) }}>{tip.text}</div>}
    </div>,
    document.body,
  );
}

/** Đặt khoảng đệm một cạnh cho khổ `d`, giữ nguyên các cạnh khác (giá trị gọn "lg" → tách ra 4 cạnh; cạnh chưa đặt lấy giá trị đang hiển thị). */
function setPadding(editor: TiptapEditor, pos: number, d: Device, side: Side, value: string, shown: Record<Side, number>) {
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return;
  const style = (normalizeStyle(node.attrs.style) ?? {}) as Record<string, any>;
  const cur: Box | undefined = style.padding?.[d];
  const sides: Partial<Record<Side, string>> = typeof cur === "string" ? { top: cur, right: cur, bottom: cur, left: cur } : { ...(cur ?? {}) };
  for (const s of SIDES) if (sides[s] === undefined) sides[s] = `${Math.round(shown[s])}px`;
  sides[side] = value;
  const next = { ...style, padding: { ...(style.padding ?? {}), [d]: sides } };
  editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, style: normalizeStyle(next) ?? null }));
}
