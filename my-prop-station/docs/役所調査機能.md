# 役所調査機能 — API連携設計ドキュメント

## 1. 概要

### 1.1 現状の課題

現在の役所調査機能は、Gemini AIが「国交省APIと連携している前提」で回答を**創作**している。
sheetData（役所調査シートのデータ）は全てAIが生成しており、事実に基づいていない。

```
現状: ユーザー入力 → AIが全データを創作 → sheetData（不正確）
目標: ユーザー入力 → APIで実データ取得 → AIは解説のみ → sheetData（正確）
```

### 1.2 利用するAPI

**不動産情報ライブラリAPI**（国土交通省）

- 公式サイト: https://www.reinfolib.mlit.go.jp/
- API仕様: https://www.reinfolib.mlit.go.jp/help/apiManual/
- OpenAPI仕様書: `docs/reinfolib-openapi.yaml`（本リポジトリ内）
- Scalar Viewer: `npm run openapi:prop-lib` で閲覧可能
- APIキー申請: https://www.reinfolib.mlit.go.jp/api/request/ （審査約5営業日）
- 認証: リクエストヘッダー `Ocp-Apim-Subscription-Key` にAPIキーをセット
- レスポンス: 全てgzip圧縮

---

## 2. 処理フロー

```
┌─────────────────────────────────────────────────────┐
│  ユーザーが住所を入力                                 │
│  例: 「渋谷区神南1-1-1を調査して」                    │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
            ┌─────────────────────┐
            │  STEP 1: ジオコーディング  │
            │  住所 → 緯度経度          │
            │  住所 → 市区町村コード     │
            │  (国土地理院API)          │
            └──────────┬──────────┘
                       │
                       ▼
            ┌─────────────────────┐
            │  STEP 2: タイル座標変換   │
            │  緯度経度 → x, y, z      │
            └──────────┬──────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ 都市計画系  │  │ ハザード系  │  │  価格系   │
   │ XKT001    │  │ XKT025   │  │ XPT002   │
   │ XKT002    │  │ XKT026   │  │ XIT001   │
   │ XKT003    │  │ XKT027   │  │          │
   │ XKT014    │  │ XKT028   │  │          │
   │           │  │ XKT029   │  │          │
   └─────┬────┘  └─────┬────┘  └─────┬────┘
         │             │             │
         └─────────────┼─────────────┘
                       │
                       ▼
            ┌─────────────────────┐
            │  STEP 3: Point-in-  │
            │  Polygon 判定        │
            │  (Turf.js)          │
            └──────────┬──────────┘
                       │
                       ▼
            ┌─────────────────────┐
            │  STEP 4: sheetData  │
            │  構築（実データ）      │
            └──────────┬──────────┘
                       │
                       ▼
            ┌─────────────────────┐
            │  STEP 5: AI（Gemini） │
            │  実データを渡して     │
            │  解説・補足のみ担当   │
            └──────────┬──────────┘
                       │
                       ▼
            ┌─────────────────────┐
            │  STEP 6: レスポンス  │
            │  { reply, sheetData }│
            └─────────────────────┘
```

### 2.1 STEP 1: ジオコーディング

住所文字列から緯度経度と市区町村コードを取得する。

**国土地理院 ジオコーディングAPI:**
```
GET https://msearch.gsi.go.jp/address-search/AddressSearch?q=渋谷区神南1-1-1
```

レスポンス例:
```json
[{
  "geometry": { "coordinates": [139.6998, 35.6625], "type": "Point" },
  "properties": { "addressCode": "13113", "title": "東京都渋谷区神南一丁目" }
}]
```

- `coordinates` → 緯度経度（STEP 2で使用）
- `addressCode` → 市区町村コード（XIT001, XIT002で使用）

### 2.2 STEP 2: タイル座標変換

緯度経度をXYZタイル座標に変換する。多くのAPIがこの形式でデータを要求する。

```typescript
function latLngToTile(lat: number, lng: number, zoom: number) {
  const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
  const y = Math.floor(
    (1 - Math.log(Math.tan(lat * Math.PI / 180) +
      1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)
  );
  return { x, y, z: zoom };
}
```

