import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { message, history = [] } = await req.json();
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "APIキー未設定" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    let validHistory = history.slice(0, -1);
    if (validHistory.length > 0 && validHistory[0].role === 'ai') {
      validHistory.shift();
    }

    const formattedHistory = validHistory.map((msg: any) => ({
      role: msg.role === 'ai' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    // 🌐 国土交通省「不動産情報ライブラリAPI」リアル通信処理
    const mlitApiKey = process.env.MLIT_REAL_ESTATE_API_KEY;
    let apiDataLog = "【国交省不動産ライブラリAPI連携ログ】\n";
    let realPriceContext = "";
    let isMaintenance = false;

    // APIのエラーを避けるため市区町村単位に丸める（例：愛知県小牧市）
    const cityMatch = message.match(/([^\s市区町村]+[市区町村])/);
    let detectedAddress = cityMatch ? cityMatch[1] : "";

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
            // 国交省の100%正確な地価公示データを最大5件、AIに直接引き渡す
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

    const isGisQuery = message.includes("調査") || message.includes("用途地域") || message.includes("法令") || message.includes("制限") || message.includes("土地") || message.includes("シート") || history.some((m: any) => m.content.includes("役所調査") || m.content.includes("調査"));

    // ========================================================
    // 🧠 動的ツール制御（相場が取れていても、自治体URLハントのために検索は【常にON】）
    // ========================================================
    const chatOptions: any = {
      history: formattedHistory
    };

    if (isGisQuery) {
      chatOptions.tools = [{ googleSearch: {} }];
      apiDataLog += "➔ 【システム判断】役所調査モードのため、自治体公式リンクおよび窓口情報を特定する「Google公的検索」を同時起動しました。\n";
    }

    // ========================================================
    // 🧠 AIへの厳格な指示（鈴木さんの正確性最優先プロンプト）
    // ========================================================
    const gisInstructions = `
    【国交省APIから取得した実際の周辺相場・地価公示データ（一次情報）】: 
    ${realPriceContext ? realPriceContext : "該当エリアのAPI直接データなし（近隣データ不足）"}

    【データ連携ステータス】: ${apiDataLog}

    【⚠️ 情報の正確性に関する絶対遵守ルール ⚠️】
    1. あなたは、提供された明確なデータソースに存在しない数値を予測・推測して【でっち上げることを完全に禁止】されています。
    2. 上記の「国交省APIから取得したデータ」が存在する場合は、そこに含まれる実際の標準地価格（平米単価）や地点の情報を、テキスト回答の相場欄に嘘偽りなく正確に反映させてください。
    3. 用途地域、建ぺい率、容積率、建築制限などのピンポイントな情報は、自治体の「画像地図システム（GIS）」の中に隠れているため、テキスト検索では数字の確証が持てないケースがほとんどです。その場合は、絶対に勘で数字を書かず、潔く「要手動確認（自治体GIS・窓口）」と出力してください。
    4. その代わり、Web検索（Google）機能をフルに活かして、【該当する市区町村（例：小牧市）の公式都市計画閲覧システム（公開GIS）のトップページURL】を必ず検索して特定し、鈴木さんがワンクリックで正確な一次情報地図を開けるよう、回答内で正式名称と共にURLリンクとして必ず案内してください。
    5. また、該当する市区町村役場の「都市計画課」「道路課」「上下水道局」などの実在する最新の直通電話番号をWeb検索から特定し、箇条書きで必ず記載してください。

    【⚠️ 地番に関する絶対厳守ルール ⚠️】
    住居表示から地番をでっち上げることは完全禁止です。JSONおよびシートの地番欄は必ず【 "データなし（要手動確認）" 】として出力し、法務局の「登記情報提供サービス」等を利用するようテキスト内でアナウントしてください。

    【指定JSONフォーマット】
    ---JSON_DATA_START---
    {
      "suggestedQuestions": ["30文字以内の次の質問1", "30文字以内の次の質問2", "30文字以内の次の質問3"],
      "objectInfo": { "name": "物件名", "address": "住居表示", "chiban": "データなし（要手動確認）", "plotArea": "敷地面積", "floorArea": "延床面積", "buildDate": "建築年月", "floors": "地上階数", "totalUnits": "総戸数" },
      "urbanPlanning": { "areaClassification": "区域区分", "facilities": "都市計画施設", "road": "都市計画道路", "useDistrict": "要手動確認（自治体GIS・窓口）", "fireProtection": "防火規制", "heightDistrict": "高度地区", "districtPlan": "地区計画" },
      "buildingRestrictions": { "bcRatio": "要確認", "farRatio": "要確認", "heightLimit": "絶対高さ", "slantLine": "斜線制限", "shadow": "日影規制" },
      "roadInfo": { "direction": "接面方位", "type": "建基法種別", "width": "幅員" },
      "hazardInfo": { "flood": "洪水", "inlandFlood": "内水", "cultureProperty": "文化財", "pollution": "土壌汚染" },
      "infrastructure": { "water": "水道", "sewer": "下水" }
    }
    ---JSON_DATA_END---
    `;

    const normalInstructions = `
    現在は【通常のフリートーク・営業悩み相談モード】です。役所調査の案内や物件データは一切不要です。文章のみでスマートに答えてください。
    最下部の指定JSONフォーマットの「suggestedQuestions」の中にだけ次の質問を3つ格納して出力してください。

    【指定JSONフォーマット】
    ---JSON_DATA_START---
    {
      "suggestedQuestions": ["30文字以内の次の質問1", "30文字以内の次の質問2", "30文字以内の次の質問3"]
    }
    ---JSON_DATA_END---
    `;

    const prompt = `あなたは不動産営業支援システム「Prop-Station」の超厳格なAIアシスタントです。
    
    【⚠️ 出力に関する絶対ルール ⚠️】
    1. アスタリスク記号（*）を使った太字指定や斜体指定は画面崩れの原因になるため【絶対に禁止】とします。重要な単語を強調したい場合は 【 】 などのカッコを使用してください。
    2. 文字が詰まっていると読みにくいため、箇ラ書きの前後や項目の区切りには必ず「空行」を入れてください。
    3. 各見出しや重要なポイントの先頭には、分かりやすい「絵文字」を必ず添えてください。

    【現在のモードに応じた指示】
    ${isGisQuery ? gisInstructions : normalInstructions}

    ユーザーの質問: ${message}`;

    const dynamicChat = model.startChat(chatOptions);
    const result = await dynamicChat.sendMessage(prompt);
    const rawText = result.response.text();

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