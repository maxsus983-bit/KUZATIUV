'use strict';

const logger = require('../core/logger');

/*
===============================================================
 AKV WORLD OBSERVER
===============================================================

Vazifasi:

  👁️ AKV atrofidagi Minecraft dunyosidan kelayotgan
     ma'lumotlarni yig'ish.

  👤 Playerlarni kuzatish
  🐑 Entitylarni kuzatish
  📍 Pozitsiyalarni saqlash
  💬 Chatni saqlash
  ⚔️ Muhim eventlarni saqlash
  🧠 AI uchun World State tayyorlash

MUHIM:

Bu modul Minecraft ekranini video sifatida ko'rmaydi.

U Bedrock protocol packet/eventlaridan foydalanadi.

Keyinchalik AI shu World State orqali:

  "Kim qayerda?"
  "Nima bo'lyapti?"
  "Qaysi player yaqin?"
  "Qaysi entity paydo bo'ldi?"
  "Oxirgi nima sodir bo'ldi?"

kabi savollarga javob beradi.
===============================================================
*/


class WorldObserver {

  constructor(options = {}) {

    this.botUsername =
      options.botUsername || 'AKV_Bot';


    /*
    ============================================================
    PLAYERLAR
    ============================================================
    */

    this.players = new Map();


    /*
    ============================================================
    ENTITYLAR
    ============================================================
    */

    this.entities = new Map();


    /*
    ============================================================
    CHAT
    ============================================================
    */

    this.chatHistory = [];


    /*
    ============================================================
    EVENT HISTORY
    ============================================================
    */

    this.events = [];


    /*
    ============================================================
    BLOCK OBSERVATION

    Hozircha packetlardan kelgan block ma'lumotlarini
    saqlash uchun umumiy container.

    Keyingi Block Scanner shu yerga ma'lumot qo'shadi.
    ============================================================
    */

    this.blocks = new Map();


    /*
    ============================================================
    BOT HOLATI
    ============================================================
    */

    this.bot = {

      runtimeId: null,

      position: {

        x: 0,

        y: 0,

        z: 0

      },

      rotation: {

        yaw: 0,

        pitch: 0,

        headYaw: 0

      }

    };


    /*
    ============================================================
    SERVER HOLATI
    ============================================================
    */

    this.server = {

      connected: false,

      spawned: false,

      lastPacket: null,

      lastUpdate: null

    };


    /*
    ============================================================
    STATISTICS
    ============================================================
    */

    this.statistics = {

      playersSeen: 0,

      entitiesSeen: 0,

      chatMessages: 0,

      events: 0,

      packets: 0

    };


    /*
    ============================================================
    TIMEOUT / CLEANUP
    ============================================================
    */

    this.cleanupTimer = null;

  }


  /*
  ==============================================================
  ATTACH CLIENT
  ==============================================================

  Bedrock client eventlarini observerga ulaydi.
  */

