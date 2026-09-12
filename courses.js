// courses.js - コース定義（6ステージ）
// 画面サイズ: 1200x900
// surfaceType: "road"(舗装), "offroad"(未舗装), "ice"(氷)

const COURSES = [
  {
    id: 0,
    name: "PANEL SPEEDWAY",
    description: "広いマットの基本コース。初心者向け。",
    bgColor: "#2b2b31",
    roadColor: "#5c5c66",
    wallColor: "#c03030",
    roadWidth: 130,
    laps: 5,
    waypoints: [
      { x: 300, y: 185, surface: "road" },
      { x: 900, y: 185, surface: "road" },
      { x: 1045, y: 330, surface: "road" },
      { x: 1045, y: 570, surface: "road" },
      { x: 900, y: 715, surface: "road" },
      { x: 300, y: 715, surface: "road" },
      { x: 155, y: 570, surface: "road" },
      { x: 155, y: 330, surface: "road" },
    ],
  },
  {
    id: 1,
    name: "SERPENTINE GP",
    description: "枠が中央に切れ込む蛇行コース。折り返しが勝負。",
    bgColor: "#2b2b31",
    roadColor: "#56565f",
    wallColor: "#c03030",
    roadWidth: 115,
    laps: 5,
    waypoints: [
      { x: 250, y: 180, surface: "road" },
      { x: 950, y: 180, surface: "road" },
      { x: 1050, y: 330, surface: "road" },
      { x: 1050, y: 600, surface: "road" },
      { x: 900, y: 730, surface: "road" },
      { x: 575, y: 730, surface: "road" },
      { x: 575, y: 470, surface: "road" },
      { x: 430, y: 430, surface: "road" },
      { x: 320, y: 470, surface: "road" },
      { x: 320, y: 730, surface: "road" },
      { x: 150, y: 600, surface: "road" },
      { x: 150, y: 330, surface: "road" },
    ],
  },
  {
    id: 2,
    name: "DIRT SNAKE",
    description: "全面オフロードのうねうねコース。グリップ低め。",
    bgColor: "#52422c",
    roadColor: "#9a7d50",
    wallColor: "#8b6030",
    roadWidth: 120,
    laps: 5,
    waypoints: [
      { x: 250, y: 195, surface: "offroad" },
      { x: 520, y: 155, surface: "offroad" },
      { x: 780, y: 195, surface: "offroad" },
      { x: 970, y: 215, surface: "offroad" },
      { x: 1055, y: 400, surface: "offroad" },
      { x: 1000, y: 560, surface: "offroad" },
      { x: 1055, y: 710, surface: "offroad" },
      { x: 830, y: 745, surface: "offroad" },
      { x: 540, y: 720, surface: "offroad" },
      { x: 290, y: 748, surface: "offroad" },
      { x: 150, y: 560, surface: "offroad" },
      { x: 200, y: 370, surface: "offroad" },
    ],
  },
  {
    id: 3,
    name: "ICE OVAL",
    description: "つるつるの氷マット。広い楕円でも滑る！",
    bgColor: "#7ba0bd",
    roadColor: "#d4e8f2",
    wallColor: "#4080b0",
    roadWidth: 150,
    laps: 5,
    waypoints: [
      { x: 350, y: 200, surface: "ice" },
      { x: 850, y: 200, surface: "ice" },
      { x: 1035, y: 350, surface: "ice" },
      { x: 1035, y: 550, surface: "ice" },
      { x: 850, y: 700, surface: "ice" },
      { x: 350, y: 700, surface: "ice" },
      { x: 165, y: 550, surface: "ice" },
      { x: 165, y: 350, surface: "ice" },
    ],
  },
  {
    id: 4,
    name: "MIX SERPENTINE",
    description: "舗装・ダート・氷が混在する蛇行コース。",
    bgColor: "#2f2f36",
    roadColor: "#63636c",
    wallColor: "#c03030",
    roadWidth: 120,
    laps: 5,
    waypoints: [
      { x: 250, y: 180, surface: "road" },
      { x: 950, y: 180, surface: "road" },
      { x: 1050, y: 330, surface: "ice" },
      { x: 1050, y: 600, surface: "ice" },
      { x: 900, y: 730, surface: "offroad" },
      { x: 575, y: 730, surface: "offroad" },
      { x: 575, y: 470, surface: "road" },
      { x: 430, y: 430, surface: "road" },
      { x: 320, y: 470, surface: "offroad" },
      { x: 320, y: 730, surface: "offroad" },
      { x: 150, y: 600, surface: "ice" },
      { x: 150, y: 330, surface: "road" },
    ],
  },
  {
    id: 5,
    name: "FINAL SERPENTINE",
    description: "全要素が詰まった最終決戦の蛇行コース！",
    bgColor: "#26262b",
    roadColor: "#55555f",
    wallColor: "#d02020",
    roadWidth: 120,
    laps: 5,
    waypoints: [
      { x: 230, y: 175, surface: "road" },
      { x: 560, y: 155, surface: "road" },
      { x: 880, y: 180, surface: "ice" },
      { x: 1055, y: 330, surface: "ice" },
      { x: 1055, y: 600, surface: "road" },
      { x: 910, y: 745, surface: "offroad" },
      { x: 600, y: 745, surface: "offroad" },
      { x: 600, y: 460, surface: "road" },
      { x: 450, y: 420, surface: "ice" },
      { x: 330, y: 460, surface: "ice" },
      { x: 330, y: 745, surface: "offroad" },
      { x: 155, y: 600, surface: "road" },
      { x: 155, y: 340, surface: "road" },
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
