import type { Editor as TiptapEditor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowDown, ArrowUp, ChevronRight, Copy, Trash2 } from "lucide-react";
import { Component, useEffect, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { CORE_BLOCK_STYLES, normalizeAnchor, normalizeClassName, type Device, type StylePresets } from "@cms/content";
import { StylePanel } from "./stylepanel";
import { blockPanels, onBlockPanelsChange } from "./panels";
import { BlockAttributesForm, pluginBlockInfo } from "./blocks";
import { blockInfo } from "./blockMeta";
import { currentBlock, parentBlock, setBlockAttrs, type BlockRef } from "./blockops";
import { runBlockAction } from "./handle";
import { viLabels, type EditorLabels } from "./labels";
import { LAYOUT_TYPES, LayoutSettings } from "./layoutUi";
import { labelsOf } from "./nodes";
import { cx } from "./util";

/**
 * Tab "Khối": cài đặt của khối đang chọn, đường dẫn khối cha (bấm để chọn khối cha),
 * thao tác lên / xuống / nhân bản / xoá. Khi đang hiện, form cài đặt trong khối plugin và thanh cài đặt nổi được ẩn (tránh lặp).
 * Ứng dụng đặt component này ở thanh bên, truyền đối tượng TipTap nhận từ `onReady` của Editor.
 */
export function BlockInspector({ editor, labels, device: deviceProp, onDeviceChange, presets, blockStyles }: {
  editor: TiptapEditor; labels?: Partial<EditorLabels>;
  /** Khổ màn hình đang sửa trong tab Kiểu dáng — ứng dụng truyền vào để đồng bộ với khung xem trực tiếp. */
  device?: Device; onDeviceChange?(d: Device): void;
  /** Preset kiểu dáng của theme (tab Kiểu dáng dùng thay danh sách mặc định). */
  presets?: StylePresets;
  /** Biến thể kiểu của theme theo loại khối (theme.json › blockStyles, nhãn đã dịch) — thêm vào biến thể có sẵn của lõi. */
  blockStyles?: Record<string, Array<{ name: string; label: string }>>;
}) {
  const t = { ...viLabels, ...labelsOf(editor), ...labels };
  const panels = useSyncExternalStore(onBlockPanelsChange, blockPanels);
  const [tab, setTab] = useState<"settings" | "style">("settings");
  const [ownDevice, setOwnDevice] = useState<Device>("base");
  const device = deviceProp ?? ownDevice;
  const changeDevice = (d: Device) => { setOwnDevice(d); onDeviceChange?.(d); };

  // Báo cho trình soạn biết đang có tab "Khối" (ẩn form trong khối + thanh nổi); giao dịch rỗng để các khung vẽ lại
  useEffect(() => {
    const ctx = (editor.storage as any).cmsEditorContext;
    ctx.inspector = (ctx.inspector ?? 0) + 1;
    const ping = () => { if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta("cmsInspector", true)); };
    ping();
    return () => { ctx.inspector -= 1; ping(); };
  }, [editor]);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const block = currentBlock(e.state);
      if (!block) return null;
      const chain: BlockRef[] = [block];
      for (let p = parentBlock(e.state.doc, block); p; p = parentBlock(e.state.doc, p)) chain.unshift(p);
      const $p = e.state.doc.resolve(block.pos);
      return { block, chain, index: $p.index(), count: $p.parent.childCount };
    },
    equalityFn: (a, b) => a?.block.pos === b?.block.pos && a?.block.node === b?.block.node && a?.chain.length === b?.chain.length && a?.count === b?.count,
  });

  if (!state) return <div className="cms-ed-inspector"><p className="cms-ed-inspector-empty">{t.inspectorEmpty}</p></div>;
  const { block, chain, index, count } = state;
  const info = blockInfo(block.node.type.name, t);
  const select = (b: BlockRef) => { editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, b.pos)).scrollIntoView()); };

  return (
    <div className="cms-ed-inspector">
      {chain.length > 1 && (
        <nav className="cms-ed-crumbs" aria-label={t.blockOptions}>
          {chain.map((b, i) => {
            const label = blockInfo(b.node.type.name, t).title;
            return (
              <span key={b.pos} className="cms-ed-crumb">
                {i > 0 && <ChevronRight size={12} aria-hidden />}
                {i < chain.length - 1 ? <button type="button" onClick={() => select(b)}>{label}</button> : <span aria-current="true">{label}</span>}
              </span>
            );
          })}
        </nav>
      )}
      <div className="cms-ed-inspector-head">
        <span className="cms-ed-inspector-icon"><info.icon size={18} /></span>
        <div>
          <div className="cms-ed-inspector-title">{info.title}</div>
          {info.description && <div className="cms-ed-inspector-desc">{info.description}</div>}
        </div>
      </div>
      <div className="cms-ed-inspector-tabs" role="tablist" aria-label={info.title}>
        {(["settings", "style"] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={cx(tab === k && "is-active")} onClick={() => setTab(k)}>
            {k === "settings" ? t.settingsTab : t.styleTab}
          </button>
        ))}
      </div>
      {tab === "style" ? (
        <div className="cms-ed-inspector-body" role="tabpanel">
          <StylePanel style={block.node.attrs.style} t={t} device={device} onDeviceChange={changeDevice} presets={presets}
            variants={[...(CORE_BLOCK_STYLES[block.node.type.name] ?? []).map((name) => ({ name, label: (t as Record<string, string>)[`variant_${name}`] ?? name })),
              ...(blockStyles?.[block.node.type.name] ?? [])]}
            variant={block.node.attrs.blockStyle} onVariantChange={(v) => { const tr = setBlockAttrs(editor.state, block.pos, { blockStyle: v }); if (tr) editor.view.dispatch(tr); }}
            onChange={(style) => { const tr = setBlockAttrs(editor.state, block.pos, { style }); if (tr) editor.view.dispatch(tr); }} />
        </div>
      ) : <>
      <div className="cms-ed-inspector-body" role="tabpanel">
        <Settings editor={editor} block={block} t={t} />
      </div>
      <Advanced key={block.pos} attrs={block.node.attrs} t={t} set={(a) => { const tr = setBlockAttrs(editor.state, block.pos, a); if (tr) editor.view.dispatch(tr); }} />
      {panels.filter((p) => !p.blocks || p.blocks.includes(block.node.type.name)).map((p) => (
        <section key={p.id} className="cms-ed-inspector-panel" aria-label={p.title}>
          <h4>{p.title}</h4>
          <PanelBoundary name={p.id}>
            <p.component type={block.node.type.name} attrs={block.node.attrs}
              setAttrs={(a) => { const tr = setBlockAttrs(editor.state, block.pos, a); if (tr) editor.view.dispatch(tr); }} />
          </PanelBoundary>
        </section>
      ))}
      </>}
      <div className="cms-ed-inspector-actions" role="group" aria-label={t.blockActions}>
        <button type="button" disabled={index === 0} onClick={() => runBlockAction(editor, "up", block)}><ArrowUp size={14} /> {t.moveUp}</button>
        <button type="button" disabled={index >= count - 1} onClick={() => runBlockAction(editor, "down", block)}><ArrowDown size={14} /> {t.moveDown}</button>
        <button type="button" onClick={() => runBlockAction(editor, "duplicate", block)}><Copy size={14} /> {t.duplicate}</button>
        <button type="button" className="is-danger" onClick={() => runBlockAction(editor, "delete", block)}><Trash2 size={14} /> {t.deleteBlock}</button>
      </div>
    </div>
  );
}

