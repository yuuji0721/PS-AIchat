import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { message, history = [] } = await req.json();
    
    console.log("=== サーバーが受信した履歴の件数 ===", history.length);
    if (history.length > 0) {
      console.log("直前の履歴のRole:", history[history.length - 1].role);
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "APIキー未設定" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    // 1. 最新のユーザー発言を履歴から除外
    let validHistory = history.slice(0, -1);

    // 2. 一番最初が「AIの挨拶」だったら削除する
    if (validHistory.length > 0 && validHistory[0].role === 'ai') {
      validHistory.shift();
    }

    // 3. 履歴をGemini用のフォーマットに変換
    const formattedHistory = validHistory.map((msg: any) => ({
      role: msg.role === 'ai' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

   // === ここから差し替え ===
    // 🌐 国土交通省「不動産情報ライブラリAPI」リアル通信処理
    const mlitApiKey = process.env.MLIT_REAL_ESTATE_API_KEY;
    let apiDataLog = "【国交省不動産ライブラリAPI連携ログ】\n";
    let realPriceContext = "";
    let isMaintenance = false;

    // ★改善：APIの404を絶対に回避するため、住所を「市区町村まで」に意図的に丸める（例：愛知県小牧市）
    const cityMatch = message.match(/([^\s市区町村]+[市区町村])/);
    let detectedAddress = cityMatch ? cityMatch[1] : "";

    // 都道府県名が抜けていたら「愛知県」を自動補完（実務エリアに合わせて変更可能）
    if (detectedAddress && !/..[都道府県]/.test(detectedAddress)) {
      detectedAddress = "愛知県" + detectedAddress;
    }

    if (mlitApiKey && detectedAddress) {
      try {
        let targetYear = new Date().getFullYear();
        let apiUrl = `https://www.reinfolib.mlit.go.jp/api/infrastructure/api/v1/LandPrice?year=${targetYear}&address=${encodeURIComponent(detectedAddress)}`;
        
        let response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            "Ocp-Apim-Subscription-Key": mlitApiKey,
            "Accept": "application/json"
          },
          next: { revalidate: 3600 }
        });

        // 404またはデータ空なら前年リトライ
        if (!response.ok || response.status === 404) {
          targetYear -= 1;
          apiUrl = `https://www.reinfolib.mlit.go.jp/api/infrastructure/api/v1/LandPrice?year=${targetYear}&address=${encodeURIComponent(detectedAddress)}`;
          response = await fetch(apiUrl, {
            method: "GET",
            headers: {
              "Ocp-Apim-Subscription-Key": mlitApiKey,
              "Accept": "application/json"
            },
            next: { revalidate: 3600 }
          });
        }

        if (response.ok) {
          const resData = await response.json();
          if (resData && resData.data && resData.data.length > 0) {
            // 周辺の取引事例や相場文脈としてAIに渡す
            realPriceContext = JSON.stringify(resData.data.slice(0, 5));
            apiDataLog += `- 国交省APIから周辺相場・地価データの取得に成功しました（エリア: ${detectedAddress} / ${targetYear}年版）\n`;
          } else {
            apiDataLog += `- 指定された地域（${detectedAddress}）の確定地価データは空でした。\n`;
          }
        } else {
          isMaintenance = (response.status === 500 || response.status === 503);
          apiDataLog += `- APIサーバーが応答を返しませんでした（Status: ${response.status}）\n`;
        }
      } catch (apiError: any) {
        isMaintenance = true;
        apiDataLog += `- 通信エラーが発生しました: ${apiError.message}\n`;
      }
    } else {
      apiDataLog += "- 対象の市区町村名が質問から検出されなかったため、API通信をスキップしました。\n";
    }
    

    // 🔍 役所調査の文脈判定
    const isGisQuery = message.includes("調査") || message.includes("用途地域") || message.includes("法令") || message.includes("制限") || message.includes("土地") || message.includes("シート") || history.some((m: any) => m.content.includes("役所調査") || m.content.includes("調査"));

    // ========================================================
    // 🧠 動的ツール制御（大前提：APIから取れない場合のみGoogle検索を起動）
    // ========================================================
    const chatOptions: any = {
      history: formattedHistory
    };

    if (!realPriceContext && isGisQuery) {
      chatOptions.tools = [{ googleSearch: {} }];
      apiDataLog += "➔ 【システム判断】国交省APIからデータが取得できなかったため、バックアップとして「Google検索（公的ソース限定）」を自動起動しました。\n";
    } else {
      apiDataLog += "➔ 【システム判断】国交省APIから確定データを直接取得できたため、Web検索は行いません。\n";
    }

    // ========================================================
    // 🧠 AIへの厳格な指示（システムプロンプト）
    // ========================================================
    const gisInstructions = `
    【国交省システムメンテナンス状況】: ${isMaintenance ? "【⚠️現在システムメンテナンス中（データ取得不可）】" : "正常稼働中"}
    【データ連携ステータス】: ${apiDataLog}

    【⚠️ Google検索（グラウンディング）に関する絶対遵守ルール ⚠️】
    1. もしあなたがWeb検索（Google）を行って情報を補完する場合、引用して良いソース（出所）は【各自治体の公式ホームページ（*.lg.jp）】、【政府・中央官庁の公開資料（*.go.jp）】、および【法務局】が管轄する公式な公的ドメイン・PDFデータ【のみ】とします。
    2. 民間の不動産ポータルサイト（SUUMO、アットホーム、ホームズ等）、個人ブログ、まとめサイト、不動産解説コラム等のデータは「不確かな情報」とみなし、【絶対に引用・信頼することを禁止】します。公的機関のソースから見つからない項目は、勝手に推測せず、潔く「データなし」または「不明」と出力してください。

    【⚠️ 地番に関する絶対厳守ルール（案3の適用） ⚠️】
    1. 【地番の捏造・推測の完全禁止】：
       住居表示（住所）から、あなたが勝手に「〇〇番〇」といった地番を【推論してでっち上げることを完全に禁止】します。AIの知識やWeb検索でも正確な地番の確証がない場合は、JSONおよびシートの地番欄を必ず【 "データなし（要手動確認）" 】として出力してください。
    2. 【地番特定のための外部リンク案内】：
       鈴木さんに対し、正確な地番を特定するための公的な外部リンクとして、法務局の【登記情報提供サービス】や【地番検索サービス（民事法務協会）】、または該当自治体の【地番参考図（公開GIS）】を開いて手動で確認するよう、テキスト回答内で必ず正式名称を出して案内してください。

    【⚠️ 思考・出力に関する鉄則 ⚠️】
    0. 【メンテナンス時の最優先警告アナウンス】：
       もし「国交省システムメンテナンス状況」が【⚠️現在システムメンテナンス中】の場合は、回答の【一番最初（最冒頭）】に必ず「現在、不動産ライブラリのシステムがメンテナンス中のため、情報取得できません。そのため、時間を置いてから再度検索をしてください。」と記載してください。
    1. 【推論・予測値の完全禁止】：
       提供されたデータソースに具体的な数値や確定情報が存在しない項目については、予測して捏造することを完全に禁止とします。
    2. 【注意喚起と公式問い合わせ先の必須記載】：
       テキスト回答内で必ず「※本情報は確定値ではありません。必ず公的機関の担当課窓口で最終確認を行ってください。」と記載し、該当する市区町村役場の実在する各種担当課の正確な問い合わせ先電話番号を箇条書きで記載してください。
    3. 【指定JSONフォーマットの出力】：
       回答の最末尾には、必ず以下のJSON構造の「suggestedQuestions」として、ユーザーが【次に役所調査を進める上で深掘りすべき、30文字以内の簡潔な追加質問の選択肢】を必ず3つ作成して配列で格納してください。

    【指定JSONフォーマット】
    ---JSON_DATA_START---
    {
      "suggestedQuestions": ["30文字以内の次の質問1", "30文字以内の次の質問2", "30文字以内の次の質問3"],
      "objectInfo": { "name": "物件名", "address": "住居表示", "chiban": "データなし（要手動確認）", "plotArea": "敷地面積", "floorArea": "延床面積", "buildDate": "建築年月", "floors": "地上階数", "totalUnits": "総戸数" },
      "urbanPlanning": { "areaClassification": "区域区分", "facilities": "都市計画施設", "road": "都市計画道路", "useDistrict": "用途地域", "fireProtection": "防火規制", "heightDistrict": "高度地区", "districtPlan": "地区計画" },
      "buildingRestrictions": { "bcRatio": "建ぺい率", "farRatio": "容積率", "heightLimit": "絶対高さ", "slantLine": "斜線制限", "shadow": "日影規制" },
      "roadInfo": { "direction": "接面方位", "type": "建基法種別", "width": "幅員" },
      "hazardInfo": { "flood": "洪水", "inlandFlood": "内水", "cultureProperty": "文化財", "pollution": "土壌汚染" },
      "infrastructure": { "water": "水道", "sewer": "下水" }
    }
    ---JSON_DATA_END---
    `;

    const normalInstructions = `
    現在は【通常のフリートーク・営業悩み相談モード】です。役所調査の案内や物件データは一切不要です。文章のみでスマートに答えてください。
    ただし、回答の最末尾には、ユーザーが【この回答を受けて、次にあなたに質問したくなるような30文字以内の気の利いた追加質問の選択肢】を必ず3つ作成し、最下部の指定JSONフォーマットの「suggestedQuestions」の中にだけ格納して出力してください。

    【指定JSONフォーマット】
    ---JSON_DATA_START---
    {
      "suggestedQuestions": ["30文字以内の次の質問1", "30文字以内の次の質問2", "30文字以内の次の質問3"]
    }
    ---JSON_DATA_END---
    `;

    const prompt = `あなたは不動産営業支援システム「Prop-Station」の超厳格なAIアシスタントです。
    
    【⚠️ 出力に関する絶対ルール ⚠️】
    1. アスタリスク記号（*）を使った太字指定や斜体指定は、画面崩れの原因になるため【絶対に禁止】とします。重要な単語を強調したい場合は 【 】 などのカッコを使用してください。
    2. 文字が詰まっていると読みにくいため、箇条書きの前後や項目の区切りには必ず「空行」を入れてください。
    3. 各見出しや重要なポイントの先頭には、分かりやすい「絵文字」を必ず添えてください。

    【現在のモードに応じた指示】
    ${isGisQuery ? gisInstructions : normalInstructions}

    ユーザーの質問: ${message}`;

    // ★ 徹底対策：衝突の種となる「chat」という名前を完全に排除し、新インスタンスを生成
    const dynamicChat = model.startChat(chatOptions);

    // AIへメッセージを送信
    const result = await dynamicChat.sendMessage(prompt);
    const rawText = result.response.text();

    // 届いたテキストから JSON データを分離・抽出する処理
    let reply = rawText;
    let sheetData = null;

    const jsonMatch = rawText.match(/---JSON_DATA_START---([\s\S]*?)---JSON_DATA_END---/);
    if (jsonMatch) {
      try {
        sheetData = JSON.parse(jsonMatch[1].trim());
        reply = rawText.replace(/---JSON_DATA_START---[\s\S]*?---JSON_DATA_END---/, "").trim();
      } catch (e) {
        console.error("JSONデータのパースに失敗しました:", e);
      }
    }

    return NextResponse.json({ reply, sheetData });
  } catch (error: any) {
    console.error("エラー詳細:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}