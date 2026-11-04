// node contact.js <clip> <out.jpg> n1 n2 ... : contact sheet of frames (dev helper)
const sharp = require('sharp');
(async () => {
  const [clip, out, ...ids] = process.argv.slice(2);
  const tiles = await Promise.all(ids.map(n => sharp(`frames/${clip}/${String(n).padStart(5, '0')}.jpg`).resize(480, 270).toBuffer()));
  const cols = 4, rows = Math.ceil(ids.length / cols);
  await sharp({ create: { width: cols * 480, height: rows * 270, channels: 3, background: '#f0f' } })
    .composite(tiles.map((b, i) => ({ input: b, left: (i % cols) * 480, top: Math.floor(i / cols) * 270 }))).jpeg().toFile(out);
})();
