import { normalizeStyle, type BlockStyle, type Device } from "@cms/content";
import { Link2, Link2Off, Monitor, MoreVertical, Smartphone, Tablet } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { EditorLabels } from "./labels";
import { cx } from "./util";

type Style = BlockStyle & Record<string, any>;
type Section = "typography" | "color" | "spacing" | "border" | "visibility";

/** Mục hiện mặc định trong mỗi phần (menu ⋮ bật/tắt thêm, nhớ theo trình duyệt). */
const CONTROLS: Record<Section, Array<[string, boolean]>> = {
  typography: [["fontSize", true], ["appearance", true], ["lineHeight", true], ["fontFamily", false], ["letterSpacing", false], ["decoration", false], ["transform", false], ["textAlign", false]],
  color: [["text", true], ["background", true]],
  spacing: [["padding", true], ["margin", true], ["gap", false], ["width", false], ["maxWidth", false], ["minHeight", false]],
  border: [["border", true], ["radius", true]],
  visibility: [["hide", true]],
};
const RESPONSIVE = new Set(["padding", "margin", "gap", "width", "maxWidth", "minHeight", "fontSize", "lineHeight", "letterSpacing", "textAlign"]);
const STORE_KEY = "cms-ed-style-controls";
const SIZES: Array<[string, string]> = [["sm", "S"], ["md", "M"], ["lg", "L"], ["xl", "XL"], ["2xl", "2XL"]];
const SPACES = ["0", "xs", "sm", "md", "lg", "xl", "2xl"];
const COLORS = ["primary", "muted", "surface", "white", "black"];
const WEIGHTS = ["300", "400", "500", "600", "700", "800", "900"];

function loadVisible(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}"); } catch { return {}; }
}

/** Ô nhập giá trị kiểu dáng (preset như `lg` hoặc `16px`, `1.5rem`…): lưu khi rời ô / Enter, giá trị sai thì báo đỏ. */
function ValueInput({ value, onCommit, check, placeholder, label, list }: { value?: string | number; onCommit(v: string | null): void; check(v: string): boolean; placeholder?: string; label: string; list?: string }) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const [bad, setBad] = useState(false);
  useEffect(() => { setText(value == null ? "" : String(value)); setBad(false); }, [value]);
  const commit = () => {
    const v = text.trim();
    if (v === "") { setBad(false); if (value != null) onCommit(null); return; }
    if (!check(v)) { setBad(true); return; }
    setBad(false);
    if (v !== String(value ?? "")) onCommit(v);
  };
  return <input type="text" value={text} placeholder={placeholder} aria-label={label} aria-invalid={bad || undefined} list={list}
    className={cx("cms-ed-style-input", bad && "is-invalid")} onChange={(e) => setText(e.target.value)} onBlur={commit}
    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }} />;
}

function Seg<T extends string>({ value, options, onChange, label }: { value: T | undefined; options: Array<[T, ReactNode, string]>; onChange(v: T | undefined): void; label: string }) {
  return (
    <span role="group" aria-label={label} className="cms-ed-seg">
      {options.map(([v, content, title]) => (
        <button key={v} type="button" title={title} aria-label={title} aria-pressed={value === v} className={cx("cms-ed-seg-btn", value === v && "is-active")}
          onClick={() => onChange(value === v ? undefined : v)}>{content}</button>
      ))}
    </span>
  );
}

/** Ô màu: preset của theme (ô vuông) + bảng chọn màu + bỏ màu. */
function ColorField({ value, onChange, label, t }: { value?: string; onChange(v: string | undefined): void; label: string; t: EditorLabels }) {
  const hex = value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
  return (
    <div className="cms-ed-color" role="group" aria-label={label}>
      {COLORS.map((c) => (
        <button key={c} type="button" title={c} aria-label={`${label}: ${c}`} aria-pressed={value === c} className={cx("cms-ed-swatch", value === c && "is-active")}
          style={{ background: `var(--ecx-color-${c})` }} onClick={() => onChange(value === c ? undefined : c)} />
      ))}
      <input type="color" value={hex} aria-label={`${label}: ${t.customColor}`} onChange={(e) => onChange(e.target.value)} />
      {value && <button type="button" className="cms-ed-text-btn" onClick={() => onChange(undefined)}>{t.noColor}</button>}
    </div>
  );
}

