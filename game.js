/* CENTIPEDE - arcade remake. All sprites hand-drawn pixel arrays, all audio synthesized. */
(function () {
"use strict";
const W = 240, H = 256, T = 8, COLS = 30, ROWS = 32;
const ZONE_TOP = 26, FIELD_BOTTOM = 31;          // player zone rows (inclusive)
const HZ = 59.88;
const view = document.getElementById("game");
const vctx = view.getContext("2d");
const off = document.createElement("canvas"); off.width = W; off.height = H;
const octx = off.getContext("2d");
const img = octx.createImageData(W, H), fb = new Uint32Array(img.data.buffer);

/* ---------- colours / wave palettes ---------- */
const rgb = h => { const n = parseInt(h.slice(1), 16); return 0xff000000 | ((n & 255) << 16) | (n & 0xff00) | (n >> 16); };
// each wave: mushroom cap, mushroom outline, centipede body, centipede legs/eyes, poisoned cap
// m = mushroom cap, o = mushroom outline + text, c = centipede, l = legs, e = eyes, p = poisoned cap, pl = player, sp = spider
// waves 1-2 measured from the MAME reference; later waves follow the same scheme (cap/outline rotate each wave)
const PAL = [
 { m: "#00ff00", o: "#ff0000", c: "#00ff00", l: "#ffff80", e: "#ff0000", p: "#ffff80", pl: "#ffff80", sp: "#ffff80" },
 { m: "#00ffbf", o: "#ff00bf", c: "#ff00bf", l: "#00ffff", e: "#ff8000", p: "#ff8000", pl: "#ff8000", sp: "#ffff00" },
 { m: "#ff0000", o: "#0060ff", c: "#ffff00", l: "#ff00ff", e: "#0060ff", p: "#00ff00", pl: "#ffffff", sp: "#00ff00" },
 { m: "#ffff00", o: "#00a0ff", c: "#00ffff", l: "#ff8000", e: "#ff0000", p: "#ff00bf", pl: "#ff0000", sp: "#ff00bf" },
 { m: "#ff8000", o: "#00ff00", c: "#ff00ff", l: "#ffffff", e: "#00ff00", p: "#00ffff", pl: "#00ffff", sp: "#ffff00" },
 { m: "#ff00ff", o: "#ffff00", c: "#0060ff", l: "#00ff00", e: "#ffff00", p: "#ff0000", pl: "#00ff00", sp: "#ffffff" },
 { m: "#0060ff", o: "#ff8000", c: "#ff0000", l: "#ffff80", e: "#ffffff", p: "#ffff00", pl: "#ffff00", sp: "#00ffff" },
 { m: "#ffffff", o: "#ff00bf", c: "#00ff00", l: "#ff8000", e: "#ff00bf", p: "#00ffbf", pl: "#ff00ff", sp: "#ff8000" }];
let pal;
function setPal(w) { const p = PAL[(w - 1) % PAL.length]; pal = {}; for (const k in p) pal[k] = rgb(p[k]); pal.w = rgb("#ffffff"); pal.txt = pal.o; }
setPal(1);

/* ---------- sprites (hand-drawn) ---------- */
const S = s => s.trim().split(/\s+/);
const SPR = {
 mush: S(`..bbbb.. .baaaab. baaaaaab baaaaaab bbbaabbb ..baab.. ..baab.. ..bbbb..`),
 head0: S(`..aaa... .aaaaab. aaaaeea. aaaaaaa. aaaaeea. .aaaaab. ..aaa... ........`),
 head1: S(`.baaa... .aaaaa.. aaaaeea. aaaaaaa. aaaaeea. .aaaaa.. .baaa... ........`),
 body0: S(`..aaa... .aaaaab. aaaaaaa. aaaaaaa. aaaaaaa. .aaaaab. ..aaa... ........`),
 body1: S(`.baaa... .aaaaa.. aaaaaaa. aaaaaaa. aaaaaaa. .aaaaa.. .baaa... ........`),
 player: S(`..aaa... .bbabb.. abbabba. aaaaaaa. .aaaaa.. ..aaa... ..aaa... ........`),
 spider0: S(`..b..........b.. .b.b........b.b. b...b.aaaa.b...b .....aaaaaa..... b...baaaaaab...b .b.b..aaaa..b.b. ..b..........b.. ................`),
 spider1: S(`................ b.b..........b.b .b..b.aaaa.b..b. b....aaaaaa....b .b..baaaaaab..b. b.b...aaaa...b.b ................ ................`),
 flea: S(`..aaaa.. .aaaaaa. aabaabaa .aaaaaa. ..aaaa.. .b.b.b.b b.b.b.b. ........`),
 scorp0: S(`.........aaa.... ........a...a... ..bb.....a..a... .bbbb.aaaaaaa... bbbbbaaaaaaa.... .bbbb.a.a.a..... ..bb..a.a.a..... ................`),
 scorp1: S(`.........aaa.... ........a...a... ..bb.....a..a... .bbbb.aaaaaaa... bbbbbaaaaaaa.... .bbbb..a.a.a.... ..bb...a.a.a.... ................`),
 boom0: S(`........ ...a.... .a.a.a.. ..aaa... .aaaaa.. ..aaa... .a.a.a.. ........`),
 boom1: S(`a...a..a .a.a.a.. ..a.a... aa.a.aa. ..a.a... .a.a.a.. a..a..a. ........`)
};
function blit(spr, x, y, ca, cb, flipX, rows, ce) {
 x |= 0; y |= 0; const h = rows == null ? spr.length : rows;
 for (let j = 0; j < h; j++) { const r = spr[j], yy = y + j; if (yy < 0 || yy >= H) continue;
  for (let i = 0; i < r.length; i++) { const ch = flipX ? r[r.length - 1 - i] : r[i]; if (ch === ".") continue; const xx = x + i; if (xx < 0 || xx >= W) continue; fb[yy * W + xx] = ch === "a" ? ca : ch === "e" ? (ce || cb) : cb; } }
}
function rect(x, y, w, h, c) { for (let j = Math.max(0, y); j < Math.min(H, y + h); j++) for (let i = Math.max(0, x); i < Math.min(W, x + w); i++) fb[j * W + i] = c; }
function text(s, x, y, c) { s = String(s).toUpperCase(); for (let k = 0; k < s.length; k++) { const g = window.CFONT[s[k]]; if (g) for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (g[j] & (16 >> i)) { const xx = x + k * 8 + i + 1, yy = y + j; if (xx >= 0 && xx < W && yy >= 0 && yy < H) fb[yy * W + xx] = c; } } }
const ctext = (s, row, c) => text(s, ((COLS - String(s).length) >> 1) * 8, row * 8, c);

/* ---------- audio (POKEY-style squares + poly noise) ---------- */
let AC = null, master = null;
try { ["cent_muted", "cent_muted_v2", "cent_muted_v1", "muted"].forEach(k => localStorage.removeItem(k)); } catch (_) {}
let muted = false; // session-only; never persisted
let unlocked = false, oscStarts = 0;
function audio() {
 if (!AC) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; AC = new A(); master = AC.createGain(); master.gain.value = 0.35; master.connect(AC.destination); AC.onstatechange = () => { if (AC.state === "suspended" || AC.state === "interrupted") { try { const p = AC.resume(); if (p && p.catch) p.catch(() => {}); } catch (_) {} } }; }
 master.gain.value = muted ? 0 : 0.35;
 if (AC.state !== "running" && AC.resume) { try { const p = AC.resume(); if (p && p.catch) p.catch(() => {}); } catch (_) {} }
 if (!unlocked) { try { const b = AC.createBuffer(1, 1, 22050), src = AC.createBufferSource(); src.buffer = b; src.connect(AC.destination); src.start(0); unlocked = true; } catch (_) {} }
 return AC;
}
let noiseBuf = null;
function noise() { if (!noiseBuf) { // 17-bit poly counter like POKEY
  noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseBuf.getChannelData(0); let r = 0x1ffff;
  for (let i = 0; i < d.length; i++) { const b = ((r >> 0) ^ (r >> 5)) & 1; r = (r >> 1) | (b << 16); d[i] = (r & 1) ? 0.8 : -0.8; } } return noiseBuf; }
const quiet = () => !AC || muted || demo;
function sq(f0, f1, dur, vol, when) {
 if (quiet()) return; const t = AC.currentTime + (when || 0), o = AC.createOscillator(), g = AC.createGain();
 o.type = "square"; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
 g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
 o.connect(g); g.connect(master); oscStarts++; o.start(t); o.stop(t + dur + 0.02);
}
function nz(rate0, rate1, dur, vol, when) {
 if (quiet()) return; const t = AC.currentTime + (when || 0), s = AC.createBufferSource(), g = AC.createGain();
 s.buffer = noise(); s.loop = true; s.playbackRate.setValueAtTime(rate0, t); s.playbackRate.exponentialRampToValueAtTime(rate1, t + dur);
 g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
 s.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
}
const SFX = {
 shot() { sq(2200, 900, 0.045, 0.10); },
 beat(k) { sq(k ? 98 : 110, k ? 98 : 110, 0.05, 0.16); },
 hitMush() { sq(600, 300, 0.03, 0.06); },
 seg() { nz(0.5, 0.15, 0.12, 0.25); },
 spider() { sq(380, 380, 0.5, 0.06); sq(1500, 380, 0.5, 0.035); }, // steady ~380 Hz drone + falling harmonic sweep (from spectrogram)
 flea() { /* falling whistle per frame handled in update */ },
 fleaTone(f) { sq(f, f * 0.97, 0.035, 0.07); },
 scorp(k) { sq(k ? 330 : 247, k ? 330 : 247, 0.06, 0.08); },
 boom() { nz(0.35, 0.05, 0.45, 0.45); },
 death() { nz(0.6, 0.04, 1.3, 0.5); sq(400, 60, 1.0, 0.08); },
 life() { for (let i = 0; i < 8; i++) sq(i & 1 ? 1568 : 2093, i & 1 ? 1568 : 2093, 0.06, 0.09, i * 0.07); },
 tick() { sq(1200, 1200, 0.025, 0.12); nz(1, 0.5, 0.03, 0.12); }
};

/* ---------- state ---------- */
let mush = new Int8Array(COLS * ROWS), poison = new Uint8Array(COLS * ROWS);
const MI = (c, r) => r * COLS + c;
let state = "play", demo = true, frame = 0, stateT = 0;
let score = 0, lives = 3, wave = 1, nextLife = 12000;
let player, shot, segs, spider, flea, scorp, booms, headTimer, beatT = 0, beatK = 0;
let restoreList = [], restoreT = 0, attractPhase = 0;
const KEY = "cent_scores_v1";
const DEFAULT_SCORES = [["EJD", 16543], ["DFT", 15432], ["CAD", 14320], ["DCB", 13210], ["ED ", 13010], ["DEW", 12805], ["DFW", 12201], ["GJR", 12102]];
let scores; try { scores = JSON.parse(localStorage.getItem(KEY)); } catch (e) { scores = null; }
if (!Array.isArray(scores) || scores.length !== 8) scores = DEFAULT_SCORES.map(a => a.slice());
const hiScore = () => Math.max(scores[0][1], score);

function seedMushrooms() {
 mush.fill(0); poison.fill(0);
 for (let r = 1; r < FIELD_BOTTOM; r++) for (let c = 0; c < COLS; c++) if (Math.random() < (r >= ZONE_TOP ? 0.015 : r < 2 ? 0 : 0.065)) mush[MI(c, r)] = 4;
}
function newCentipede() {
 segs = []; const extra = (wave - 1) % 12, len = 12 - extra, spd = 2;
 const dir = Math.random() < 0.5 ? 1 : -1, sc = dir > 0 ? 14 : 15;
 for (let i = 0; i < len; i++) segs.push(mkSeg(sc - dir * i, 1, dir, spd, i === 0));
 for (let i = 0; i < extra; i++) { const d = i & 1 ? 1 : -1; segs.push(mkSeg(2 + Math.floor(Math.random() * 26), 1, d, spd, true)); segs[segs.length - 1].y -= 0; }
 headTimer = 0;
}
function mkSeg(c, r, dx, spd, head) { return { x: c * T, y: r * T, tx: c * T, ty: r * T, dx, vy: 1, spd, head, pois: false, low: false }; }
function resetPlayer() { player = { x: 116, y: 30 * T, alive: true }; shot = null; spider = null; flea = null; scorp = null; booms = []; }
function startGame(isDemo) {
 demo = isDemo; score = 0; lives = 3; wave = 1; nextLife = 12000; setPal(1); seedMushrooms(); resetPlayer(); newCentipede();
 state = "play"; stateT = 0; spiderT = 120; fleaArm = false;
}
let spiderT = 0, fleaArm = false;

/* ---------- input ---------- */
const keys = {}; let mdx = 0, mdy = 0, fireHeld = false, touchFire = false, mouseFire = false;
addEventListener("keydown", e => { keys[e.code] = true; if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault(); onAny(e); if (e.code === "KeyM") toggleMute(); });
addEventListener("keyup", e => { keys[e.code] = false; });
view.addEventListener("mousedown", e => { if (e.button === 0) { mouseFire = true; onAny(e); if (state === "play" && !demo && view.requestPointerLock && !document.pointerLockElement && !document.body.classList.contains("touch")) { try { const p = view.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (_) {} } } });
addEventListener("mouseup", () => { mouseFire = false; });
addEventListener("mousemove", e => { if (document.body.classList.contains("touch")) return; const r = view.getBoundingClientRect(); if (!r.width) return; const k = W / r.width; mdx += e.movementX * k; mdy += e.movementY * k; });
// touch: left drag pad = trackball, right FIRE button (auto-fire while held)
const pad = document.getElementById("pad"), fireBtn = document.getElementById("fire");
let padId = null, plx = 0, ply = 0;
function padDown(e) { e.preventDefault(); onAny(e); padId = e.pointerId; plx = e.clientX; ply = e.clientY; try { e.target.setPointerCapture(e.pointerId); } catch (_) {} }
function padMove(e) { if (e.pointerId !== padId) return; e.preventDefault(); const r = view.getBoundingClientRect(), k = W / r.width * 1.5; mdx += (e.clientX - plx) * k; mdy += (e.clientY - ply) * k; plx = e.clientX; ply = e.clientY; }
function padUp(e) { if (e.pointerId === padId) padId = null; }
[pad, view].forEach(el => { el.addEventListener("pointerdown", e => { if (e.pointerType === "mouse") return; padDown(e); }); el.addEventListener("pointermove", padMove); el.addEventListener("pointerup", padUp); el.addEventListener("pointercancel", padUp); });
fireBtn.addEventListener("pointerdown", e => { e.preventDefault(); onAny(e); touchFire = true; fireBtn.classList.add("active"); try { fireBtn.setPointerCapture(e.pointerId); } catch (_) {} });
["pointerup", "pointercancel", "lostpointercapture"].forEach(t => fireBtn.addEventListener(t, () => { touchFire = false; fireBtn.classList.remove("active"); }));
function onAny() {
 audio();
 if (demo) { startGame(false); return; }
 if (state === "over" && stateT > 60) { toAttract(); }
}

/* ---------- AI for attract demo ---------- */
function demoInput() {
 let tx = 116; const near = segs.filter(s => s.y >= 160).sort((a, b) => b.y - a.y)[0];
 if (spider && Math.abs(spider.x - player.x) < 30 && spider.y > 190) tx = player.x + (spider.x < player.x ? 40 : -40);
 else if (near) tx = near.x; else if (segs.length) tx = segs[0].x;
 const ty = 29 * T + Math.sin(frame / 40) * 12;
 return { dx: Math.max(-2, Math.min(2, tx - player.x)), dy: Math.max(-2, Math.min(2, ty - player.y)), fire: true };
}

/* ---------- helpers ---------- */
function mushAt(px, py) { const c = px >> 3, r = py >> 3; if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false; return mush[MI(c, r)] > 0; }
function blockedPlayer(x, y) { for (const [ox, oy] of [[1, 0], [6, 0], [1, 6], [6, 6]]) if (mushAt(x + ox, y + oy)) return true; return false; }
function addScore(n) { if (demo) return; score += n; if (score >= nextLife) { nextLife += 12000; if (lives < 6) lives++; SFX.life(); } }
function boom(x, y, big) { booms.push({ x, y, t: 0, big }); }

/* ---------- update ---------- */
function update() {
 frame++; stateT++;
 if (state === "attract") { attractUpdate(); return; }
 if (state === "entry") { entryUpdate(); return; }
 if (state === "over") { if (stateT > 240) toAttract(); return; }
 if (state === "dying") { dyingUpdate(); return; }
 // play
 let dx = 0, dy = 0, fire = false;
 if (demo) { const d = demoInput(); dx = d.dx; dy = d.dy; fire = d.fire; if (stateT > 60 * 90) { toAttract(); return; } }
 else {
  const kx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0), ky = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
  dx = kx * 2 + Math.max(-6, Math.min(6, mdx)); dy = ky * 2 + Math.max(-6, Math.min(6, mdy)); mdx = 0; mdy = 0;
  fire = keys.Space || mouseFire || touchFire;
 }
 movePlayer(dx, dy);
 if (fire && !shot) { shot = { x: player.x + 3, y: player.y - 2 }; SFX.shot(); }
 if (shot) shotUpdate();
 segUpdate();
 spiderUpdate(); fleaUpdate(); scorpUpdate();
 for (const b of booms) b.t++; booms = booms.filter(b => b.t < 24);
 collidePlayer();
 if (segs.length) { if (++beatT >= 12) { beatT = 0; beatK ^= 1; SFX.beat(beatK); } }
 if (!segs.length && state === "play") { wave++; setPal(wave); newCentipede(); fleaArm = wave >= 2; }
}
function movePlayer(dx, dy) {
 const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))) || 0;
 for (let s = 0; s < steps; s++) {
  const sx = dx / steps, sy = dy / steps;
  let nx = Math.max(0, Math.min(W - 8, player.x + sx)); if (!blockedPlayer(nx | 0, player.y | 0)) player.x = nx;
  let ny = Math.max(ZONE_TOP * T, Math.min(FIELD_BOTTOM * T, player.y + sy)); if (!blockedPlayer(player.x | 0, ny | 0)) player.y = ny;
 }
}
function shotUpdate() {
 for (let k = 0; k < 9 && shot; k++) { // ~9 px per frame, checked per pixel
  shot.y -= 1; const sx = shot.x | 0, sy = shot.y | 0;
  if (sy < 8) { shot = null; break; }
  const c = sx >> 3, r = sy >> 3, i = MI(c, r);
  if (mush[i] > 0) { mush[i]--; SFX.hitMush(); if (mush[i] === 0) { poison[i] = 0; addScore(1); } shot = null; break; }
  for (let j = 0; j < segs.length; j++) { const s = segs[j]; if (sx >= s.x && sx < s.x + 8 && sy >= s.y && sy < s.y + 8) { hitSeg(j); shot = null; break; } }
  if (!shot) break;
  if (spider && sx >= spider.x && sx < spider.x + 16 && sy >= spider.y && sy < spider.y + 8) { const d = Math.abs(spider.y - player.y); const p = d < 16 ? 900 : d < 40 ? 600 : 300; addScore(p); boom(spider.x, spider.y, p); spider = null; spiderT = 60 + Math.random() * 180; SFX.boom(); shot = null; break; }
  if (flea && sx >= flea.x && sx < flea.x + 8 && sy >= flea.y && sy < flea.y + 8) { if (++flea.hits >= 2) { addScore(200); boom(flea.x, flea.y); flea = null; SFX.boom(); } else flea.spd *= 2; shot = null; break; }
  if (scorp && sx >= scorp.x && sx < scorp.x + 16 && sy >= scorp.y && sy < scorp.y + 8) { addScore(1000); boom(scorp.x, scorp.y); scorp = null; SFX.boom(); shot = null; break; }
 }
}
function hitSeg(j) {
 const s = segs[j]; addScore(s.head ? 100 : 10); SFX.seg();
 const c = Math.round(s.x / 8), r = Math.round(s.y / 8);
 if (c >= 0 && c < COLS && r > 0 && r < ROWS) { mush[MI(c, r)] = 4; poison[MI(c, r)] = 0; }
 boom(s.x, s.y);
 if (j + 1 < segs.length && !segs[j + 1].head) segs[j + 1].head = true;
 segs.splice(j, 1);
}
function segUpdate() {
 for (const s of segs) {
  for (let k = 0; k < s.spd; k++) {
   if (s.x === s.tx && s.y === s.ty) chooseNext(s);
   s.x += Math.sign(s.tx - s.x); s.y += Math.sign(s.ty - s.y);
  }
 }
 // extra heads drop in once centipede has reached the player area
 if (segs.some(s => s.low)) { if (++headTimer > 60 * 6) { headTimer = 0; const d = Math.random() < 0.5 ? 1 : -1; const s = mkSeg(d > 0 ? 0 : COLS - 1, ZONE_TOP, d, 2, true); segs.push(s); } }
}
function chooseNext(s) {
 const c = s.x >> 3, r = s.y >> 3;
 if (r >= ZONE_TOP) s.low = true;
 if (s.pois) { if (r >= FIELD_BOTTOM) { s.pois = false; s.vy = -1; } else { s.ty = s.y + 8; return; } }
 const nc = c + s.dx;
 const blocked = nc < 0 || nc >= COLS || (mush[MI(nc, r)] > 0 && !(r >= ROWS));
 if (blocked) {
  if (nc >= 0 && nc < COLS && poison[MI(nc, r)] && mush[MI(nc, r)] > 0) { s.pois = true; s.dx = -s.dx; s.ty = s.y + 8; return; }
  if (r + s.vy > FIELD_BOTTOM) s.vy = -1; else if (s.vy < 0 && r + s.vy < ZONE_TOP) s.vy = 1;
  s.ty = s.y + s.vy * 8; s.dx = -s.dx;
 } else s.tx = s.x + s.dx * 8;
}
function spiderUpdate() {
 if (!spider) { if (--spiderT <= 0) { const l = Math.random() < 0.5; spider = { x: l ? -16 : W, y: 23 * T + Math.random() * 40, dx: l ? 1 : -1, vy: 1, mode: 0, mt: 0, spd: wave > 1 ? 2 : 1 }; } return; }
 const sp = spider; if (frame % 30 === 0) SFX.spider();
 if (--sp.mt <= 0) { sp.mode = Math.random() < 0.35 ? 1 : 0; sp.mt = 20 + Math.random() * 40; } // mode1 = vertical only
 if (frame % 2 === 0 || sp.spd > 1) { if (!sp.mode) sp.x += sp.dx; sp.y += sp.vy * 1.5; }
 if (sp.y > FIELD_BOTTOM * T) sp.vy = -1; if (sp.y < 23 * T) sp.vy = 1;
 // eats mushrooms
 const c = (sp.x + 8) >> 3, r = (sp.y + 4) >> 3; if (c >= 0 && c < COLS && r >= ZONE_TOP - 2 && r < ROWS && mush[MI(c, r)] && Math.random() < 0.1) mush[MI(c, r)] = 0;
 if (sp.x < -20 || sp.x > W + 4) { spider = null; spiderT = 90 + Math.random() * 200; }
}
function fleaUpdate() {
 if (!flea) {
  if (wave < 2) return; let n = 0; for (let r = ZONE_TOP; r <= FIELD_BOTTOM; r++) for (let c = 0; c < COLS; c++) if (mush[MI(c, r)]) n++;
  if (n < 5 && Math.random() < 0.01) flea = { x: (Math.random() * COLS | 0) * 8, y: 8, spd: 2, hits: 0 };
  return;
 }
 flea.y += flea.spd; SFX.fleaTone(1400 - flea.y * 4);
 const r = flea.y >> 3, c = flea.x >> 3;
 if ((flea.y & 7) < flea.spd && r < FIELD_BOTTOM && r > 0 && !mush[MI(c, r)] && Math.random() < 0.25) mush[MI(c, r)] = 4;
 if (flea.y > H) flea = null;
}
function scorpUpdate() {
 if (!scorp) { if (wave >= 3 && Math.random() < 0.0015) { const l = Math.random() < 0.5; scorp = { x: l ? -16 : W, y: (3 + Math.random() * 14 | 0) * 8, dx: l ? 1 : -1 }; } return; }
 if (frame % 2 === 0) scorp.x += scorp.dx; if (frame % 15 === 0) SFX.scorp((frame / 15) & 1);
 const c = (scorp.x + 8) >> 3, r = scorp.y >> 3; if (c >= 0 && c < COLS && mush[MI(c, r)]) poison[MI(c, r)] = 1;
 if (scorp.x < -20 || scorp.x > W + 4) scorp = null;
}
function overlap(ax, ay, aw, ah, bx, by, bw, bh) { return ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah; }
function collidePlayer() {
 const px = player.x + 1, py = player.y + 1;
 let hit = segs.some(s => overlap(px, py, 6, 6, s.x + 1, s.y + 1, 6, 6));
 if (spider && overlap(px, py, 6, 6, spider.x + 2, spider.y + 1, 12, 6)) hit = true;
 if (flea && overlap(px, py, 6, 6, flea.x + 1, flea.y, 6, 6)) hit = true;
 if (hit) { state = "dying"; stateT = 0; SFX.death(); }
}
function dyingUpdate() {
 for (const b of booms) b.t++; booms = booms.filter(b => b.t < 24);
 if (stateT === 70) { // build restore list: damaged or poisoned mushrooms
  restoreList = []; for (let i = 0; i < mush.length; i++) if (mush[i] && (mush[i] < 4 || poison[i])) restoreList.push(i);
  restoreT = 0; segs = []; spider = null; flea = null; scorp = null; shot = null;
 }
 if (stateT > 70) {
  if (restoreList.length) { if (++restoreT >= 4) { restoreT = 0; const i = restoreList.shift(); mush[i] = 4; poison[i] = 0; addScore(5); SFX.tick(); } }
  else if (stateT > 100) {
   lives--; if (lives <= 0) { gameOver(); return; }
   resetPlayer(); newCentipede(); state = "play"; stateT = 0; spiderT = 120;
  }
 }
}
function gameOver() {
 if (demo) { toAttract(); return; }
 state = "over"; stateT = 0;
 if (score > scores[7][1]) { state = "entry"; stateT = 0; entry = { pos: 0, ch: [0, 0, 0], acc: 0, rel: false }; mdx = mdy = 0; Object.keys(keys).forEach(k => keys[k] = false); mouseFire = touchFire = false; }
}
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ ";
let entry = null;
function entryUpdate() {
 if (stateT < 30) { mdx = mdy = 0; return; } // ignore input for the first 0.5 s
 const kx = (keys.ArrowRight || keys.KeyD || keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowLeft || keys.KeyA || keys.ArrowUp || keys.KeyW ? 1 : 0);
 entry.acc += kx * 0.25 + (mdx + mdy) * 0.12; mdx = mdy = 0;
 while (entry.acc >= 1) { entry.acc--; entry.ch[entry.pos] = (entry.ch[entry.pos] + 1) % ALPHA.length; }
 while (entry.acc <= -1) { entry.acc++; entry.ch[entry.pos] = (entry.ch[entry.pos] + ALPHA.length - 1) % ALPHA.length; }
 const f = keys.Space || keys.Enter || mouseFire || touchFire;
 if (!f) entry.rel = true;
 else if (entry.rel) { entry.rel = false; entry.pos++; SFX.tick();
  if (entry.pos >= 3) { const name = entry.ch.map(i => ALPHA[i]).join(""); scores.push([name, score]); scores.sort((a, b) => b[1] - a[1]); scores.length = 8; try { localStorage.setItem(KEY, JSON.stringify(scores)); } catch (_) {} state = "over"; stateT = 0; } }
 if (stateT > 60 * 60) { state = "over"; stateT = 0; }
}
function toAttract() { if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock(); startGame(true); }
function attractUpdate() {
 if (stateT > 60 * 8) { startGame(true); }
}

