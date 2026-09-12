// courses.js - コース定義（6ステージ / ラジコン迷路スタイル）
// 画面サイズ: 1200x900
// surfaceType: "road"(舗装), "offroad"(未舗装), "ice"(氷)

// 迷路（コーム型の蛇行）を生成する。
// マット全体を隙間なく走行帯で埋め、隣り合う帯は1枚の枠（壁）で仕切る。
// rawComb: 縦フィンガーのコーム経路を [x,y] 配列で返す（cols は偶数）
function rawComb(box, cols) {
  const { x0, y0, x1, y1 } = box;
  const sp = (x1 - x0) / (cols - 1);
  const yTop = y0, yBot = y1, yTop2 = y0 + sp;
  const xs = [];
  for (let i = 0; i < cols; i++) xs.push(x0 + sp * i);
  const raw = [];
  raw.push([xs[0], yTop]);
  raw.push([xs[cols - 1], yTop]);       // 上帯（左→右）
  raw.push([xs[cols - 1], yBot]);       // 右端を下る
  let atTop = false;
  for (let i = cols - 2; i >= 1; i--) { // 内側フィンガーを右から左へ
    raw.push([xs[i], atTop ? yTop2 : yBot]);
    atTop = !atTop;
    raw.push([xs[i], atTop ? yTop2 : yBot]);
  }
  raw.push([xs[0], atTop ? yTop2 : yBot]);
  raw.push([xs[0], yTop]);              // 左端を上って閉じる
  return raw;
}

// 縦型コーム（縦帯の迷路）
function combV(box, cols, flip, sf) {
  return rawComb(box, cols).map(([x, y]) => {
    const Y = flip ? (box.y0 + box.y1 - y) : y;
    return { x, y: Y, surface: sf ? sf(x, Y) : "road" };
  });
}

// 横型コーム（横帯の迷路＝縦型をXY入れ替え）
function combH(box, rows, flip, sf) {
  const V = { x0: box.y0, y0: box.x0, x1: box.y1, y1: box.x1 };
  return rawComb(V, rows).map(([vx, vy]) => {
    let X = vy; const Y = vx;
    if (flip) X = box.x0 + box.x1 - X;
    return { x: X, y: Y, surface: sf ? sf(X, Y) : "road" };
  });
}

const MAZE_BOX = { x0: 170, y0: 165, x1: 1030, y1: 780 };

const COURSES = [
  {
    id: 0,
    name: "PANEL MAZE",
    description: "枠で仕切られた基本の迷路コース。初心者向け。",
    bgColor: "#2b2b31",
    roadColor: "#5c5c66",
    wallColor: "#c03030",
    roadWidth: 140,
    laps: 5,
    waypoints: combV(MAZE_BOX, 6, false, () => "road"),
  },
  {
    id: 1,
    name: "SNAKE MAZE",
    description: "横帯が積み重なる蛇行迷路。折り返し勝負。",
    bgColor: "#2b2b31",
    roadColor: "#56565f",
    wallColor: "#c03030",
    roadWidth: 100,
    laps: 5,
    waypoints: combH(MAZE_BOX, 6, false, () => "road"),
  },
  {
    id: 2,
    name: "DIRT MAZE",
    description: "縦枠が密集するオフロード大迷路。グリップ低め。",
    bgColor: "#52422c",
    roadColor: "#9a7d50",
    wallColor: "#8b6030",
    roadWidth: 130,
    laps: 5,
    waypoints: combV(MAZE_BOX, 6, true, () => "offroad"),
  },
  {
    id: 3,
    name: "ICE MAZE",
    description: "幅広の横帯がつるつる滑る氷の迷路。壁に激突注意！",
    bgColor: "#7ba0bd",
    roadColor: "#d4e8f2",
    wallColor: "#4080b0",
    roadWidth: 160,
    laps: 5,
    waypoints: combH(MAZE_BOX, 4, false, () => "ice"),
  },
  {
    id: 4,
    name: "MIX MAZE",
    description: "舗装・ダート・氷が縦帯で混在する迷路。",
    bgColor: "#2f2f36",
    roadColor: "#63636c",
    wallColor: "#c03030",
    roadWidth: 105,
    laps: 5,
    waypoints: combV(MAZE_BOX, 8, false, (x) =>
      x < 460 ? "offroad" : x > 740 ? "ice" : "road"),
  },
  {
    id: 5,
    name: "FINAL MAZE",
    description: "横帯に全要素が詰まった最終決戦の大迷路！",
    bgColor: "#26262b",
    roadColor: "#55555f",
    wallColor: "#d02020",
    roadWidth: 100,
    laps: 5,
    waypoints: combH(MAZE_BOX, 6, true, (x, y) =>
      y < 370 ? "ice" : y > 590 ? "offroad" : "road"),
  },
];

// Catmull-Rom spline補間
function getCoursePoints(course, resolution) {
  const wp = course.waypoints;
  const points = [];
  const n = wp.length;
  for (let i = 0; i < n; i++) {
    const p0 = wp[(i - 1 + n) % n];
    const p1 = wp[i];
    const p2 = wp[(i + 1) % n];
    const p3 = wp[(i + 2) % n];
    for (let t = 0; t < resolution; t++) {
      const f = t / resolution;
      const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * f + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * f * f + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * f * f * f);
      const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * f + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * f * f + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * f * f * f);
      points.push({ x, y, surface: p1.surface });
    }
  }
  return points;
}
