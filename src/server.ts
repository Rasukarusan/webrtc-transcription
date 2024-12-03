import { WebSocketServer, WebSocket } from "ws";
import { Writable } from "stream";
import * as fs from "fs";
import * as ffmpeg from "fluent-ffmpeg";
import { OpenAI } from "openai";
import { SpeechClient } from "@google-cloud/speech";

const PORT = process.env.PORT ?? 9999;
const TEMP_FILE = "temp.raw";
const OUTPUT_MP3_FILE = "output.mp3";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const speechClient = new SpeechClient();

// WebSocketサーバーをセットアップ
const wss = new WebSocketServer({ port: Number(PORT) });
console.log(`WebSocket server running on ws://localhost:${PORT}`);

wss.on("connection", (ws: WebSocket) => {
  console.log("Client connected");

  // Speech-to-Textのストリーミングリクエストを作成
  const request = {
    config: {
      encoding: "LINEAR16" as const, // PCM形式（16ビットリトルエンディアン）
      sampleRateHertz: 44100, // サンプリングレート (クライアントが送信する音声に合わせる)
      languageCode: "ja-JP", // 日本語
    },
    interimResults: true, // 中間結果を取得するかどうか
  };

  const recognizeStream = speechClient
    .streamingRecognize(request)
    .on("data", (data) => {
      const transcription = data.results
        ?.map((result) => result.alternatives?.[0].transcript)
        .join("\n");
      // テキストを出力
      console.clear();
      console.log(transcription);
    })
    .on("error", (error) => {
      console.error("Speech-to-Text error:", error);
    });

  // 一時ファイルへの書き込みストリームを作成
  const tempFileStream = fs.createWriteStream(TEMP_FILE);
  const audioStream = new Writable({
    write(chunk: Buffer, encoding: string, callback: () => void) {
      recognizeStream.write(chunk);
      tempFileStream.write(chunk); // TEMP_FILEに書き込む
      callback();
    },
  });

  // WebSocketで受信したデータをaudioStreamに流す
  ws.on("message", (message) => {
    if (Buffer.isBuffer(message)) {
      audioStream.write(message);
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    audioStream.end();
    recognizeStream.end();
    tempFileStream.end(); // TEMP_FILEの書き込みを終了
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });

  // TEMP_FILEの書き込み終了後にMP3変換を開始
  tempFileStream.on("finish", () => {
    encodeToMp3(TEMP_FILE, OUTPUT_MP3_FILE);
    audioToText(OUTPUT_MP3_FILE);
  });
});

/**
 * rawファイルをmp3に変換
 */
const encodeToMp3 = (rawPath: string, outputPath: string) => {
  ffmpeg(rawPath)
    .inputOptions("-f s16le") // PCM形式（16ビットリトルエンディアン）
    .inputOptions("-ar 44100") // サンプリングレート 44100Hz
    .inputOptions("-ac 1") // モノラル
    .audioCodec("libmp3lame") // MP3エンコード
    .audioBitrate("192k") // 推奨値: 128k以上
    .output(outputPath)
    .on("end", () => {
      console.log(`MP3 file created: ${outputPath}`);
      // 元データを削除
      // fs.unlinkSync(rawPath);
    })
    .on("error", (err) => {
      console.error("Error during MP3 conversion:", err);
    })
    .run();
};

// encodeToMp3(TEMP_FILE, "./output.mp3");

/**
 * 音声をテキストに変換
 */
const audioToText = async (audioPath: string) => {
  try {
    const response = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: fs.createReadStream(audioPath),
      language: "ja",
      response_format: "verbose_json",
    });
    console.log("✅ 音声テキスト化：", response.text);
    const outputPath = "./transcription_result.json";
    fs.writeFileSync(outputPath, JSON.stringify(response, null, 2), "utf-8");
    summarize(response.text);
  } catch (error) {
    console.error(
      "Error during transcription:",
      error.response?.data || error.message
    );
  }
};

// audioToText("./output.mp3");

/**
 * 要約
 */
const summarize = async (content: string) => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "あなたは優秀なライターです。以下の会議の音声を要約してください。",
        },
        { role: "user", content: content },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    console.log("✅ AI要約:", response.choices[0].message.content);
  } catch (error) {
    console.error("エラー:", error.response?.data || error.message);
  }
};
