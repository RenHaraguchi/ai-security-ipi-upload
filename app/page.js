"use client";

import { useRef, useState } from "react";

const TODAY = "2026年6月7日";

// 配布用サンプル記事（public/sample-articles/ に配置）。
// 講師が事前配布する想定。受講生は中身を知らずにアップロードする＝被害者役。
const SAMPLES = [
  { file: "clean-ev.html", label: "EV販売の記事" },
  { file: "trapped-clinic.html", label: "AI問診クリニックの記事" },
  { file: "trapped-delivery.html", label: "宅配の偽メール注意の記事" },
  { file: "trapped-utility.html", label: "電気料金値上げの記事" },
  { file: "trapped-bank.html", label: "ネット銀行の不正送金の記事" },
  { file: "trapped-jobscam.html", label: "SNS副業詐欺の記事" },
];

const MAX_FILE_BYTES = 200 * 1024; // 200KB まで

// アップロードされたHTMLを「その場で」解析し、人間に見えない要素を洗い出す。
// これは要約フローとは独立した教育用の事後解析。
// アプリは事前にどれが罠かを知らない（DOMParserで毎回ゼロから調べる）。
function findHiddenContent(html) {
  const found = [];
  if (typeof window === "undefined" || !html) return found;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const root = doc.body || doc.documentElement;

    const seen = new Set();
    const push = (reason, text) => {
      const t = (text || "").replace(/\s+/g, " ").trim();
      if (!t || seen.has(reason + t)) return;
      seen.add(reason + t);
      found.push({ reason, text: t });
    };

    const els = root ? root.querySelectorAll("*") : [];
    els.forEach((el) => {
      const style = (el.getAttribute("style") || "").toLowerCase();
      const text = el.textContent || "";
      if (!text.trim()) return;

      if (/display\s*:\s*none/.test(style)) {
        push("display:none（画面に表示されない）", text);
      } else if (/visibility\s*:\s*hidden/.test(style)) {
        push("visibility:hidden（不可視）", text);
      } else if (/opacity\s*:\s*0(\D|$)/.test(style)) {
        push("opacity:0（完全に透明）", text);
      } else if (/font-size\s*:\s*(0|0px|0\.\d+px|1px)/.test(style)) {
        push("極小フォント（font-size ほぼ0で読めない）", text);
      } else if (
        /color\s*:\s*(#fff(fff)?|white|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))/.test(
          style,
        )
      ) {
        push("白文字（背景と同色で見えない）", text);
      } else if (
        /(left|top)\s*:\s*-\d{3,}px/.test(style) ||
        /text-indent\s*:\s*-\d{3,}px/.test(style)
      ) {
        push("画面外へ配置（見えない位置に追いやる）", text);
      } else if (el.hasAttribute("hidden")) {
        push("hidden属性（非表示）", text);
      }
    });

    // HTMLコメント（画面には絶対出ないテキスト）も拾う
    const walker = doc.createTreeWalker(
      doc.documentElement || doc,
      NodeFilter.SHOW_COMMENT,
    );
    let node;
    while ((node = walker.nextNode())) {
      push("HTMLコメント（画面に表示されない注記）", node.nodeValue || "");
    }
  } catch {
    /* 解析失敗時は何も返さない */
  }
  return found;
}