**APIごとの対応ズームレベル:**

| API | ズームレベル |
|-----|------------|
| XKT001（区域区分） | 11〜15 |
| XKT002（用途地域） | 11〜15 |
| XKT003（立地適正化） | 11〜15 |
| XKT014（防火地域） | 11〜15 |
| XKT025（液状化） | 11〜15 |
| XKT026（洪水浸水） | **14〜15** |
| XKT027（高潮浸水） | **13〜15** |
| XKT028（津波浸水） | **14〜15** |
| XKT029（土砂災害） | 11〜15 |
| XPT002（地価公示） | **13〜15** |
| XGT001（避難場所） | 11〜15 |

推奨: **z=14** で統一すれば全APIに対応可能。

### 2.3 STEP 3: Point-in-Polygon 判定

タイル座標APIはタイル範囲内の全ポリゴンを返す。
対象地点がどのポリゴンに含まれるかをクライアント側で判定する必要がある。

```typescript
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';

const targetPoint = point([lng, lat]);

// GeoJSONのFeatureCollectionから該当ポリゴンを特定
const matchedFeature = geojsonResult.features.find(feature =>
  booleanPointInPolygon(targetPoint, feature)
);
```

### 2.4 STEP 4〜6: sheetData構築 → AI解説 → レスポンス

→ 詳細は「4. 実装設計」を参照

---

## 3. データソースマッピング

### 3.1 セクション別対応表

役所調査シートの各セクション・項目と、データの取得元を対応付ける。

#### セクション1: 物件基本情報（objectInfo）

| シート項目 | API取得 | データソース | 備考 |
|-----------|---------|-------------|------|
| 物件名 | 不可 | ユーザー入力 | 任意の名前 |
| 住居表示 | 不可 | ユーザー入力 | 入力された住所をそのまま使う |
| 地番 | 不可 | ユーザー入力 / 登記情報提供サービス（有料） | 住居表示≠地番のため変換が必要 |
| 敷地面積 | 不可 | ユーザー入力 | 登記簿からの転記 |
| 延床面積 | 不可 | ユーザー入力 | 登記簿からの転記 |
| 建築年月 | 不可 | ユーザー入力 | 登記簿からの転記 |
| 階数 | 不可 | ユーザー入力 | 登記簿からの転記 |
| 総戸数 | 不可 | ユーザー入力 | 登記簿からの転記 |

**結論**: 全項目がユーザー入力。物件固有の登記情報であり、公開APIでは取得不可能。

---

#### セクション2: 都市計画・地域地区制限（urbanPlanning）

| シート項目 | API取得 | API ID | レスポンスフィールド |
|-----------|---------|--------|---------------------|
| 区域区分 | **可能** | XKT001 | `area_classification_ja` |
| 用途地域 | **可能** | XKT002 | `use_area_ja` |
| 防火規制 | **可能** | XKT014 | `fire_prevention_ja` |
| 高度地区 | 不可 | — | 不動産情報ライブラリにAPIなし。各自治体の都市計画課で確認 |
| 地区計画 | 部分的 | XKT003 | 立地適正化計画のみ取得可。狭義の地区計画データはAPIなし |
| 都市計画施設 | 不可 | — | 各自治体の都市計画課で確認 |
| 都市計画道路 | 不可 | — | 各自治体の都市計画課で確認 |

---

#### セクション3: 建築基準法制限（buildingRestrictions）

| シート項目 | API取得 | API ID | レスポンスフィールド |
|-----------|---------|--------|---------------------|
| 建ぺい率 | **可能** | XKT002 | `u_building_coverage_ratio_ja` |
| 容積率 | **可能** | XKT002 | `u_floor_area_ratio_ja` |
| 絶対高さ制限 | 不可 | — | APIなし。低層住居専用地域なら10m/12mが一般的（AI推定可） |
| 斜線制限 | 不可 | — | 用途地域の種類から推定可能（AI推定向き） |
| 日影規制 | 不可 | — | 用途地域+地域指定から推定可能（AI推定向き） |

---

#### セクション4: 道路状況（roadInfo）

