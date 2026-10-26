/**
 * Title-screen ambient rain: red drops fall onto a wet stone street under clear water and ripple on impact.
 * One WebGL fragment shader renders the street in perspective, with the stones seen through
 * the water. Ripples are damped wave trains that refract the stones and reflect a dim overhead
 * light; the red stays on the ring crests
 * and the floating drop (nothing spreads into the water), falling drops are motion-blurred
 * with depth of field, and every streak lands where its ripple starts.
 * Everything is procedural from time, so landings and ripples stay in sync with no JS state.
 * Allowed by DESIGN.md "Title rain exception". Tune the constants on the room's projector.
 */
const RENDER_SCALE = 0.75; // canvas pixels per CSS pixel; the grain hides the upscale

// --- glitch ----------------------------------------------------------------------------------
// Short digital tears while the lamp is steady. To remove: set GLITCH to false, or delete every
// block marked "glitch" in this file plus the .glitching rule in style.css.
const GLITCH = true;

// Tear pass: copies the finished frame to the screen with some horizontal bands shifted
// sideways (wrapping), red and blue pulled apart, a few bands smeared, and scanlines on the tears.
const GLITCH_FRAG = `
precision highp float;
uniform sampler2D uFrame;
uniform vec2 uRes;
uniform float uSeed; // new value for each glitch state
float h(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
void main() {
  vec2 st = gl_FragCoord.xy / uRes;
  float band = floor(st.y * floor(mix(8.0, 26.0, h(uSeed))) + h(uSeed + 1.0) * 3.0);
  float r = h(band * 7.31 + uSeed);
  float hit = step(0.72, r); // about a quarter of the bands tear
  vec2 q = vec2(fract(st.x + (h(band * 3.17 + uSeed * 1.3) - 0.5) * 0.14 * hit), st.y);
  if (h(band * 1.7 + uSeed * 2.1) > 0.93) q.x = floor(q.x * 6.0) / 6.0 + 0.01; // stuck, smeared band
  float split = 0.003 + 0.012 * hit * r;
  vec3 col = vec3(texture2D(uFrame, q + vec2(split, 0.0)).r, texture2D(uFrame, q).g, texture2D(uFrame, q - vec2(split, 0.0)).b);
  col *= 1.0 - 0.25 * hit * step(0.5, fract(gl_FragCoord.y * 0.5));
  gl_FragColor = vec4(col, 1.0);
}`;
// --- end glitch -------------------------------------------------------------------------------

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

// Shared by both passes: uniforms, constants and helpers.
const HEAD = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uRed, uRedDeep, uBg;
uniform sampler2D uStone;
uniform float uLamp; // streetlight level, 0..1, set per frame by the flicker in JS

#define DROPS 64
const float PITCH = 0.92;       // camera tilt below the horizon, rad
const float TAN_HALF = 0.42;    // tan(vertical half-fov)
const float CAM_H = 2.0;        // camera height, m
const float FALL_SPEED = 9.0;   // m/s, real rain speed
const float RIPPLE_LIFE = 2.6;  // s
const float PERIOD = 1.8;       // s per drop cycle; >= (fall time + RIPPLE_LIFE) / 2 since two cycles are drawn
const float BEAD_TIME = 0.07;   // s the red drop stays visible on the surface after impact
const float WIND_CALM = 0.05;   // m of drift per m fallen in a lull; streaks lean bottom-left
const float WIND_GUST = 0.16;   // ... and at the height of a gust
const float SHUTTER = 0.03;     // s of motion blur (streak length)
const float WAVE_K = 150.0;     // ripple wavenumber, rad/m
const float WAVE_V = 0.11;      // ripple front speed, m/s
const float FOCUS = 2.6;        // focus distance, m
const float RED_FILM = 2.3;     // how strongly ring crests carry red
const float GROUND_LIGHT = 0.065; // brightness of the stones under the water
const float STONE_CONTRAST = 1.5; // >1 pushes stone tones apart, like wet stone
const float JOINT_DARK = 0.9;     // how dark the water-filled joints are (0 = photo's light mortar)
const vec2 STONE_ORIGIN = vec2(-1.25, 0.5); // the photo spans the unmasked ground once, at its own
const vec2 STONE_SIZE = vec2(4.2, 2.8);     // 3:2 aspect; the masked left edge and a thin far strip mirror
const vec3 LAMP_POS = vec3(5.1, 5.0, 6.9);  // streetlight off-frame; its reflection centres right of middle
const vec3 LAMP_COL = vec3(0.75, 0.86, 1.0); // cold LED white, against the red
const float LAMP_GLARE = 5.0;   // strength of the lamp's reflection streak on the water
const float LAMP_POOL = 60.0;   // how strongly the lamp lights the stones (falls off with distance squared)
const float SPLASH_TIME = 0.22; // s a splash crown is in the air
const float EXPOSURE = 1.6;     // overall brightness before tone mapping; projectors need it high
const float DRIFT = 1.0;        // camera drift amount (0 = locked off)
const float GRAIN = 0.045;      // film grain strength
const float GATE_WEAVE = 0.0006; // per-frame jitter of the image, in uv (about half a pixel)

