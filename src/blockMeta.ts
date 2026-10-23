import {
  Braces, CheckSquare, Columns2, Columns3, FileText, Globe, Heading, ImageIcon, Images, Info, List, ListOrdered, Minus, Music, Pilcrow, Quote,
  RectangleHorizontal, SquareCode, SquareDashed, Table2, TriangleAlert, Video, type LucideIcon,
} from "lucide-react";
import { pluginBlockInfo } from "./blocks";
import type { EditorLabels } from "./labels";
import { UNKNOWN_BLOCK } from "./unknown";

export interface BlockInfo { title: string; icon: LucideIcon; description?: string }

/** Tên + biểu tượng của một loại khối (lõi hoặc plugin) — dùng chung cho trình chèn, cây khối, tab "Khối". */
export function blockInfo(type: string, t: EditorLabels): BlockInfo {
  const core: Record<string, BlockInfo> = {
    paragraph: { title: t.paragraph, icon: Pilcrow, description: t.paragraphHint },
    heading: { title: t.heading, icon: Heading },
    bulletList: { title: t.bulletList, icon: List },
    orderedList: { title: t.orderedList, icon: ListOrdered },
    taskList: { title: t.taskList, icon: CheckSquare },
    blockquote: { title: t.quote, icon: Quote },
    codeBlock: { title: t.codeBlock, icon: SquareCode },
    horizontalRule: { title: t.hr, icon: Minus, description: t.hrHint },
    image: { title: t.image, icon: ImageIcon },
    gallery: { title: t.gallery, icon: Images, description: t.galleryHint },
    video: { title: t.video, icon: Video },
    audio: { title: t.audio, icon: Music },
    file: { title: t.file, icon: FileText, description: t.fileHint },
    table: { title: t.table, icon: Table2 },
    youtube: { title: t.youtube, icon: Video },
    columns: { title: t.columnsBlock, icon: Columns3, description: t.columnsHint },
    column: { title: t.column, icon: Columns2 },
    group: { title: t.group, icon: SquareDashed, description: t.groupHint },
    callout: { title: t.callout, icon: Info, description: t.calloutHint },
    button: { title: t.button, icon: RectangleHorizontal, description: t.buttonHint },
    embed: { title: t.embed, icon: Globe, description: t.embedHint },
    preformatted: { title: t.preformattedBlock, icon: SquareCode },
    [UNKNOWN_BLOCK]: { title: t.unknownBlock, icon: TriangleAlert },
  };
  if (core[type]) return core[type];
  const plugin = pluginBlockInfo(type);
  if (plugin) return { title: plugin.title, icon: plugin.icon, description: plugin.description };
  return { title: type, icon: Braces };
}