  attach(client) {

    if (!client) {

      throw new Error(
        'WorldObserver: client berilmagan.'
      );

    }


    this.client = client;


    /*
    --------------------------------------------------------------
    CONNECTION
    --------------------------------------------------------------
    */

    client.on(
      'connect',
      () => {

        this.server.connected = true;

        this.addEvent(
          'connection',
          {
            status: 'connected'
          }
        );

      }
    );


    client.on(
      'spawn',
      () => {

        this.server.connected = true;

        this.server.spawned = true;

        this.addEvent(
          'spawn',
          {}
        );


        logger.info(
          '👁️ World Observer: SPAWN'
        );

      }
    );


    client.on(
      'close',
      () => {

        this.server.connected = false;

        this.server.spawned = false;


        this.addEvent(
          'connection',
          {
            status: 'closed'
          }
        );


        logger.warn(
          '👁️ World Observer: connection yopildi.'
        );

      }
    );


    /*
    --------------------------------------------------------------
    CHAT
    --------------------------------------------------------------
    */

    client.on(
      'text',
      packet => {

        this.handleChat(packet);

      }
    );


    /*
    --------------------------------------------------------------
    PLAYER JOIN
    --------------------------------------------------------------
    */

    client.on(
      'add_player',
      packet => {

        this.handleAddPlayer(packet);

      }
    );


    /*
    --------------------------------------------------------------
    PLAYER / ENTITY MOVEMENT
    --------------------------------------------------------------
    */

    client.on(
      'move_player',
      packet => {

        this.handleMovePlayer(packet);

      }
    );


    /*
    --------------------------------------------------------------
    REMOVE ENTITY
    --------------------------------------------------------------
    */

    client.on(
      'remove_entity',
      packet => {

        this.handleRemoveEntity(packet);

      }
    );


    /*
    --------------------------------------------------------------
    ENTITY ADD

    Turli bedrock-protocol versiyalarida entity packet nomlari
    farq qilishi mumkin.

    Shuning uchun mavjud bo'lsa ulaymiz.
    --------------------------------------------------------------
    */

    client.on(
      'add_entity',
      packet => {

        this.handleAddEntity(packet);

      }
    );


    client.on(
      'add_item_entity',
      packet => {

        this.handleAddEntity(packet);

      }
    );


    client.on(
      'add_mob',
      packet => {

        this.handleAddEntity(packet);

      }
    );


    client.on(
      'add_player',
      packet => {

        this.handleAddPlayer(packet);

      }
    );


    /*
    --------------------------------------------------------------
    HURT / DAMAGE
    --------------------------------------------------------------
    */

    client.on(
      'entity_event',
      packet => {

        this.handleEntityEvent(packet);

      }
    );


    /*
    --------------------------------------------------------------
    PACKET MONITOR
    --------------------------------------------------------------
    */

    /*
     * Barcha packetlarni universal tarzda tutishga urinmaymiz.
     *
     * Faqat bizga kerak bo'lgan packet eventlar yuqorida
     * alohida qayta ishlanadi.
     */


    this.startCleanup();


    logger.info(
      '👁️ World Observer clientga ulandi.'
    );

  }


  /*
  ==============================================================
  BOT POSITION
  ==============================================================

  AKV o'z pozitsiyasini saqlaydi.
  */

  setBotPosition(position) {

    if (!position) {

      return;

    }


    const x =
      Number(position.x);

    const y =
      Number(position.y);

    const z =
      Number(position.z);


    if (
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      Number.isFinite(z)
    ) {

      this.bot.position = {

        x,

        y,

        z

      };

    }

  }


  setBotRotation(
    yaw,
    pitch,
    headYaw
  ) {

    if (yaw !== undefined) {

      this.bot.rotation.yaw =
        Number(yaw);

    }


    if (pitch !== undefined) {

      this.bot.rotation.pitch =
        Number(pitch);

    }


    if (headYaw !== undefined) {

      this.bot.rotation.headYaw =
        Number(headYaw);

    }

  }


  setBotRuntimeId(id) {

    if (
      id === undefined ||
      id === null
    ) {

      return;

    }


    try {

      this.bot.runtimeId =
        BigInt(id);

    } catch {

      this.bot.runtimeId =
        id;

    }

  }


  /*
  ==============================================================
  PLAYER ADD
  ==============================================================

  Player serverga kirganda.
  */

  handleAddPlayer(packet) {

    if (!packet) {

      return;

    }


    const username =
      packet.username ||
      packet.name ||
      packet.player_name ||
      'Unknown';


    const runtimeId =
      packet.runtime_entity_id ??
      packet.runtime_id ??
      null;


    const position =
      this.normalizePosition(
        packet.position
      );


    /*
    ------------------------------------------------------------
    Agar bu AKVning o'zi bo'lsa
    ------------------------------------------------------------
    */

    if (
      username ===
      this.botUsername
    ) {

      this.setBotRuntimeId(
        runtimeId
      );

      if (position) {

        this.setBotPosition(
          position
        );

      }


      this.setBotRotation(

        packet.yaw,

        packet.pitch,

        packet.head_yaw

      );

      return;

    }


    /*
    ------------------------------------------------------------
    PLAYER OBJECT
    ------------------------------------------------------------
    */

    const player = {

      username,

      runtimeId,

      position,

      rotation: {

        yaw:
          this.numberOrNull(
            packet.yaw
          ),

        pitch:
          this.numberOrNull(
            packet.pitch
          ),

        headYaw:
          this.numberOrNull(
            packet.head_yaw
          )

      },

      firstSeen:
        Date.now(),

      lastSeen:
        Date.now(),

      lastAction:
        'joined',

      health:
        null,

      distance:
        this.calculateDistance(
          position,
          this.bot.position
        )

    };


    this.players.set(
      username,
      player
    );


    this.statistics.playersSeen++;


    this.addEvent(
      'player_join',
      {

        username,

        position

      }
    );


    logger.info(
      `👤 PLAYER JOIN: ${username}`
    );

  }


