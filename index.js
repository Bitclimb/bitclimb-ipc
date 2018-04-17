const axon = require('./lib');
const sock = axon.socket('sub');
const fs = require('fs');
const sockpath = '/tmp/unix.sock';

const cleanSock = cb => {
  if (fs.existsSync(sockpath)) {
    console.log(sockpath, 'exists');
    fs.unlinkSync(sockpath);
  }
  if (cb) {
    cb();
  }
};

cleanSock(() => {
  sock.bind(sockpath, err => {
    if (err) throw new Error(err);
  }).on('ready', () => {
    console.log('ready');
    sock.on('connect', (client) => {
      client.on('data', data => {
        data = data.toString();
        console.log('data', data);
        console.log(JSON.parse(data));
        client.end();
        client.destroy();
      });
    });
    sock.on('error', err => {
      sock.closeServer();
    });
  });

  process.on('SIGTERM', () => {
    sock.closeServer();
    process.exit();
  });
  process.on('SIGINT', () => {
    sock.closeServer();
    setTimeout(process.exit, 2000);
  });
});
