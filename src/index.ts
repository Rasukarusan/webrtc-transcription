import { WebSocketServer, WebSocket } from "ws";
import { Writable } from "stream";
import { SpeechClient } from "@google-cloud/speech";
import * as fs from "fs";
import * as ffmpeg from "fluent-ffmpeg";

// Google Speech-to-Textのクライアント設定
const speechClient = new SpeechClient();
const requestConfig = {
  config: {
    encoding: "LINEAR16" as const,
    sampleRateHertz: 16000,
    languageCode: "ja-JP", // 日本語
  },
  interimResults: true, // 中間結果を取得
};

const PORT = 9999;
const TEMP_FILE = "temp.raw";
const OUTPUT_MP3_FILE = "output.mp3";

// WebSocketサーバーをセットアップ
const wss = new WebSocketServer({ port: PORT });
console.log(`WebSocket server running on ws://localhost:${PORT}`);

wss.on("connection", (ws: WebSocket) => {
  console.log("Client connected");

  // 一時ファイルへの書き込みストリームを作成
  const tempFileStream = fs.createWriteStream(TEMP_FILE);

  // Google Speech-to-Textのストリームを作成
  // const recognizeStream = speechClient.streamingRecognize(requestConfig)
  //   .on('data', data => {
  //     const transcription = data.results[0]?.alternatives[0]?.transcript || '';
  //     console.log(`Transcription: ${transcription}`);
  //   })
  //   .on('error', error => console.error('Speech-to-Text error:', error))
  //   .on('end', () => console.log('Speech-to-Text stream ended'));

  // 音声データをGoogle Speech-to-TextとTEMP_FILEに書き込む
  const audioStream = new Writable({
    write(chunk: Buffer, encoding: string, callback: () => void) {
      // recognizeStream.write(chunk); // Speech-to-Textに送信
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

  // TEMP_FILEの書き込み終了後にMP3変換を開始
  tempFileStream.on("finish", () => {
    console.log("TEMP_FILE write completed. Starting MP3 conversion...");
    encodeToMp3(TEMP_FILE, OUTPUT_MP3_FILE);
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    audioStream.end();
    tempFileStream.end(); // TEMP_FILEの書き込みを終了
    // recognizeStream.end(); // Speech-to-Textの終了
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

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

encodeToMp3(TEMP_FILE, "./output-test.mp3");
