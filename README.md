
## bitclimb-ipc 
- Bitclimb messaging socket library for listening to notifications from other local processes such as Bitcoin wallet's `blocknotify`.
- Supports `IPC(Unix Socket`), `Tcp` and `Udp`
- Installation `npm install bitclimb-ipc --save`
- Supports messaging via Bash shell `netcap` or `nc`

note: all data from clients are on `buffer` format. You can convert it to regular text using `data.toString()`

### Usage
```js
// server-side code
const bipc = require('bitclimb-ipc');
const sock = bipc.socket('sub')

//using unix socket, fastest compared to tcp and udp
const sockpath = '/tmp/myunix.sock';

// most events/api from Nodejs Net class are available https://nodejs.org/api/net.html#net_class_net_socket

// via events with callback
  sock.bind(sockpath, err => {
    if (err) throw new Error(err);
  }).on('ready', () => {
    console.log('ready');
    sock.on('connect', (client) => {
      client.on('data', data => {
        console.log('data', data.toString());
        client.end();
      });
    });
    sock.on('error', err => {
      sock.closeServer();
    });
  });

// via pure events
// register listeners first
const onConnect = (client) => {
  client.on('data', data => {
      console.log('data', data.toString());
     client.end();
   });
}
const onReady = (err) => {
  if(err) throw new Error(err)
  sock.on('connect',onConnect)
  sock.on('error', err => {
      sock.closeServer();
    });
}
sock.on('ready', onReady)
sock.bind(sockpath);
```

### Sending a message from shell command/terminal

```bash
echo 'hello' | nc -U /tmp/myunix.sock
# or
echo 'hello' | netcat -U /tmp/myunix.sock

# you can also send an encrypted message via password or gpg
# using aes-256-cbc

echo 'test' | openssl aes-256-cbc -e -k 'password' -a -nosalt | xargs -L 1 echo | nc -U /tmp/unix.sock
```
Sample Bitcoin-qt `blocknotify`

```js
//server.js
const {socket} = require('bitclimb-ipc');
const sock = socket('sub')
const sockpath = '/tmp/btcnotify.sock';

const onConnect = (client) => {
  client.on('data', data => {
      console.log(data.toString());
      //=> logs the blockhash
      // you must end the client right away after receiving the notification
     client.end();
   });
}
const onReady = (err) => {
  if(err) throw new Error(err)
  sock.on('connect',onConnect)
}
sock.on('ready', onReady)
sock.bind(sockpath);
```
```bash
# bitcoin.conf
# ...other configs
blocknotify=echo %s | nc -U /tmp/myunix.sock
```
```bash
# you can also send it as a JSON string printf for escaping
blocknotify=printf '{"type":"block","txid": "%s"}' | nc -U /tmp/unix.sock
```
