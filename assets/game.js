/* Flex a Car: a tiny black and white arcade game. No libraries, no network, no stored data. */
(function (root) {
  "use strict";

  var T = 16;
  var COLS = 15, ROWS = 15;
  var ROW_A = "#.##.##.##.##.#";
  var ROW_B = "#.#.###.###.#.#";
  var MAP = [];
  for (var r = 0; r < ROWS; r++) {
    if (r === 0 || r === ROWS - 1) MAP.push("###############");
    else if (r % 2 === 1) MAP.push("#.............#");
    else MAP.push((r / 2) % 2 === 1 ? ROW_A : ROW_B);
  }
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  var CAR_STARTS = [[1, 1], [13, 1], [1, 13], [13, 13], [7, 13]];
  var FOOT_SPEED = 4.3;
  var CAR_SPEED = 4.7;
  var LEVEL_BASE = 5.0;
  var LEVEL_STEP = 0.35;

  function isOpen(c, r) {
    return r >= 0 && r < ROWS && c >= 0 && c < COLS && MAP[r].charAt(c) !== "#";
  }

  function makeEntity(c, r, speed) {
    return { c: c, r: r, pc: c, pr: r, t: 0, moving: false, dir: null, speed: speed };
  }

  function pos(e) {
    if (!e.moving) return { x: e.c, y: e.r };
    return { x: e.pc + (e.c - e.pc) * e.t, y: e.pr + (e.r - e.pr) * e.t };
  }

  /* Move an entity along the grid. pick(e) returns the next direction at a tile centre, or null to wait. */
  function advance(e, dt, pick) {
    var left = e.speed * dt;
    while (left > 0) {
      if (!e.moving) {
        var d = pick(e);
        if (!d) return;
        e.dir = d; e.pc = e.c; e.pr = e.r; e.c += d[0]; e.r += d[1]; e.t = 0; e.moving = true;
      }
      var need = 1 - e.t;
      if (left >= need) {
        left -= need; e.moving = false; e.pc = e.c; e.pr = e.r; e.t = 0;
      } else {
        e.t += left; left = 0;
      }
    }
  }

  function createCore(rand) {
    rand = rand || Math.random;
    var core = { status: "idle", time: 0, caught: 0, total: CAR_STARTS.length, player: null, cars: [], step: 0 };

    core.reset = function () {
      core.status = "idle"; core.time = 0; core.caught = 0; core.step = 0;
      var p = makeEntity(7, 7, FOOT_SPEED);
      p.want = null; p.level = 0;
      core.player = p;
      core.cars = CAR_STARTS.map(function (s, i) {
        var car = makeEntity(s[0], s[1], CAR_SPEED - 0.25 + (i % 3) * 0.2);
        car.pause = 0; car.cool = 0.5 + i * 0.3; car.facing = 1;
        return car;
      });
    };

    core.start = function () { core.reset(); core.status = "running"; };

    core.setWant = function (dx, dy) { if (core.player) core.player.want = [dx, dy]; };

    function playerPick(e) {
      var w = e.want;
      if (w && isOpen(e.c + w[0], e.r + w[1])) return w;
      if (e.dir && isOpen(e.c + e.dir[0], e.r + e.dir[1])) return e.dir;
      return null;
    }

    function carPick(car) {
      if (car.pause > 0) return null;
      var pl = core.player;
      var ref = pl.moving && pl.t < 0.5 ? { x: pl.pc, y: pl.pr } : { x: pl.c, y: pl.r };
      var opts = [];
      DIRS.forEach(function (d) { if (isOpen(car.c + d[0], car.r + d[1])) opts.push(d); });
      if (opts.length > 1 && car.dir) {
        var fwd = opts.filter(function (d) { return !(d[0] === -car.dir[0] && d[1] === -car.dir[1]); });
        if (fwd.length) opts = fwd;
      }
      if (opts.length >= 3 && car.cool <= 0 && rand() < 0.15) { car.pause = 0.45; car.cool = 1.6; return null; }
      var choice;
      if (rand() < 0.2) {
        choice = opts[Math.floor(rand() * opts.length)];
      } else {
        var best = -1;
        opts.forEach(function (d) {
          var dx = car.c + d[0] - ref.x, dy = car.r + d[1] - ref.y;
          var score = dx * dx + dy * dy + rand() * 0.5;
          if (score > best) { best = score; choice = d; }
        });
      }
      if (choice[0] !== 0) car.facing = choice[0];
      return choice;
    }

    core.update = function (dt) {
      if (core.status !== "running") return;
      dt = Math.min(dt, 0.05);
      core.time += dt;
      var p = core.player;
      var w = p.want;
      if (p.moving && w && p.dir && w[0] === -p.dir[0] && w[1] === -p.dir[1]) {
        var oc = p.c, or = p.r;
        p.c = p.pc; p.r = p.pr; p.pc = oc; p.pr = or; p.t = 1 - p.t; p.dir = w;
      }
      advance(p, dt, playerPick);
      if (p.moving || p.dir) core.step += dt * p.speed;
      core.cars.forEach(function (car) {
        car.pause = Math.max(0, car.pause - dt);
        car.cool = Math.max(0, car.cool - dt);
        advance(car, dt, carPick);
      });
      var pp = pos(p);
      for (var i = core.cars.length - 1; i >= 0; i--) {
        var cp = pos(core.cars[i]);
        var dx = cp.x - pp.x, dy = cp.y - pp.y;
        if (dx * dx + dy * dy < 0.6) {
          core.cars.splice(i, 1);
          core.caught++;
          p.level = Math.min(core.caught, 5);
          p.speed = LEVEL_BASE + LEVEL_STEP * (p.level - 1);
        }
      }
      if (!core.cars.length) core.status = "won";
    };

    core.reset();
    return core;
  }

  var api = { createCore: createCore, pos: pos, isOpen: isOpen, MAP: MAP, COLS: COLS, ROWS: ROWS, T: T };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  if (typeof document === "undefined") return;

  /* ---------- Drawing: white on black, low detail ---------- */
  var PLAYER_A = [
    "..#######...", "..#######.##", "...#.#.#....", "...#####....", "..#######...", ".#.#####.#..",
    ".#.#####.#..", "...#####....", "..#######...", ".#########..", ".###...###..", ".###...###.."
  ];
  var LEGS_B = [".#########..", "..###.###...", "..###.###..."];

  function px(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }

  function drawWalls(ctx) {
    ctx.fillStyle = "#fff";
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (MAP[r].charAt(c) !== "#") continue;
        var x = c * T, y = r * T;
        if (isOpen(c, r - 1)) ctx.fillRect(x, y, T, 2);
        if (isOpen(c, r + 1)) ctx.fillRect(x, y + T - 2, T, 2);
        if (isOpen(c - 1, r)) ctx.fillRect(x, y, 2, T);
        if (isOpen(c + 1, r)) ctx.fillRect(x + T - 2, y, 2, T);
      }
    }
  }

  function drawPerson(ctx, x, y, step) {
    var rows = PLAYER_A.slice();
    if (Math.floor(step * 2) % 2 === 1) { rows[9] = LEGS_B[0]; rows[10] = LEGS_B[1]; rows[11] = LEGS_B[2]; }
    ctx.fillStyle = "#fff";
    for (var j = 0; j < rows.length; j++) {
      for (var i = 0; i < rows[j].length; i++) {
        if (rows[j].charAt(i) === "#") ctx.fillRect(x + 2 + i, y + 2 + j, 1, 1);
      }
    }
  }

  function drawCar(ctx, x, y, facing, level, driver, bob) {
    ctx.save();
    ctx.translate(facing < 0 ? x + T : x, y + (bob ? 1 : 0));
    ctx.scale(facing < 0 ? -1 : 1, 1);
    var W = "#fff", K = "#000";
    if (level >= 4) { px(ctx, -4, 7, 3, 1, W); px(ctx, -3, 9, 2, 1, W); px(ctx, -4, 11, 3, 1, W); }
    px(ctx, 1, 6, 14, 5, W);
    px(ctx, 4, 3, 8, 3, W);
    px(ctx, 5, 4, 2, 2, K); px(ctx, 9, 4, 2, 2, K);
    if (driver) { px(ctx, 9, 5, 1, 1, W); px(ctx, 10, 4, 1, 1, W); }
    px(ctx, 2, 10, 4, 4, W); px(ctx, 3, 11, 2, 2, K);
    px(ctx, 10, 10, 4, 4, W); px(ctx, 11, 11, 2, 2, K);
    if (level >= 2) px(ctx, 1, 8, 14, 1, K);
    if (level >= 3) { px(ctx, 0, 3, 3, 1, W); px(ctx, 1, 3, 1, 3, W); }
    if (level >= 4) px(ctx, 15, 7, 1, 1, K);
    if (level >= 5) { px(ctx, 6, 0, 1, 3, W); px(ctx, 8, 0, 1, 3, W); px(ctx, 10, 0, 1, 3, W); px(ctx, 6, 2, 5, 1, W); }
    ctx.restore();
  }

  function draw(ctx, core) {
    px(ctx, 0, 0, COLS * T, ROWS * T, "#000");
    drawWalls(ctx);
    core.cars.forEach(function (car) {
      var p = pos(car);
      drawCar(ctx, Math.round(p.x * T), Math.round(p.y * T), car.facing, 0, false, car.pause > 0 && Math.floor(core.time * 8) % 2 === 0);
    });
    var pl = core.player, pp = pos(pl);
    var x = Math.round(pp.x * T), y = Math.round(pp.y * T);
    if (pl.level > 0) {
      if (pl.dir && pl.dir[0] !== 0) pl.facing = pl.dir[0];
      drawCar(ctx, x, y, pl.facing || 1, pl.level, true, false);
    } else {
      drawPerson(ctx, x, y, core.step);
    }
  }

  /* ---------- Page wiring ---------- */
  var canvas = document.getElementById("game-canvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var overlay = document.getElementById("game-overlay");
  var title = document.getElementById("game-title");
  var note = document.getElementById("game-note");
  var startBtn = document.getElementById("game-start");
  var status = document.getElementById("game-status");
  var pad = document.getElementById("game-pad");
  var core = createCore();
  var visible = true, last = 0, raf = 0;

  function setStatus() {
    status.textContent = core.status === "won"
      ? "All " + core.total + " cars caught in " + Math.round(core.time) + " seconds."
      : "Cars caught: " + core.caught + " of " + core.total;
  }

  function showOverlay(won) {
    title.textContent = won ? "You caught them all" : "Flex a Car";
    note.textContent = won ? "Your ride is looking fancy." : "Chase the cars on foot. Catch one and you drive it.";
    startBtn.textContent = won ? "Play again" : "Start";
    overlay.hidden = false;
    startBtn.focus({ preventScroll: true });
  }

  function loop(now) {
    raf = 0;
    if (core.status !== "running" || !visible || document.hidden) return;
    var dt = last ? (now - last) / 1000 : 0;
    last = now;
    core.update(dt);
    draw(ctx, core);
    setStatus();
    if (core.status === "won") { showOverlay(true); return; }
    raf = requestAnimationFrame(loop);
  }

  function resume() {
    if (!raf && core.status === "running" && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(loop); }
  }

  startBtn.addEventListener("click", function () {
    core.start();
    startBtn.blur();
    overlay.hidden = true;
    setStatus();
    draw(ctx, core);
    resume();
  });

  var KEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
  document.addEventListener("keydown", function (e) {
    if (core.status !== "running" || !visible || e.ctrlKey || e.metaKey || e.altKey) return;
    var d = KEYS[e.key];
    if (!d) return;
    e.preventDefault();
    core.setWant(d[0], d[1]);
  });

  var PAD = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  Array.prototype.forEach.call(pad.querySelectorAll("button"), function (b) {
    var d = PAD[b.getAttribute("data-dir")];
    function press(e) { e.preventDefault(); if (core.status === "running") core.setWant(d[0], d[1]); }
    b.addEventListener("pointerdown", press);
    b.addEventListener("click", function () { if (core.status === "running") core.setWant(d[0], d[1]); });
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) resume();
    }, { threshold: 0.2 }).observe(canvas);
  }
  document.addEventListener("visibilitychange", resume);

  setStatus();
  draw(ctx, core);
})(typeof window !== "undefined" ? window : this);
