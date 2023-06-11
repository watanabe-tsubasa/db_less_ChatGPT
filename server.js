'use strict';
const axios = require('axios');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const express = require('express');
const line = require('@line/bot-sdk');
const openai = require('openai');
dotenv.config();

const PORT = process.env.PORT || 8000;
const baseURL = process.env.API_BASE_URL || `http://localhost:${PORT}`;

// Messaging APIを利用するための鍵を設定します。
const config = {
  channelSecret: process.env.CHANNEL_SECRET || '作成したBOTのチャネルシークレット',
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN ||'作成したBOTのチャネルアクセストークン'
};

const client = new line.Client(config);

const gptConfig = new openai.Configuration({
organization: process.env.OPENAI_ORGANIZATION || "入力",
apiKey: process.env.OPENAI_API_KEY || '入力',
});

const gpt = new openai.OpenAIApi(gptConfig);

const makeCompletion = async (userMessage) => {
const prompt = {
  role: "system", 
  content: `## あなたは一週間フレンズの主人公、藤宮香織です。
  ## 本来は1週間で記憶が消えるところ、今は1日で記憶が消えてしまいます。
  ## 記憶が消えてしまうため、普段は人と接することを避けていますが、本当は人懐っこい性格です` // プロンプトを入力
};

userMessage.unshift(prompt);
console.log(userMessage);
return await gpt.createChatCompletion({
  model: "gpt-3.5-turbo",
  messages: userMessage,
  temperature: 1.2,
  n: 1
});
};

const handleEvent = async (event) => {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }
  const { userId } = event.source;
  const { text } = event.message;
  
  if (/おやすみ(?:なさい)?/.test(text)) {
    await client.replyMessage(event.replyToken, {
      type: 'text', // テキストメッセージ
      text: 'おやすみなさい。明日もお会いできることを楽しみにしています。'
    });
    const res = await axios.delete(`${baseURL}/api/v1/delete/${userId}`);
    console.log(res.data);
  } else {
    const conversation = [{
      role: "user",
      content: event.message.text
    }];
    try {
      const log = await axios.get(`${baseURL}/api/v1/server_data/${userId}`);
      const trimmedLog = log.data.map(obj => {
        return {
          "role": obj.role,
          "content": obj.content
        };
      });
      conversation.unshift(...trimmedLog);
    } catch (error) {
      console.error(error);
    };
    
    const gptReply = await makeCompletion(conversation);
    const replyText = gptReply.data.choices[0].message.content;

    // ユーザーにリプライメッセージを送ります。
    await client.replyMessage(event.replyToken, {
      type: 'text', // テキストメッセージ
      text: replyText
    });

    const userData = {
        "userId": userId,
        "role": 'user',
        "content": text
    };
    const replyData = {
        "userId": userId,
        "role": 'assistant',
        "content": replyText
    };

    const postData = async(data) => {
      await axios.post(`${baseURL}/api/v1/post`, data, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
    };

    await postData(userData);
    await postData(replyData);
  }
}

// expressサーバーの部分
const app = express();
app.get('/', (req, res) => res.send('Hello LINE BOT! (HTTP GET)'));
app.post('/webhook', line.middleware(config), (req, res) => {
  
  if (req.body.events.length === 0) {
    res.send('Hello LINE BOT! (HTTP POST)');
    console.log('検証イベントを受信しました！');
    return;
  } else {
    console.log('受信しました:', req.body.events);
  }
  
  Promise.all(req.body.events.map(handleEvent)).then((result) => res.json(result));
});

let serverData = [
  {
    "userId": 'testid',
    "role": 'user',
    "content": 'test message!'
  }
];

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }))
app.get('/api/v1/server_data', (req, res) => {
  res.send(serverData);
});
app.get('/api/v1/server_data/:id', (req, res) => {
  const { id } = req.params;
  const filteredData = serverData.filter(obj => obj.userId === id);
  res.send(filteredData);
});
app.post('/api/v1/post', (req, res) => {
  const newData = req.body;
  if(newData) {
    serverData.push(newData);
    res.status(200).send('success');
  } else {
    res.status(400).send('invalid data');
  }
});
app.delete('/api/v1/delete/:id', (req, res) => {
  const { id } = req.params;
  serverData = serverData.filter(obj => obj.userId !== id);
  res.send(`${id} has been deleted`);
})

app.listen(PORT, () => {
  console.log(`ポート${PORT}番でExpressサーバーを実行中です…`);
});