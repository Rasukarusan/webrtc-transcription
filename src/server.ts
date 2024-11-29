import { WebSocketServer, WebSocket } from "ws";
import { Writable } from "stream";
import * as fs from "fs";
import * as ffmpeg from "fluent-ffmpeg";
import { OpenAI } from "openai";

const PORT = process.env.PORT ?? 9999;
const TEMP_FILE = "temp.raw";
const OUTPUT_MP3_FILE = "output.mp3";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// WebSocketサーバーをセットアップ
const wss = new WebSocketServer({ port: Number(PORT) });
console.log(`WebSocket server running on ws://localhost:${PORT}`);

wss.on("connection", (ws: WebSocket) => {
  console.log("Client connected");

  // 一時ファイルへの書き込みストリームを作成
  const tempFileStream = fs.createWriteStream(TEMP_FILE);
  const audioStream = new Writable({
    write(chunk: Buffer, encoding: string, callback: () => void) {
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
    tempFileStream.end(); // TEMP_FILEの書き込みを終了
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });

  // TEMP_FILEの書き込み終了後にMP3変換を開始
  tempFileStream.on("finish", () => {
    console.log("TEMP_FILE write completed. Starting MP3 conversion...");
    encodeToMp3(TEMP_FILE, OUTPUT_MP3_FILE);
  });
});

/**
 * rawファイルをmp3に変換
 */
const encodeToMp3 = (rawPath: string, outputPath: string) => {
  ffmpeg(rawPath)
    .inputOptions("-f s16le") // PCM形式（16ビットリトルエンディアン）
    .inputOptions("-ar 44100") // サンプリングレート 16kHz
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

// encodeToMp3(TEMP_FILE, "./output-test.mp3");

/**
 * 音声をテキストに変換
 */
const audioToText = async (audioPath: string) => {
  try {
    console.log(`🚀 Start audioToText: ${audioPath}`);
    const response = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: fs.createReadStream(audioPath),
      language: "ja",
      response_format: "verbose_json",
    });
    console.log(response);
    const outputPath = "./transcription_result.json";
    fs.writeFileSync(outputPath, JSON.stringify(response, null, 2), "utf-8");
    console.log(`✅ Transcription saved to ${outputPath}`);
  } catch (error) {
    console.error(
      "Error during transcription:",
      error.response?.data || error.message
    );
  }
};

// audioToText("./output.mp3");
