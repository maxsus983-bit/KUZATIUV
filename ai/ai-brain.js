'use strict';

/*
===============================================================
                    AKV AI BRAIN
===============================================================

Bu modul AKV botning qaror qabul qilish markazi.

Vazifalari:

  🧠 Tabiiy buyruqlarni tushunish
  🚶 Movement buyruqlarini bajarish
  👤 Playerlarni topish
  📍 Koordinataga borish
  👁️ World Observer ma'lumotlarini tahlil qilish
  💬 Chat buyruqlarini qayta ishlash
  🤖 "O'zing o'yna" avtonom rejimini boshqarish
  📋 Server holatini umumlashtirish
  💾 Muhim hodisalarni xotirada saqlash

Misollar:

  "oldinga yur"
  "20 blok oldinga yur"
  "50 blok orqaga yur"
  "chapga 30 blok yur"
  "o'ngga 10 blok yur"
  "to'xta"
  "sakra"
  "Steve oldiga bor"
  "100 64 -50 ga bor"
  "Steve'ni kuzat"
  "o'zing o'yna"
  "avtonom rejimni to'xtat"

===============================================================
*/


const logger = require('../core/logger');


class AIBrain {

  constructor(options = {}) {

    this.bot =
      options.bot || null;


    this.observer =
      options.observer || null;


    this.navigator =
      options.navigator || null;


    /*
    ============================================================
    AI HOLATI
    ============================================================
    */

    this.state = {

      enabled: true,

      autonomous: false,

      busy: false,

      currentTask: null,

      lastCommand: null,

      lastDecision: null,

      lastReport: null

    };


    /*
    ============================================================
    AVTONOM REJIM SOZLAMALARI
    ============================================================
    */

    this.autonomousConfig = {

      decisionInterval: 5000,

      observationRadius: 32,

      dangerRadius: 12,

      maxPlayersDistance: 100,

      allowMovement: true,

      allowJump: true,

      allowFollow: false

    };


    /*
    ============================================================
    XOTIRA
    ============================================================
    */

    this.memory = {

      facts: [],

      importantEvents: [],

      visitedLocations: [],

      knownPlayers: new Map()

    };


    /*
    ============================================================
    LOOP
    ============================================================
    */

    this.autonomousTimer = null;

    this.reportTimer = null;

  }


  /*
  ==============================================================
  START
  ==============================================================
  */

  start() {

    if (!this.state.enabled) {

      this.state.enabled = true;

    }


    logger.info(
      '🧠 AKV AI Brain ishga tushdi.'
    );

  }


  /*
  ==============================================================
  STOP
  ==============================================================
  */

  stop() {

    this.disableAutonomous();

    this.state.enabled = false;

    this.cancelCurrentTask();

  }


  /*
  ==============================================================
  COMMAND
  ==============================================================

  Tashqaridan kelgan tabiiy til buyruqlarini qabul qiladi.
  */

