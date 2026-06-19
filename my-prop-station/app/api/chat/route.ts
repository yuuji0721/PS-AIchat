import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { message, history = [] } = await req.json();
    
    // 🔍 【デバッグ用】サーバーに届いた履歴の件数をターミナルに表示
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

    // 1. 最新のユーザー発言（今回の質問）を履歴から除外
    let validHistory = history.slice(0, -1);

    // 2. 一番最初が「AIの挨拶」だったら、Geminiのルール違反になるので削除する
    if (validHistory.length > 0 && validHistory[0].role === 'ai') {
      validHistory.shift();
    }

    // 3. Gemini用のフォーマットに変換
    const formattedHistory = validHistory.map((msg: any) => ({
      role: msg.role === 'ai' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({
      history: formattedHistory,
    });

    // ========================================================
    // ★ 外部連携システム（国交省API / GIS / MCP）のシミュレーター
    // ========================================================
    const mlitApiKey = process.env.MLIT_REAL_ESTATE_API_KEY;
    
    // クイックコマンド等の履歴から、現在のチャットの目的を自動判定
    const isGisQuery = message.includes("調査") || message.includes("用途地域") || message.includes("法令");
    const isPriceQuery = message.includes("地価") || message.includes("価格") || message.includes("相場");

    let externalContext = "";
    if (mlitApiKey) {
      externalContext += `\n[MCP/国交省不動産ライブラリ連携: 有効]`;
      if (isPriceQuery) {
        externalContext += `\n- システムは国交省DB（土地総合情報システム）から最新の「公示地価・都道府県地価・取引価格情報」へのMCPアクセス権を持っています。`;
      }
    } else {
      externalContext += `\n[MCP/外部データ連携: 開発環境エミュレーション起動中]`;
    }

    if (isGisQuery) {
      externalContext += `\n- 各自治体GISデータ連携: 有効（都市計画図、道路幅員、用途地域、建ぺい率/容積率、ハザードマップ情報をMCP経由で取得可能）`;
    }

    // AIへの指示（システムプロンプト）の強化：視認性の徹底向上 ＆ JSON抽出指示
    const prompt = `あなたは不動産営業支援システム「Prop-Station」の超優秀なAIアシスタントです。
    
    【現在のデータ連携ステータス】:${externalContext}
    
    上記のリモートデータソース（国交省API・自治体GIS）から、MCP（Model Context Protocol）を通じてセキュアに物件・土地情報を引き出している前提で回答してください。

    【⚠️ 出力に関する絶対ルール ⚠️】
    1. アスタリスク記号（*）を使った太字指定や斜体指定は、画面崩れ（***の露出など）の原因になるため【絶対に禁止】とします。重要な単語を強調したい場合は、記号を使わず、【 】 などのカッコを使うか、前後に改行を入れて目立たせてください。
    2. 文字が詰まっていると読みにくいため、箇条書きの前後や、項目の区切りには必ず「空行（2連続の改行）」を入れて、スカスカで開放感のあるレイアウトにしてください。
    3. 各見出しや重要なポイントの先頭には、内容に合った分かりやすい「絵文字」を必ず添えて、視覚的にパッと情報が飛び込んでくるようにしてください。
    4. 不動産のプロとして、具体的かつ正確な数値や法令（例: 第一種住居地域、建ぺい率60%など）をスマートに提示してください。
    5. もし今回の質問が「役所調査」や「地価検索」に関するものである場合、上記のチャット用テキスト回答とは【完全に切り離して】、回答の最末尾に必ず以下の【指定JSONフォーマット】の構造をエミュレートし、データを埋めて出力してください。テキストとJSONデータの境界線は必ず ---JSON_DATA_START--- と ---JSON_DATA_END--- で挟んでください。

    【指定JSONフォーマット】
    ---JSON_DATA_START---
    {
      "objectInfo": { "name": "物件名", "address": "住居表示", "chiban": "地番", "plotArea": "敷地面積(数値のみ)", "floorArea": "延床面積(数値のみ)", "buildDate": "建築年月", "floors": "地上階数", "totalUnits": "総戸数" },
      "urbanPlanning": { "areaClassification": "市街化区域/市街化調整区域/非線引き", "facilities": "都市計画施設の有無", "road": "都市計画道路の有無・名称", "useDistrict": "用途地域名", "fireProtection": "防火規制の種類", "heightDistrict": "高度地区の有無・制限", "districtPlan": "地区計画の有無" },
      "buildingRestrictions": { "bcRatio": "建ぺい率(%)", "farRatio": "容積率(%)", "heightLimit": "絶対高さ制限", "slantLine": "斜線制限(道路・隣地・北側)", "shadow": "日影規制の有無" },
      "roadInfo": { "direction": "接面方位", "type": "建基法上の種別(1項1号、2項など)", "width": "幅員(m)" },
      "hazardInfo": { "flood": "洪水ハザード", "inlandFlood": "内水ハザード", "cultureProperty": "埋蔵文化財", "pollution": "土壌汚染" },
      "infrastructure": { "water": "飲用水の区分", "sewer": "下水の区分" }
    }
    ---JSON_DATA_END---

    ユーザーの質問: ${message}`;

    // AIへメッセージを送信
    const result = await chat.sendMessage(prompt); // ★メッセージではなく、強化したプロンプトを送信
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

    // チャット文章と、シート用の構造化データをセットにしてフロント（画面）へ返却！
    return NextResponse.json({ reply, sheetData });
  } catch (error: any) {
    console.error("エラー詳細:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}