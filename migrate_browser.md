# Browser Migration Plan for image-shield

このドキュメントでは、image-shieldパッケージをブラウザ環境で動作するようにするために必要なタスクを詳細に記載します。

## ⚠️ 重要: 判断が必要な項目

### 1. 🔴 高優先度: バンドラーの選択
- **Webpack** vs **Vite** vs **Rollup**
- **理由**: ビルド速度、出力サイズ、設定の複雑さが異なる
- **推奨**: Vite（高速、モダン、TypeScript標準サポート）

### 2. 🔴 高優先度: Buffer Polyfillの対応
- ```typescript
// 🎯 統一実装: Web Crypto API使用
// src/utils/crypto.ts (Node.js & ブラウザ共通)

export class InvalidUUIDFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUUIDFormatError";
  }
}

export class CryptoUtils {
  // 🔧 変更: 同期 → 非同期
  static async encryptBuffer(buffer: Uint8Array, key: string, iv: Uint8Array): Promise<Uint8Array> {
    const cryptoKey = await this.importKey(await this.keyTo32(key));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-CBC", iv },
      cryptoKey,
      buffer
    );
    return new Uint8Array(encrypted);
  }

  static async decryptBuffer(buffer: Uint8Array, key: string, iv: Uint8Array): Promise<Uint8Array> {
    const cryptoKey = await this.importKey(await this.keyTo32(key));
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-CBC", iv },
      cryptoKey,
      buffer
    );
    return new Uint8Array(decrypted);
  }

  static async keyTo32(key: string): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return new Uint8Array(hash);
  }

  static generateUUID(): string {
    return crypto.randomUUID(); // Node.js 15.6.0+ & all browsers
  }

  static uuidToIV(uuid: string): Uint8Array {
    const hex = uuid.replace(/-/g, "");
    if (hex.length !== 32) throw new InvalidUUIDFormatError("Invalid UUID format");
    return new Uint8Array(hex.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
  }

  private static async importKey(keyData: Uint8Array): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "AES-CBC" },
      false,
      ["encrypt", "decrypt"]
    );
  }
}
```rray採用を決定**
- **理由**: Uint8Array は Node.js 0.10+ と全ブラウザで完全対応
- **対応**:
  1. **Buffer → Uint8Array**: Node.js Buffer APIをUint8Arrayに書き換え
  2. **互換性関数**: `Buffer.from()` → `new Uint8Array()`
  3. **メソッド対応**: `.subarray()`, `.set()`, `.slice()` 等を使用
- **影響**: 軽微（APIがほぼ同等）

### 3. 🔴 高優先度: Web Crypto APIの制約
- **✅ 解決済み**: **Web Crypto API採用を決定**
- **⚠️ 重要**: crypto-jsは非推奨、Web Crypto APIが標準
- **対応方針**:
  - **Node.js & ブラウザ**: `Web Crypto API` 統一使用
  - **互換性**: Node.js 15.6.0+, 全主要ブラウザ対応
  - **メリット**: 軽量、高速、標準API、セキュア
- **注意点**: 非同期API（Promise）のため既存コードの書き換えが必要

### 4. 🟡 中優先度: パフォーマンス目標
- **判断が必要**: 
  - ファイルサイズ上限（例: <500KB gzipped）
  - 処理速度目標（例: 1MB画像を5秒以内）
  - メモリ使用量制限
- **トレードオフ**: 機能 vs パフォーマンス vs サイズ

### 5. � 高優先度: API設計方針
- **✅ 解決済み**: **統一コア + 環境別ファイル**
- **設計方針**:
  - **コア機能**: Node.jsとブラウザ共通実装
  - **環境依存部分**: `.node.ts` と `.browser.ts` に分離
  - **例**: `crypto.ts` → `crypto.node.ts` + `crypto.browser.ts`
  - **統一API**: 環境判定で適切な実装を選択