  async command(text) {

    if (
      !text ||
      typeof text !== 'string'
    ) {

      return {

        ok: false,

        message:
          'Buyruq bo‘sh.'

      };

    }


    const command =
      text
        .trim()
        .replace(/\s+/g, ' ');


    this.state.lastCommand =
      command;


    logger.info(
      `🧠 COMMAND: ${command}`
    );


    /*
    ------------------------------------------------------------
    TO'XTASH
    ------------------------------------------------------------
    */

    if (
      this.isStopCommand(
        command
      )
    ) {

      this.cancelCurrentTask();

      return {

        ok: true,

        action: 'stop',

        message:
          '🛑 To‘xtadim.'

      };

    }


    /*
    ------------------------------------------------------------
    AVTONOM YOQISH
    ------------------------------------------------------------
    */

    if (
      this.isAutonomousStartCommand(
        command
      )
    ) {

      this.enableAutonomous();


      return {

        ok: true,

        action: 'autonomous_start',

        message:
          '🤖 Avtonom rejim yoqildi. Atrofni kuzatib, vaziyatga qarab mustaqil qaror qilaman.'

      };

    }


    /*
    ------------------------------------------------------------
    AVTONOM O'CHIRISH
    ------------------------------------------------------------
    */

    if (
      this.isAutonomousStopCommand(
        command
      )
    ) {

      this.disableAutonomous();


      return {

        ok: true,

        action: 'autonomous_stop',

        message:
          '🛑 Avtonom rejim to‘xtatildi.'

      };

    }


    /*
    ------------------------------------------------------------
    STATUS
    ------------------------------------------------------------
    */

    if (
      this.isStatusCommand(
        command
      )
    ) {

      return {

        ok: true,

        action: 'status',

        data:
          this.getStatus(),

        message:
          this.createStatusReport()

      };

    }


    /*
    ------------------------------------------------------------
    NIMA BOR?
    ------------------------------------------------------------
    */

    if (
      this.isObservationCommand(
        command
      )
    ) {

      return {

        ok: true,

        action: 'observe',

        data:
          this.getWorldState(),

        message:
          this.createObservationReport()

      };

    }


    /*
    ------------------------------------------------------------
    SAKRA
    ------------------------------------------------------------
    */

    if (
      this.isJumpCommand(
        command
      )
    ) {

      return await this.executeJump();

    }


    /*
    ------------------------------------------------------------
    PLAYERNI KUZATISH
    ------------------------------------------------------------
    */

    const followTarget =
      this.parseFollowCommand(
        command
      );


    if (followTarget) {

      return await this.executeFollow(
        followTarget
      );

    }


    /*
    ------------------------------------------------------------
    PLAYER OLDIGA BORISH
    ------------------------------------------------------------
    */

    const playerTarget =
      this.parsePlayerTarget(
        command
      );


    if (playerTarget) {

      return await this.executeGoToPlayer(
        playerTarget
      );

    }


    /*
    ------------------------------------------------------------
    COORDINATE GOTO
    ------------------------------------------------------------
    */

    const coordinates =
      this.parseCoordinates(
        command
      );


    if (coordinates) {

      return await this.executeGoToCoordinates(
        coordinates
      );

    }


    /*
    ------------------------------------------------------------
    DISTANCE MOVEMENT
    ------------------------------------------------------------
    */

    const movement =
      this.parseMovementCommand(
        command
      );


    if (movement) {

      return await this.executeMovement(
        movement
      );

    }


    /*
    ------------------------------------------------------------
    SIMPLE MOVEMENT
    ------------------------------------------------------------
    */

    const simple =
      this.parseSimpleMovement(
        command
      );


    if (simple) {

      return await this.executeMovement(
        simple
      );

    }


    /*
    ------------------------------------------------------------
    UNKNOWN COMMAND
    ------------------------------------------------------------
    */

    return {

      ok: false,

      action: 'unknown',

      message:
        `🧠 Buyruqni tushunmadim: "${command}". Masalan: "20 blok oldinga yur", "to‘xta", "Steve oldiga bor" yoki "o‘zing o‘yna".`

    };

  }


  /*
  ==============================================================
  MOVEMENT PARSER
  ==============================================================

  Istalgan raqamni qabul qiladi.

  1
  5
  10
  25
  100
  500
  1000

  va hokazo.
  */

  parseMovementCommand(
    text
  ) {

    const normalized =
      this.normalizeText(
        text
      );


    let direction = null;


    if (
      /\boldinga\b/.test(
        normalized
      ) ||
      /\boldi\b/.test(
        normalized
      )
    ) {

      direction =
        'forward';

    }


    if (
      /\borqaga\b/.test(
        normalized
      ) ||
      /\borqa\b/.test(
        normalized
      )
    ) {

      direction =
        'backward';

    }


    if (
      /\bchapga\b/.test(
        normalized
      )
    ) {

      direction =
        'left';

    }


    if (
      /\bo.ngga\b/.test(
        normalized
      ) ||
      /\bonga\b/.test(
        normalized
      )
    ) {

      direction =
        'right';

    }


    if (!direction) {

      return null;

    }


    /*
    ------------------------------------------------------------
    SONNI TOPISH
    ------------------------------------------------------------
    */

    const numberMatch =
      normalized.match(
        /(\d+(?:[.,]\d+)?)/
      );


    let distance =
      numberMatch
        ? Number(
            numberMatch[1]
              .replace(',', '.')
          )
        : 5;


    /*
    Manfiy yoki nol masofani qabul qilmaymiz.
    */

    if (
      !Number.isFinite(distance) ||
      distance <= 0
    ) {

      distance = 5;

    }


    /*
    Juda katta raqam ham texnik jihatdan qabul qilinadi,
    lekin xavfsiz limit bilan.
    */

    distance =
      Math.min(
        distance,
        100000
      );


    return {

      type: 'distance',

      direction,

      distance

    };

  }


