const CONFIG = require('../config');

class Memory {

  constructor() {

    this.items = [];

  }

  add(type, data) {

    this.items.push({

      type,

      data,

      time: new Date().toISOString()

    });

    if (
      this.items.length >
      CONFIG.AI.MAX_MEMORY
    ) {

      this.items.shift();

    }

  }

  recent(limit = 30) {

    return this.items.slice(-limit);

  }

  search(text) {

    const query =
      String(text).toLowerCase();

    return this.items.filter(item =>

      JSON.stringify(item)
        .toLowerCase()
        .includes(query)

    );

  }

  clear() {

    this.items = [];

  }

}

module.exports = Memory;
