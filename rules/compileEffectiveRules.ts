// Minimal, deterministic compiler for small-LLM context
export type CompileOpts = {
  roomType: "kitchen" | "bath";
  style: string;
  skuRefs?: string[];
  flags?: { ada?: boolean };
  format?: "json" | "xml";
};

import rulebook from "./rulebook.master.json";

// Re-export engine functions for integration
export { mergeRules, placementValidator } from "../src/lib/rulesEngine";

export function compileEffectiveRules(opts: CompileOpts): string | object {
  const { roomType, style, flags, format = "json" } = opts;

  const base = {
    ver: rulebook.meta?.version || "1.0.0",
    u: rulebook.meta?.units || "in",
    room: roomType,
    style
  };

  // Merge room hard rules
  const room = (rulebook as any)[roomType] || {};
  const hard = room.hard || {};
  // ADA overlay if flag set
  const ada = flags?.ada ? rulebook.globals?.ada || {} : {};

  // Style prefs
  const stylePrefs = rulebook.styles?.[style]?.prefs || {};
  const prefs = {
    doors: stylePrefs.cabinetDoorProfiles || [],
    pulls: stylePrefs.pullTypes || [],
    fin: stylePrefs.applianceFinishes || []
  };

  // Build tiny payload
  const tiny = {
    ...base,
    hard: pickTiny(roomType, hard, ada),
    prefs
  };

  if (format === "xml") return toXml(tiny);
  return tiny;
}

function pickTiny(roomType: string, hard: any, ada: any) {
  if (roomType === "kitchen") {
    return {
      aisle: { work1: hard.aisles?.workOneCookMin, work2: hard.aisles?.workTwoCookMin, walk: hard.aisles?.walkwayMin },
      island: { gap: hard.islandClear?.min },
      tri: { legMin: hard.triangle?.legMin, legMax: hard.triangle?.legMax, sumMax: hard.triangle?.sumMax },
      land: {
        sinkL: hard.landings?.sink?.left,
        sinkR: hard.landings?.sink?.right,
        cookL: hard.landings?.cooktop?.left,
        cookR: hard.landings?.cooktop?.right,
        refA: hard.landings?.refrigerator?.adjacent,
        refX: hard.landings?.refrigerator?.orAcrossWithin
      },
      dw: { nearSinkMax: hard.dwNearSink?.maxEdgeToEdge, sideClear: hard.dwNearSink?.sideClearAtRightAngle },
      ada: ada ? { cfW: ada.clearFloorWxD?.[0], cfD: ada.clearFloorWxD?.[1], turn: ada.turningDia } : undefined
    };
  } else {
    return {
      front: { lav: hard.frontClear?.lavToiletTubMin, shower: hard.frontClear?.showerEntryMin, rec: hard.frontClear?.recommendedFrontAll },
      wc: { center: hard.toilet?.centerlineToSideMin, width: hard.toilet?.clearWidthMin },
      sh: { boxW: hard.shower?.interiorMin?.[0], boxD: hard.shower?.interiorMin?.[1], doorFree: hard.shower?.doorSwingFreeAreaMin },
      ada: ada ? { cfW: ada.clearFloorWxD?.[0], cfD: ada.clearFloorWxD?.[1], turn: ada.turningDia } : undefined
    };
  }
}

function toXml(t: any): string {
  const esc = (s: any) => String(s ?? "");
  const hard = t.hard || {};
  const prefs = t.prefs || {};
  return `<rules ver="${esc(t.ver)}" room="${esc(t.room)}" style="${esc(t.style)}" u="${esc(t.u)}">` +
    `<hard>` +
      (hard.aisle ? `<aisle work1="${esc(hard.aisle.work1)}" work2="${esc(hard.aisle.work2)}" walk="${esc(hard.aisle.walk)}"/>` : "") +
      (hard.island ? `<island gap="${esc(hard.island.gap)}"/>` : "") +
      (hard.tri ? `<tri minLeg="${esc(hard.tri.legMin)}" maxLeg="${esc(hard.tri.legMax)}" sumMax="${esc(hard.tri.sumMax)}"/>` : "") +
      (hard.land ? `<land sinkL="${esc(hard.land.sinkL)}" sinkR="${esc(hard.land.sinkR)}" cookL="${esc(hard.land.cookL)}" cookR="${esc(hard.land.cookR)}" refA="${esc(hard.land.refA)}" refX="${esc(hard.land.refX)}"/>` : "") +
      (hard.dw ? `<dw nearSinkMax="${esc(hard.dw.nearSinkMax)}" sideClear="${esc(hard.dw.sideClear)}"/>` : "") +
      (hard.front ? `<front lav="${esc(hard.front.lav)}" shower="${esc(hard.front.shower)}" rec="${esc(hard.front.rec)}"/>` : "") +
      (hard.wc ? `<wc center="${esc(hard.wc.center)}" width="${esc(hard.wc.width)}"/>` : "") +
      (hard.sh ? `<sh boxW="${esc(hard.sh.boxW)}" boxD="${esc(hard.sh.boxD)}" doorFree="${esc(hard.sh.doorFree)}"/>` : "") +
      (hard.ada ? `<ada cfW="${esc(hard.ada.cfW)}" cfD="${esc(hard.ada.cfD)}" turn="${esc(hard.ada.turn)}"/>` : "") +
    `</hard>` +
    `<prefs doors="${esc((prefs.doors||[]).join('|'))}" pulls="${esc((prefs.pulls||[]).join('|'))}" fin="${esc((prefs.fin||[]).join('|'))}"/>` +
  `</rules>`;
}