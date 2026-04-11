import { $ } from "bun";
const query = "test query";
const out1 = await $`echo ${query}`.text();
console.log("Without quotes output:", `|${out1.trim()}|`);
const out2 = await $`echo "${query}"`.text();
console.log("With quotes output:", `|${out2.trim()}|`);