  /*
  ==============================================================
  PLAYER MOVEMENT
  ==============================================================

  move_player packet orqali keladigan ma'lumot.
  */

  handleMovePlayer(packet) {

    if (!packet) {

      return;

    }


    const runtimeId =
      packet.runtime_entity_id ??
      packet.runtime_id ??
      null;


    if (runtimeId === null) {

      return;

    }


    const position =
      this.normalizePosition(
        packet.position
      );


    /*
    ------------------------------------------------------------
    AKVning o'zi
    ------------------------------------------------------------
    */

    if (
      this.sameId(
        runtimeId,
        this.bot.runtimeId
      )
    ) {

      if (position) {

        this.setBotPosition(
          position
        );

      }


      this.setBotRotation(

        packet.yaw,

        packet.pitch,

        packet.head_yaw

      );

      return;

    }


    /*
    ------------------------------------------------------------
    PLAYER
    ------------------------------------------------------------
    */

    for (
      const player of
      this.players.values()
    ) {

      if (
        this.sameId(
          runtimeId,
          player.runtimeId
        )
      ) {

        if (position) {

          player.position =
            position;

        }


        if (
          packet.yaw !== undefined
        ) {

          player.rotation.yaw =
            Number(packet.yaw);

        }


        if (
          packet.pitch !== undefined
        ) {

          player.rotation.pitch =
            Number(packet.pitch);

        }


        if (
          packet.head_yaw !== undefined
        ) {

          player.rotation.headYaw =
            Number(packet.head_yaw);

        }


        player.lastSeen =
          Date.now();

        player.lastAction =
          'movement';

        player.distance =
          this.calculateDistance(
            player.position,
            this.bot.position
          );


        return;

      }

    }


    /*
    ------------------------------------------------------------
    Agar noma'lum entity bo'lsa
    ------------------------------------------------------------
    */

    const entity =
      this.entities.get(
        this.idKey(runtimeId)
      );


    if (entity) {

      if (position) {

        entity.position =
          position;

      }


      entity.lastSeen =
        Date.now();

      entity.lastAction =
        'movement';

      entity.distance =
        this.calculateDistance(
          entity.position,
          this.bot.position
        );

    }

  }


  /*
  ==============================================================
  ENTITY ADD
  ==============================================================

  Mob / item / boshqa entity.
  */

  handleAddEntity(packet) {

    if (!packet) {

      return;

    }


    const runtimeId =
      packet.runtime_entity_id ??
      packet.runtime_id ??
      packet.unique_id ??
      null;


    if (
      runtimeId === null
    ) {

      return;

    }


    const identifier =
      packet.identifier ||
      packet.entity_type ||
      packet.entity_identifier ||
      packet.name ||
      'unknown';


    const position =
      this.normalizePosition(
        packet.position
      );


    const entity = {

      runtimeId,

      identifier,

      position,

      rotation: {

        yaw:
          this.numberOrNull(
            packet.yaw
          ),

        pitch:
          this.numberOrNull(
            packet.pitch
          ),

        headYaw:
          this.numberOrNull(
            packet.head_yaw
          )

      },

      firstSeen:
        Date.now(),

      lastSeen:
        Date.now(),

      lastAction:
        'spawned',

      distance:
        this.calculateDistance(
          position,
          this.bot.position
        )

    };


    this.entities.set(
      this.idKey(runtimeId),
      entity
    );


    this.statistics.entitiesSeen++;


    this.addEvent(
      'entity_spawn',
      {

        runtimeId,

        identifier,

        position

      }
    );


    logger.info(
      `🐾 ENTITY: ${identifier}`
    );

  }


