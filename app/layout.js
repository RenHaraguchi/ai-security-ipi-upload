import "./globals.css";

export const metadata = {
  title: "Mediascope ｜ 記事要約ワークスペース",
  description: "取り込んだ記事ファイルをAIで要約する社内向けツール",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
