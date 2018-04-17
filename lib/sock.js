const EventEmitter = require('events');
const debug = require('debug')('bipc:sock');
const Message = require('amp-message');
const Parser = require('amp').Stream;
const url = require('url');
const net = require('net');
const fs = require('fs');

class Socket extends EventEmitter {
  constructor () {
    super();
    const self = this;
    self.opts = {};
    self.server = null;
    self.socks = [];
    self.settings = {};
    self.hwm = Infinity;
    self.identity = String(process.pid);
    self.retry_timeout = 100;
    self.retry_max_timeout = 5000;
  }
}

Socket.prototype.pack = args => {
  debug('pack message');
  let msg = new Message(args);
  return msg.toBuffer();
};

Socket.prototype.closeSockets = function () {
  debug('closing %d connections', this.socks.length);
  this.socks.forEach(sock => {
    sock.destroy();
  });
};

Socket.prototype.close = function (fn) {
  debug('closing');
  this.closing = true;
  this.closeSockets();
  if (this.server) this.closeServer(fn);
};

Socket.prototype.closeServer = function (fn) {
  debug('closing server');
  this.server.on('close', this.emit.bind(this, 'close'));
  this.server.close();
  fn && fn();
};

Socket.prototype.address = function () {
  if (!this.server) return;
  const addr = this.server.address();
  addr.string = `tcp://${addr.address}:${addr.port}`;
  return addr;
};

Socket.prototype.removeSocket = function (sock) {
  if (this.socks.includes(sock)) {
    debug('remove socket ');
    this.socks = this.socks.filter(s => s !== sock);
  }
};

Socket.prototype.addSocket = function (sock) {
  const parser = new Parser();
  const i = this.socks.push(sock) - 1;
  debug('add socket %d', i);
  sock.pipe(parser);
  parser.on('data', this.onmessage(sock));
};

Socket.prototype.handleErrors = function (sock) {
  const self = this;
  sock.on('error', err => {
    debug('error %s', err.code || err.message);
    self.emit('error', err);
    self.removeSocket(sock);
  });
};

Socket.prototype.handleServerErrors = function (isUnix, port, cb) {
  const self = this;
  self.server.on('error', err => {
    debug('Got error while trying to bind', err.stack || err);
    self.emit('error', err);
    self.closeServer();
    if (isUnix) {
      try {
        fs.unlinkSync(port);
        cb();
      } catch (e) {
        cb(`Unable to delete ${port}, got error ${e}`);
      }
    }
  });
};

Socket.prototype.onmessage = function (sock) {
  debug('onmessage');
  const self = this;
  return buf => {
    let msg = new Message(buf);
    msg = ['message'].concat(msg.args);
    self.emit.apply(self, msg, sock);
  };
};

Socket.prototype.connect = function (port, host, fn) {
  const self = this;
  if (this.type == 'server') throw new Error('cannot connect() after bind()');
  if (typeof host === 'function') fn = host, host = undefined;

  if (typeof port === 'string') {
    port = url.parse(port);

    if (port.pathname) {
      fn = host;
      host = null;
      fn = undefined;
      port = port.pathname;
    } else {
      host = port.hostname || '0.0.0.0';
      port = parseInt(port.port, 10);
    }
  } else {
    host = host || '0.0.0.0';
  }
  const max = self.retry_max_timeout;
  const sock = new net.Socket();
  sock.setNoDelay();
  self.type = 'client';

  self.handleErrors(sock);

  sock.on('close', () => {
    self.connected = false;
    self.removeSocket(sock);
    if (self.closing) return self.emit('close');
    const retry = self.retry || self.retry_timeout;
    setTimeout(() => {
      debug('attempting reconnect');
      self.emit('reconnect attempt');
      sock.destroy();
      self.connect(port, host);
      self.retry = Math.round(Math.min(max, retry * 1.5));
    }, retry);
  });

  sock.on('connect', () => {
    debug('connect');
    self.connected = true;
    self.addSocket(sock);
    self.retry = self.retry_timeout;
    self.emit('connect');
    fn && fn();
  });

  debug('connect attempt %s:%s', host, port);
  sock.connect(port, host);
  return self;
};

/**
 * Handle connection.
 *
 * @param {Socket} sock
 * @api private
 */

Socket.prototype.onconnect = function (sock) {
  const self = this;
  let addr = null;

  if (sock.remoteAddress && sock.remotePort) {
    addr = `${sock.remoteAddress}:${sock.remotePort}`;
  } else if (sock.server && sock.server._pipeName) {
    addr = sock.server._pipeName;
  }

  debug('accept %s', addr);
  self.addSocket(sock);
  self.handleErrors(sock);
  self.emit('connect', sock);
  sock.on('close', () => {
    debug('disconnect %s', addr);
    self.emit('disconnect', sock);
    self.removeSocket(sock);
  });
};

/**
 * Bind to `port` at `host` and invoke `fn()`.
 *
 * Defaults `host` to INADDR_ANY.
 *
 * Emits:
 *
 *  - `connection` when a client connects
 *  - `disconnect` when a client disconnects
 *  - `bind` when bound and listening
 *
 * @param {Number|String} port
 * @param {Function} fn
 * @return {Socket}
 * @api public
 */

Socket.prototype.bind = function (port, host, fn) {
  const self = this;
  if (self.type == 'client') throw new Error('cannot bind() after connect()');
  if (typeof host === 'function') fn = host, host = undefined;

  let unixSocket = false;

  if (typeof port === 'string') {
    port = url.parse(port);
    if (port.pathname) {
      host = null;
      port = port.pathname;
      unixSocket = true;
    } else {
      host = port.hostname || '0.0.0.0';
      port = parseInt(port.port, 10);
    }
  } else {
    host = host || '0.0.0.0';
  }
  self.type = 'server';
  self.server = net.createServer(self.onconnect.bind(self));
  debug('bind %s:%s', host, port);
  self.server.on('listening', () => {
    self.emit('ready');
  });
  self.handleServerErrors(unixSocket, port, err => {
    if (err) { return self.close(); }
    self.server.listen(port, host, fn);
  });
  self.server.listen(port, host, fn);
  return self;
};

module.exports = Socket;
