import assert from "node:assert/strict";
import { test } from "node:test";
import { Pilcrow } from "lucide-react";
import { rankItems } from "../src/rank";

const item = (key: string, title: string, keywords = "") => ({ key, title, hint: "", icon: Pilcrow, keywords, run() {} });
const list = [item("p", "Đoạn văn", "doan van"), item("ul", "Danh sách", "danh sach list"), item("image", "Ảnh"), item("preformatted", "Văn bản định dạng sẵn", "pre")];

test("slash: tên bắt đầu > từ trong tên > từ khoá; không khớp giữa từ", () => {
  assert.deepEqual(rankItems(list, "anh").map((i) => i.key), ["image"]);
  assert.deepEqual(rankItems(list, "van").map((i) => i.key), ["preformatted", "p"]);
});

test("slash: nhiều từ, mỗi từ khớp đầu một từ của tên / từ khoá", () => {
  assert.deepEqual(rankItems(list, "dinh dang").map((i) => i.key), ["preformatted"]);
  assert.deepEqual(rankItems(list, "dinh xyz").map((i) => i.key), []);
});
