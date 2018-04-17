exports.Socket = require('./sock');
exports.PubSocket = require('./pub');
exports.SubSocket = require('./sub');

exports.types = {
  'pub': exports.PubSocket,
  'sub': exports.SubSocket
};
exports.socket = (type, options) => {
  const fn = exports.types[type];
  if (!fn) throw new Error(`invalid socket type "${type}", accepted types: ${Object.keys(exports.types).join(',')}`);
  return Object.seal(new fn(options));
};
