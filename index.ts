import { processMinutes, saveTex } from "./processMinutes";

const minutes = process.argv[2];

let tex = await processMinutes(minutes);

await saveTex(minutes, tex);