/** Bốn cạnh (trên, phải, dưới, trái) — khoá liên kết thì một giá trị cho cả bốn. */
function BoxField({ value, onChange, label, t }: { value: string | Record<string, string> | undefined; onChange(v: string | Record<string, string> | undefined): void; label: string; t: EditorLabels }) {
  const [linked, setLinked] = useState(typeof value !== "object" || value === null);
  const ok = (v: string) => !!normalizeStyle({ padding: v });
  const sides = typeof value === "object" && value ? value : value ? { top: value, right: value, bottom: value, left: value } : {};
  const setSide = (s: string, v: string | null) => {
    const next: Record<string, string> = { ...sides };
    if (v == null) delete next[s]; else next[s] = v;
    onChange(Object.keys(next).length ? next : undefined);
  };
  return (
    <div className="cms-ed-box">
      <div className="cms-ed-box-head">
        <span>{label}</span>
        <span role="group" aria-label={label} className="cms-ed-seg is-compact">
          {SPACES.map((v) => (
            <button key={v} type="button" title={v} aria-pressed={linked && value === v} className={cx("cms-ed-seg-btn", linked && value === v && "is-active")}
              onClick={() => { setLinked(true); onChange(value === v ? undefined : v); }}>{v === "0" ? "0" : v.toUpperCase()}</button>
          ))}
        </span>
        <button type="button" className="cms-ed-btn" title={linked ? t.unlinkSides : t.linkSides} aria-label={linked ? t.unlinkSides : t.linkSides} aria-pressed={linked}
          onClick={() => setLinked(!linked)}>{linked ? <Link2 size={14} /> : <Link2Off size={14} />}</button>
      </div>
      {linked
        ? <ValueInput label={label} value={typeof value === "string" ? value : undefined} check={ok} placeholder="16px, 1.5rem, lg…" onCommit={(v) => onChange(v ?? undefined)} />
        : <div className="cms-ed-box-sides">
            {(["top", "right", "bottom", "left"] as const).map((s) => (
              <label key={s}><span>{t[`side_${s}` as keyof EditorLabels]}</span>
                <ValueInput label={`${label} ${t[`side_${s}` as keyof EditorLabels]}`} value={sides[s]} check={ok} onCommit={(v) => setSide(s, v)} /></label>
            ))}
          </div>}
    </div>
  );
}

