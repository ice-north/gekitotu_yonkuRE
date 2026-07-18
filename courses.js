// courses.js - コース定義（6ステージ）
// 画面サイズ: 1200x900
// surfaceType: "road"(舗装), "offroad"(未舗装), "ice"(氷)

const COURSES = [
  {
    id: 0,
    name: "OVAL CIRCUIT",
    description: "基本の楕円コース。初心者向け。",
    bgColor: "#2d5a1e",
    roadColor: "#707070",
    wallColor: "#c03030",
    roadWidth: 140,
    laps: 5,
    waypoints: [
      { x: 400, y: 150, surface: "road" },
      { x: 800, y: 150, surface: "road" },
      { x: 980, y: 260, surface: "road" },
      { x: 1050, y: 450, surface: "road" },
      { x: 980, y: 640, surface: "road" },
      { x: 800, y: 750, surface: "road" },
      { x: 400, y: 750, surface: "road" },
      { x: 220, y: 640, surface: "road" },
      { x: 150, y: 450, surface: "road" },
      { x: 220, y: 260, surface: "road" },
    ],
  },
  {
    id: 1,
    name: "TECHNICAL GP",
    description: "S字やヘアピンが連続するテクニカルコース。",
    bgColor: "#2d5a1e",
    roadColor: "#606060",
    wallColor: "#c03030",
    roadWidth: 130,
    laps: 5,
    waypoints: [
      { x: 600, y: 130, surface: "road" },
      { x: 900, y: 160, surface: "road" },
      { x: 1070, y: 360, surface: "road" },
      { x: 940, y: 560, surface: "road" },
      { x: 700, y: 500, surface: "road" },
      { x: 520, y: 620, surface: "road" },
      { x: 330, y: 760, surface: "road" },
      { x: 150, y: 600, surface: "road" },
      { x: 200, y: 360, surface: "road" },
      { x: 380, y: 180, surface: "road" },
    ],
  },
  {
    id: 2,
    name: "DIRT CROSS",
    description: "全面オフロード。グリップの低い荒れた路面。",
    bgColor: "#6b5535",
    roadColor: "#9a7d50",
    wallColor: "#8b6030",
    roadWidth: 150,
    laps: 5,
    waypoints: [
      { x: 600, y: 140, surface: "offroad" },
      { x: 960, y: 190, surface: "offroad" },
      { x: 1060, y: 450, surface: "offroad" },
      { x: 900, y: 720, surface: "offroad" },
      { x: 560, y: 760, surface: "offroad" },
      { x: 240, y: 700, surface: "offroad" },
      { x: 140, y: 420, surface: "offroad" },
      { x: 300, y: 160, surface: "offroad" },
    ],
  },
  {
    id: 3,
    name: "ICE LAKE",
    description: "凍った湖の上のコース。滑りやすい！",
    bgColor: "#90b8d0",
    roadColor: "#c0dae8",
    wallColor: "#4080b0",
    roadWidth: 155,
    laps: 5,
    waypoints: [
      { x: 600, y: 150, surface: "ice" },
      { x: 960, y: 270, surface: "ice" },
      { x: 1030, y: 560, surface: "ice" },
      { x: 700, y: 760, surface: "ice" },
      { x: 320, y: 720, surface: "ice" },
      { x: 150, y: 450, surface: "ice" },
      { x: 280, y: 210, surface: "ice" },
    ],
  },
  {
    id: 4,
    name: "MIX RALLY",
    description: "舗装・ダート・氷が混在するコース。",
    bgColor: "#3a5a2a",
    roadColor: "#686868",
    wallColor: "#c03030",
    roadWidth: 135,
    laps: 5,
    waypoints: [
      { x: 600, y: 120, surface: "road" },
      { x: 950, y: 170, surface: "road" },
      { x: 1080, y: 410, surface: "offroad" },
      { x: 1000, y: 660, surface: "offroad" },
      { x: 720, y: 770, surface: "ice" },
      { x: 420, y: 740, surface: "ice" },
      { x: 170, y: 590, surface: "offroad" },
      { x: 140, y: 340, surface: "road" },
      { x: 330, y: 160, surface: "road" },
    ],
  },
  {
    id: 5,
    name: "FINAL GP",
    description: "全要素が詰まった最終決戦コース！",
    bgColor: "#1e3a1e",
    roadColor: "#585858",
    wallColor: "#d02020",
    roadWidth: 125,
    laps: 5,
    waypoints: [
      { x: 600, y: 110, surface: "road" },
      { x: 900, y: 120, surface: "road" },
      { x: 1090, y: 280, surface: "ice" },
      { x: 1070, y: 500, surface: "ice" },
      { x: 900, y: 640, surface: "offroad" },
      { x: 700, y: 530, surface: "road" },
      { x: 560, y: 680, surface: "offroad" },
      { x: 330, y: 780, surface: "offroad" },
      { x: 150, y: 620, surface: "ice" },
      { x: 140, y: 380, surface: "road" },
      { x: 230, y: 200, surface: "road" },
      { x: 400, y: 120, surface: "road" },
    ],
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
