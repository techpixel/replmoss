#!/usr/bin/env node

/*
MIT License

Copyright (c) 2022 Manitej Boorgu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// Libraries
const Client = require("replapi-it"); // Replapi-It
const net = require("net"); // Replapi-It

// Replit configuration
const token = process.env.token;
const language = process.argv[2]; // 'python'
const user = process.argv[3]; // 'togethertest'
const regexMatch = new RegExp(process.argv[4]); // sub.*
const defaultDir = new RegExp(process.argv[5]); // '.*\.py' 

// Moss configuration
const userId = process.env.userId;
const mossHost = 'moss.stanford.edu';
const mossPort = 7690;

// Check token
if (!token) {
  throw new Error('Missing `connect.sid` token');
} else if (!userId) {
  throw new Error('Missing MOSS userId');
} else if (!(language && user && process.argv[4] && process.argv[5])) {
  throw new Error('Missing argument');
}

let baseFiles = []
let files = []

opts = {
  l: language, // language
  m: 10, // 
  d: 0,
  x: 0, // experimental
  c: '', // comment
  n: 250
}

// Set opts
if (!(process.argv[6] == '-1')) { // C
  opts.c = process.argv[6];
} else if (process.argv[7] > 0) { // M
  opts.m = process.argv[7];
} else if (process.argv[8] > 0) { // N
  opts.n = process.argv[8];
} 

// Get all repls based on regex match
const client = new Client(token);

client.on('ready', async () => {
  // Initalize connection
  let socket = new net.Socket();

  socket.connect(mossPort, mossHost, () => {
    console.log(`Connected to MOSS server @ ${mossHost}:${mossPort}`)

    socket.write(`moss ${userId}\n`)
    socket.write(`directory ${opts.d}\n`)
    socket.write(`X ${opts.x}\n`)
    socket.write(`maxmatches ${opts.m}\n`)
    socket.write(`show ${opts.n}\n`)
    socket.write(`language ${opts.l}\n`)
  }); // Initalize connection

  // Handle data
  socket.on('data', async (data) => {
    console.log('DATA: ' + data);

    if (data == 'no\n') {
      throw new Error("Encountered an error: ", data);
    }

    if (data == 'yes\n') {
      let repls = await (await client.users.fetch(user)).repls.fetch();
      let fileId = 1;

      for (const [id, repl] of repls) {
        if (regexMatch.test(repl.title)) {
          try {

            repl.connect();

            let replData;

            for (const file of (await repl.files.readdir())) {
              if (defaultDir.test(file)) {
                replData = await repl.files.read(file);
                let newdata = replData.replace(/[^a-zA-Z0-9\t\n ./,<>?;:"'`!@#$%^&*()\[\]{}_+=|\\-]/g, '');
                let writing = `file ${fileId} ${opts.l} ${Buffer.byteLength(newdata)} ${repl.title}-${file}\n`;
                socket.write(writing);
                socket.write(newdata);
                console.log("Written " + writing);
                fileId++;
              }
            }
          } catch (e) {
            console.log("Encountered exception: ", e)
          }
        }
      }

      socket.write(`query 0 ${opts.c}\n`); // Query for results
    }

    if (String(data).startsWith("http://moss.stanford.edu")) {
      socket.write('end\n');
      socket.destroy();
      console.log(data.toString('utf8'));
    }

  });

  socket.on('close', () => {
    console.log('Connection closed');
  });
});