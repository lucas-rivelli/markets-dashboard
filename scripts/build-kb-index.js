const { KB_INDEX_FILE, writeKbIndex } = require("../lib/kb-index");

const index = writeKbIndex();

console.log(
  `Built ${KB_INDEX_FILE} with ${index.counts.items} item(s), ${index.counts.inbox} inbox record(s), and ${index.counts.notes} note(s).`
);