function Panel({ title, section, t, visible, setVisible, onReset, children }: {
  title: string; section: Section; t: EditorLabels; visible: Record<string, boolean>; setVisible(k: string, v: boolean): void; onReset(): void; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", outside, true);
    return () => document.removeEventListener("mousedown", outside, true);
  }, [open]);
  return (
    <section className="cms-ed-style-panel" aria-labelledby={id}>
      <div className="cms-ed-style-panel-head" ref={ref}>
        <h4 id={id}>{title}</h4>
        <button type="button" className="cms-ed-btn" aria-label={`${title}: ${t.moreOptions}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><MoreVertical size={14} /></button>
        {open && (
          <div role="menu" className="cms-ed-menu cms-ed-style-menu">
            {CONTROLS[section].map(([k, def]) => {
              const on = visible[`${section}.${k}`] ?? def;
              return (
                <button key={k} type="button" role="menuitemcheckbox" aria-checked={on} className={cx("cms-ed-menu-item", on && "is-active")}
                  onClick={() => setVisible(`${section}.${k}`, !on)}><span>{t[`style_${k}` as keyof EditorLabels] ?? k}</span>{on && <span aria-hidden>✓</span>}</button>
              );
            })}
            <button type="button" role="menuitem" className="cms-ed-menu-item is-danger" onClick={() => { setOpen(false); onReset(); }}>{t.resetAll}</button>
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * Tab "Kiểu dáng" của khối: kiểu chữ, màu, khoảng cách, viền, ẩn theo khổ màn hình — ghi vào `attrs.style` (@cms/content).
 * Giá trị theo khổ (khoảng cách, cỡ chữ…) sửa theo khổ đang chọn; khổ nhỏ chưa đặt thì kế thừa khổ lớn hơn.
 */
export function StylePanel({ style: raw, onChange, t, device, onDeviceChange }: {
  style: unknown; onChange(style: BlockStyle | null): void; t: EditorLabels; device: Device; onDeviceChange(d: Device): void;
}) {
  const style: Style = (normalizeStyle(raw) ?? {}) as Style;
  const [visible, setVisibleState] = useState<Record<string, boolean>>(loadVisible);
  const setVisible = (k: string, v: boolean) => {
    const next = { ...visible, [k]: v };
    setVisibleState(next);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* bỏ qua */ }
  };
  const shows = (section: Section, k: string) => visible[`${section}.${k}`] ?? CONTROLS[section].find(([x]) => x === k)?.[1] ?? false;

  const commit = (next: Style) => onChange(normalizeStyle(next) ?? null);
  /** Đọc / ghi một thuộc tính; thuộc tính theo khổ dùng khổ đang chọn. */
  const get = (k: string): any => (RESPONSIVE.has(k) ? style[k]?.[device] : style[k]);
  const inherited = (k: string): any => (RESPONSIVE.has(k) && device !== "base" ? (device === "mobile" ? style[k]?.tablet ?? style[k]?.base : style[k]?.base) : undefined);
  const set = (k: string, v: unknown) => {
    const next: Style = { ...style };
    if (RESPONSIVE.has(k)) {
      const r = { ...(style[k] ?? {}) };
      if (v === undefined || v === null || v === "") delete r[device]; else r[device] = v;
      next[k] = Object.keys(r).length ? r : undefined;
    } else next[k] = v === "" ? undefined : v;
    commit(next);
  };
  const setGroup = (k: "color" | "border", sub: string, v: unknown) => set(k, { ...(style[k] ?? {}), [sub]: v });
  const reset = (keys: string[]) => { const next: Style = { ...style }; for (const k of keys) delete next[k]; commit(next); };
  const ok = (k: string) => (v: string) => !!normalizeStyle({ [k]: v });
  const deviceMark = (k: string) => (RESPONSIVE.has(k) && device !== "base" && get(k) === undefined && inherited(k) !== undefined ? <span className="cms-ed-inherit">{t.inherited}: {String(typeof inherited(k) === "object" ? "…" : inherited(k))}</span> : null);
  const row = (k: string, label: string, control: ReactNode) => (
    <div className="cms-ed-ifield" key={k}><span>{label}{RESPONSIVE.has(k) && device !== "base" && <em className="cms-ed-device-tag">{t[`device_${device}` as keyof EditorLabels]}</em>}</span>{control}{deviceMark(k)}</div>
  );
  const appearance = `${style.fontWeight ?? ""}${style.fontStyle === "italic" ? "i" : ""}`;

  return (
    <div className="cms-ed-style">
      <div className="cms-ed-ifield">
        <span>{t.device}</span>
        <span role="group" aria-label={t.device} className="cms-ed-seg">
          {([["base", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([d, Icon]) => (
            <button key={d} type="button" title={t[`device_${d}`]} aria-label={t[`device_${d}`]} aria-pressed={device === d} className={cx("cms-ed-seg-btn", device === d && "is-active")} onClick={() => onDeviceChange(d)}><Icon size={14} /></button>
          ))}
        </span>
      </div>

      <Panel title={t.style_typography} section="typography" t={t} visible={visible} setVisible={setVisible}
        onReset={() => reset(["fontFamily", "fontSize", "lineHeight", "letterSpacing", "fontWeight", "fontStyle", "textDecoration", "textTransform", "textAlign"])}>
        {shows("typography", "fontFamily") && row("fontFamily", t.style_fontFamily,
          <select value={style.fontFamily ?? ""} aria-label={t.style_fontFamily} onChange={(e) => set("fontFamily", e.target.value || undefined)}>
            <option value="">{t.default}</option><option value="body">{t.font_body}</option><option value="heading">{t.font_heading}</option><option value="mono">{t.font_mono}</option>
          </select>)}
        {shows("typography", "fontSize") && row("fontSize", t.style_fontSize, <>
          <Seg label={t.style_fontSize} value={get("fontSize")} onChange={(v) => set("fontSize", v)} options={SIZES.map(([v, l]) => [v, l, v] as [string, ReactNode, string])} />
          <ValueInput label={`${t.style_fontSize}: ${t.custom}`} value={SIZES.some(([v]) => v === get("fontSize")) ? undefined : get("fontSize")} check={ok("fontSize")} placeholder="18px, 1.25rem" onCommit={(v) => set("fontSize", v)} />
        </>)}
        {shows("typography", "appearance") && row("appearance", t.style_appearance,
          <select value={appearance} aria-label={t.style_appearance} onChange={(e) => {
            const v = e.target.value;
            commit({ ...style, fontWeight: v.replace("i", "") || undefined, fontStyle: v.endsWith("i") ? "italic" : undefined });
          }}>
            <option value="">{t.default}</option>
            {WEIGHTS.flatMap((w) => [<option key={w} value={w}>{t[`weight_${w}` as keyof EditorLabels]}</option>, <option key={`${w}i`} value={`${w}i`}>{t[`weight_${w}` as keyof EditorLabels]} {t.italicSuffix}</option>])}
          </select>)}
        {shows("typography", "lineHeight") && row("lineHeight", t.style_lineHeight,
          <ValueInput label={t.style_lineHeight} value={get("lineHeight")} check={ok("lineHeight")} placeholder="1.5" onCommit={(v) => set("lineHeight", v == null ? undefined : Number(v))} />)}
        {shows("typography", "letterSpacing") && row("letterSpacing", t.style_letterSpacing,
          <ValueInput label={t.style_letterSpacing} value={get("letterSpacing")} check={ok("letterSpacing")} placeholder="1px, 0.05em" onCommit={(v) => set("letterSpacing", v)} />)}
        {shows("typography", "decoration") && row("decoration", t.style_decoration,
          <Seg label={t.style_decoration} value={style.textDecoration} onChange={(v) => set("textDecoration", v)}
            options={[["none", "—", t.none], ["underline", <u>U</u>, t.underlineText], ["line-through", <s>S</s>, t.strikeText]]} />)}
        {shows("typography", "transform") && row("transform", t.style_transform,
          <Seg label={t.style_transform} value={style.textTransform} onChange={(v) => set("textTransform", v)}
            options={[["none", "—", t.none], ["uppercase", "AB", t.upper], ["lowercase", "ab", t.lower], ["capitalize", "Ab", t.capitalize]]} />)}
        {shows("typography", "textAlign") && row("textAlign", t.textAlign,
          <Seg label={t.textAlign} value={get("textAlign")} onChange={(v) => set("textAlign", v)}
            options={[["left", "L", t.alignLeft], ["center", "C", t.alignCenter], ["right", "R", t.alignRight], ["justify", "J", t.alignJustify]]} />)}
      </Panel>

      <Panel title={t.style_color} section="color" t={t} visible={visible} setVisible={setVisible} onReset={() => reset(["color"])}>
        {shows("color", "text") && row("text", t.style_text, <ColorField label={t.style_text} t={t} value={style.color?.text} onChange={(v) => setGroup("color", "text", v)} />)}
        {shows("color", "background") && row("background", t.style_background, <ColorField label={t.style_background} t={t} value={style.color?.background} onChange={(v) => setGroup("color", "background", v)} />)}
      </Panel>

      <Panel title={t.style_spacing} section="spacing" t={t} visible={visible} setVisible={setVisible} onReset={() => reset(["padding", "margin", "gap", "width", "maxWidth", "minHeight"])}>
        {shows("spacing", "padding") && <div className="cms-ed-ifield"><BoxField label={`${t.style_padding}${device !== "base" ? ` · ${t[`device_${device}`]}` : ""}`} t={t} value={get("padding")} onChange={(v) => set("padding", v)} />{deviceMark("padding")}</div>}
        {shows("spacing", "margin") && <div className="cms-ed-ifield"><BoxField label={`${t.style_margin}${device !== "base" ? ` · ${t[`device_${device}`]}` : ""}`} t={t} value={get("margin")} onChange={(v) => set("margin", v)} />{deviceMark("margin")}</div>}
        {(["gap", "width", "maxWidth", "minHeight"] as const).filter((k) => shows("spacing", k)).map((k) =>
          row(k, t[`style_${k}`], <ValueInput label={t[`style_${k}`]} value={get(k)} check={ok(k)} placeholder={k === "gap" ? "md, 24px" : "100%, 640px, 60vh"} onCommit={(v) => set(k, v)} />))}
      </Panel>

      <Panel title={t.style_border} section="border" t={t} visible={visible} setVisible={setVisible} onReset={() => reset(["border", "radius"])}>
        {shows("border", "border") && <>
          {row("borderWidth", t.style_borderWidth, <ValueInput label={t.style_borderWidth} value={style.border?.width} check={ok("radius")} placeholder="1px" onCommit={(v) => setGroup("border", "width", v ?? undefined)} />)}
          {row("borderStyle", t.style_borderStyle, <Seg label={t.style_borderStyle} value={style.border?.style} onChange={(v) => setGroup("border", "style", v)}
            options={[["solid", "—", t.border_solid], ["dashed", "- -", t.border_dashed], ["dotted", "···", t.border_dotted]]} />)}
          {row("borderColor", t.style_borderColor, <ColorField label={t.style_borderColor} t={t} value={style.border?.color} onChange={(v) => setGroup("border", "color", v)} />)}
        </>}
        {shows("border", "radius") && row("radius", t.style_radius, <ValueInput label={t.style_radius} value={style.radius} check={ok("radius")} placeholder="8px" onCommit={(v) => set("radius", v ?? undefined)} />)}
      </Panel>

      <Panel title={t.style_visibility} section="visibility" t={t} visible={visible} setVisible={setVisible} onReset={() => reset(["hide"])}>
        {shows("visibility", "hide") && (["desktop", "tablet", "mobile"] as const).map((d) => (
          <label key={d} className="cms-ed-check"><input type="checkbox" checked={!!style.hide?.includes(d)}
            onChange={(e) => set("hide", e.target.checked ? [...(style.hide ?? []), d] : (style.hide ?? []).filter((x) => x !== d))} /> {t[`hide_${d}`]}</label>
        ))}
      </Panel>
    </div>
  );
}
