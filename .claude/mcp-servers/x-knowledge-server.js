#!/usr/bin/env node

/**
 * X Knowledge MCP Server
 *
 * X運用ナレッジベースを管理するMCPサーバー
 *
 * 提供ツール:
 * - x_knowledge__add - ナレッジ追加
 * - x_knowledge__search - セマンティック検索
 * - x_knowledge__list - 一覧取得
 * - x_knowledge__get - 詳細取得
 * - x_knowledge__delete - 削除
 * - x_knowledge__generate_post - 投稿生成
 * - x_knowledge__sync - インデックス同期
 * - x_knowledge__stats - 統計取得
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, writeFileSync, existsSync, copyFileSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, basename, extname } from 'path';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';

// Configuration
const KNOWLEDGE_PATH = process.env.KNOWLEDGE_PATH || './knowledge';
const INDEX_FILE = join(KNOWLEDGE_PATH, 'index.json');

// Categories
const CATEGORIES = [
  'marketing',
  'engagement',
  'content-strategy',
  'analytics',
  'case-studies',
  'trends',
  'best-practices',
  'tools',
  'other',
];

const server = new Server(
  {
    name: 'x-knowledge',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Load knowledge index
 */
function loadIndex() {
  if (!existsSync(INDEX_FILE)) {
    return {
      version: '1.0.0',
      lastUpdated: '',
      totalItems: 0,
      items: [],
      config: {
        embedding: {
          provider: 'openai',
          model: 'text-embedding-3-small',
          dimension: 1536,
        },
        chunking: {
          strategy: 'recursive',
          maxChunkSize: 500,
          overlap: 50,
        },
        search: {
          defaultLimit: 5,
          minSimilarity: 0.7,
        },
      },
      categories: CATEGORIES,
    };
  }

  try {
    return JSON.parse(readFileSync(INDEX_FILE, 'utf-8'));
  } catch (error) {
    console.error('Error loading index:', error);
    return null;
  }
}

/**
 * Save knowledge index
 */