  /*
  ==============================================================
  SIMPLE MOVEMENT
  ==============================================================

  "oldinga yur"
  "orqaga yur"
  "chapga yur"
  "o'ngga yur"
  */

  parseSimpleMovement(
    text
  ) {

    const normalized =
      this.normalizeText(
        text
      );


    let direction = null;


    if (
      /\boldinga\b/.test(
        normalized
      ) ||
      /\boldi\b/.test(
        normalized
      )
    ) {

      direction =
        'forward';

    } else if (
      /\borqaga\b/.test(
        normalized
      )
    ) {

      direction =
        'backward';

    } else if (
      /\bchapga\b/.test(
        normalized
      )
    ) {

      direction =
        'left';

    } else if (
      /\bo.ngga\b/.test(
        normalized
      ) ||
      /\bonga\b/.test(
        normalized
      )
    ) {

      direction =
        'right';

    }


    if (!direction) {

      return null;

    }


    return {

      type: 'distance',

      direction,

      distance: 5

    };

  }


  /*
  ==============================================================
  EXECUTE MOVEMENT
  ============================================================== 
  */

  async executeMovement(
    movement
  ) {

    if (
      !this.navigator
    ) {

      return {

        ok: false,

        message:
          '❌ Navigator ulanmagan.'

      };

    }


    if (
      this.state.busy
    ) {

      this.cancelCurrentTask();

    }


    this.state.busy = true;

    this.state.currentTask = {

      type: 'movement',

      ...movement

    };


    this.state.lastDecision = {

      type: 'movement',

      direction:
        movement.direction,

      distance:
        movement.distance

    };


    const directionText =
      this.directionToUzbek(
        movement.direction
      );


    logger.info(
      `🚶 ${movement.distance} blok ${directionText}`
    );


    try {

      /*
      ----------------------------------------------------------
      Distance bo'yicha yurish.

      Navigator ichidagi haqiqiy movement engine keyinchalik
      blok masofasini aniq hisoblaydi.
      ----------------------------------------------------------
      */

      let result = false;


      /*
      Har bir blok uchun taxminiy vaqt.
      Bu keyingi Pathfinder tomonidan yaxshilanadi.
      */

      const millisecondsPerBlock =
        550;


      const duration =
        Math.max(
          200,
          movement.distance *
          millisecondsPerBlock
        );


      if (
        movement.direction ===
        'forward'
      ) {

        result =
          await this.navigator.forward(
            duration
          );

      } else if (
        movement.direction ===
        'backward'
      ) {

        result =
          await this.navigator.backward(
            duration
          );

      } else if (
        movement.direction ===
        'left'
      ) {

        result =
          await this.navigator.left(
            duration
          );

      } else if (
        movement.direction ===
        'right'
      ) {

        result =
          await this.navigator.right(
            duration
          );

      }


      this.state.busy = false;

      this.state.currentTask = null;


      this.remember(

        `AKV ${movement.distance} blok ${directionText} harakat qildi.`

      );


      return {

        ok: result !== false,

        action: 'movement',

        message:
          result !== false
            ? `✅ ${movement.distance} blok ${directionText} yurish tugadi.`
            : `⚠️ ${directionText} harakatni bajarishning iloji bo‘lmadi.`

      };

    } catch (error) {

      this.state.busy = false;

      this.state.currentTask = null;


      logger.error(
        'AI movement error:',
        error
      );


      return {

        ok: false,

        action: 'movement_error',

        message:
          `❌ Harakatda xatolik: ${error.message}`

      };

    }

  }