  /*
  ==============================================================
  ENTITY EVENT

  Damage / hurt / death kabi eventlar.
  ============================================================== 
  */

  handleEntityEvent(packet) {

    if (!packet) {

      return;

    }


    const runtimeId =
      packet.runtime_entity_id ??
      packet.runtime_id ??
      packet.entity_id ??
      null;


    this.addEvent(
      'entity_event',
      {

        runtimeId,

        event:
          packet.event ??
          packet.event_id ??
          null

      }
    );

  }


  /*
  ==============================================================
  REMOVE ENTITY
  ============================================================== 
  */

  handleRemoveEntity(packet) {

    if (!packet) {

      return;

    }


    const runtimeId =
      packet.runtime_entity_id ??
      packet.runtime_id ??
      packet.entity_id ??
      null;


    if (
      runtimeId === null
    ) {

      return;

    }


    /*
    ------------------------------------------------------------
    Playerni tekshiramiz
    ------------------------------------------------------------
    */

    for (
      const [username, player]
      of this.players.entries()
    ) {

      if (
        this.sameId(
          runtimeId,
          player.runtimeId
        )
      ) {

        this.players.delete(
          username
        );


        this.addEvent(
          'player_leave',
          {

            username,

            runtimeId

          }
        );


        logger.info(
          `🔴 PLAYER LEAVE: ${username}`
        );


        return;

      }

    }


    /*
    ------------------------------------------------------------
    Entity
    ------------------------------------------------------------
    */

    const key =
      this.idKey(runtimeId);


    const entity =
      this.entities.get(key);


    if (entity) {

      this.entities.delete(key);


      this.addEvent(
        'entity_remove',
        {

          runtimeId,

          identifier:
            entity.identifier

        }
      );

    }

  }


  /*
  ==============================================================
  CHAT
  ============================================================== 
  */

  handleChat(packet) {

    if (!packet) {

      return;

    }


    const source =
      packet.source_name ||
      packet.username ||
      packet.name ||
      'Server';


    const message =
      packet.message ||
      packet.raw_message ||
      packet.text ||
      '';


    if (!message) {

      return;

    }


    const item = {

      source,

      message,

      time:
        new Date().toISOString()

    };


    this.chatHistory.push(
      item
    );


    this.statistics.chatMessages++;


    /*
    ------------------------------------------------------------
    Limit
    ------------------------------------------------------------
    */

    if (
      this.chatHistory.length >
      500
    ) {

      this.chatHistory.shift();

    }


    this.addEvent(
      'chat',
      item
    );


    logger.chat(
      source,
      message
    );

  }


  /*
  ==============================================================
  GENERIC EVENT
  ============================================================== 
  */

  addEvent(
    type,
    data
  ) {

    const event = {

      type,

      data,

      time:
        new Date().toISOString()

    };


    this.events.push(
      event
    );


    this.statistics.events++;


    if (
      this.events.length >
      2000
    ) {

      this.events.shift();

    }

  }


  /*
  ==============================================================
  BLOCK OBSERVATION
  ==============================================================

  Keyingi block scanner shu funksiyadan foydalanadi.
  */

  observeBlock(
    x,
    y,
    z,
    block
  ) {

    const key =
      `${x},${y},${z}`;


    this.blocks.set(
      key,
      {

        x:
          Number(x),

        y:
          Number(y),

        z:
          Number(z),

        block,

        time:
          Date.now()

      }
    );


    /*
    Limit.
    */

    if (
      this.blocks.size >
      5000
    ) {

      const first =
        this.blocks.keys()
          .next()
          .value;


      if (first) {

        this.blocks.delete(
          first
        );

      }

    }

  }