export default function Home() {
  const [fileName, setFileName] = useState("");
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [showReveal, setShowReveal] = useState(false);
  const [hidden, setHidden] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  function loadFile(file) {
    if (!file) return;
    if (!/\.html?$/i.test(file.name)) {
      setError("HTMLファイル（.html）を選んでください。");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("ファイルが大きすぎます（200KBまで）。");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setHtml(String(reader.result || ""));
      setFileName(file.name);
      setResult(null);
      setError("");
      setShowReveal(false);
      setHidden(null);
    };
    reader.onerror = () => setError("ファイルの読み込みに失敗しました。");
    reader.readAsText(file);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    loadFile(e.dataTransfer?.files?.[0]);
  }

  async function runSummary() {
    setLoading(true);
    setError("");
    setResult(null);
    setShowReveal(false);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ html }),
      });
      const data = await res.json();
      if (!res.ok) setError(data?.error || "要約に失敗しました。");
      else setResult(data);
    } catch {
      setError("通信に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  function toggleReveal() {
    if (hidden === null) setHidden(findHiddenContent(html));
    setShowReveal((v) => !v);
  }

  function reset() {
    setHtml("");
    setFileName("");
    setResult(null);
    setError("");
    setShowReveal(false);
    setHidden(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <>
      <header className="masthead">
        <div className="masthead-inner">
          <div className="brand">
            <span className="mark">M</span>
            <span>
              <span className="name">Mediascope</span>{" "}
              <span className="sub">記事要約ワークスペース</span>
            </span>
          </div>
          <div className="masthead-meta">
            {TODAY}
            <br />
            取り込み元：ローカルファイル
          </div>
        </div>
      </header>

      <main className="container">
        <div className="section-label">
          <h1>記事を取り込んで要約</h1>
          <span className="rule" />
        </div>
        <p className="lead-note">
          手元の記事ファイル（HTML）を読み込ませると、AIが本文を要約します。
          長い記事の下読みや、共有された資料の概要把握にお使いください。
        </p>

        {!html && (
          <div className="panel">
            <div
              className={`dropzone${dragOver ? " over" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <div className="dz-icon" aria-hidden>
                ⬆
              </div>
              <div className="dz-main">記事ファイルをここにドラッグ＆ドロップ</div>
              <div className="dz-sub">またはクリックして選択（.html）</div>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".html,.htm,text/html"
              onChange={(e) => loadFile(e.target.files?.[0])}
              style={{ display: "none" }}
            />

            <div className="sample-links">
              <span className="sample-title">デモ用サンプル記事</span>
              <div className="sample-row">
                {SAMPLES.map((s) => (
                  <a
                    key={s.file}
                    className="sample-link"
                    href={`/sample-articles/${s.file}`}
                    download
                  >
                    {s.label}
                  </a>
                ))}
              </div>
              <span className="sample-hint">
                ダウンロードして、上のエリアに読み込ませてください。
              </span>
            </div>

            {error && <div className="inline-error">{error}</div>}
          </div>
        )}

        {html && (
          <div className="panel">
            <div className="panel-head">
              <span className="filechip">
                <span className="filechip-dot" aria-hidden />
                {fileName || "uploaded.html"}
              </span>
              <button className="link-btn" onClick={reset}>
                別の記事を選ぶ
              </button>
            </div>

            <div className="preview-wrap">
              <div className="preview-label">記事プレビュー</div>
              {/* sandbox="" で scripts も same-origin も無効化（アップロードHTMLを安全に表示）。
                  CSSは効くため display:none などの罠は画面に出ない＝人間には見えない。 */}
              <iframe
                className="preview-frame"
                sandbox=""
                srcDoc={html}
                title="記事プレビュー"
              />
            </div>

            <div className="summary-bar">
              <div className="summary-actions">
                <button className="btn" onClick={runSummary} disabled={loading}>
                  {loading && <span className="spinner" />}
                  {loading ? "要約中…" : "この記事をAIで要約"}
                </button>
                <span className="hint">
                  読み込んだ記事をAIが読み取り、要約します
                </span>
              </div>

              {error && (
                <div className="summary-out" style={{ marginTop: 16 }}>
                  <div className="out-text">{error}</div>
                </div>
              )}

              {result && (
                <div className="summary-out">
                  <div className="out-label">
                    AIによる要約
                    {result.mode && (
                      <span className="mode-badge">
                        {result.mode === "live" ? "LIVE" : "DEMO"}
                      </span>
                    )}
                  </div>
                  <div className="out-text">{result.summary}</div>

                  <div style={{ marginTop: 14 }}>
                    <button className="btn btn-ghost" onClick={toggleReveal}>
                      {showReveal
                        ? "種明かしを閉じる"
                        : "種明かし（この記事に隠し命令はある？）"}
                    </button>
                  </div>

                  {showReveal && (
                    <div className="reveal">
                      {hidden && hidden.length > 0 ? (
                        <>
                          <h3>この記事に隠されていた、画面に見えない文章</h3>
                          <ul className="hidden-list">
                            {hidden.map((h, i) => (
                              <li key={i}>
                                <span className="hidden-reason">{h.reason}</span>
                                <pre>{h.text}</pre>
                              </li>
                            ))}
                          </ul>
                          <p className="method">
                            あなたは「要約して」と頼んだだけ。だが記事に紛れて画面に出ない
                            上の文章をAIが指示として読み取り、要約に従ってしまった。
                            これが間接プロンプトインジェクション（IPI）。
                            上の要約に、頼んでいない案内文やリンクが紛れていないか見比べてください。
                          </p>
                        </>
                      ) : (
                        <>
                          <h3>隠し命令は見つかりませんでした</h3>
                          <p className="method">
                            この記事には画面に出ない仕込みは無さそうです。
                            アプリは事前に「どれが罠か」を知りません。
                            アップロードされた記事をその場で解析した結果です。
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <div className="footer-note">
        ※ 本ツールはデモ用です。読み込んだファイルはサーバに保存しません。
      </div>
    </>
  );
}