| シート項目 | API取得 | データソース | 備考 |
|-----------|---------|-------------|------|
| 接面方位 | 不可 | 現地調査 / ユーザー入力 | |
| 建基法種別 | 不可 | 現地調査 / 各自治体の道路台帳 | |
| 幅員 | 不可 | 現地調査 / 各自治体の道路台帳 | |

**結論**: 全項目が現地調査項目。APIからは取得不可能。

**参考情報として活用可能**: XPT002（地価公示ポイント）の近隣データに以下が含まれる:
- `front_road_width` — 前面道路幅員
- `front_road_azimuth_name_ja` — 前面道路方位
- `front_road_name_ja` — 前面道路区分

あくまで近隣の地価公示地点のデータであり、対象物件そのものの情報ではない。

---

#### セクション5: 環境・ハザード情報（hazardInfo）

| シート項目 | API取得 | API ID | レスポンスフィールド | 備考 |
|-----------|---------|--------|---------------------|------|
| 洪水ハザード | **可能** | XKT026 | `A31a_205`（浸水深ランク）, `A31a_202`（河川名） | |
| 高潮ハザード | **可能** | XKT027 | `A49_003`（浸水深区分） | **現在のシートに項目なし → 追加推奨** |
| 津波ハザード | **可能** | XKT028 | `A40_003`（浸水深区分） | **現在のシートに項目なし → 追加推奨** |
| 土砂災害 | **可能** | XKT029 | `A33_001`（現象種類）, `A33_002`（区域区分） | **現在のシートに項目なし → 追加推奨** |
| 液状化 | **可能** | XKT025 | `liquefaction_tendency_level`（6段階） | **現在のシートに項目なし → 追加推奨** |
| 内水ハザード | 不可 | — | 各自治体の内水ハザードマップ（API提供なし） | |
| 埋蔵文化財 | 不可 | — | 各自治体の教育委員会に照会 | |
| 土壌汚染 | 不可 | — | 各自治体の環境部局に照会 | |

**重要**: 現在のシートはハザード情報が「洪水・内水」の2項目のみだが、APIで**高潮・津波・土砂災害・液状化**の4項目も取得可能。シートの拡張を推奨。

---

#### セクション6: インフラ状況（infrastructure）

| シート項目 | API取得 | API ID | レスポンスフィールド | 備考 |
|-----------|---------|--------|---------------------|------|
| 飲用水 | 間接的 | XPT002 | `water_supply_availability`（boolean） | 近隣の地価公示ポイントのデータ。参考情報 |
| 下水道 | 間接的 | XPT002 | `sewer_supply_availability`（boolean） | 同上 |

**結論**: 対象物件そのものではなく近隣地価公示ポイントのデータ。あくまで参考情報として表示し、正確な情報はユーザーが各事業者に確認する必要がある。

---

#### 追加取得可能データ（シート拡張候補）

現在のシートには項目がないが、APIで取得可能なデータ:

| データ | API ID | 活用案 |
|--------|--------|--------|
| 最寄り避難場所 | XGT001 | `facility_name_ja`, 災害種別対応フラグ |
| 立地適正化計画区域 | XKT003 | 居住誘導区域 / 都市機能誘導区域の該当判定 |
| 周辺地価公示 | XPT002 | 当年価格、変動率、最寄り駅情報 |
| 周辺取引価格 | XIT001 | 直近の取引事例（坪単価、取引時期等） |

---

### 3.2 三層アーキテクチャ

データの信頼性と取得元に基づき、3つのレイヤーに分類する。

