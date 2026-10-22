import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, useEditorState, type ReactNodeViewProps } from "@tiptap/react";
import { BLOCK_VERSION_ATTR, blockDefaults, type BlockAttrSpec, type BlockDefinition } from "@cms/content";
import { Blocks, type LucideIcon } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { registerEditorExtension, unregisterEditorExtension } from "./registry";
import { cx } from "./util";

/** Props của phần xem trước tuỳ chỉnh trong trình soạn (tuỳ chọn — mặc định trình soạn tự hiển thị). */
export interface BlockEditProps {
  attrs: Record<string, any>;
  setAttrs(attrs: Record<string, unknown>): void;
  selected: boolean;
  /** Nội dung bên trong (khối có content "inline"/"blocks") — đặt vào chỗ muốn người dùng gõ. */
  children?: ReactNode;
}

export interface RegisterBlockOptions {
  /** Biểu tượng trong slash menu và khung khối. */
  icon?: LucideIcon;
  /** Xem trước tuỳ chỉnh trong trình soạn; không có → khung chung + form cài đặt sinh từ attributes. */
  edit?: ComponentType<BlockEditProps>;
  /** Dịch nhãn ("%khoá%" → chữ theo ngôn ngữ admin) — admin truyền vào. */
  translate?(text: string): string;
}

const blocks = new Map<string, BlockDefinition>();

/** Khối đang đăng ký (để chuẩn hoá + nâng phiên bản khi mở bài: contentToEditor). */
export const registeredBlocks = (): BlockDefinition[] => [...blocks.values()];

function controlOf(spec: BlockAttrSpec): NonNullable<BlockAttrSpec["control"]> {
  if (spec.control) return spec.control;
  if (spec.enum) return "select";
  switch (spec.type) {
    case "number": case "integer": return "number";
    case "boolean": return "checkbox";
    case "url": return "url";
    case "json": return "hidden";
    default: return "text";
  }
}

/** Form cài đặt sinh từ attributes của khối. */
function Settings({ def, attrs, setAttrs, t }: { def: BlockDefinition; attrs: Record<string, any>; setAttrs(a: Record<string, unknown>): void; t(s: string): string }) {
  const fields = Object.entries(def.attributes).filter(([, spec]) => controlOf(spec) !== "hidden");
  if (!fields.length) return null;
  return (
    <div className="cms-ed-block-settings" contentEditable={false}>
      {fields.map(([key, spec]) => {
        const control = controlOf(spec);
        const value = attrs[key] ?? spec.default ?? "";
        const id = `blk-${def.name}-${key}`;
        const label = t(spec.label ?? key);
        const set = (v: unknown) => setAttrs({ [key]: v === "" ? null : v });
        return (
          <label key={key} htmlFor={id} className={cx("cms-ed-field", control === "checkbox" && "is-check")}>
            {control !== "checkbox" && <span>{label}</span>}
            {control === "select" ? (
              <select id={id} value={String(value)} onChange={(e) => set(e.target.value)}>
                {(spec.enum ?? []).map((v, i) => <option key={String(v)} value={String(v)}>{t(spec.enumLabels?.[i] ?? String(v))}</option>)}
              </select>
            ) : control === "textarea" ? (
              <textarea id={id} value={String(value)} onChange={(e) => set(e.target.value)} rows={3} />
            ) : control === "checkbox" ? (
              <><input id={id} type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} /><span>{label}</span></>
            ) : (
              <input id={id} type={control === "number" ? "number" : control === "color" ? "color" : control === "url" ? "url" : "text"} value={String(value)}
                min={spec.min} max={spec.max} onChange={(e) => set(control === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)} />
            )}
            {spec.help && <small>{t(spec.help)}</small>}
          </label>
        );
      })}
    </div>
  );
}

