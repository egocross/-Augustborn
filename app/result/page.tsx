import Link from 'next/link';

export default function ResultPage() {
  return (
    <main className="site-shell direct-result">
      <p className="eyebrow">探索报告</p>
      <h1>报告仅在当前页面中保留</h1>
      <p>
        为保护隐私，出生信息和报告不会写入网址、Cookie 或浏览器存储。刷新页面或直接打开此链接后，请重新填写信息以生成报告。
      </p>
      <Link className="primary-button" href="/">
        重新开始
      </Link>
    </main>
  );
}

