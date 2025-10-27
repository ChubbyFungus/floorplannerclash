#!/usr/bin/env ts-node
 
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { solveIntents } from "../src/lib/solver/solve";
import { checkClearances } from "../src/lib/solver/clearance";

const scene:any = {
  thickness_m: 0.1,
  walls: [{ id:"W1", a:[0,0], b:[4.8768,0] }, { id:"W2", a:[4.8768,0], b:[4.8768,3.6576] }],
  openings: [],
  catalogMeta: {
    BASE_CORNER_BIC_36x36: { declaredDimsIn:{ w:36,d:36,h:34.5 }, forward:"-Z", originSemantic:"CENTER" },
    RANGE_30: { declaredDimsIn:{ w:30,d:25,h:36 }, forward:"+Z", originSemantic:"CENTER" },
    HOOD_30:  { declaredDimsIn:{ w:30,d:20,h:10 }, forward:"+Z", originSemantic:"CENTER" },
    BASE_30:  { declaredDimsIn:{ w:30,d:24,h:34.5 }, forward:"-Z", originSemantic:"CENTER" }
  }
};

const intents:any[] = [
  { type:"PlaceAtCorner", payload:{ sku:"BASE_CORNER_BIC_36x36", primaryWallId:"W1", secondaryWallId:"W2" }, meta:{ userOverride:true } },
  { type:"PlaceOnWall",  payload:{ sku:"RANGE_30", wallId:"W1", offset_in:120 }, meta:{ userOverride:true } },
  { type:"PlaceOnWall",  payload:{ sku:"HOOD_30",  wallId:"W1", offset_in:120 }, meta:{ userOverride:true } },
  { type:"AlignOffset",  payload:{ anchorSku:"RANGE_30", targetSku:"HOOD_30" } }
];

while (intents.length < 100) intents.push({ ...intents[intents.length % 4] });

function run(n: number) {
  const t0 = performance.now();
  let cmds:any[] = [];
  for (let i = 0; i < n; i++) cmds = (solveIntents as any)(intents, { scene, catalogMeta: scene.catalogMeta, reveal_in: 0.5 });
  const t1 = performance.now();
  const { violations } = checkClearances(cmds as any, scene as any, { aisle_in: 36 });
  return { ms: (t1 - t0) / n, count: cmds.length, violations };
}

const N = Number(process.argv[2] ?? 25);
const { ms, count, violations } = run(N);

console.log(JSON.stringify({ items: count, avg_ms: Number(ms.toFixed(2)), violations }, null, 2));
fs.writeFileSync(path.resolve(process.cwd(), "solver-smoke-output.json"),
  JSON.stringify({ when: new Date().toISOString(), N, items: count, avg_ms: ms, violations }, null, 2));