```
┌───────────────────────────────────────────────────────┐
│  レイヤー1: API（事実データ）                           │
│  ───────────────────────────────────────────────────  │
│  確実に取れるデータ — sheetDataに直接セットする          │
│                                                       │
│    区域区分（市街化/調整）           ← XKT001          │
│    用途地域                         ← XKT002          │
│    建ぺい率・容積率                  ← XKT002          │
│    防火/準防火地域                   ← XKT014          │
│    洪水浸水想定                      ← XKT026          │
│    高潮浸水想定                      ← XKT027          │
│    津波浸水想定                      ← XKT028          │
│    土砂災害警戒区域                  ← XKT029          │
│    液状化傾向                       ← XKT025          │
│    周辺地価公示                      ← XPT002          │
│    周辺取引価格                      ← XIT001          │
│    最寄り避難場所                    ← XGT001          │
├───────────────────────────────────────────────────────┤
│  レイヤー2: AI（推定・解説・補足）                      │
│  ───────────────────────────────────────────────────  │
│  用途地域等の実データから推定 — AI回答テキストに記載     │
│                                                       │
│    斜線制限（道路/隣地/北側）  ← 用途地域の種類で決まる  │
│    日影規制                  ← 用途地域+地域の指定で決まる│
│    絶対高さ制限の可能性       ← 低層住居専用なら10m/12m  │
│    インフラの一般的傾向       ← 市街化区域なら公営水道+  │
│                                公共下水が一般的         │
│    規制の解説文（意味、注意点）                         │
│    営業時の注意事項                                     │
│    現地調査で追加確認すべき項目                         │
├───────────────────────────────────────────────────────┤
│  レイヤー3: ユーザー入力 / 現地調査                     │
│  ───────────────────────────────────────────────────  │
│  APIで取得不可能 — 空欄 or 「要確認」で返す             │
│                                                       │
│    物件基本情報（全項目）      ← 登記簿 or ユーザー入力  │
│    道路状況（全項目）          ← 現地調査 + 道路台帳     │
│    高度地区                   ← 各自治体の都市計画課     │
│    地区計画                   ← 各自治体の都市計画課     │
│    都市計画施設・都市計画道路  ← 各自治体の都市計画課     │
│    埋蔵文化財                 ← 各自治体の教育委員会     │
│    土壌汚染                   ← 各自治体の環境部局       │
│    内水ハザード               ← 各自治体の内水ハザードマップ│
└───────────────────────────────────────────────────────┘
```

---

## 4. 実装設計

### 4.1 sheetData構築（route.ts のリファクタリング）

```typescript
// 現在のroute.ts（全データをAIが生成）
const prompt = `...JSONフォーマットでデータを埋めて出力してください...`;
// → AIが全フィールドを創作

// あるべき実装（APIデータ + AIは解説のみ）
const sheetData = await buildSheetData(inputAddress, apiKey);
const prompt = buildPromptWithRealData(inputAddress, sheetData, userMessage);
const aiReply = await gemini.sendMessage(prompt);
return { reply: aiReply, sheetData };  // sheetDataはAPI実データ
```

### 4.2 buildSheetData 関数の設計