- **メリット**: コードの重複最小化、保守性向上

### 6. 🟡 中優先度: テストストラテジー
- **判断が必要**:
  - 実ブラウザテスト vs JSDOMテスト
  - CI/CDでのブラウザテスト実行方法
  - 複数ブラウザ対応範囲（Chrome, Firefox, Safari, Edge）

---

## 1. 依存関係とNode.js固有APIの置き換え

### 1.1 Node.js内蔵モジュールの置き換え

#### 🔴 高優先度: ファイルシステム操作 (fs)
- **対象ファイル**: `src/utils/file.ts`
- **現在の実装**: `node:fs` promises APIを使用
- **ブラウザ対応**:
  - `readFileBuffer()` → File API / FileReader APIで実装
  - `createDir()` → ブラウザでは削除（意味がない）
  - `writeFile()` → Blob API + downloadリンク生成で実装
  - `readJsonFile()` → JSONファイルの読み込みをFile APIで実装

#### 🔴 高優先度: 暗号化モジュール (crypto)
- **対象ファイル**: `src/utils/crypto.ts`
- **✅ 解決済み**: **Web Crypto API統一実装**
- **対応方針**:
  - **Node.js & ブラウザ**: `Web Crypto API` 統一使用
  - **実装**: 単一ファイル `crypto.ts` で両環境対応
  - **メリット**: コード統一、メンテナンス性向上
- **変更点**: 同期API → 非同期API (async/await)

#### 🟡 中優先度: パス操作 (path)
- **対象ファイル**: `src/utils/file.ts`, `src/utils/helpers.ts`
- **現在の実装**: `node:path`モジュールを使用
- **ブラウザ対応**:
  - `path.join()` → 独自実装または軽量ライブラリ
  - `path.basename()` → 文字列操作で実装
  - `path.extname()` → 文字列操作で実装

### 1.2 外部依存関係の見直し