/* ---------- render ---------- */
function drawField() {
 for (let r = 1; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const v = mush[MI(c, r)]; if (!v) continue; const p = poison[MI(c, r)]; blit(SPR.mush, c * 8, r * 8, p ? pal.p : pal.m, pal.o, false, v * 2); }
}
function drawHUD() {
 const sc = score ? String(score) : "00"; text(sc.padStart(6, " "), 0, 0, pal.txt);
 const hs = String(hiScore()); text(hs, 104, 0, pal.txt);
 if (!demo) for (let i = 0; i < Math.min(lives - 1, 6); i++) blit(SPR.player, 48 + i * 8, 0, pal.pl, pal.o);
}
function render() {
 fb.fill(0xff000000);
 {
  drawField(); drawHUD();
  const leg = (frame >> 2) & 1;
  for (const s of segs) blit(s.head ? (leg ? SPR.head1 : SPR.head0) : (leg ? SPR.body1 : SPR.body0), s.x, s.y, pal.c, pal.l, s.dx < 0, null, pal.e);
  if (spider) blit(leg ? SPR.spider1 : SPR.spider0, spider.x, spider.y, pal.sp, pal.m);
  if (flea) blit(SPR.flea, flea.x, flea.y, pal.c, pal.o);
  if (scorp) blit(leg ? SPR.scorp1 : SPR.scorp0, scorp.x, scorp.y, pal.m, pal.c, scorp.dx < 0);
  for (const b of booms) { if (b.big) text(String(b.big), b.x, b.y, pal.w); else blit((b.t >> 2) & 1 ? SPR.boom1 : SPR.boom0, b.x, b.y, pal.w, pal.w); }
  if (state === "dying") { if (stateT < 70) { const k = (stateT >> 2) & 1; blit(k ? SPR.boom1 : SPR.boom0, player.x - 2 + (stateT >> 3) % 3, player.y, (stateT >> 1) & 1 ? pal.c : pal.l, pal.m); } }
  else { blit(SPR.player, player.x, player.y, pal.pl, pal.o); if (shot) rect(shot.x | 0, shot.y | 0, 1, 6, pal.pl); }
  if (demo) { // attract overlay, laid out like the arcade score table
   text("HIGH SCORES", 80, 16, pal.txt);
   for (let i = 0; i < 8; i++) { const [n, s] = scores[i]; text(String(s).padStart(5, " ") + " " + n, 88 - Math.max(0, String(s).length - 5) * 8, 24 + i * 8, pal.txt); }
   text("1 COIN 1 PLAY", 64, 96, pal.txt); text("BONUS EVERY 12000", 56, 112, pal.txt);
   if ((frame >> 5) & 1) ctext(document.body.classList.contains("touch") ? "TAP TO PLAY" : "CLICK OR SPACE TO PLAY", 16, pal.w);
   ctext("CENTIPEDE  ARCADE REMAKE", 31, pal.txt);
  }
  if (state === "over") ctext("GAME OVER", 15, pal.w);
  if (state === "entry") {
   ctext("GREAT SCORE", 12, pal.w); ctext("ENTER YOUR INITIALS", 14, pal.txt);
   const nm = entry.ch.map(i => ALPHA[i]).join(""); text(nm, 108, 17 * 8, pal.w);
   if ((frame >> 3) & 1 && entry.pos < 3) rect(108 + entry.pos * 8 + 1, 17 * 8 + 8, 6, 1, pal.w);
   ctext("MOVE TO PICK  FIRE TO ENTER", 20, pal.txt);
  }
 }
 octx.putImageData(img, 0, 0);
 vctx.imageSmoothingEnabled = false; vctx.drawImage(off, 0, 0, view.width, view.height);
}

