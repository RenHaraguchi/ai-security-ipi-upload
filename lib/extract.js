// HTML から「本文テキスト」を取り出す軽量関数（依存なし・サーバ/クライアント両用）。
//
// 重要な設計意図:
//   display:none や 1px の白文字など「人間には見えない要素」のテキストも、
//   ここではタグを外すだけなので、そのまま結果テキストに残る。
//   これは “Webページを要約するAIが、画面に見えない文字まで読み込んでしまう”
//   という現実の脆弱性（間接プロンプトインジェクションの入口）をそのまま再現している。
//   アプリ側で罠を検出・除去しないのがこのデモの肝（やらせにしない）。

const NAMED_ENTITIES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&nbsp;": " ",
  "&hellip;": "…",
  "&mdash;": "—",
};

function decodeEntities(input) {
  return input
    .replace(/&#(\d+);/g, (_, n) => safeFromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => safeFromCodePoint(parseInt(n, 16)))
    .replace(/&[a-z]+;/gi, (m) => NAMED_ENTITIES[m.toLowerCase()] ?? m);
}

function safeFromCodePoint(code) {
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

export function htmlToText(html) {
  if (typeof html !== "string") return "";
  let text = html;

  // script / style の中身は本文ではないので丸ごと除去
  text = text.replace(/<script[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, " ");
  // <head> ブロックは本文でないため除去（title などのノイズを避ける）
  text = text.replace(/<head[\s\S]*?<\/head>/gi, " ");
  // HTML コメントは画面に出ない。一般的なテキスト抽出に合わせて除去
  text = text.replace(/<!--[\s\S]*?-->/g, " ");

  // ブロック要素の終端を改行に（段落の区切りを保つ）
  text = text.replace(
    /<\/(p|div|h[1-6]|li|tr|section|article|header|footer|blockquote)>/gi,
    "\n",
  );
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // 残りのタグをすべて除去（＝display:none 等の中身テキストはここで「残る」）
  text = text.replace(/<[^>]+>/g, " ");

  text = decodeEntities(text);

  // 空白の整形
  text = text
    .replace(/\r/g, "")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}
