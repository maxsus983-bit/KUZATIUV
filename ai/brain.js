const CONFIG = require('../config');
const logger = require('../core/logger');
const Memory = require('./memory');

class AIBrain {

constructor(bot) {

this.bot = bot;

this.memory =
  new Memory();

this.running = false;

this.timer = null;

this.lastDecision = null;

}

start() {

if (
  this.running ||
  !CONFIG.AI.ENABLED
) {

  return;

}

this.running = true;

logger.info(
  '🧠 AI Brain ishga tushdi.'
);

this.timer =
  setInterval(
    () => this.think(),
    CONFIG.AI.THINK_INTERVAL
  );

}

stop() {

this.running = false;

if (this.timer) {

  clearInterval(this.timer);

  this.timer = null;

}

}

buildWorldState() {

return {

  server: {

    connected:
      this.bot.connected,

    spawned:
      this.bot.spawned

  },

  bot: {

    username:
      this.bot.username,

    position:
      this.bot.movement
        ?.getState()
        ?.position || null,

    rotation:
      this.bot.movement
        ?.getState()
        ?.rotation || null

  },

  players:
    this.bot.observer
      .getPlayers(),

  recentEvents:
    this.bot.observer
      .getRecentEvents(30),

  recentChat:
    this.bot.observer
      .chat
      .getRecent(20)

};

}

async think() {

if (
  !this.running ||
  !this.bot.connected ||
  !this.bot.spawned
) {

  return;

}

try {

  const world =
    this.buildWorldState();


  this.memory.add(
    'world_state',
    world
  );


  if (
    !CONFIG.OPENROUTER.ENABLED
  ) {

    /*
     * API yo'q bo'lsa xavfsiz
     * lokal kuzatuv rejimi.
     */
    this.localDecision(world);

    return;

  }


  const decision =
    await this.askAI(world);


  if (!decision) {

    return;

  }


  this.lastDecision =
    decision;


  this.memory.add(
    'ai_decision',
    decision
  );


  await this.executeDecision(
    decision
  );


} catch (error) {

  logger.error(
    'AI think error.',
    error
  );

}

}

localDecision(world) {

/*
 * OpenRouter bo'lmasa AI
 * o'zicha xavfli harakat qilmaydi.
 */

this.lastDecision = {

  action: 'observe',

  reason:
    'OpenRouter API ulanmagan.'

};

}

async askAI(world) {

const systemPrompt = `

SEN AKV NOMLI MINECRAFT BEDROCK AI AGENTSAN.

SENING VAZIFANG:
Minecraft serverida mustaqil yashash,
atrofni kuzatish, playerlarni tushunish,
vaziyatni tahlil qilish va maqsadga qarab
eng yaxshi harakatni tanlash.

MUHIM QOIDALAR:

1. Har bir qarorni avval vaziyatni tahlil qilib qil.
2. Keraksiz harakat qilma.
3. Playerlar bilan muloqotda tabiiy bo'l.
4. Chatni kuzat.
5. Player kirsa yoki chiqsa buni hisobga ol.
6. Xavf bo'lsa xavfsiz harakatni tanla.
7. Maqsad berilsa unga erishish uchun reja tuz.
8. Yo'l to'silsa boshqa yo'lni tanla.
9. O'zingga berilgan buyruqni unutma.
10. Avtonom rejimda foydali harakat qil.
11. Bir xil harakatni cheksiz takrorlama.
12. Agar hech narsa qilish kerak bo'lmasa kuzat.
13. Bilmagan narsangni o'ylab topib yuborma.
14. Minecraftdagi real kuzatuv ma'lumotlaridan foydalan.
15. Harakatni action orqali bajar.

SENING ACTIONLARING:

observe
forward
backward
left
right
stop
jump
look
chat
follow
goto

JSON FORMATIDAN CHIQMA.

Masalan:

{
"action": "forward",
"duration": 1500,
"reason": "Oldindagi yo'l ochiq."
}

Yoki:

{
"action": "chat",
"message": "Salom!",
"reason": "Player menga murojaat qildi."
}

WORLD STATE:
${JSON.stringify(world, null, 2)}

`;

const response =
  await fetch(
    CONFIG.OPENROUTER.URL,
    {

      method: 'POST',

      headers: {

        'Authorization':
          `Bearer ${CONFIG.OPENROUTER.API_KEY}`,

        'Content-Type':
          'application/json'

      },

      body: JSON.stringify({

        model:
          CONFIG.OPENROUTER.MODEL,

        messages: [

          {
            role: 'system',

            content:
              systemPrompt

          },

          {

            role: 'user',

            content:
              'Hozirgi vaziyatni tahlil qil va eng yaxshi actionni tanla.'

          }

        ],

        temperature: 0.4,

        max_tokens: 500

      })

    }

  );


if (!response.ok) {

  throw new Error(
    `OpenRouter HTTP ${response.status}`
  );

}


const data =
  await response.json();


const text =
  data?.choices?.[0]?.message?.content;


if (!text) {

  return null;

}


return this.extractJSON(
  text
);

}

extractJSON(text) {

try {

  return JSON.parse(text);

} catch {}


const match =
  text.match(
    /\{[\s\S]*\}/
  );


if (!match) {

  logger.warn(
    'AI JSON topilmadi.'
  );

  return null;

}


try {

  return JSON.parse(
    match[0]
  );

} catch {

  return null;

}

}

async executeDecision(decision) {

if (!decision) {
  return;
}


logger.info(
  `🧠 AI ACTION: ${decision.action}`
);

if (
  decision.reason
) {

  logger.info(
    `   Sabab: ${decision.reason}`
  );

}


const movement =
  this.bot.movement;


switch (
  decision.action
) {


  case 'forward':

    movement.forward();

    await this.delay(
      decision.duration || 1000
    );

    movement.stopMoving();

    break;


  case 'backward':

    movement.backward();

    await this.delay(
      decision.duration || 1000
    );

    movement.stopMoving();

    break;


  case 'left':

    movement.left();

    await this.delay(
      decision.duration || 700
    );

    movement.stopMoving();

    break;


  case 'right':

    movement.right();

    await this.delay(
      decision.duration || 700
    );

    movement.stopMoving();

    break;


  case 'jump':

    movement.jump();

    break;


  case 'stop':

    movement.stopMoving();

    break;


  case 'look':

    movement.look(

      Number(
        decision.yaw || 0
      ),

      Number(
        decision.pitch || 0
      )

    );

    break;


  case 'chat':

    if (
      decision.message
    ) {

      this.bot.sendChat(
        decision.message
      );

    }

    break;


  case 'follow':

    if (
      decision.target
    ) {

      this.bot.followPlayer(
        decision.target
      );

    }

    break;


  case 'goto':

    if (
      decision.target
    ) {

      this.bot.goTo(
        decision.target
      );

    }

    break;


  case 'observe':

    break;


  default:

    logger.warn(
      `Noma'lum AI action: ${decision.action}`
    );

}

}

delay(ms) {

return new Promise(
  resolve =>
    setTimeout(
      resolve,
      ms
    )
);

}

getStatus() {

return {

  running:
    this.running,

  lastDecision:
    this.lastDecision,

  memory:
    this.memory.recent(10)

};

}

}

module.exports = AIBrain;
