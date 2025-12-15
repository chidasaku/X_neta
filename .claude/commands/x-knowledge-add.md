---
description: X運用ナレッジを追加・登録
---

# X Knowledge Add - ナレッジ追加コマンド

X運用に関する資料をナレッジベースに追加します。

## 実行フロー

### Step 1: ファイル確認

ユーザーが指定したファイルパスを確認:

```
対象ファイル: [ファイルパス]
形式: [PDF/Excel/CSV/Markdown/テキスト]
サイズ: [ファイルサイズ]
```

### Step 2: メタデータ入力

以下の情報を対話的に収集:

1. **タイトル**: ナレッジの名称
2. **カテゴリ**: 以下から選択
   - marketing (マーケティング)
   - engagement (エンゲージメント)
   - content-strategy (コンテンツ戦略)
   - analytics (分析・KPI)
   - case-studies (成功事例)
   - trends (トレンド)
   - best-practices (ベストプラクティス)
   - tools (ツール)
   - other (その他)
3. **タグ**: 関連キーワード（カンマ区切り）
4. **説明**: 内容の簡単な説明

### Step 3: 処理実行

1. ファイルを `knowledge/raw/` にコピー
2. テキスト抽出
3. チャンク化（500文字、50オーバーラップ）
4. OpenAI埋め込み生成
5. `index.json` 更新

### Step 4: 完了確認

```
✅ ナレッジを追加しました

ID: [UUID]
タイトル: [タイトル]
カテゴリ: [カテゴリ]
チャンク数: [N]
埋め込み: 完了
```

## 対応形式

| 形式 | 拡張子 | 備考 |
|------|--------|------|
| PDF | .pdf | テキスト抽出 |
| Excel | .xlsx, .xls | 全シート処理 |
| CSV | .csv | UTF-8推奨 |
| Markdown | .md | そのまま処理 |
| テキスト | .txt | そのまま処理 |

## 使用例

```
/x-knowledge-add ./docs/x-marketing-guide.pdf
```

## 注意事項

- OpenAI APIキーが必要です（OPENAI_API_KEY）
- 大きなファイルは処理に時間がかかる場合があります
- 機密情報を含むファイルは注意して追加してください