  /*
  ==============================================================
  JUMP
  ============================================================== 
  */

  async executeJump() {

    if (
      !this.navigator
    ) {

      return {

        ok: false,

        message:
          '❌ Navigator ulanmagan.'

      };

    }


    try {

      this.navigator.jump();


      return {

        ok: true,

        action: 'jump',

        message:
          '🦘 Sakradim.'

      };

    } catch (error) {

      return {

        ok: false,

        message:
          `❌ Sakrashda xatolik: ${error.message}`

      };

    }

  }


  /*
  ==============================================================
  PARSE PLAYER
  ==============================================================

  "Steve oldiga bor"
  "Alex yoniga bor"
  "Steve tomon yur"
  */

  parsePlayerTarget(
    text
  ) {

    if (
      !this.observer
    ) {

      return null;

    }


    const normalized =
      this.normalizeText(
        text
      );


    const players =
      this.observer.getPlayers();


    if (
      !players ||
      players.length === 0
    ) {

      return null;

    }


    for (
      const player
      of players
    ) {

      if (
        !player.username
      ) {

        continue;

      }


      const username =
        this.normalizeText(
          player.username
        );


      if (
        normalized.includes(
          username
        ) &&
        (
          normalized.includes(
            'oldiga'
          ) ||
          normalized.includes(
            'yoniga'
          ) ||
          normalized.includes(
            'tomon'
          ) ||
          normalized.includes(
            'bor'
          )
        )
      ) {

        return {

          username:
            player.username

        };

      }

    }


    return null;

  }


  /*
  ==============================================================
  GO TO PLAYER
  ============================================================== 
  */

  async executeGoToPlayer(
    username
  ) {

    if (
      !this.navigator
    ) {

      return {

        ok: false,

        message:
          '❌ Navigator ulanmagan.'

      };

    }


    logger.info(
      `🎯 ${username} oldiga borish`
    );


    try {

      const result =
        await this.navigator.goToPlayer(
          username,
          {

            maxTime:
              60000,

            tolerance:
              2

          }
        );


      return {

        ok:
          result !== false,

        action:
          'goto_player',

        message:
          result !== false
            ? `✅ ${username} oldiga yetib bordim.`
            : `⚠️ ${username} oldiga borolmadim.`

      };

    } catch (error) {

      return {

        ok: false,

        message:
          `❌ ${username} tomon harakatda xatolik: ${error.message}`

      };

    }

  }


  /*
  ==============================================================
  FOLLOW PARSER
  ============================================================== 
  */

  parseFollowCommand(
    text
  ) {

    if (
      !this.observer
    ) {

      return null;

    }


    const normalized =
      this.normalizeText(
        text
      );


    const players =
      this.observer.getPlayers();


    if (
      !players
    ) {

      return null;

    }


    if (
      !(
        normalized.includes(
          'kuzat'
        ) ||
        normalized.includes(
          'ergash'
        ) ||
        normalized.includes(
          'orqasidan'
        )
      )
    ) {

      return null;

    }


    for (
      const player
      of players
    ) {

      const username =
        this.normalizeText(
          player.username
        );


      if (
        normalized.includes(
          username
        )
      ) {

        return player.username;

      }

    }


    return null;

  }


  /*
  ==============================================================
  EXECUTE FOLLOW
  ============================================================== 
  */

  async executeFollow(
    username
  ) {

    if (
      !this.navigator
    ) {

      return {

        ok: false,

        message:
          '❌ Navigator ulanmagan.'

      };

    }


    try {

      this.state.busy = true;

      this.state.currentTask = {

        type: 'follow',

        username

      };


      await this.navigator.followPlayer(

        username,

        {

          interval:
            1000,

          maxDistance:
            3

        }

      );


      this.state.busy = false;

      this.state.currentTask = null;


      return {

        ok: true,

        action:
          'follow',

        message:
          `👤 ${username} kuzatuv rejimi tugadi.`

      };

    } catch (error) {

      this.state.busy = false;

      this.state.currentTask = null;


      return {

        ok: false,

        message:
          `❌ Kuzatishda xatolik: ${error.message}`

      };

    }

  }