vec3 ro, fwd, rgt, up;

float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}

vec3 rayDir(vec2 uv) { return normalize(fwd + (uv.x * rgt + uv.y * up) * 2.0 * TAN_HALF); }
vec2 groundHit(vec2 uv) { vec3 d = rayDir(uv); return (ro + d * (-ro.y / d.y)).xz; }

// Damped ring train behind a front moving at WAVE_V. Returns slope (xz) and crest height / amp.
vec3 ripple(vec2 p, vec2 c, float a, float amp) {
  vec2 dv = p - c;
  float d = length(dv);
  float w = 0.02 + 0.045 * a;          // the train spreads as it travels
  float x = d - WAVE_V * a + 0.8 * w;  // envelope peaks just behind the front
  if (abs(x) > 2.5 * w) return vec3(0.0);
  float env = exp(-(x * x) / (w * w)) * smoothstep(0.0, 0.012, d);
  float decay = exp(-1.3 * a) / (1.0 + 5.0 * WAVE_V * a);
  float ph = WAVE_K * (x - 0.8 * w);
  float slope = amp * decay * WAVE_K * cos(ph) * env;
  return vec3(slope * dv / max(d, 1e-4), sin(ph) * env * decay);
}

// The street: the stone photo (web/assets/stone.jpg) laid once across the visible ground,
// darkened and contrast-lifted to read wet, joints filled with water, and broad wet / oil
// patches to break it up.
vec3 street(vec2 p) {
  vec2 st = (p - STONE_ORIGIN) / STONE_SIZE;
  float v = pow(texture2D(uStone, st).r, 2.2 * STONE_CONTRAST);
  // Joints: the mortar is lighter than the stones around it. Comparing a lightly blurred lookup
  // with a heavily blurred local average (mip bias) finds it and cancels the photo's uneven light.
  float joint = smoothstep(0.03, 0.08, texture2D(uStone, st, 1.5).r - texture2D(uStone, st, 5.0).r);
  v *= 1.0 - JOINT_DARK * joint;
  v *= mix(0.6, 1.25, vnoise(p * 1.3) * 0.6 + vnoise(p * 4.7) * 0.4);
  return v * vec3(0.95, 0.97, 1.0); // wet stone reads slightly cool
}

