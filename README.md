# WebRTC Transcription

ブラウザ上の音声をリアルタイムに文字起こしして要約

![demo.gif](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/142791/074f52bf-ac31-5bca-9a49-8a2604a506be.gif)

## Setting

- `.env`

```sh
# OpenAI
OPENAI_API_KEY=

# サービスアカウントのjsonをディレクトリにセットしてください。
GOOGLE_APPLICATION_CREDENTIALS=./google-service-account.json
```

- server

```sh
yarn
yarn dev
```

- client

`src/client.js`を[User Javascript and CSS](https://chromewebstore.google.com/detail/user-javascript-and-css/nbhcbdghjpllgmfilhnhkllmkecfmpld?hl=ja&pli=1)や Chrome 拡張にて実行ください。

## Reference

- [oVice で会議を文字起こしする仕組みを作る]()