  /*
  ==============================================================
  COORDINATE PARSER
  ==============================================================

  "100 64 -50 ga bor"
  "x100 y64 z-50"
  "100,64,-50"
  */

  parseCoordinates(
    text
  ) {

    const normalized =
      this.normalizeText(
        text
      );


    /*
    x/y/z format
    */

    const xyz =
      normalized.match(

        /x\s*(-?\d+(?:[.,]\d+)?)\s*y\s*(-?\d+(?:[.,]\d+)?)\s*z\s*(-?\d+(?:[.,]\d+)?)/

      );


    if (xyz) {

      return {

        x:
          Number(
            xyz[1]
              .replace(',', '.')
          ),

        y:
          Number(
            xyz[2]
              .replace(',', '.')
          ),

        z:
          Number(
            xyz[3]
              .replace(',', '.')
          )

      };

    }


    /*
    Oddiy 3 ta son.
    */

    const numbers =
      normalized.match(

        /(-?\d+(?:[.,]\d+)?)[,\s]+(-?\d+(?:[.,]\d+)?)[,\s]+(-?\d+(?:[.,]\d+)?)/

      );


    if (!numbers) {

      return null;

    }


    if (
      !(
        normalized.includes(
          'ga bor'
        ) ||
        normalized.includes(
          'bor'
        ) ||
        normalized.includes(
          'koordinata'
        )
      )
    ) {

      return null;

    }


    return {

      x:
        Number(
          numbers[1]
            .replace(',', '.')
        ),

      y:
        Number(
          numbers[2]
            .replace(',', '.')
        ),

      z:
        Number(
          numbers[3]
            .replace(',', '.')
        )

    };

  }


  /*
  ==============================================================
  EXECUTE COORDINATES
  ============================================================== 
  */

  async executeGoToCoordinates(
    coordinates
  ) {

    if (
      !this.navigator
    ) {

      return {

        ok: false,

        message:
          '❌ Navigator ulanmagan.'

      };

    }


    try {

      const result =
        await this.navigator.goTo(

          coordinates.x,

          coordinates.y,

          coordinates.z,

          {

            maxTime:
              120000,

            tolerance:
              1.5

          }

        );


      return {

        ok:
          result !== false,

        action:
          'goto_coordinates',

        message:
          result !== false
            ? `✅ ${coordinates.x} ${coordinates.y} ${coordinates.z} koordinatasiga yetib bordim.`
            : `⚠️ Koordinataga yetib borolmadim.`

      };

    } catch (error) {

      return {

        ok: false,

        message:
          `❌ GOTO xatoligi: ${error.message}`

      };

    }

  }


  /*
  ==============================================================
  AUTONOMOUS MODE
  ============================================================== 
  */

  enableAutonomous() {

    if (
      this.state.autonomous
    ) {

      return;

    }


    this.state.autonomous =
      true;


    logger.info(
      '🤖 AUTONOMOUS MODE: ON'
    );


    this.autonomousDecisionLoop();

  }


  disableAutonomous() {

    this.state.autonomous =
      false;


    if (
      this.autonomousTimer
    ) {

      clearTimeout(
        this.autonomousTimer
      );

      this.autonomousTimer =
        null;

    }


    logger.info(
      '🤖 AUTONOMOUS MODE: OFF'
    );

  }


  /*
  ==============================================================
  AUTONOMOUS DECISION LOOP
  ==============================================================

  Muhim:

  Bu "AI o'zicha hamma narsani qila oladi" degani emas.

  Unga mavjud observer va movement imkoniyatlari asosida
  xavfsiz qarorlar beriladi.

  Keyinchalik OpenRouter/LLM Brain shu joyga ulanadi.
  */

  async autonomousDecisionLoop() {

    if (
      !this.state.autonomous
    ) {

      return;

    }


    try {

      const world =
        this.getWorldState();


      const decision =
        this.makeAutonomousDecision(
          world
        );


      if (
        decision
      ) {

        this.state.lastDecision =
          decision;


        await this.executeDecision(
          decision
        );

      }

    } catch (error) {

      logger.error(
        'Autonomous decision error:',
        error
      );

    }


    if (
      this.state.autonomous
    ) {

      this.autonomousTimer =
        setTimeout(

          () =>
            this.autonomousDecisionLoop(),

          this.autonomousConfig
            .decisionInterval

        );

    }

  }