```typescript
async function buildSheetData(address: string, apiKey: string): Promise<SheetData> {
  // STEP 1: ジオコーディング
  const geo = await geocode(address);
  const { lat, lng } = geo.coordinates;
  const cityCode = geo.addressCode;

  // STEP 2: タイル座標変換（z=14で統一）
  const tile = latLngToTile(lat, lng, 14);

  // STEP 3: 並列API呼び出し
  const [
    areaClassification,  // XKT001: 区域区分
    useDistrict,         // XKT002: 用途地域
    firePrevention,      // XKT014: 防火地域
    floodArea,           // XKT026: 洪水浸水想定
    stormSurge,          // XKT027: 高潮浸水想定
    tsunami,             // XKT028: 津波浸水想定
    sedimentDisaster,    // XKT029: 土砂災害
    liquefaction,        // XKT025: 液状化
    landPrices,          // XPT002: 地価公示
  ] = await Promise.all([
    fetchGeoJSON('XKT001', tile, apiKey),
    fetchGeoJSON('XKT002', tile, apiKey),
    fetchGeoJSON('XKT014', tile, apiKey),
    fetchGeoJSON('XKT026', tile, apiKey),
    fetchGeoJSON('XKT027', tile, apiKey),
    fetchGeoJSON('XKT028', tile, apiKey),
    fetchGeoJSON('XKT029', tile, apiKey),
    fetchGeoJSON('XKT025', tile, apiKey),
    fetchGeoJSON('XPT002', { ...tile, year: currentYear }, apiKey),
  ]);

  // STEP 4: Point-in-Polygon で該当データ抽出
  const targetPoint = point([lng, lat]);

  const matchedArea = findMatchingFeature(areaClassification, targetPoint);
  const matchedUse  = findMatchingFeature(useDistrict, targetPoint);
  const matchedFire = findMatchingFeature(firePrevention, targetPoint);
  const matchedFlood = findMatchingFeature(floodArea, targetPoint);
  // ... 他のAPIも同様

  // STEP 5: sheetData構築
  return {
    objectInfo: {
      name: "",           // ユーザー入力待ち
      address: address,   // 入力された住所
      chiban: "",         // ユーザー入力待ち
      plotArea: "",
      floorArea: "",
      buildDate: "",
      floors: "",
      totalUnits: "",
    },
    urbanPlanning: {
      areaClassification: matchedArea?.properties.area_classification_ja || "データなし",
      useDistrict: matchedUse?.properties.use_area_ja || "指定なし",
      fireProtection: matchedFire?.properties.fire_prevention_ja || "指定なし",
      heightDistrict: "要確認（各自治体の都市計画課）",
      districtPlan: "要確認（各自治体の都市計画課）",
      facilities: "要確認（各自治体の都市計画課）",
      road: "要確認（各自治体の都市計画課）",
    },
    buildingRestrictions: {
      bcRatio: matchedUse?.properties.u_building_coverage_ratio_ja || "ーー",
      farRatio: matchedUse?.properties.u_floor_area_ratio_ja || "ーー",
      heightLimit: "要確認",   // AI推定をreplyに含める
      slantLine: "要確認",     // AI推定をreplyに含める
      shadow: "要確認",        // AI推定をreplyに含める
    },
    roadInfo: {
      direction: "",   // 現地調査項目
      type: "",        // 現地調査項目
      width: "",       // 現地調査項目
    },
    hazardInfo: {
      flood: matchedFlood
        ? `浸水深ランク${matchedFlood.properties.A31a_205}（${matchedFlood.properties.A31a_202}）`
        : "浸水想定区域外",
      stormSurge: matchedStormSurge?.properties.A49_003 || "浸水想定区域外",
      tsunami: matchedTsunami?.properties.A40_003 || "浸水想定区域外",
      sedimentDisaster: matchedSediment
        ? `警戒区域（${matchedSediment.properties.A33_005}）`
        : "区域外",
      liquefaction: matchedLiquefaction?.properties.note || "データなし",
      inlandFlood: "要確認（各自治体の内水ハザードマップ）",
      cultureProperty: "要確認（各自治体の教育委員会）",
      pollution: "要確認（各自治体の環境部局）",
    },
    infrastructure: {
      water: "要確認（上水道事業者）",
      sewer: "要確認（下水道事業者）",
    },
  };
}
```

### 4.3 AI プロンプト設計（解説特化）

```typescript
function buildPromptWithRealData(
  address: string,
  sheetData: SheetData,
  userMessage: string
): string {
  return `あなたは不動産営業支援システム「Prop-Station」のAIアシスタントです。

以下は「${address}」について、国交省の不動産情報ライブラリAPIから取得した実データです:

【都市計画データ（API取得済み・事実）】
- 区域区分: ${sheetData.urbanPlanning.areaClassification}
- 用途地域: ${sheetData.urbanPlanning.useDistrict}
- 建ぺい率: ${sheetData.buildingRestrictions.bcRatio}
- 容積率: ${sheetData.buildingRestrictions.farRatio}
- 防火地域: ${sheetData.urbanPlanning.fireProtection}

【ハザード情報（API取得済み・事実）】
- 洪水浸水想定: ${sheetData.hazardInfo.flood}
- 高潮浸水想定: ${sheetData.hazardInfo.stormSurge}
- 津波浸水想定: ${sheetData.hazardInfo.tsunami}
- 土砂災害: ${sheetData.hazardInfo.sedimentDisaster}
- 液状化傾向: ${sheetData.hazardInfo.liquefaction}

上記の実データを元に、不動産営業担当向けに以下を回答してください:
1. 取得データの要点と営業時の注意点を分かりやすく解説
2. 用途地域から推定される斜線制限・日影規制・高さ制限
3. 現地調査や役所窓口で追加確認すべき項目のリスト
4. この地域の特徴や物件評価に影響するポイント

