const debug = require('debug')('bipc:pub');

const Socket = require('./sock');

/**
 * Initialize a new `PubSocket`.
 *
 * @api private
 */

class PubSocket extends Socket {
  constructor() {
    super();
  }
}
/**
 * Send `msg` to all established peers.
 *
 * @param {Mixed} msg
 * @api public
 */

PubSocket.prototype.send = function(...args) {
  debug('pub socket send');
  const socks = this.socks;

  const buf = this.pack(args);
  for (const sock of socks) {
    if (sock.writable) sock.write(buf);
  }

  return this;
};

/**
 * Expose `PubSocket`.
 */

module.exports = PubSocket;