  /*
  ==============================================================
  AUTONOMOUS DECISION
  ==============================================================

  Hozirgi boshlang'ich xavfsiz AI.

  Keyinchalik LLM qarorini shu yerga qo'shish mumkin.
  */

  makeAutonomousDecision(
    world
  ) {

    /*
    ------------------------------------------------------------
    Agar server ulanmagan bo'lsa
    ------------------------------------------------------------
    */

    if (
      !world.server?.connected
    ) {

      return null;

    }


    /*
    ------------------------------------------------------------
    Xavfli entitylarni qidirish
    ------------------------------------------------------------
    */

    const danger =
      this.findDangerousEntity(
        world.entities
      );


    if (danger) {

      return {

        type: 'look',

        target:
          danger.position,

        reason:
          `Xavfli entity yaqin: ${danger.identifier}`

      };

    }


    /*
    ------------------------------------------------------------
    Yaqin player bo'lsa kuzatish.
    ------------------------------------------------------------
    */

    const players =
      world.players || [];


    if (
      players.length > 0
    ) {

      const nearest =
        players
          .filter(
            p =>
              p.position
          )
          .sort(

            (a, b) =>
              (a.distance ?? Infinity) -
              (b.distance ?? Infinity)

          )[0];


      if (
        nearest &&
        nearest.distance !== null &&
        nearest.distance < 8
      ) {

        return {

          type: 'look',

          target:
            nearest.position,

          reason:
            `${nearest.username} yaqin.`

        };

      }

    }


    /*
    ------------------------------------------------------------
    Default autonomous action.

    Kichik movement.
    ------------------------------------------------------------
    */

    if (
      this.autonomousConfig.allowMovement
    ) {

      const directions = [

        'forward',

        'left',

        'right'

      ];


      const direction =
        directions[
          Math.floor(
            Math.random() *
            directions.length
          )
        ];


      return {

        type:
          'small_movement',

        direction,

        distance:
          1,

        reason:
          'Atrofni kuzatish'

      };

    }


    return null;

  }


  /*
  ==============================================================
  EXECUTE AUTONOMOUS DECISION
  ============================================================== 
  */

  async executeDecision(
    decision
  ) {

    if (
      !decision
    ) {

      return;

    }


    if (
      decision.type ===
      'small_movement'
    ) {

      /*
      Autonomous mode'da tasklar ustma-ust tushmasligi kerak.
      */

      if (
        this.state.busy
      ) {

        return;

      }


      await this.executeMovement({

        type:
          'distance',

        direction:
          decision.direction,

        distance:
          decision.distance

      });


      return;

    }


    if (
      decision.type ===
      'look'
    ) {

      if (
        this.navigator &&
        decision.target
      ) {

        this.navigator.facePosition(
          decision.target
        );

      }

    }

  }


  /*
  ==============================================================
  DANGER DETECTION
  ============================================================== 
  */

  findDangerousEntity(
    entities
  ) {

    if (
      !Array.isArray(
        entities
      )
    ) {

      return null;

    }


    const dangerousWords = [

      'zombie',

      'skeleton',

      'creeper',

      'spider',

      'witch',

      'enderman',

      'husk',

      'drowned',

      'pillager',

      'vindicator',

      'phantom'

    ];


    for (
      const entity
      of entities
    ) {

      if (
        !entity.identifier
      ) {

        continue;

      }


      const name =
        String(
          entity.identifier
        )
        .toLowerCase();


      const dangerous =
        dangerousWords.some(
          word =>
            name.includes(
              word
            )
        );


      if (
        dangerous &&
        (
          entity.distance === null ||
          entity.distance <=
            this.autonomousConfig
              .dangerRadius
        )
      ) {

        return entity;

      }

    }


    return null;

  }


  /*
  ==============================================================
  OBSERVATION
  ============================================================== 
  */

