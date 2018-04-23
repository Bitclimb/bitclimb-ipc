const debug = require('debug')('bipc:sub');
const { escapeStrRegex } = require('./utils');
const Message = require('amp-message');
const Socket = require('./sock');

/**
 * Initialize a new `SubSocket`.
 *
 * @api private
 */

class SubSocket extends Socket {
  constructor() {
    super();
    this.subscriptions = [];
  }
}

/**
 * Check if this socket has subscriptions.
 *
 * @return {Boolean}
 * @api public
 */

SubSocket.prototype.hasSubscriptions = function() {
  return !!this.subscriptions.length;
};

/**
 * Check if any subscriptions match `topic`.
 *
 * @param {String} topic
 * @return {Boolean}
 * @api public
 */

SubSocket.prototype.matches = function(topic) {
  for (const subs of this.subscriptions) {
    if (subs.test(topic)) {
      return true;
    }
  }
  return false;
};

/**
 * Message handler.
 *
 * @param {net.Socket} sock
 * @return {Function} closure(msg, mulitpart)
 * @api private
 */

SubSocket.prototype.onmessage = function(sock) {
  const subs = this.hasSubscriptions();
  const self = this;

  return buf => {
    const msg = new Message(buf);

    if (subs) {
      const topic = msg.args[0];
      if (!self.matches(topic)) return debug('not subscribed to "%s"', topic);
    }
    debug('onmessage %s', msg.args);
    self.emit.apply(self, ['message'].concat(msg.args).concat(sock));
  };
};

/**
 * Subscribe with the given `re`.
 *
 * @param {RegExp|String} re
 * @return {RegExp}
 * @api public
 */

SubSocket.prototype.subscribe = function(re) {
  debug('subscribe to "%s"', re);
  this.subscriptions.push((re = toRegExp(re)));
  return re;
};

/**
 * Unsubscribe with the given `re`.
 *
 * @param {RegExp|String} re
 * @api public
 */

SubSocket.prototype.unsubscribe = function(re) {
  debug('unsubscribe from "%s"', re);
  re = toRegExp(re);
  for (const subs of this.subscriptions) {
    if (subs.toString() === re.toString()) {
      this.subscriptions = this.subscriptions.filter(s => s !== subs.toString());
    }
  }
};

/**
 * Clear current subscriptions.
 *
 * @api public
 */

SubSocket.prototype.clearSubscriptions = function() {
  this.subscriptions = [];
};

/**
 * Subscribers should not send messages.
 */

SubSocket.prototype.send = () => {
  throw new Error('subscribers cannot send messages');
};

/**
 * Convert `str` to a `RegExp`.
 *
 * @param {String} str
 * @return {RegExp}
 * @api private
 */

function toRegExp(str) {
  if (str instanceof RegExp) return str;
  str = escapeStrRegex(str);
  str = str.replace(/\\\*/g, '(.+)');
  return new RegExp(`^${str}$`);
}

/**
 * Expose `SubSocket`.
 */

module.exports = SubSocket;