  /*
  ==============================================================
  PLAYER DISTANCE
  ============================================================== 
  */

  getNearbyPlayers(
    maxDistance = 50
  ) {

    const result = [];


    for (
      const player
      of this.players.values()
    ) {

      const distance =
        this.calculateDistance(
          player.position,
          this.bot.position
        );


      if (
        distance === null ||
        distance <= maxDistance
      ) {

        result.push({

          ...player,

          distance

        });

      }

    }


    return result.sort(
      (a, b) =>
        (a.distance ?? Infinity) -
        (b.distance ?? Infinity)
    );

  }


  /*
  ==============================================================
  NEARBY ENTITIES
  ============================================================== 
  */

  getNearbyEntities(
    maxDistance = 50
  ) {

    const result = [];


    for (
      const entity
      of this.entities.values()
    ) {

      const distance =
        this.calculateDistance(
          entity.position,
          this.bot.position
        );


      if (
        distance === null ||
        distance <= maxDistance
      ) {

        result.push({

          ...entity,

          distance

        });

      }

    }


    return result.sort(
      (a, b) =>
        (a.distance ?? Infinity) -
        (b.distance ?? Infinity)
    );

  }


  /*
  ==============================================================
  GET WORLD STATE

  AI'ga yuboriladigan asosiy ma'lumot.
  ============================================================== 
  */

  getWorldState() {

    return {

      time:
        new Date().toISOString(),


      server: {

        connected:
          this.server.connected,

        spawned:
          this.server.spawned,

        lastUpdate:
          this.server.lastUpdate

      },


      bot: {

        username:
          this.botUsername,

        runtimeId:
          this.safeId(
            this.bot.runtimeId
          ),

        position:
          this.bot.position,

        rotation:
          this.bot.rotation

      },


      players:
        this.getNearbyPlayers(100),


      entities:
        this.getNearbyEntities(100),


      recentChat:
        this.getRecentChat(30),


      recentEvents:
        this.getRecentEvents(50),


      observedBlocks:
        this.getNearbyBlocks(32),


      statistics:
        this.statistics

    };

  }


  /*
  ==============================================================
  BLOCK STATE
  ============================================================== 
  */

  getNearbyBlocks(
    radius = 16
  ) {

    const result = [];


    const bot =
      this.bot.position;


    for (
      const block
      of this.blocks.values()
    ) {

      if (!block) {

        continue;

      }


      const dx =
        block.x - bot.x;


      const dy =
        block.y - bot.y;


      const dz =
        block.z - bot.z;


      const distance =
        Math.sqrt(
          dx * dx +
          dy * dy +
          dz * dz
        );


      if (
        distance <= radius
      ) {

        result.push({

          ...block,

          distance

        });

      }

    }


    return result;

  }


  /*
  ==============================================================
  RECENT CHAT
  ============================================================== 
  */

  getRecentChat(
    limit = 20
  ) {

    return this.chatHistory.slice(
      -limit
    );

  }


  /*
  ==============================================================
  RECENT EVENTS
  ============================================================== 
  */

  getRecentEvents(
    limit = 30
  ) {

    return this.events.slice(
      -limit
    );

  }


  /*
  ==============================================================
  GET PLAYER
  ============================================================== 
  */

  getPlayer(
    username
  ) {

    if (!username) {

      return null;

    }


    return (
      this.players.get(
        username
      ) ||
      null
    );

  }


  /*
  ==============================================================
  GET ENTITY
  ============================================================== 
  */

  getEntity(
    runtimeId
  ) {

    if (
      runtimeId === null ||
      runtimeId === undefined
    ) {

      return null;

    }


    return (
      this.entities.get(
        this.idKey(runtimeId)
      ) ||
      null
    );

  }


  /*
  ==============================================================
  GET PLAYERS
  ============================================================== 
  */

  getPlayers() {

    return Array.from(
      this.players.values()
    );

  }


  /*
  ==============================================================
  GET ENTITIES
  ============================================================== 
  */

  getEntities() {

    return Array.from(
      this.entities.values()
    );

  }