  getWorldState() {

    if (
      !this.observer
    ) {

      return {

        server: {

          connected: false

        },

        players: [],

        entities: [],

        recentChat: [],

        recentEvents: []

      };

    }


    return this.observer
      .getWorldState();

  }


  /*
  ==============================================================
  OBSERVATION REPORT
  ============================================================== 
  */

  createObservationReport() {

    const world =
      this.getWorldState();


    const lines = [];


    const botPosition =
      world.bot?.position;


    if (botPosition) {

      lines.push(

        `📍 Men: ${this.formatPosition(botPosition)}`

      );

    }


    const players =
      world.players || [];


    if (
      players.length === 0
    ) {

      lines.push(
        '👤 Yaqinda player ko‘rinmayapti.'
      );

    } else {

      lines.push(
        `👤 Yaqinda ${players.length} ta player bor.`
      );


      for (
        const player
        of players.slice(0, 10)
      ) {

        lines.push(

          `• ${player.username} — ${this.formatDistance(player.distance)}`

        );

      }

    }


    const entities =
      world.entities || [];


    if (
      entities.length > 0
    ) {

      lines.push(
        `🐾 Yaqinda ${entities.length} ta entity bor.`
      );


      for (
        const entity
        of entities.slice(0, 10)
      ) {

        lines.push(

          `• ${entity.identifier} — ${this.formatDistance(entity.distance)}`

        );

      }

    }


    const chat =
      world.recentChat || [];


    if (
      chat.length > 0
    ) {

      const last =
        chat[chat.length - 1];


      lines.push(

        `💬 Oxirgi chat: ${last.source}: ${last.message}`

      );

    }


    return lines.join(
      '\n'
    );

  }


  /*
  ==============================================================
  STATUS REPORT
  ============================================================== 
  */

  createStatusReport() {

    const status =
      this.getStatus();


    return [

      `🤖 AKV holati: ${status.connected ? 'ONLINE' : 'OFFLINE'}`,

      `🧠 AI: ${status.aiEnabled ? 'ON' : 'OFF'}`,

      `🤖 Avtonom: ${status.autonomous ? 'ON' : 'OFF'}`,

      `🚶 Harakat: ${status.busy ? 'HA' : 'YO‘Q'}`,

      `👤 Playerlar: ${status.players}`,

      `🐾 Entitylar: ${status.entities}`,

      `💬 Chat: ${status.chatMessages}`,

      `📋 Eventlar: ${status.events}`

    ].join('\n');

  }


  /*
  ==============================================================
  STATUS
  ============================================================== 
  */

  getStatus() {

    const world =
      this.getWorldState();


    return {

      connected:
        Boolean(
          world.server?.connected
        ),

      aiEnabled:
        this.state.enabled,

      autonomous:
        this.state.autonomous,

      busy:
        this.state.busy,

      currentTask:
        this.state.currentTask,

      players:
        world.players?.length || 0,

      entities:
        world.entities?.length || 0,

      chatMessages:
        world.recentChat?.length || 0,

      events:
        world.recentEvents?.length || 0,

      position:
        world.bot?.position || null

    };

  }


  /*
  ==============================================================
  MEMORY
  ============================================================== 
  */

  remember(
    text
  ) {

    if (
      !text
    ) {

      return;

    }


    this.memory.facts.push({

      text,

      time:
        new Date().toISOString()

    });


    if (
      this.memory.facts.length >
      1000
    ) {

      this.memory.facts.shift();

    }

  }


  rememberEvent(
    event
  ) {

    if (!event) {

      return;

    }


    this.memory.importantEvents.push({

      ...event,

      savedAt:
        new Date().toISOString()

    });


    if (
      this.memory.importantEvents.length >
      2000
    ) {

      this.memory.importantEvents.shift();

    }

  }


  getMemory(
    limit = 100
  ) {

    return {

      facts:
        this.memory.facts
          .slice(-limit),

      events:
        this.memory.importantEvents
          .slice(-limit),

      visitedLocations:
        this.memory.visitedLocations
          .slice(-limit)

    };

  }


  /*
  ==============================================================
  CANCEL
  ============================================================== 
  */