function saveIndex(index) {
  index.lastUpdated = new Date().toISOString();
  index.totalItems = index.items.length;

  // Ensure directory exists
  const dir = join(KNOWLEDGE_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
}

/**
 * Calculate file hash
 */
function calculateHash(filePath) {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Get file type from extension
 */
function getFileType(ext) {
  const typeMap = {
    '.pdf': 'pdf',
    '.xlsx': 'excel',
    '.xls': 'excel',
    '.csv': 'csv',
    '.md': 'markdown',
    '.txt': 'text',
  };
  return typeMap[ext.toLowerCase()] || 'text';
}

/**
 * Read text content from file (basic implementation)
 */
function readTextContent(filePath) {
  const ext = extname(filePath).toLowerCase();

  // For now, only support text-based files directly
  // PDF/Excel parsing would require additional libraries
  if (['.md', '.txt'].includes(ext)) {
    return readFileSync(filePath, 'utf-8');
  }

  // For other formats, return a placeholder message
  return `[このファイル形式(${ext})のテキスト抽出には追加のライブラリが必要です。pdf-parse, xlsx等をインストールしてください。]`;
}

/**
 * Simple text chunking
 */
function chunkText(text, maxSize = 500, overlap = 50) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxSize, text.length);
    chunks.push({
      content: text.slice(start, end),
      startOffset: start,
      endOffset: end,
    });
    start = end - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'x_knowledge__add',
        description: 'ナレッジアイテムをナレッジベースに追加します。ファイルを解析し、チャンク化・インデックス登録を行います。',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'ファイルパス',
            },
            title: {
              type: 'string',
              description: 'ナレッジのタイトル',
            },
            category: {
              type: 'string',
              enum: CATEGORIES,
              description: 'カテゴリ',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'タグ（配列）',
            },
            description: {
              type: 'string',
              description: '説明',
            },
            postTypes: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['thread', 'single', 'quote', 'tips'],
              },
              description: '適した投稿タイプ',
            },
          },
          required: ['filePath', 'title', 'category'],
        },
      },
      {
        name: 'x_knowledge__search',
        description: 'ナレッジベースをキーワード検索します。（セマンティック検索にはOpenAI APIキーが必要）',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '検索クエリ',
            },
            category: {
              type: 'string',
              enum: CATEGORIES,
              description: 'カテゴリフィルター',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'タグフィルター',
            },
            limit: {
              type: 'number',
              description: '結果数上限',
              default: 5,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'x_knowledge__list',
        description: 'ナレッジ一覧を取得します。',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: CATEGORIES,
              description: 'カテゴリフィルター',
            },
            status: {
              type: 'string',
              enum: ['all', 'pending', 'completed', 'error'],
              description: 'ステータスフィルター',
              default: 'all',
            },
            sortBy: {
              type: 'string',
              enum: ['createdAt', 'updatedAt', 'usage'],
              description: 'ソート順',
              default: 'createdAt',
            },
          },
        },
      },
      {
        name: 'x_knowledge__get',
        description: '特定のナレッジの詳細を取得します。',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ナレッジID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'x_knowledge__delete',
        description: 'ナレッジを削除します。',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ナレッジID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'x_knowledge__generate_post',
        description: 'ナレッジを元にX投稿案を生成します。（この機能はClaude APIを使用するため、Claude Code経由で呼び出してください）',
        inputSchema: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              description: '投稿トピック',
            },
            style: {
              type: 'string',
              enum: ['professional', 'casual', 'educational'],
              description: 'スタイル',
              default: 'professional',
            },
            format: {
              type: 'string',
              enum: ['single', 'thread', 'quote', 'tips'],
              description: 'フォーマット',
              default: 'single',
            },
            count: {
              type: 'number',
              description: '生成数',
              default: 3,
            },
            knowledgeIds: {
              type: 'array',
              items: { type: 'string' },
              description: '参照するナレッジID',
            },
          },
          required: ['topic'],
        },
      },
      {
        name: 'x_knowledge__sync',
        description: 'ナレッジインデックスを同期・更新します。rawディレクトリをスキャンして変更を検出します。',
        inputSchema: {
          type: 'object',
          properties: {
            force: {
              type: 'boolean',
              description: '強制的に全て再処理',
              default: false,
            },
          },
        },
      },
      {
        name: 'x_knowledge__stats',
        description: 'ナレッジベースの統計情報を取得します。',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'x_knowledge__add': {
        const { filePath, title, category, tags = [], description = '', postTypes = ['single'] } = args;

        // Validate file exists
        if (!existsSync(filePath)) {
          return {
            content: [{ type: 'text', text: `❌ ファイルが見つかりません: ${filePath}` }],
            isError: true,
          };
        }

        const index = loadIndex();
        if (!index) {
          return {
            content: [{ type: 'text', text: '❌ インデックスの読み込みに失敗しました' }],
            isError: true,
          };
        }

        // Check for duplicates
        const hash = calculateHash(filePath);
        const existing = index.items.find((item) => item.source.hash === hash);
        if (existing) {
          return {
            content: [{ type: 'text', text: `⚠️ 同じファイルが既に登録されています: ${existing.title} (ID: ${existing.id})` }],
          };
        }

        // Get file info
        const stat = statSync(filePath);
        const ext = extname(filePath);
        const fileType = getFileType(ext);

        // Create raw directory if not exists
        const rawDir = join(KNOWLEDGE_PATH, 'raw', fileType === 'excel' || fileType === 'csv' ? 'excel' : fileType === 'pdf' ? 'pdf' : 'docs');
        if (!existsSync(rawDir)) {
          mkdirSync(rawDir, { recursive: true });
        }

        // Copy file to raw directory
        const destPath = join(rawDir, basename(filePath));
        copyFileSync(filePath, destPath);

        // Read and chunk content
        const content = readTextContent(filePath);
        const chunks = chunkText(content);

        // Save chunks
        const chunksDir = join(KNOWLEDGE_PATH, 'processed', 'chunks');
        if (!existsSync(chunksDir)) {
          mkdirSync(chunksDir, { recursive: true });
        }

        const id = randomUUID();
        const chunkFile = join(chunksDir, `${id}.json`);
        writeFileSync(
          chunkFile,
          JSON.stringify(
            {
              sourceId: id,
              chunks: chunks.map((c, i) => ({
                id: `${id}-${i}`,
                index: i,
                ...c,
              })),
            },
            null,
            2
          )
        );

        // Create knowledge item
        const item = {
          id,
          slug: title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          source: {
            type: fileType,
            path: destPath.replace(KNOWLEDGE_PATH + '/', ''),
            originalName: basename(filePath),
            size: stat.size,
            hash,
          },
          title,
          description,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          category,
          tags,
          xRelevance: {
            postTypes,
            suggestedTopics: tags,
            engagementPotential: 'medium',
          },
          processing: {
            status: 'completed',
            chunked: true,
            embedded: false,
            chunkCount: chunks.length,
          },
          usage: {
            timesReferenced: 0,
            generatedPostsCount: 0,
          },
        };

        index.items.push(item);
        saveIndex(index);

        return {
          content: [
            {
              type: 'text',
              text: `✅ ナレッジを追加しました

ID: ${id}
タイトル: ${title}
カテゴリ: ${category}
タグ: ${tags.join(', ') || 'なし'}
チャンク数: ${chunks.length}
ファイル: ${destPath}`,
            },
          ],
        };
      }

      case 'x_knowledge__search': {
        const { query, category, tags = [], limit = 5 } = args;

        const index = loadIndex();
        if (!index) {
          return {
            content: [{ type: 'text', text: '❌ インデックスの読み込みに失敗しました' }],
            isError: true,
          };
        }

        // Filter items
        let results = index.items;

        if (category) {
          results = results.filter((item) => item.category === category);
        }

        if (tags.length > 0) {
          results = results.filter((item) => tags.some((tag) => item.tags.includes(tag)));
        }

        // Simple keyword search (for semantic search, OpenAI API would be needed)
        const queryLower = query.toLowerCase();
        results = results
          .map((item) => {
            let score = 0;
            if (item.title.toLowerCase().includes(queryLower)) score += 2;
            if (item.description.toLowerCase().includes(queryLower)) score += 1;
            if (item.tags.some((t) => t.toLowerCase().includes(queryLower))) score += 1;
            return { ...item, score };
          })
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);

        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `🔍 検索結果: "${query}"

結果が見つかりませんでした。

ヒント:
- 別のキーワードで検索してみてください
- カテゴリフィルターを外してみてください`,
              },
            ],
          };
        }

        const resultText = results
          .map(
            (item, i) => `${i + 1}. ${item.title}
   カテゴリ: ${item.category} | タグ: ${item.tags.map((t) => '#' + t).join(' ') || 'なし'}
   ID: ${item.id}`
          )
          .join('\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `🔍 検索結果: "${query}"

${resultText}

※ セマンティック検索にはOpenAI APIキーの設定が必要です`,
            },
          ],
        };
      }

      case 'x_knowledge__list': {
        const { category, status = 'all', sortBy = 'createdAt' } = args;

        const index = loadIndex();
        if (!index) {
          return {
            content: [{ type: 'text', text: '❌ インデックスの読み込みに失敗しました' }],
            isError: true,
          };
        }

        let items = index.items;

        // Filter by category
        if (category) {
          items = items.filter((item) => item.category === category);
        }

        // Filter by status
        if (status !== 'all') {
          items = items.filter((item) => item.processing.status === status);
        }

        // Sort
        items.sort((a, b) => {
          if (sortBy === 'usage') {
            return b.usage.timesReferenced - a.usage.timesReferenced;
          }
          return new Date(b[sortBy]) - new Date(a[sortBy]);
        });

        if (items.length === 0) {
          return {
            content: [{ type: 'text', text: '📚 ナレッジ一覧\n\nナレッジが登録されていません。\n\n/x-knowledge-add でナレッジを追加してください。' }],
          };
        }

        const listText = items
          .map(
            (item, i) => `${i + 1}. ${item.title}
   カテゴリ: ${item.category} | 参照回数: ${item.usage.timesReferenced}
   ID: ${item.id}`
          )
          .join('\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `📚 ナレッジ一覧 (${items.length}件)

${listText}`,
            },
          ],
        };
      }

      case 'x_knowledge__get': {
        const { id } = args;

        const index = loadIndex();
        if (!index) {
          return {
            content: [{ type: 'text', text: '❌ インデックスの読み込みに失敗しました' }],
            isError: true,
          };
        }

        const item = index.items.find((i) => i.id === id);
        if (!item) {
          return {
            content: [{ type: 'text', text: `❌ ナレッジが見つかりません: ${id}` }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `📄 ナレッジ詳細

ID: ${item.id}
タイトル: ${item.title}
説明: ${item.description || 'なし'}

カテゴリ: ${item.category}
タグ: ${item.tags.join(', ') || 'なし'}

ファイル情報:
- 形式: ${item.source.type}
- パス: ${item.source.path}
- サイズ: ${(item.source.size / 1024).toFixed(1)} KB

処理状態:
- ステータス: ${item.processing.status}
- チャンク数: ${item.processing.chunkCount || 0}
- 埋め込み: ${item.processing.embedded ? 'あり' : 'なし'}

X関連性:
- 投稿タイプ: ${item.xRelevance.postTypes.join(', ')}
- エンゲージメント予測: ${item.xRelevance.engagementPotential}

利用状況:
- 参照回数: ${item.usage.timesReferenced}
- 生成投稿数: ${item.usage.generatedPostsCount}

作成日: ${item.createdAt}
更新日: ${item.updatedAt}`,
            },
          ],
        };
      }

      case 'x_knowledge__delete': {
        const { id } = args;

        const index = loadIndex();
        if (!index) {
          return {
            content: [{ type: 'text', text: '❌ インデックスの読み込みに失敗しました' }],
            isError: true,
          };
        }

        const itemIndex = index.items.findIndex((i) => i.id === id);
        if (itemIndex === -1) {
          return {
            content: [{ type: 'text', text: `❌ ナレッジが見つかりません: ${id}` }],
            isError: true,
          };
        }

        const item = index.items[itemIndex];
        index.items.splice(itemIndex, 1);
        saveIndex(index);

        return {
          content: [
            {
              type: 'text',
              text: `🗑️ ナレッジを削除しました

ID: ${id}
タイトル: ${item.title}

※ rawファイルは残っています。必要に応じて手動で削除してください。`,
            },
          ],
        };
      }

      case 'x_knowledge__generate_post': {
        const { topic, style = 'professional', format = 'single', count = 3, knowledgeIds } = args;

        const index = loadIndex();
        if (!index) {
          return {
            content: [{ type: 'text', text: '❌ インデックスの読み込みに失敗しました' }],
            isError: true,
          };
        }

        // Get relevant knowledge
        let relevantItems = [];
        if (knowledgeIds && knowledgeIds.length > 0) {
          relevantItems = index.items.filter((i) => knowledgeIds.includes(i.id));
        } else {
          // Simple keyword matching
          const topicLower = topic.toLowerCase();
          relevantItems = index.items
            .filter((item) => {
              return (
                item.title.toLowerCase().includes(topicLower) ||
                item.tags.some((t) => t.toLowerCase().includes(topicLower))
              );
            })
            .slice(0, 3);
        }

        // Return context for Claude to generate posts
        const context = relevantItems.length > 0
          ? relevantItems.map((item) => `【${item.title}】\nカテゴリ: ${item.category}\nタグ: ${item.tags.join(', ')}`).join('\n\n')
          : 'ナレッジベースに関連情報が見つかりませんでした。';

        return {
          content: [
            {
              type: 'text',
              text: `📝 投稿生成リクエスト

トピック: ${topic}
スタイル: ${style}
フォーマット: ${format}
生成数: ${count}

参照ナレッジ:
${context}

---

⚠️ 投稿の実際の生成はClaude APIを通じて行われます。
Claude Codeで以下のプロンプトを使用して生成してください:

「${topic}」について、${style === 'professional' ? 'プロフェッショナルな' : style === 'casual' ? 'カジュアルな' : '教育的な'}トーンで、${format === 'single' ? '単独投稿' : format === 'thread' ? 'スレッド形式' : format === 'tips' ? 'Tips形式' : '引用形式'}のX投稿を${count}案生成してください。

文字数は140-280文字で、ハッシュタグを2-3個含めてください。`,
            },
          ],
        };
      }

      case 'x_knowledge__sync': {
        const { force = false } = args;

        const index = loadIndex();
        if (!index) {
          return {
            content: [{ type: 'text', text: '❌ インデックスの読み込みに失敗しました' }],
            isError: true,
          };
        }

        // Scan raw directory
        const rawDir = join(KNOWLEDGE_PATH, 'raw');
        if (!existsSync(rawDir)) {
          return {
            content: [{ type: 'text', text: '📁 rawディレクトリが存在しません。ナレッジを追加してください。' }],
          };
        }

        let newFiles = 0;
        let updatedFiles = 0;
        let deletedItems = 0;

        // Check for new/updated files
        const scanDir = (dir) => {
          if (!existsSync(dir)) return;
          const files = readdirSync(dir);
          for (const file of files) {
            const filePath = join(dir, file);
            const stat = statSync(filePath);
            if (stat.isDirectory()) {
              scanDir(filePath);
            } else if (file !== '.gitkeep') {
              const hash = calculateHash(filePath);
              const existing = index.items.find((i) => i.source.hash === hash);
              if (!existing) {
                newFiles++;
              }
            }
          }
        };

        scanDir(rawDir);

        // Check for deleted files
        const toDelete = [];
        for (const item of index.items) {
          const fullPath = join(KNOWLEDGE_PATH, item.source.path);
          if (!existsSync(fullPath)) {
            toDelete.push(item.id);
            deletedItems++;
          }
        }

        // Remove deleted items
        if (toDelete.length > 0) {
          index.items = index.items.filter((i) => !toDelete.includes(i.id));
          saveIndex(index);
        }

        return {
          content: [
            {
              type: 'text',
              text: `🔄 インデックス同期完了

新規ファイル検出: ${newFiles}件
更新ファイル: ${updatedFiles}件
削除アイテム: ${deletedItems}件

※ 新規ファイルは /x-knowledge-add で個別に追加してください。`,
            },
          ],
        };
      }

      case 'x_knowledge__stats': {
        const index = loadIndex();
        if (!index) {
          return {
            content: [{ type: 'text', text: '❌ インデックスの読み込みに失敗しました' }],
            isError: true,
          };
        }

        // Calculate stats
        const totalItems = index.items.length;
        const categoryStats = {};
        let totalChunks = 0;
        let totalReferences = 0;
        let totalGeneratedPosts = 0;

        for (const item of index.items) {
          categoryStats[item.category] = (categoryStats[item.category] || 0) + 1;
          totalChunks += item.processing.chunkCount || 0;
          totalReferences += item.usage.timesReferenced;
          totalGeneratedPosts += item.usage.generatedPostsCount;
        }

        const categoryText = Object.entries(categoryStats)
          .map(([cat, count]) => `  - ${cat}: ${count}件`)
          .join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `📊 ナレッジベース統計

総ナレッジ数: ${totalItems}件
総チャンク数: ${totalChunks}

カテゴリ別:
${categoryText || '  (なし)'}

利用統計:
  - 総参照回数: ${totalReferences}
  - 生成投稿数: ${totalGeneratedPosts}

設定:
  - 埋め込みモデル: ${index.config.embedding.model}
  - チャンクサイズ: ${index.config.chunking.maxChunkSize}文字
  - オーバーラップ: ${index.config.chunking.overlap}文字

最終更新: ${index.lastUpdated || '未更新'}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ エラーが発生しました\n\n${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('X Knowledge MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