【重要ルール】
- 上記のAPIデータは事実なので、そのまま前提として使ってください
- データを改変したり、別の値を創作しないでください
- 「要確認」の項目については推定や一般論を補足してください

ユーザーの質問: ${userMessage}`;
}
```

### 4.4 共通API呼び出し関数

```typescript
const BASE_URL = 'https://www.reinfolib.mlit.go.jp/ex-api/external';

async function fetchGeoJSON(
  apiId: string,
  params: { x: number; y: number; z: number; [key: string]: any },
  apiKey: string
): Promise<GeoJSON.FeatureCollection | null> {
  const queryParams = new URLSearchParams({
    response_format: 'geojson',
    z: String(params.z),
    x: String(params.x),
    y: String(params.y),
    ...Object.fromEntries(
      Object.entries(params)
        .filter(([k]) => !['x', 'y', 'z'].includes(k))
        .map(([k, v]) => [k, String(v)])
    ),
  });

  const res = await fetch(`${BASE_URL}/${apiId}?${queryParams}`, {
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Accept-Encoding': 'gzip',
    },
  });

  if (!res.ok) return null;
  return res.json();
}

function findMatchingFeature(
  geojson: GeoJSON.FeatureCollection | null,
  targetPoint: GeoJSON.Feature<GeoJSON.Point>
): GeoJSON.Feature | null {
  if (!geojson?.features) return null;
  return geojson.features.find(feature =>
    booleanPointInPolygon(targetPoint, feature)
  ) || null;
}
```

---

## 5. 役所調査シート拡張方針

### 5.1 ハザードセクションの拡張

現在のシート（2項目）:
```
洪水ハザード | 内水ハザード
```

拡張後（7項目）:
```
洪水浸水想定  | XKT026 — 浸水深ランク + 河川名
高潮浸水想定  | XKT027 — 浸水深区分
津波浸水想定  | XKT028 — 浸水深区分
土砂災害警戒  | XKT029 — 現象種類 + 区域区分
液状化傾向    | XKT025 — 6段階評価 + 地形区分名
内水ハザード  | 要確認（各自治体）
文化財・汚染  | 要確認（各自治体）
```

### 5.2 周辺情報セクションの新設（検討）

APIで取得可能だがシートに未反映のデータ:

```
【7. 周辺地価情報】（新設候補）
  最寄り地価公示地点  | XPT002 — 標準地番号、当年価格、変動率
  最寄り駅           | XPT002 — 駅名、距離
  周辺取引事例        | XIT001 — 直近の取引価格、坪単価

【8. 最寄り避難場所】（新設候補）
  施設名             | XGT001 — facility_name_ja
  住所              | XGT001 — address_ja
  対応災害           | XGT001 — 各災害フラグ
```

---

## 6. 必要なライブラリ

| ライブラリ | 用途 | npm |
|-----------|------|-----|
| @turf/boolean-point-in-polygon | GeoJSONポリゴン内判定 | `npm i @turf/boolean-point-in-polygon` |
| @turf/helpers | GeoJSONのPoint生成 | `npm i @turf/helpers` |

---

## 7. 環境変数

```env
# .env.local に追加
MLIT_REAL_ESTATE_API_KEY=xxxxxxxx   # 不動産情報ライブラリAPIキー
```

---

## 8. 制約・注意事項

| 項目 | 内容 |
|------|------|
| APIレート制限 | 明確な数値なし。連続実行を避け間隔を空ける |
| gzip圧縮 | 全レスポンスがgzip。fetchではヘッダー設定が必要 |
| Point-in-Polygon精度 | 対象地点がポリゴン境界付近の場合、隣接区域のデータが返る可能性あり |
| ズームレベル差異 | APIによって対応ズームレベルが異なる（z=14で統一推奨） |
| ポリゴン分割 | 洪水・高潮・津波系は大規模ポリゴンが分割提供されるため、原典データと形状が一致しない場合がある |
| データ鮮度 | 避難場所等はリアルタイム同期ではない。最新情報は各市町村に要確認 |
| APIキー審査 | 申請から発行まで約5営業日 |