  cancelCurrentTask() {

    if (
      this.navigator
    ) {

      try {

        this.navigator.cancelTask();

      } catch (error) {

        logger.error(
          'Navigator cancel error:',
          error
        );

      }

    }


    this.state.busy = false;

    this.state.currentTask =
      null;

  }


  /*
  ==============================================================
  COMMAND CHECKS
  ============================================================== 
  */

  isStopCommand(
    text
  ) {

    const t =
      this.normalizeText(
        text
      );


    return (

      t === 'toxta' ||

      t === 'stop' ||

      t.includes(
        'toxta qol'
      ) ||

      t.includes(
        'harakatni toxta'
      )

    );

  }


  isJumpCommand(
    text
  ) {

    const t =
      this.normalizeText(
        text
      );


    return (

      t === 'sakra' ||

      t.includes(
        'sakrab'
      ) ||

      t.includes(
        'sakrash'
      )

    );

  }


  isAutonomousStartCommand(
    text
  ) {

    const t =
      this.normalizeText(
        text
      );


    return (

      t.includes(
        'ozing oyna'
      ) ||

      t.includes(
        'ozi oyna'
      ) ||

      t.includes(
        'avtonom rejim'
      ) ||

      t.includes(
        'mustaqil oyna'
      ) ||

      t.includes(
        'ozing harakatlan'
      ) ||

      t.includes(
        'ozing harakat qil'
      )

    );

  }


  isAutonomousStopCommand(
    text
  ) {

    const t =
      this.normalizeText(
        text
      );


    return (

      t.includes(
        'avtonomni toxta'
      ) ||

      t.includes(
        'avtonom rejimni toxta'
      ) ||

      t.includes(
        'ozing oynashni toxta'
      ) ||

      t.includes(
        'mustaqil rejimni toxta'
      )

    );

  }


  isStatusCommand(
    text
  ) {

    const t =
      this.normalizeText(
        text
      );


    return (

      t === 'status' ||

      t.includes(
        'holating'
      ) ||

      t.includes(
        'nima qilyapsan'
      ) ||

      t.includes(
        'qayerdasan'
      )

    );

  }


  isObservationCommand(
    text
  ) {

    const t =
      this.normalizeText(
        text
      );


    return (

      t.includes(
        'oldinda nima bor'
      ) ||

      t.includes(
        'atrofda nima bor'
      ) ||

      t.includes(
        'nima korayapsan'
      ) ||

      t.includes(
        'nima koryapsan'
      ) ||

      t.includes(
        'nima bolyapti'
      ) ||

      t.includes(
        'nima bolmoqda'
      )

    );

  }


  /*
  ==============================================================
  NORMALIZE TEXT
  ============================================================== 
  */

  normalizeText(
    text
  ) {

    return String(text)

      .toLowerCase()

      .replace(
        /['`ʻʼ’‘]/g,
        ''
      )

      .replace(
        /o'g/gi,
        'og'
      )

      .replace(
        /o'ng/gi,
        'ong'
      )

      .replace(
        /\s+/g,
        ' '
      )

      .trim();

  }


  /*
  ==============================================================
  DIRECTION TEXT
  ============================================================== 
  */

  directionToUzbek(
    direction
  ) {

    const map = {

      forward:
        'oldiga',

      backward:
        'orqaga',

      left:
        'chapga',

      right:
        "o'ngga"

    };


    return (
      map[direction] ||
      direction
    );

  }


  /*
  ==============================================================
  FORMAT POSITION
  ============================================================== 
  */

  formatPosition(
    position
  ) {

    if (!position) {

      return 'noma’lum';

    }


    return [

      Math.round(
        position.x
      ),

      Math.round(
        position.y
      ),

      Math.round(
        position.z
      )

    ].join(
      ' '
    );

  }


  /*
  ==============================================================
  FORMAT DISTANCE
  ============================================================== 
  */

  formatDistance(
    distance
  ) {

    if (
      distance === null ||
      distance === undefined
    ) {

      return 'masofa noma’lum';

    }


    return `${Number(distance).toFixed(1)} blok`;

  }

}


module.exports =
  AIBrain;