  /*
  ==============================================================
  DISTANCE
  ============================================================== 
  */

  calculateDistance(
    a,
    b
  ) {

    if (!a || !b) {

      return null;

    }


    const dx =
      Number(a.x) -
      Number(b.x);


    const dy =
      Number(a.y) -
      Number(b.y);


    const dz =
      Number(a.z) -
      Number(b.z);


    if (
      !Number.isFinite(dx) ||
      !Number.isFinite(dy) ||
      !Number.isFinite(dz)
    ) {

      return null;

    }


    return Math.sqrt(
      dx * dx +
      dy * dy +
      dz * dz
    );

  }


  /*
  ==============================================================
  POSITION NORMALIZER
  ============================================================== 
  */

  normalizePosition(
    position
  ) {

    if (!position) {

      return null;

    }


    const x =
      Number(position.x);


    const y =
      Number(position.y);


    const z =
      Number(position.z);


    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(z)
    ) {

      return null;

    }


    return {

      x,

      y,

      z

    };

  }


  /*
  ==============================================================
  NUMBER NORMALIZER
  ============================================================== 
  */

  numberOrNull(
    value
  ) {

    if (
      value === undefined ||
      value === null
    ) {

      return null;

    }


    const n =
      Number(value);


    return Number.isFinite(n)
      ? n
      : null;

  }


  /*
  ==============================================================
  ID COMPARISON
  ============================================================== 
  */

  sameId(
    a,
    b
  ) {

    if (
      a === null ||
      a === undefined ||
      b === null ||
      b === undefined
    ) {

      return false;

    }


    try {

      return (
        BigInt(a) ===
        BigInt(b)
      );

    } catch {

      return (
        String(a) ===
        String(b)
      );

    }

  }


  /*
  ==============================================================
  ID KEY
  ============================================================== 
  */

  idKey(
    id
  ) {

    try {

      return BigInt(id).toString();

    } catch {

      return String(id);

    }

  }


  /*
  ==============================================================
  SAFE ID
  ============================================================== 
  */

  safeId(
    id
  ) {

    if (
      id === null ||
      id === undefined
    ) {

      return null;

    }


    try {

      return BigInt(id).toString();

    } catch {

      return String(id);

    }

  }


  /*
  ==============================================================
  CLEANUP
  ==============================================================

  Uzoq vaqt ko'rinmagan entitylarni tozalaydi.
  */

  startCleanup() {

    if (
      this.cleanupTimer
    ) {

      return;

    }


    this.cleanupTimer =
      setInterval(
        () => {

          this.cleanup();

        },
        60000
      );

  }


  cleanup() {

    const now =
      Date.now();


    /*
    ------------------------------------------------------------
    Entity cleanup
    ------------------------------------------------------------
    */

    for (
      const [key, entity]
      of this.entities.entries()
    ) {

      if (
        now - entity.lastSeen >
        300000
      ) {

        this.entities.delete(
          key
        );

      }

    }


    /*
    ------------------------------------------------------------
    Player cleanup
    ------------------------------------------------------------

    Playerlarni juda tez o'chirmaymiz.
    Faqat 10 minut ko'rinmasa tozalaymiz.
    ------------------------------------------------------------
    */

    for (
      const [username, player]
      of this.players.entries()
    ) {

      if (
        now - player.lastSeen >
        600000
      ) {

        this.players.delete(
          username
        );

      }

    }

  }


  /*
  ==============================================================
  STOP
  ============================================================== 
  */

  stop() {

    if (
      this.cleanupTimer
    ) {

      clearInterval(
        this.cleanupTimer
      );

      this.cleanupTimer = null;

    }

  }


  /*
  ==============================================================
  DEBUG
  ============================================================== 
  */

  debug() {

    return {

      bot:
        this.bot,

      players:
        this.players.size,

      entities:
        this.entities.size,

      blocks:
        this.blocks.size,

      chat:
        this.chatHistory.length,

      events:
        this.events.length,

      statistics:
        this.statistics

    };

  }

}


module.exports =
  WorldObserver;