float segDist(vec2 p, vec2 a, vec2 b, out float h) {
  vec2 pa = p - a, ba = b - a;
  h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// Rain intensity 0.3..1: swells and eases over ~10-20 s (two incommensurate sines, so no loop).
float gust(float t) { return clamp(0.62 + 0.25 * sin(t * 0.41) + 0.2 * sin(t * 0.17 + 1.3), 0.3, 1.0); }

// Impact splash: a crown of droplets thrown out and up on ballistic arcs, and a short rebound
// jet from the centre. Heights map to screen-up at the landing's scale s (the same framing as
// the streaks); outward ground offsets are foreshortened by the view angle (fore).
vec3 splash(vec2 uv, vec2 uvL, float s, float fore, float a, float size, float seed, vec3 redDeep, vec3 red) {
  vec3 col = vec3(0.0);
  vec3 spec = vec3(1.0, 0.8, 0.75);
  float w = max(0.0018 * size * s, 0.0013);
  for (int j = 0; j < 7; j++) {
    float fj = float(j);
    vec2 rn = hash22(vec2(seed, fj));
    float ang = (fj + rn.x * 0.8) * 0.8976;                  // spread round the crown (2pi / 7)
    float vh = (0.35 + 0.5 * rn.y) * size;                   // outward speed, m/s
    float vv = (0.7 + 0.6 * hash12(vec2(fj, seed))) * size;  // upward speed, m/s
    float h = vv * a - 4.9 * a * a;                          // height under gravity
    if (h < 0.0) continue;
    vec2 g = vec2(cos(ang), sin(ang)) * vh * a;
    vec2 q = uvL + vec2(g.x, g.y * fore + h) * s;
    float d = length(uv - q);
    float I = exp(-d * d / (w * w));
    col += (redDeep * 1.6 + red * 0.25) * I + spec * I * I * 0.35;
  }
  float ja = (a - 0.02) / 0.16; // rebound jet rises and falls back
  if (ja > 0.0 && ja < 1.0) {
    float hAlong;
    float d = segDist(uv, uvL, uvL + vec2(0.0, 0.035 * size * sin(3.1416 * ja) * s), hAlong);
    float wj = w * mix(1.4, 0.8, hAlong);
    float I = exp(-d * d / (wj * wj)) * (1.0 - 0.5 * ja);
    col += (redDeep * 1.5 + red * 0.4) * I + spec * I * I * 0.3 * step(0.85, hAlong);
  }
  return col;
}

vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

void camera() {
  float sp = sin(PITCH), cp = cos(PITCH);
  ro = vec3(0.0, CAM_H, 0.0);
  fwd = vec3(0.0, -sp, cp);
  rgt = vec3(1.0, 0.0, 0.0);
  up = vec3(0.0, cp, sp);
}

// Slow handheld drift as a 2D move of the image: pan, a slight roll and a breathing zoom on
// incommensurate 30-60 s periods. At this size it reads the same as moving the camera, and it
// keeps the 3D camera constant so the compiler can fold the per-drop maths (a moving camera
// more than doubled the frame time on integrated GPUs).
vec2 drift(vec2 uv, float t) {
  float roll = DRIFT * 0.0025 * sin(t * 0.19 + 0.7);
  uv = mat2(cos(roll), sin(roll), -sin(roll), cos(roll)) * uv;
  uv *= 1.0 + DRIFT * 0.015 * sin(t * 0.11 + 0.5);
  return uv + DRIFT * vec2(0.024 * sin(t * 0.13), 0.014 * sin(t * 0.21 + 1.0));
}

// Gate weave: the film frame jitters a fraction of a pixel, once per 24 fps frame.
vec2 weave(float t) { return (hash22(vec2(mod(floor(t * 24.0), 97.0), 3.7)) - 0.5) * GATE_WEAVE; }

// Drop fi in cycle cb, identical in both passes. False if the gust left it out this cycle
// (decided when the cycle began, so a drop and its ripple come and go together). Otherwise:
// landing point on screen, landing depth along the view axis, uv per metre there, size, and
// the fall time from just above the top edge.
bool drop(float fi, float cb, float off, float aspect, out vec2 uvL, out float zL, out float s, out float size, out float fallT) {
  if (hash12(vec2(fi + 0.5, cb * 1.7)) > gust(cb * PERIOD - off)) return false;
  size = mix(0.6, 1.3, hash12(vec2(cb, fi + 17.0)));
  uvL = mix(vec2(-0.15 * aspect, -0.48), vec2(0.5 * aspect, 0.42), hash22(vec2(fi, cb)));
  zL = -CAM_H / (fwd.y + uvL.y * 2.0 * TAN_HALF * up.y);
  s = 1.0 / (zL * 2.0 * TAN_HALF);
  fallT = (0.62 - uvL.y) / (FALL_SPEED * s);
  return true;
}
`;

// Pass 1: street, water, ripples and falling streaks.
const FRAG = HEAD + `
void main() {
  vec2 frameUv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y; // fixed to the frame (vignette)
  vec2 uv = drift(frameUv, uTime) + weave(uTime);
  float aspect = uRes.x / uRes.y;
  camera();

  vec3 rd = rayDir(uv);
  float tHit = -ro.y / rd.y;
  vec2 p = (ro + rd * tHit).xz;

  vec3 red = pow(uRed, vec3(2.2)), redDeep = pow(uRedDeep, vec3(2.2)), bg = pow(uBg, vec3(2.2));
  vec2 grad = vec2(0.0);
  float film = 0.0, bead = 0.0;
  vec3 emit = vec3(0.0);

  float gNow = gust(uTime);
  vec2 dir = normalize(vec2(mix(WIND_CALM, WIND_GUST, gNow), 1.0)); // the wind leans harder in a gust

  // Fine rain pocking the whole surface: one small ripple per 0.2 m cell, random rhythm.
  vec2 gi = floor(p * 5.0);
  for (int j = -1; j <= 1; j++) for (int k = -1; k <= 1; k++) {
    vec2 cid = gi + vec2(float(j), float(k));
    vec2 rn = hash22(cid);
    float per = 1.4 + 1.6 * rn.x;
    float tt = uTime + rn.y * per;
    float cy = floor(tt / per);
    float a = tt - cy * per;
    vec2 c = (cid + hash22(cid + cy * 7.31)) / 5.0;
    grad += ripple(p, c, a, 0.003 * rn.y * gNow).xy * smoothstep(1.5, 0.6, a);
  }

  // Drops: each falls as a streak, lands exactly where it ripples, flashes a red bead for an
  // instant and leaves a red-crested ring train. The previous cycle is evaluated too, because
  // its ripple is still spreading while the drop's next fall begins.
  vec3 streak = vec3(0.0);
  for (int i = 0; i < DROPS; i++) {
    float fi = float(i);
    float off = hash11(fi * 3.7 + 1.0) * PERIOD;
    float t = uTime + off;
    float cyc = floor(t / PERIOD);
    float tau = t - cyc * PERIOD;
    for (int back = 0; back < 2; back++) {
      float cb = cyc - float(back);
      vec2 uvL;
      float zL, s, size, fallT;
      if (!drop(fi, cb, off, aspect, uvL, zL, s, size, fallT)) continue;
      float a = tau + float(back) * PERIOD - fallT;         // time since impact
      if (a >= RIPPLE_LIFE) continue;

      // Cheap screen-space bounds first: most drops can't touch this pixel.
      vec2 duv = uv - uvL;
      float reach = (WAVE_V * a + 1.7 * (0.02 + 0.045 * a)) * s * 1.3; // ripple() is zero beyond this (margin for the nearer side being larger on screen)
      bool nearRipple = a >= 0.0 && dot(duv, duv) < reach * reach;
      bool inStreak = back == 0 && a < SHUTTER && duv.y > -0.02 && abs(duv.x * dir.y - duv.y * dir.x) < 0.02;
      if (!nearRipple && !inStreak) continue;

      if (nearRipple) {
        vec2 c = groundHit(uvL);
        vec3 rp = ripple(p, c, a, 0.009 * size);
        grad += rp.xy;
        film += max(rp.z, 0.0) * RED_FILM;
        float d = length(p - c);
        if (a < BEAD_TIME) { // the drop's body sits on the surface for an instant, shrinking as it sinks
          float k = 1.0 - a / BEAD_TIME;
          float rb = 0.008 * size * k;
          float m = k * smoothstep(rb, rb * 0.4, d);
          bead = max(bead, m);
          if (d < rb) grad += (p - c) / rb * 2.0 * m;
          emit += red * exp(-d * d / 0.00002) * k * 0.8; // impact glint
        }
      }
      if (inStreak) {
        // Fall straight down the screen onto the landing point (cinematic framing: verticals stay
        // vertical instead of converging under the tilted camera). Screen speed and blur scale with
        // the landing depth, so near drops fall faster and wider. The blurred tail keeps draining
        // into the impact point for one shutter after landing.
        vec2 head = uvL + dir * FALL_SPEED * max(-a, 0.0) * s;
        vec2 tail = uvL + dir * FALL_SPEED * (SHUTTER - a) * s;
        float w = max(0.0028 * size * s, 0.001) + 0.0016 * abs(zL - FOCUS);
        float hAlong;
        float sd = segDist(uv, head, tail, hAlong);
        float fade = min(1.0, 0.0018 / w); // defocus spreads the same light wider
        float I = exp(-sd * sd / (w * w)) * pow(1.0 - hAlong, 1.5) * fade;
        float hd = length(uv - head);
        float H = exp(-hd * hd / (w * w * 1.6)) * fade * step(a, 0.0); // the drop itself, gone once it lands
        // Translucent dark-red body; only the drop's head catches a little light.
        streak += (redDeep * 1.2 + red * 0.15) * I * 0.8 + red * H * 0.6 + vec3(1.0, 0.75, 0.7) * H * H * 0.25;
      }
    }
  }

  // Shade: stones seen through the water (ripples refract it), plus the water's own reflection
  // of an overcast sky and the streetlight, weighted by Fresnel. A broad sheen sits top right; a
  // sharp light behind the camera is only caught by ripple slopes.
  vec3 n = normalize(vec3(-grad.x, 1.0, -grad.y));
  vec3 r = reflect(rd, n);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
  float rb = max(dot(r, normalize(vec3(0.5, 0.55, 0.68))), 0.0);
  float rs = max(dot(r, normalize(vec3(0.3, 0.9, -0.3))), 0.0);
  vec3 sky = vec3(0.01) + vec3(0.15, 0.14, 0.13) * smoothstep(0.25, 1.0, r.y); // overcast, brighter overhead
  vec3 lamp = vec3(1.0, 0.93, 0.86) * (pow(rs, 60.0) * 15.0 + pow(rb, 6.0) * 0.3);
  // Streetlight. Wet streets stretch a light's reflection toward the viewer, so the lobe is
  // narrow sideways and long in elevation; ripples and fine rain tear it into glints.
  vec3 toL = LAMP_POS - vec3(p.x, 0.0, p.y);
  float dl = length(toL);
  vec3 ldir = toL / dl;
  vec3 dv = r - ldir;
  float side = dot(dv, normalize(vec3(-ldir.z, 0.0, ldir.x)));
  float el = dv.y * dv.y;
  lamp += LAMP_COL * (exp(-side * side / 0.0015 - el / 0.03) + 0.12 * exp(-side * side / 0.012 - el / 0.06)) * LAMP_GLARE * uLamp; // core + soft halo
  film = clamp(film, 0.0, 1.0);
  vec3 tint = mix(vec3(1.0), red * 4.5, film);
  vec3 ground = street(p + grad * 0.004) * GROUND_LIGHT; // ripples refract the stones
  ground *= 1.0 + LAMP_COL * LAMP_POOL * uLamp * ldir.y / (dl * dl); // pool of lamplight on the stones
  vec3 col = mix(ground, redDeep * 0.08, film) * (1.0 - fres) + fres * (sky + lamp) * tint;
  col = mix(col, redDeep * 0.35 + lamp * red * 3.0 + red * 0.08, bead);
  col += emit;

  col = mix(col, bg * 0.5, smoothstep(2.5, 7.0, tHit) * 0.6); // distance haze

  col += streak;

  col *= smoothstep(1.25, 0.35, length(frameUv * vec2(0.75, 1.0))); // vignette
  col = pow(aces(col * EXPOSURE), vec3(1.0 / 2.2));
  // Film grain at 24 fps: soft (triangular) noise, strongest in shadows and mids, and a faint
  // per-frame exposure flicker like a projected print. Monochrome on purpose: one more hash for
  // colour grain tipped the compiled shader into a form ~80% slower on integrated GPUs.
  float frame = mod(floor(uTime * 24.0), 97.0);
  vec2 gp = gl_FragCoord.xy + frame * vec2(37.0, 17.0);
  float grain = hash12(gp) + hash12(gp + 71.3) - 1.0;
  col *= 1.0 + (hash11(frame + 0.5) - 0.5) * 0.03;
  col += grain * GRAIN * mix(1.0, 0.4, dot(col, vec3(0.299, 0.587, 0.114)));
  gl_FragColor = vec4(col, 1.0);
}`;

// Pass 2, blended additively on top: impact splashes. A separate pass because carrying splash
// state out of pass 1's drop loop made the compiled shader ~2x slower on integrated GPUs.
const SPLASH_FRAG = HEAD + `
void main() {
  vec2 frameUv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y; // fixed to the frame (vignette)
  vec2 uv = drift(frameUv, uTime) + weave(uTime);
  float aspect = uRes.x / uRes.y;
  camera();
  vec3 red = pow(uRed, vec3(2.2)), redDeep = pow(uRedDeep, vec3(2.2));
  vec3 col = vec3(0.0);
  for (int i = 0; i < DROPS; i++) {
    float fi = float(i);
    float off = hash11(fi * 3.7 + 1.0) * PERIOD;
    float t = uTime + off;
    float cb = floor(t / PERIOD);
    vec2 uvL;
    float zL, s, size, fallT;
    if (!drop(fi, cb, off, aspect, uvL, zL, s, size, fallT)) continue;
    float a = t - cb * PERIOD - fallT;
    vec2 duv = uv - uvL;
    if (a < 0.0 || a >= SPLASH_TIME || dot(duv, duv) > 0.0625 * s * s) continue;
    vec3 dL = normalize(vec3(uvL.x * 2.0 * TAN_HALF, fwd.y + uvL.y * 2.0 * TAN_HALF * up.y, fwd.z + uvL.y * 2.0 * TAN_HALF * up.z));
    col += splash(uv, uvL, s, -dL.y, a, size, fi + cb * 13.0, redDeep, red);
  }
  col *= smoothstep(1.25, 0.35, length(frameUv * vec2(0.75, 1.0)));
  gl_FragColor = vec4(pow(aces(col * EXPOSURE), vec3(1.0 / 2.2)), 1.0);
}`;

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

export function startRain(screen) {
  const canvas = document.createElement("canvas");
  canvas.className = "rain";
  canvas.setAttribute("aria-hidden", "true");
  screen.prepend(canvas);
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" });
  if (!gl) { canvas.remove(); return; } // no WebGL: plain title screen

  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // one covering triangle
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const css = getComputedStyle(document.documentElement);
  const token = (name) => rgb(css.getPropertyValue(name).trim());
  const program = (frag) => {
    const prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(prog, 0, "aPos");
    gl.linkProgram(prog);
    gl.useProgram(prog);
    gl.uniform3fv(gl.getUniformLocation(prog, "uRed"), token("--signal"));
    gl.uniform3fv(gl.getUniformLocation(prog, "uRedDeep"), token("--signal-fill"));
    gl.uniform3fv(gl.getUniformLocation(prog, "uBg"), token("--bg"));
    const u = (name) => gl.getUniformLocation(prog, name);
    return { prog, uRes: u("uRes"), uTime: u("uTime"), uLamp: u("uLamp") };
  };
  const passes = [program(FRAG), program(SPLASH_FRAG)];
  gl.blendFunc(gl.ONE, gl.ONE); // splashes add light on top of pass 1

  // Stone texture: a grey placeholder until the photo loads, then resized to a power of two
  // so WebGL 1 can mipmap it (distant stones would shimmer without mipmaps).
  const T = gl.TEXTURE_2D;
  gl.bindTexture(T, gl.createTexture());
  gl.texImage2D(T, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([90, 90, 90]));
  gl.texParameteri(T, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  const img = new Image();
  img.onload = () => {
    const pot = document.createElement("canvas");
    pot.width = 2048; pot.height = 1024;
    pot.getContext("2d").drawImage(img, 0, 0, pot.width, pot.height);
    gl.texImage2D(T, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, pot);
    gl.generateMipmap(T);
    gl.texParameteri(T, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(T, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT); // covers the masked left edge and the far strip
    gl.texParameteri(T, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    const aniso = gl.getExtension("EXT_texture_filter_anisotropic"); // sharper stones at grazing angles
    if (aniso) gl.texParameterf(T, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    if (!raf) draw(7.3);
  };
  img.src = new URL("../assets/stone.jpg", import.meta.url);

  // --- glitch: an offscreen frame (texture unit 1) and the tear pass, used only during a burst ---
  let tear = null;
  if (GLITCH) {
    const pass = program(GLITCH_FRAG);
    gl.uniform1i(gl.getUniformLocation(pass.prog, "uFrame"), 1);
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(T, tex);
    gl.texParameteri(T, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(T, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(T, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.activeTexture(gl.TEXTURE0); // the stone texture stays on unit 0
    tear = { ...pass, tex, fbo: gl.createFramebuffer(), uSeed: gl.getUniformLocation(pass.prog, "uSeed") };
  }
  let burst = null;
  function makeBurst(start) { // 1-3 states of 0.12-0.2 s each
    const steps = [];
    let end = start;
    for (let i = 1 + Math.floor(Math.random() * 3); i > 0; i--) steps.push([(end += rand(0.12, 0.2)), rand(1, 1000)]);
    return { start, steps };
  }
  function glitchAt(t) { // seed of the current glitch state, or 0
    if (!burst || t < burst.start) return 0;
    for (const [end, seed] of burst.steps) if (t < end) return seed;
    burst = null;
    return 0;
  }
  // --- end glitch ---

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const t0 = performance.now();
  let raf = 0;

  // Dying streetlight: steady with a faint hum, then now and again it stutters, browns out or
  // cuts out and sputters back. Every level change lasts at least 0.34 s, so it never flashes
  // more than 3 times a second (WCAG 2.3.1, seizure safety). Reduced motion keeps it steady.
  const rand = (a, b) => a + Math.random() * (b - a);
  let queue = [], target = 1, level = 1, until = 0, last = 0;
  function nextEvents() {
    const ev = [[1, rand(2, 7)]];
    const r = Math.random();
    if (r < 0.45) for (let i = 2 + Math.floor(rand(0, 3)); i > 0; i--) ev.push([0.12, rand(0.34, 0.5)], [1, rand(0.34, 0.6)]); // stutter
    else if (r < 0.75) ev.push([0.35, rand(0.6, 1.5)]); // brownout
    else ev.push([0, rand(0.8, 2.5)], [0.5, 0.34], [0.05, 0.34]); // cuts out, sputters back
    return ev;
  }
  function lamp(t) {
    if (t >= until) {
      if (!queue.length) queue = nextEvents();
      const [l, d] = queue.shift();
      target = l;
      until = t + d;
      // glitch: maybe one burst inside a long steady stretch, at least 1 s after the lamp settles
      // and 1.5 s before it next changes, so lamp and glitch together stay under 3 flashes a second
      if (GLITCH && l === 1 && d >= 2.5 && Math.random() < 0.7) burst = makeBurst(t + rand(1, d - 1.5));
    }
    level += (target - level) * Math.min(1, (t - last) * 25); // ~40 ms switch, not a hard cut
    last = t;
    return level * (0.98 + 0.02 * Math.sin(t * 11)); // hum, well under a visible flash
  }

  function draw(t, lampLevel = 1, seed = 0) {
    if (seed) gl.bindFramebuffer(gl.FRAMEBUFFER, tear.fbo); // glitch: render offscreen, then tear
    passes.forEach((pass, i) => {
      gl.useProgram(pass.prog);
      gl.uniform1f(pass.uTime, t);
      gl.uniform1f(pass.uLamp, lampLevel);
      if (i) gl.enable(gl.BLEND);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    });
    gl.disable(gl.BLEND);
    // --- glitch: tear the finished frame onto the screen; the title tears with it ---
    if (seed) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(tear.prog);
      gl.uniform1f(tear.uSeed, seed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      screen.style.setProperty("--glitch-x", `${((seed * 7) % 1 - 0.5) * 0.12}em`);
    }
    if (GLITCH) screen.classList.toggle("glitching", seed > 0);
    // --- end glitch ---
  }
  function frame(now) {
    const t = (now - t0) / 1000 + 4; // +4 s so the first frame is mid-storm
    const lampLevel = lamp(t);
    draw(t, lampLevel, GLITCH ? glitchAt(t) : 0);
    raf = requestAnimationFrame(frame);
  }
  function play(on) {
    cancelAnimationFrame(raf);
    raf = 0;
    if (on && !reduced) raf = requestAnimationFrame(frame);
  }

  new ResizeObserver(() => {
    const r = screen.getBoundingClientRect();
    if (!r.width || !r.height) return;
    canvas.width = Math.round(r.width * RENDER_SCALE);
    canvas.height = Math.round(r.height * RENDER_SCALE);
    gl.viewport(0, 0, canvas.width, canvas.height);
    passes.forEach((pass) => { gl.useProgram(pass.prog); gl.uniform2f(pass.uRes, canvas.width, canvas.height); });
    // --- glitch: size the offscreen frame to the canvas ---
    if (tear) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, tear.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, tear.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tear.tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(tear.prog);
      gl.uniform2f(tear.uRes, canvas.width, canvas.height);
    }
    // --- end glitch ---
    if (!raf) draw(7.3); // reduced motion: one still frame
  }).observe(screen);
  new IntersectionObserver(([e]) => play(e.isIntersecting)).observe(screen);
}
