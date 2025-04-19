import fs from "fs";

const logStream = fs.createWriteStream("./debug.log", { flags: "a" });

export const logger = {
  info: (...args: any[]) => {
    logStream.write(args.map(String).join(" ") + "\n");
  },
};