/** Node TipTap sinh từ định nghĩa khối — plugin không cần biết TipTap. */
export function blockNode(def: BlockDefinition, opts: RegisterBlockOptions = {}) {
  const t = opts.translate ?? ((s: string) => s);
  const Icon = opts.icon ?? Blocks;
  const hasContent = def.content !== "none";
  function View({ node, selected, updateAttributes, editor, getPos }: ReactNodeViewProps) {
    const attrs = node.attrs as Record<string, any>;
    // Form cài đặt hiện khi khối được chọn hoặc con trỏ đang ở bên trong khối
    const inside = useEditorState({ editor, selector: ({ editor: e }) => {
      const pos = getPos();
      if (typeof pos !== "number") return false;
      const { from, to } = e.state.selection;
      return from >= pos && to <= pos + node.nodeSize;
    } });
    const active = selected || inside;
    const selectBlock = (e: { preventDefault(): void }) => { e.preventDefault(); const pos = getPos(); if (typeof pos === "number") editor.commands.setNodeSelection(pos); };
    const setAttrs = (a: Record<string, unknown>) => updateAttributes(a);
    const inner = hasContent ? <NodeViewContent className="cms-ed-block-content" /> : null;
    return (
      <NodeViewWrapper className={cx("cms-ed-block", "cms-ed-plugin-block", active && "is-selected")} data-block={def.name}>
        <div className="cms-ed-block-label" contentEditable={false} data-drag-handle onMouseDown={selectBlock}><Icon size={12} /> {t(def.title)}</div>
        {opts.edit ? <opts.edit attrs={attrs} setAttrs={setAttrs} selected={active}>{inner}</opts.edit> : inner}
        {active && <Settings def={def} attrs={attrs} setAttrs={setAttrs} t={t} />}
      </NodeViewWrapper>
    );
  }
  return Node.create({
    name: def.name,
    group: "block",
    content: def.content === "blocks" ? "block+" : def.content === "inline" ? "inline*" : undefined,
    atom: !hasContent,
    draggable: true,
    defining: hasContent,
    addAttributes() {
      // Thuộc tính chỉ nằm trong JSON (không render ra HTML của trình soạn)
      const attr = (def_: unknown) => ({ default: def_ ?? null, renderHTML: () => ({}), parseHTML: () => def_ ?? null });
      return {
        ...Object.fromEntries(Object.entries(def.attributes).map(([k, spec]) => [k, attr(spec.default)])),
        [BLOCK_VERSION_ATTR]: attr(def.version > 1 ? def.version : null),
      };
    },
    parseHTML: () => [{ tag: `div[data-block="${def.name}"]` }],
    renderHTML: ({ HTMLAttributes }) => hasContent ? ["div", mergeAttributes(HTMLAttributes, { "data-block": def.name }), 0] : ["div", mergeAttributes(HTMLAttributes, { "data-block": def.name })],
    addNodeView: () => ReactNodeViewRenderer(View),
  });
}

/**
 * Đăng ký khối (từ defineBlock) cho mọi trình soạn trong ứng dụng: node + mục slash menu + form cài đặt.
 * Trình soạn đang mở tự nạp lại. Gọi lại cùng tên → thay định nghĩa cũ.
 */
export function registerBlock(def: BlockDefinition, opts: RegisterBlockOptions = {}) {
  const t = opts.translate ?? ((s: string) => s);
  blocks.set(def.name, def);
  registerEditorExtension({
    name: `block:${def.name}`,
    extensions: [blockNode(def, opts)],
    insertItems: [{
      key: `block:${def.name}`, title: t(def.title), hint: def.description ? t(def.description) : def.name, icon: opts.icon ?? Blocks,
      keywords: `${def.keywords} ${def.name.replace(/[/_-]/g, " ")}`.toLowerCase(),
      run: (editor, range) => {
        const c = range ? editor.chain().focus().deleteRange(range) : editor.chain().focus();
        const node: Record<string, unknown> = { type: def.name, attrs: blockDefaults(def) };
        if (def.content === "blocks") node.content = [{ type: "paragraph" }];
        c.insertContent(node).run();
      },
    }],
  });
}

export function unregisterBlock(name: string) {
  blocks.delete(name);
  unregisterEditorExtension(`block:${name}`);
}