/** Nâng cao: neo HTML (id) và class CSS riêng — lưu khi rời ô, giá trị sai báo đỏ. */
function Advanced({ attrs, t, set }: { attrs: Record<string, any>; t: EditorLabels; set(a: Record<string, unknown>): void }) {
  const [anchor, setAnchor] = useState(attrs.anchor ?? "");
  const [cls, setCls] = useState(attrs.className ?? "");
  const anchorBad = anchor.trim() !== "" && !normalizeAnchor(anchor);
  return (
    <details className="cms-ed-inspector-panel cms-ed-advanced">
      <summary>{t.advanced}</summary>
      <Field label={t.anchor}>{(id) => <>
        <input id={id} value={anchor} aria-invalid={anchorBad || undefined} className={cx(anchorBad && "is-invalid")} placeholder="bang-gia"
          onChange={(e) => setAnchor(e.target.value)} onBlur={() => { if (!anchorBad) set({ anchor: normalizeAnchor(anchor) ?? null }); }} />
        <small>{t.anchorHint}</small>
      </>}</Field>
      <Field label={t.cssClass}>{(id) => <>
        <input id={id} value={cls} placeholder="hero highlight" onChange={(e) => setCls(e.target.value)}
          onBlur={() => { const v = normalizeClassName(cls) ?? null; setCls(v ?? ""); set({ className: v }); }} />
        <small>{t.cssClassHint}</small>
      </>}</Field>
    </details>
  );
}

/** Panel của plugin lỗi chỉ ẩn panel đó, không làm hỏng tab "Khối". */
class PanelBoundary extends Component<{ name: string; children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  componentDidCatch(e: unknown) { console.error(`[cms-editor] panel ${this.props.name}:`, e); }
  render() { return this.state.error ? null : this.props.children; }
}

function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return <div className="cms-ed-ifield"><label htmlFor={id}>{label}</label>{children(id)}</div>;
}

