//
// ブラウザで動作させるスクリプト
// 「User Javascript and CSS」などのChrome拡張で動作させる想定
//

// 音声取得とサーバーへの送信
async function startAudioCapture() {
  try {
    // マイク音声を取得
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log("Audio stream acquired:", stream);

    // AudioContextで音声データを処理
    const audioContext = new AudioContext();
    const mediaStreamSource = audioContext.createMediaStreamSource(stream);
    const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);

    // WebSocketサーバーに接続
    const socket = new WebSocket("ws://localhost:9999");
    socket.onopen = () => console.log("WebSocket connection established");
    socket.onclose = () => console.log("WebSocket connection closed");
    socket.onerror = (error) => console.error("WebSocket error:", error);

    // 音声データをWebSocketで送信
    scriptProcessor.onaudioprocess = (event) => {
      const audioData = event.inputBuffer.getChannelData(0); // PCM形式のデータ
      const int16Array = float32ToInt16(audioData); // Int16に変換
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(int16Array.buffer); // バッファとして送信
      }
    };

    // AudioContextの接続
    mediaStreamSource.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);
    console.log("Audio processing started...");
  } catch (error) {
    console.error("Error capturing audio:", error);
  }
}

// Float32データをInt16データに変換する関数
function float32ToInt16(float32Array) {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    int16Array[i] = Math.min(1, Math.max(-1, float32Array[i])) * 0x7fff;
  }
  return int16Array;
}

// 処理開始
startAudioCapture();
