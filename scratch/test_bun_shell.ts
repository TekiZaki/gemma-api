import { $ } from "bun";
const query = "test query";
const cmd = $`echo "${query}"`.toString();
console.log("With quotes:", cmd);
const cmd2 = $`echo ${query}`.toString();
console.log("Without quotes:", cmd2);
