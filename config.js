const CONFIG = {

  SERVER: {
    HOST: process.env.MC_HOST || 'Soloraft.aternos.me',
    PORT: Number(process.env.MC_PORT || 27295),
    VERSION: process.env.MC_VERSION || '1.26.30'
  },

  BOT: {
    USERNAME: process.env.BOT_USERNAME || 'AKV_Bot',
    OFFLINE: true
  },

  OPENROUTER: {

    ENABLED:
      Boolean(process.env.OPENROUTER_API_KEY),

    API_KEY:
      process.env.OPENROUTER_API_KEY || '',

    MODEL:
      process.env.OPENROUTER_MODEL ||
      'openrouter/free',

    URL:
      'https://openrouter.ai/api/v1/chat/completions'

  },

  RECONNECT: {

    ENABLED: true,

    DELAY: 5000,

    MAX_DELAY: 30000

  },

  AI: {

    ENABLED: true,

    THINK_INTERVAL: 5000,

    MAX_MEMORY: 500,

    AUTONOMOUS_MODE: true

  },

  ANTI_AFK: {

    ENABLED: true,

    INTERVAL: 15000

  },

  OBSERVER: {

    ENABLED: true

  }

};

module.exports = CONFIG;
