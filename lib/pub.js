const debug = require('debug')('bipc:pub');

const Socket = require('./sock');

/**
 * Initialize a new `PubSocket`.
 *
 * @api private
 */

class PubSocket extends Socket {
  constructor () {
    super();
  }
}
/**
 * Send `msg` to all established peers.
 *
 * @param {Mixed} msg
 * @api public
 */

PubSocket.prototype.send = function (...args) {
  debug('pub socket send');
  const socks = this.socks;
  const len = socks.length;
  let sock;

  const buf = this.pack(args);

  for (let i = 0; i < len; i++) {
    sock = socks[i];
    if (sock.writable) sock.write(buf);
  }

  return this;
};

PubSocket.prototype.sendv2 = function (data, cb) {
  debug('pub socket sendv2');
  const socks = this.socks;
  const len = socks.length;

  if (len == 0) { return process.nextTick(cb); }

  const buf = this.pack([data]);

  let i = 0;

  socks.forEach(sock => {
    if (sock.writable) {
      sock.write(buf, () => {
        i++;
        if (i == len) { process.nextTick(cb); }
      });
    } else {
      i++;
      if (i == len) { process.nextTick(cb); }
    }
  });

  return this;
};

/**
 * Expose `PubSocket`.
 */

module.exports = PubSocket;