/* ---------- sizing: fixed stage scaled by min ratio ---------- */
function fit() {
 const touch = matchMedia("(pointer:coarse)").matches || navigator.maxTouchPoints > 0;
 document.body.classList.toggle("touch", touch);
 const vv = window.visualViewport, vw = vv ? vv.width : innerWidth, vh = vv ? vv.height : innerHeight;
 const land = vw > vh;
 let aw = vw - 8, ah = vh - 40;
 if (touch) { if (land) aw = vw - 2 * 150; else ah = vh - 40 - 190; }
 const s = Math.max(0.5, Math.min(aw / W, ah / H));
 const cw = Math.floor(W * s), ch = Math.floor(H * s), dpr = Math.min(3, window.devicePixelRatio || 1);
 view.style.width = cw + "px"; view.style.height = ch + "px";
 view.width = Math.round(cw * dpr); view.height = Math.round(ch * dpr);
 document.documentElement.style.setProperty("--cw", cw + "px");
}
addEventListener("resize", fit); addEventListener("orientationchange", () => { fit(); setTimeout(fit, 350); });
if (window.visualViewport) visualViewport.addEventListener("resize", fit);
fit();

/* ---------- mute ---------- */
const muteBtn = document.getElementById("btn-mute");
function toggleMute() { muted = !muted; audio(); muteBtn.textContent = muted ? "SOUND OFF" : "SOUND ON"; }
muteBtn.addEventListener("click", e => { e.stopPropagation(); toggleMute(); });
muteBtn.textContent = muted ? "SOUND OFF" : "SOUND ON";
["pointerdown", "touchstart", "touchend", "click", "keydown"].forEach(t => addEventListener(t, () => audio(), { capture: true, passive: true }));
document.addEventListener("visibilitychange", () => { if (!document.hidden && AC && AC.state !== "running") { try { AC.resume().catch(() => {}); } catch (_) {} } });
addEventListener("pageshow", () => { if (AC && AC.state !== "running") { try { AC.resume().catch(() => {}); } catch (_) {} } });
window.__audioInfo = () => ({ ctx: AC ? AC.state : "none", muted, gain: master ? master.gain.value : null, oscStarts });
window.__cent = { get state() { return { state, score, lives, wave, segs: segs ? segs.length : 0, spider: !!spider, flea: !!flea, scorp: !!scorp, demo }; }, start: () => startGame(false), demo: () => startGame(true), kill: () => { state = "dying"; stateT = 0; }, setWave: w => { wave = w; setPal(w); }, forceSpider: () => { spiderT = 1; } };

/* ---------- loop @ 59.88 Hz ---------- */
startGame(true);
let last = performance.now(), acc = 0; const STEP = 1000 / HZ;
function loop(t) { acc += Math.min(250, t - last); last = t; while (acc >= STEP) { update(); acc -= STEP; } render(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
})();
