# X_neta Knowledge Base

X運用ナレッジを管理するためのディレクトリです。

## ディレクトリ構造

```
knowledge/
├── raw/                    # オリジナル資料
│   ├── pdf/               # PDFファイル
│   ├── excel/             # Excel/CSVファイル
│   └── docs/              # Markdown/テキストファイル
├── processed/              # 処理済みデータ
│   ├── chunks/            # チャンク化されたテキスト
│   └── embeddings/        # ベクトル埋め込み
├── templates/              # 投稿テンプレート
│   ├── formats/           # フォーマット定義
│   └── styles/            # スタイル定義
├── categories/             # カテゴリ別整理
├── history/                # 生成履歴
│   └── generated-posts/   # 生成した投稿
└── index.json             # メタデータインデックス
```

## 使用方法

### ナレッジの追加

```
/x-knowledge-add [ファイルパス]
```

対応形式: PDF, Excel, CSV, Markdown, テキスト

### ナレッジの検索

```
/x-knowledge-search [検索クエリ]
```

セマンティック検索でナレッジを検索します。

### 投稿の生成

```
/x-generate-post [トピック]
```

ナレッジを元にX投稿案を生成します。

## カテゴリ

- `marketing` - マーケティング知識
- `engagement` - エンゲージメント戦略
- `content-strategy` - コンテンツ戦略
- `analytics` - 分析・KPI
- `case-studies` - 成功事例
- `trends` - トレンド
- `best-practices` - ベストプラクティス
- `tools` - ツール・サービス

## 注意事項

- `raw/` 配下のファイルは.gitignoreで除外されています
- 機密情報を含む資料は取り扱いに注意してください
- 埋め込み生成にはOpenAI APIキーが必要です