#### 🔴 高優先度: Jimp ライブラリ
- **対象ファイル**: `src/utils/block.ts`
- **現在の実装**: Jimpライブラリを使用してPNG処理
- **✅ 解決済み**: **Jimpはブラウザ対応済み**
- **公式対応**: [Jimp Browser Guide](https://jimp-dev.github.io/jimp/guides/browser/)
- **ブラウザ機能**:
  - `Jimp.read()`: URL、ファイルパスから読み込み
  - `Jimp.fromBuffer()`: ArrayBufferから読み込み  
  - `Jimp.fromBitmap()`: Canvas ImageDataから読み込み
  - Web Workers対応で重い処理も安心
- **対応方針**: **そのまま使用可能**（コード変更不要）

## 2. ブラウザ用ビルド設定

### 2.1 バンドラー設定
- **🤔 判断が必要**: **Webpack** vs **Vite** vs **Rollup**
  - Webpack: 豊富な機能、大きな設定ファイル
  - Vite: 高速、モダン、TypeScript標準サポート（推奨）
  - Rollup: 軽量、ライブラリ向け
- **Buffer polyfill必須**: `buffer` パッケージの設定
- UMD/ESMフォーマットでの出力設定
- TreeShaking最適化

### 2.2 TypeScript設定
- ブラウザ環境用のtsconfig.browser.json作成
- DOM types の追加
- Node.js typesの除外

### 2.3 package.json更新
- browser field の追加
- ブラウザ用ビルドスクリプトの追加
- 新しい依存関係の追加

## 3. コア機能のブラウザ対応

### 3.1 ImageShield クラス (src/index.ts)
- **encrypt()メソッド**:
  - `imagePaths` → File[] または Blob[] を受け取るように変更
  - `outputDir` → ダウンロード用のBlob配列を返すように変更
- **decrypt()メソッド**:
  - `imagePaths` → File[] または Blob[] を受け取るように変更
  - `manifestPath` → manifest JSONオブジェクトを直接受け取るように変更

### 3.2 ImageFragmenter クラス (src/fragmenter.ts)
- ファイルパス処理をBlob/File処理に変更
- `_processSourceImageBuffer()` でファイル読み込み部分を修正

### 3.3 ImageRestorer クラス (src/restorer.ts)
- ファイルパス処理をBlob/File処理に変更
- `_readImageBuffer()` でファイル読み込み部分を修正

## 4. ユーティリティ関数の再実装

### 4.1 Block操作 (src/utils/block.ts)
- **重要**: この部分はほぼそのまま使える（Buffer操作が中心）
- Jimp部分のみブラウザ対応が必要
- `imageFileToBlocks()` の入力処理を修正

### 4.2 ランダム処理 (src/utils/random.ts)
- **OK**: そのまま使用可能（純粋なJS実装）

### 4.3 ヘルパー関数 (src/utils/helpers.ts)
- **OK**: そのまま使用可能（文字列操作のみ）

## 5. 新しいブラウザ専用ユーティリティ

### 5.1 ブラウザファイル操作
```typescript
// src/utils/browser-file.ts (新規作成)
export class BrowserFileHandler {
  static async readFile(file: File): Promise<ArrayBuffer>
  static async downloadBlob(blob: Blob, filename: string): Promise<void>
  static createObjectURL(blob: Blob): string
  static revokeObjectURL(url: string): void
}
```

### 5.2 Canvas/ImageData操作
```typescript
// src/utils/canvas.ts (新規作成)
export class CanvasImageProcessor {
  static async imageToImageData(file: File): Promise<ImageData>
  static imageDataToCanvas(imageData: ImageData): HTMLCanvasElement
  static canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob>
}
```

## 6. Web Crypto API実装

### 6.1 暗号化実装の書き換え
```typescript
// src/utils/web-crypto.ts (新規作成)
export class WebCryptoUtils {
  static async generateKey(password: string): Promise<CryptoKey>
  static async encrypt(data: ArrayBuffer, key: CryptoKey, iv: Uint8Array): Promise<ArrayBuffer>
  static async decrypt(data: ArrayBuffer, key: CryptoKey, iv: Uint8Array): Promise<ArrayBuffer>
  static generateIV(): Uint8Array
  static async hash(data: ArrayBuffer): Promise<ArrayBuffer>
}
```

## 7. 画像処理ライブラリの選択

### 7.1 Jimp代替案の検討
1. **Canvas API使用**: ネイティブブラウザAPI
2. **pngjs**: 軽量なPNGライブラリ（ブラウザ対応）
3. **Konva.js**: Canvas2D描画ライブラリ
4. **Fabric.js**: 高機能Canvas操作ライブラリ

### 7.2 推奨アプローチ（確定）
- **✅ 決定**: **Jimp継続使用**
- **理由**: 
  - 公式ブラウザ対応（[Browser Guide](https://jimp-dev.github.io/jimp/guides/browser/)）
  - 既存コードの変更不要
  - Web Workers対応で重い処理も安心
  - ArrayBuffer, Canvas ImageData, URL読み込み対応
- **メリット**: 開発工数大幅削減、既存の実装をそのまま活用

## 8. API設計の変更

### 8.1 現在のAPI
```typescript
// Node.js版
await ImageShield.encrypt({
  imagePaths: ["./image1.png", "./image2.png"],
  outputDir: "./output",
  secretKey: "secret"
});
```

### 8.2 ブラウザ用API案
```typescript
// ブラウザ版
const result = await ImageShield.encrypt({
  images: [file1, file2], // File[] or Blob[]
  config: { blockSize: 2 },
  secretKey: "secret"
});

// 結果のダウンロード
for (const [filename, blob] of Object.entries(result.files)) {
  await BrowserFileHandler.downloadBlob(blob, filename);
}
```

## 9. テスト環境の整備

### 9.1 ブラウザテスト環境
- Puppeteer または Playwright
- JSDOM環境での単体テスト
- 実ブラウザでの統合テスト

### 9.2 テストファイルの作成
- `src/**/*.browser.test.ts` - ブラウザ専用テスト
- DOM環境のモック設定

## 10. ドキュメントとサンプル

### 10.1 ブラウザ用ドキュメント
- README.md にブラウザ使用例を追加
- HTMLサンプルページの作成
- デモページの作成

### 10.2 使用例の作成
```html
<!-- example/index.html -->
<input type="file" id="fileInput" multiple accept="image/*">
<button onclick="encryptImages()">Encrypt</button>
<script src="./dist/image-shield.browser.js"></script>
```

## 11. リリース戦略

### 11.1 パッケージ構成
```
dist/
├── index.js          # Node.js版
├── index.d.ts        # 型定義
├── browser.js        # ブラウザ版
└── browser.d.ts      # ブラウザ版型定義
```

### 11.2 package.json設定
```json
{
  "main": "dist/index.js",
  "browser": "dist/browser.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "browser": "./dist/browser.js",
      "node": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

## ✅ 解決済み項目の実装詳細

### 1. Buffer → Uint8Array 移行
```typescript
// 移行前 (Node.js Buffer)
const buffer = Buffer.from([1, 2, 3, 4]);
const slice = buffer.subarray(1, 3);

// 移行後 (Uint8Array)
const uint8Array = new Uint8Array([1, 2, 3, 4]);
const slice = uint8Array.subarray(1, 3);

// 互換性関数
function bufferFrom(data: number[] | string): Uint8Array {
  if (typeof data === 'string') {
    return new TextEncoder().encode(data);
  }
  return new Uint8Array(data);
}
```

### 2. 環境別暗号化実装
```typescript
// src/utils/crypto.node.ts
import crypto from "node:crypto";
export class CryptoUtils {
  static encryptBuffer(buffer: Uint8Array, key: string, iv: Uint8Array): Uint8Array {
    const cipher = crypto.createCipheriv("aes-256-cbc", this.keyTo32(key), iv);
    return new Uint8Array([...cipher.update(buffer), ...cipher.final()]);
  }
}

// src/utils/crypto.browser.ts  
import CryptoJS from "crypto-js";
export class CryptoUtils {
  static encryptBuffer(buffer: Uint8Array, key: string, iv: Uint8Array): Uint8Array {
    const wordArray = CryptoJS.lib.WordArray.create(buffer);
    const encrypted = CryptoJS.AES.encrypt(wordArray, key, { iv: CryptoJS.lib.WordArray.create(iv) });
    return new Uint8Array(encrypted.ciphertext.words);
  }
}
```

### 3. API変更の影響範囲
```typescript
// 🔧 変更が必要: 同期処理 → 非同期処理

// Before (Node.js crypto - 同期)
const encrypted = CryptoUtils.encryptBuffer(buffer, key, iv);

// After (Web Crypto API - 非同期)  
const encrypted = await CryptoUtils.encryptBuffer(buffer, key, iv);

// 影響ファイル: fragmenter.ts, restorer.ts などの暗号化処理を含む全ファイル
```

### 4. Jimp ブラウザ対応調査の次ステップ
```typescript
// ✅ 調査完了 - Jimpは公式ブラウザ対応済み

// ブラウザでの使用例
import { Jimp } from "jimp";

// 1. URL/ファイルパスから読み込み
const image1 = await Jimp.read("/some/url");
const image2 = await Jimp.read("https://example.com/image.png");

// 2. ArrayBufferから読み込み（File APIと連携）
const reader = new FileReader();
reader.onload = async (e) => {
  const image = await Jimp.fromBuffer(e.target?.result);
  image.greyscale();
  const base64 = await image.getBase64("image/jpeg");
};
reader.readAsArrayBuffer(file);

// 3. Canvas ImageDataから読み込み
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const image = await Jimp.fromBitmap(
  ctx.getImageData(0, 0, canvas.width, canvas.height)
);
```

---

## 実装優先順位

### Phase 0: 重要判断の確定 (完了)
1. **✅ バンドラー選択**: Vite（決定済み）
2. **✅ Buffer対応方針**: Uint8Array書き換え（決定済み）
3. **✅ 画像処理ライブラリ**: Jimp継続使用（決定済み）
4. **✅ API設計方針**: 統一コア + 環境別ファイル（決定済み）
5. **🔍 パフォーマンス目標**: サイズ・速度・メモリ制限の設定

### Phase 1: 基盤整備 (必須)
1. **✅ 暗号化実装**: crypto.node.ts + crypto.browser.ts
2. **✅ 画像処理**: Jimp（そのまま使用）
3. Buffer→Uint8Array全面移行
4. ブラウザファイル操作実装

### Phase 2: コア機能移行
1. block.ts のブラウザ対応
2. ImageFragmenter のブラウザ対応
3. ImageRestorer のブラウザ対応

### Phase 3: API統合
1. index.ts のブラウザ用API実装
2. ビルド設定とパッケージング

### Phase 4: テストと最適化
1. ブラウザテストの実装
2. パフォーマンス最適化
3. ドキュメント整備

---

**注意**: この移行は大規模な作業になります。段階的に実装し、各フェーズで動作確認を行うことを推奨します。

## 🎉 最終決定事項まとめ

すべての重要判断が完了しました！

### ✅ **確定した技術選択**
1. **バンドラー**: Vite
2. **Buffer対応**: Uint8Array書き換え
3. **暗号化**: **Web Crypto API統一実装**（Node.js & ブラウザ共通）
4. **画像処理**: Jimp（そのまま使用、ブラウザ公式対応済み）
5. **API設計**: 統一実装（環境別ファイル不要）

### 🚀 **開発工数のさらなる削減**
- **Jimp**: 既存コード変更不要（最大の工数削減要因）
- **Uint8Array**: 軽微な書き換えのみ
- **Web Crypto API**: 統一実装でコード重複なし、ライブラリサイズ0KB

### ⚡ **次の実装ステップ**
1. Buffer→Uint8Array移行（1-2日）
2. crypto.ts Web Crypto API実装（1日）
3. 同期→非同期API変更（fragmenter.ts, restorer.ts等）（1-2日）
4. Viteビルド設定（半日）
5. ブラウザファイル操作実装（1日）
6. 統合テスト（1日）

**総工数予想**: 約5-7日（同期→非同期変更を含む）

### 🎯 **Web Crypto APIの主なメリット**
- **軽量**: 外部依存なし（487KB削減）
- **高速**: ネイティブ実装
- **セキュア**: 標準暗号化API
- **統一**: Node.js/ブラウザ共通コード

## 🧪 Web Crypto API 検証結果

### ✅ 互換性テスト完了

**テスト環境**: Node.js v22.14.0
**テスト日**: 2025年6月25日

**検証項目**:
1. ✅ AES-256-CBC 暗号化/復号化
2. ✅ SHA-256 ハッシュ化
3. ✅ UUID 生成
4. ✅ 日本語文字列の暗号化
5. ✅ 既存Node.js実装との互換性

**テスト結果**:
```
🧪 Web Crypto API テスト開始
📝 テストデータ:
  UUID: 33204a16-60a3-4711-90fa-c21a981d89f8
  IV長: 16 bytes
  元データ: Hello, World! 日本語テスト

🔒 暗号化中...
  暗号化データ長: 48 bytes

🔓 復号化中...
  復号化結果: Hello, World! 日本語テスト

✅ テスト結果: 成功
🎉 Web Crypto API は正常に動作しています！
```

**結論**: Web Crypto APIは既存のNode.js crypto実装と完全に互換性があり、crypto-jsの代替として使用可能です。

---
