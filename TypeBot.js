const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const fileUpload = require('express-fileupload');
const port = 8000;
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const url = 'https://botzdgtype.comunidadezdg.com.br/api/v1/sendMessage';
const typebot = 'zdg';
const dirBot = './typebot';

if (!fs.existsSync(dirBot)){
    fs.mkdirSync(dirBot)
}

app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));
app.use(fileUpload({
  debug: true
}));
app.use("/", express.static(__dirname + "/"))
app.get('/', (req, res) => {
  res.sendFile('index.html', {
    root: __dirname
  });
});

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'typebot' }),
  puppeteer: { headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // <- this one doesn't works in Windows
      '--disable-gpu'
    ] }
});

client.initialize();

io.on('connection', function(socket) {
  socket.emit('message', '© BOT-ZDG - Iniciado');
  socket.emit('qr', './icon.svg');

client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.toDataURL(qr, (err, url) => {
      socket.emit('qr', url);
      socket.emit('message', '© BOT-ZDG QRCode recebido, aponte a câmera  seu celular!');
    });
});

client.on('ready', async () => {
    socket.emit('ready', '© BOT-ZDG Dispositivo pronto!');
    socket.emit('message', '© BOT-ZDG Dispositivo pronto!');
    socket.emit('qr', './check.svg')	
    console.log('© BOT-ZDG Dispositivo pronto');
});

client.on('authenticated', () => {
    socket.emit('authenticated', '© BOT-ZDG Autenticado!');
    socket.emit('message', '© BOT-ZDG Autenticado!');
    console.log('© BOT-ZDG Autenticado');
});

client.on('auth_failure', function() {
    socket.emit('message', '© BOT-ZDG Falha na autenticação, reiniciando...');
    console.error('© BOT-ZDG Falha na autenticação');
});

client.on('change_state', state => {
  console.log('© BOT-ZDG Status de conexão: ', state );
});

client.on('disconnected', (reason) => {
  socket.emit('message', '© BOT-ZDG Cliente desconectado!');
  console.log('© BOT-ZDG Cliente desconectado', reason);
  client.initialize();
});
});

function deleteDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath);
    files.forEach((file) => {
      const filePath = path.join(dirPath, file);
      if (fs.statSync(filePath).isDirectory()) {
        deleteDirectory(filePath);
      } else {
        fs.unlinkSync(filePath);
      }
    });
    try {
      fs.rmdirSync(dirPath);
      console.log(`Diretório ${dirPath} deletado com sucesso.`);
    } catch (error) {
      console.error(`Erro ao deletar diretório ${dirPath}:`, error);
    }
  } else {
    console.log(`O diretório ${dirPath} não existe.`);
  }
}

async function readWriteFileJson(sessionId, from) {
  let dataFile = [];
  fs.writeFileSync("./typebot/" + from + "/typebot.json", JSON.stringify(dataFile));
  var data = fs.readFileSync("./typebot/" + from + "/typebot.json");
  var myObject = JSON.parse(data);
  let newData = {
    id: sessionId,
  };
  await myObject.push(newData);
  fs.writeFileSync("./typebot/" + from + "/typebot.json", JSON.stringify(myObject));
}

async function createSession(data){
  const reqData = {
    sessionId: data.from,
    startParams: {
      typebot: typebot,
      prefilledVariables: {
        number: data.from.split('@')[0],
        name: data.notifyName
      },
    },
  };
  const request = await axios.post(url, reqData);
  const dirFrom = './typebot/' + data.from.replace(/\D/g,'');
  if (!fs.existsSync(dirFrom)){
    fs.mkdirSync(dirFrom);
    await readWriteFileJson(request.data.sessionId, data.from.replace(/\D/g,''));
  }
}

client.on('message', async msg => {
  const dirFrom = './typebot/' + msg.from.replace(/\D/g,'');
  if (!fs.existsSync(dirFrom)){
    await createSession(msg);
  }
  if (msg.body !== 'sair'){
    const from = msg.from.replace(/\D/g,'');
    const sessionId = fs.readFileSync("./typebot/" + from + "/typebot.json","utf8").split(':')[1].replace(/\W/g, '');
    const content = msg.body;
    const reqData = {
        message: content,
        sessionId: sessionId,
    };
    const request = await axios.post(url, reqData);
    const messages = request.data.messages
    for (const message of messages){
      if (message.type === 'text') {
        let formattedText = '';
        for (const richText of message.content.richText){
          for (const element of richText.children){
            let text = '';
            if (element.text) {
                text = element.text;
            }
            if (element.bold) {
                text = `*${text}*`;
            }
            if (element.italic) {
                text = `_${text}_`;
            }
            if (element.underline) {
                text = `~${text}~`;
            }
            formattedText += text;          
          }
          formattedText += '\n';
        }
        formattedText = formattedText.replace(/\n$/, '');
        await client.sendMessage(msg.from, formattedText);
      }
      if (message.type === 'image' || message.type === 'video') {
        console.log(message)
        try{
          const media = await MessageMedia.fromUrl(message.content.url)
          await client.sendMessage(msg.from, media, {caption: 'Comunidade ZDG'})
        }catch(e){}
      }
      if (message.type === 'audio') {
        console.log(message)
        try{
          const media = await MessageMedia.fromUrl(message.content.url)
          await client.sendMessage(msg.from, media, {sendAudioAsVoice: true})
        }catch(e){}
      }
    }
  }
  if (msg.body === 'sair'){
    await deleteDirectory(dirFrom)
    await client.sendMessage(msg.from, 'Atendimento automático desligado.')
  }
});

console.log("\nA Comunidade ZDG é a oportunidade perfeita para você aprender a criar soluções incríveis usando as APIs, sem precisar de experiência prévia com programação. Com conteúdo exclusivo e atualizado, você terá tudo o que precisa para criar robôs, sistemas de atendimento e automações do zero. O curso é projetado para iniciantes e avançados, e oferece um aprendizado prático e passo a passo para que você possa criar soluções incríveis.")
console.log("\nIncreva-se agora acessando link: comunidadezdg.com.br\n")
   
server.listen(port, function() {
  console.log('App running on *: ' + port);
});