function Segmented<T extends string | number>({ label, value, options, onChange }: { label: string; value: T | null; options: Array<[T, ReactNode, string]>; onChange(v: T): void }) {
  return (
    <div className="cms-ed-ifield">
      <span>{label}</span>
      <span role="group" aria-label={label} className="cms-ed-seg">
        {options.map(([v, content, title]) => (
          <button key={String(v)} type="button" title={title} aria-label={title} aria-pressed={value === v} className={cx("cms-ed-seg-btn", value === v && "is-active")} onClick={() => onChange(v)}>{content}</button>
        ))}
      </span>
    </div>
  );
}

/** Cài đặt theo loại khối. */
function Settings({ editor, block, t }: { editor: TiptapEditor; block: BlockRef; t: EditorLabels }) {
  const { pos, node } = block;
  const type = node.type.name;
  const a = node.attrs as Record<string, any>;
  const set = (attrs: Record<string, unknown>) => {
    const tr = setBlockAttrs(editor.state, pos, attrs);
    if (tr) editor.view.dispatch(tr);
  };
  const text = (key: string, label: string, opts: { area?: boolean; number?: boolean } = {}) => (
    <Field label={label}>{(id) => opts.area
      ? <textarea id={id} rows={3} value={a[key] ?? ""} onChange={(e) => set({ [key]: e.target.value || null })} />
      : <input id={id} type={opts.number ? "number" : "text"} value={a[key] ?? ""} onChange={(e) => set({ [key]: e.target.value === "" ? null : opts.number ? Number(e.target.value) : e.target.value })} />}
    </Field>
  );
  const check = (key: string, label: string, def: boolean) => (
    <label className="cms-ed-check"><input type="checkbox" checked={a[key] ?? def} onChange={(e) => set({ [key]: e.target.checked })} /> {label}</label>
  );
  const align = (
    <Segmented label={t.textAlign} value={a.textAlign ?? "left"} onChange={(v) => set({ textAlign: v === "left" ? null : v })} options={[
      ["left", <AlignLeft size={14} />, t.alignLeft], ["center", <AlignCenter size={14} />, t.alignCenter], ["right", <AlignRight size={14} />, t.alignRight], ["justify", <AlignJustify size={14} />, t.alignJustify]]} />
  );

  if (LAYOUT_TYPES.has(type)) return <div className="cms-ed-inspector-layout"><LayoutSettings editor={editor} pos={pos} node={node} t={t} /></div>;
  const plugin = pluginBlockInfo(type);
  if (plugin) return <BlockAttributesForm def={plugin.def} attrs={a} setAttrs={set} t={plugin.translate} stacked />;
  switch (type) {
    case "paragraph": return align;
    case "heading": return <>
      <Segmented label={t.headingLevel} value={a.level ?? 2} onChange={(v) => set({ level: v })} options={[[2, "H2", "H2"], [3, "H3", "H3"], [4, "H4", "H4"]]} />
      {align}
    </>;
    case "orderedList": return text("start", t.listStart, { number: true });
    case "codeBlock": return text("language", t.codeLanguage);
    case "image": return <>
      {text("alt", t.alt, { area: true })}
      {text("caption", t.caption)}
      <Segmented label={t.size} value={a.align ?? "none"} onChange={(v) => set({ align: v === "none" ? null : v })} options={[
        ["left", <AlignLeft size={14} />, t.floatLeft], ["none", <AlignCenter size={14} />, t.center], ["right", <AlignRight size={14} />, t.floatRight], ["wide", "↔", t.wide]]} />
    </>;
    case "gallery": return <>
      <Segmented label={t.columns.replace(/:$/, "")} value={a.columns ?? 3} onChange={(v) => set({ columns: v })} options={[2, 3, 4, 5].map((n) => [n, String(n), String(n)] as [number, ReactNode, string])} />
      {text("caption", t.caption)}
    </>;
    case "video": case "audio": return text("caption", t.caption);
    case "file": return <>{text("caption", t.caption)}{check("embed", t.showPdf, true)}{check("download", t.allowDownload, false)}</>;
    case "youtube": return text("start", t.startAt, { number: true });
    case "table": return <>
      {check("footer", t.footerRow, false)}
      {check("fixed", t.fixedLayout, false)}
      <div className="cms-ed-inspector-row">
        {([[t.addRow, () => editor.chain().focus().addRowAfter().run()], [t.addCol, () => editor.chain().focus().addColumnAfter().run()],
          [t.delRow, () => editor.chain().focus().deleteRow().run()], [t.delCol, () => editor.chain().focus().deleteColumn().run()]] as const)
          .map(([l, f]) => <button key={l} type="button" className="cms-ed-text-btn" onClick={f}>{l}</button>)}
      </div>
    </>;
    default: return <p className="cms-ed-inspector-empty">{t.noSettings}</p>;
  }
}

