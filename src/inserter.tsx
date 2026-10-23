import type { Editor as TiptapEditor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { Search } from "lucide-react";
import { useId, useState, type DragEvent } from "react";
import { blockFromPos, currentBlock, insertParagraphAfter } from "./blockops";
import { viLabels, type EditorLabels } from "./labels";
import { labelsOf } from "./nodes";
import type { InsertItem } from "./types";
import { rankItems } from "./rank";
import { cx } from "./util";

/** Kiểu dữ liệu kéo từ trình chèn vào trình soạn. */
export const INSERT_MIME = "application/x-cms-insert";

const GROUPS: Array<[keyof EditorLabels, string[]]> = [
  ["groupText", ["p", "h2", "h3", "h4", "ul", "ol", "quote", "code", "table"]],
  ["groupMedia", ["image", "gallery", "video", "audio", "file"]],
  ["groupDesign", ["columns2", "columns3", "group", "callout", "button", "hr"]],
  ["groupEmbed", ["youtube", "embed"]],
  ["groupWidgets", ["shortcode"]],
];

const itemsOf = (editor: TiptapEditor): InsertItem[] => (editor.storage as any).cmsEditorContext?.items ?? [];

/** Đoạn văn trống đang có con trỏ → dùng luôn; không thì thêm đoạn trống dưới khối hiện tại (hoặc cuối bài). */
function prepareLine(editor: TiptapEditor) {
  const { state } = editor;
  const block = currentBlock(state);
  if (block && block.node.type.name === "paragraph" && block.node.content.size === 0) return;
  if (block) { editor.view.dispatch(insertParagraphAfter(state, block)); return; }
  const end = state.doc.content.size;
  const tr = state.tr.insert(end, state.schema.nodes.paragraph.create());
  editor.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, end + 1)));
}

/** Chèn một lệnh của trình chèn / slash menu dưới khối đang chọn. */
export function insertItem(editor: TiptapEditor, item: InsertItem) {
  prepareLine(editor);
  item.run(editor);
}

/**
 * Thả từ trình chèn vào trình soạn: thêm đoạn trống phía trên / dưới khối dưới con trỏ chuột (theo nửa trên / nửa dưới), rồi chạy lệnh.
 * Editor gọi hàm này trong handleDrop; trả true khi đã xử lý.
 */
export function handleInsertDrop(editor: TiptapEditor, view: EditorView, event: DragEvent | globalThis.DragEvent): boolean {
  const key = event.dataTransfer?.getData(INSERT_MIME);
  if (!key) return false;
  const item = itemsOf(editor).find((i) => i.key === key);
  if (!item) return false;
  event.preventDefault();
  const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
  const block = at ? blockFromPos(view.state.doc, at.inside >= 0 ? at.inside : Math.max(0, at.pos - 1)) : null;
  let pos = view.state.doc.content.size;
  if (block) {
    const dom = view.nodeDOM(block.pos) as HTMLElement | null;
    const rect = dom?.getBoundingClientRect?.();
    pos = rect && event.clientY < rect.top + rect.height / 2 ? block.pos : block.pos + block.node.nodeSize;
  }
  const tr = view.state.tr.insert(pos, view.state.schema.nodes.paragraph.create());
  view.dispatch(tr.setSelection(TextSelection.create(tr.doc, pos + 1)));
  view.focus();
  item.run(editor);
  return true;
}

/** Trình chèn khối (cột trái, như Block Inserter của Gutenberg): tìm, bấm để chèn, kéo vào bài. */
export function BlockInserter({ editor, labels }: { editor: TiptapEditor; labels?: Partial<EditorLabels> }) {
  const t = { ...viLabels, ...labelsOf(editor), ...labels };
  const [query, setQuery] = useState("");
  const id = useId();
  // Danh sách lệnh do Editor đặt vào ngữ cảnh (gồm khối của plugin); đọc lại khi trình soạn đổi
  const items = useEditorState({ editor, selector: ({ editor: e }) => itemsOf(e), equalityFn: (a, b) => a === b });
  const list = query.trim() ? rankItems(items, query) : items;
  const known = new Set(GROUPS.flatMap(([, keys]) => keys));
  const groups: Array<[string, InsertItem[]]> = query.trim()
    ? [["", list]]
    : [...GROUPS.map(([label, keys]) => [t[label], keys.map((k) => list.find((i) => i.key === k)).filter(Boolean) as InsertItem[]] as [string, InsertItem[]]),
      [t.groupPlugin, list.filter((i) => !known.has(i.key))]];

  const onDragStart = (e: DragEvent, item: InsertItem) => {
    e.dataTransfer.setData(INSERT_MIME, item.key);
    e.dataTransfer.setData("text/plain", item.title);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="cms-ed-inserter">
      <label className="cms-ed-inserter-search" htmlFor={id}>
        <Search size={14} aria-hidden />
        <input id={id} type="search" placeholder={t.searchBlocks} aria-label={t.searchBlocks} value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && list[0]) { e.preventDefault(); insertItem(editor, list[0]); } }} />
      </label>
      <p className="cms-ed-inserter-hint">{t.dragToInsert}</p>
      {list.length === 0 && <p className="cms-ed-inspector-empty">{t.noBlocks}</p>}
      {groups.filter(([, g]) => g.length).map(([label, g]) => (
        <section key={label || "results"} className="cms-ed-inserter-group" aria-label={label || t.searchBlocks}>
          {label && <h3>{label}</h3>}
          <div className="cms-ed-inserter-grid">
            {g.map((item) => (
              <button key={item.key} type="button" draggable className={cx("cms-ed-inserter-item")} title={item.hint} data-key={item.key}
                onDragStart={(e) => onDragStart(e, item)} onClick={() => insertItem(editor, item)}>
                <item.icon size={20} aria-hidden />
                <span>{item.title}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
