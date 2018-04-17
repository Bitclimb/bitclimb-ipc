const matchOperatorsRe = /[|\\{}()[\]^$+*?.]/g;

exports.escapeStrRegex = str => {
  if (typeof str !== 'string') {
    throw new TypeError('Expected a string');
  }

  return str.replace(matchOperatorsRe, '\\$&');
};
