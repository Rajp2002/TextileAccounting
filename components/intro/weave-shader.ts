/**
 * Procedural weave for the brand intro. One full-screen triangle; every pixel
 * works out which warp end / weft pass it sits on, whether that pass has been
 * woven yet, and whether saffron floats on the face there (from the logo mask).
 */

export const WEAVE_VERTEX_SHADER = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`

export const WEAVE_UNIFORMS = [
    'uRes', 'uDpr', 'uCamA', 'uZ', 'uInk', 'uGrid', 'uMask', 'uLogo', 'uPng',
    'uFell', 'uCarrierX', 'uInDir', 'uCarrierA', 'uTrail', 'uFellY',
    'uBeat', 'uReed', 'uReedA', 'uShed', 'uTex', 'uBeige', 'uExposure',
    'uStage', 'uRadius', 'uShadowZ', 'uShadowA', 'uLogoA',
] as const

export type WeaveUniform = (typeof WEAVE_UNIFORMS)[number]

export const WEAVE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uDpr;
uniform vec2 uCamA; uniform float uZ;
uniform vec4 uInk; uniform vec2 uGrid;
uniform highp sampler2D uMask; uniform sampler2D uLogo; uniform vec4 uPng;
uniform float uFell; uniform float uCarrierX; uniform float uInDir; uniform float uCarrierA; uniform float uTrail; uniform float uFellY;
uniform float uBeat; uniform float uReed; uniform float uReedA; uniform float uShed;
uniform float uTex; uniform float uBeige; uniform float uExposure;
uniform vec4 uStage; uniform float uRadius; uniform float uShadowZ; uniform float uShadowA; uniform float uLogoA;
out vec4 outColor;

const vec3 SAFF  = vec3(238.0, 127.0, 45.0) / 255.0;   // the logo's own pixels (#EE7F2D)
const vec3 BEIGE = vec3(255.0, 248.0, 234.0) / 255.0;  // --weavly-app-bg

// Dark cloth -> the app's beige, through warm tones rather than a flat grey.
vec3 cloth(vec3 dark, vec3 light) {
  return mix(dark, light, uBeige) + vec3(0.16, 0.07, 0.0) * sin(3.14159265 * uBeige);
}

float hash(float n) { return fract(sin(n * 12.9898 + 4.1414) * 43758.5453); }
float cover(float t, float gap, float aa) { float h = 0.5 - gap; return 1.0 - smoothstep(h - aa, h + aa, abs(t - 0.5)); }
float shade(float t, float gap) { float h = 0.5 - gap; float x = clamp((t - 0.5) / h, -1.0, 1.0); return sqrt(max(0.0, 1.0 - x * x)); }

float sdStage(vec2 p) {
  vec2 c = 0.5 * (uStage.xy + uStage.zw);
  vec2 h = 0.5 * (uStage.zw - uStage.xy);
  vec2 q = p - c;
  float r = q.y > 0.0 ? min(uRadius, min(h.x, h.y)) : 0.0;   // only the bottom corners are rounded
  vec2 d = abs(q) - h + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

vec3 woven(float fi, float fj, float u, float v, float fig, float aa, vec3 warpC, vec3 weftC, vec3 gapC) {
  float wv = hash(fi), fv = hash(fj + 100.0);
  if (fig < 0.25 && mod(fi + fj, 2.0) < 0.5) {             // ground: warp over
    vec3 t = warpC * (0.8 + 0.4 * wv) * (0.55 + 0.45 * shade(u, 0.07)) * (1.0 + 0.14 * (0.5 - u));
    return mix(gapC, t, cover(u, 0.07, aa));
  }
  if (fig > 0.25) {
    // Brocade floats pack tightly: rows read through shading, never black gaps (which look like holes).
    float tw = 1.0 + 0.06 * sin(6.2831853 * (u * 2.0 + v * 0.9 + fv * 3.0));
    vec3 c = SAFF * (0.66 + 0.40 * shade(v, 0.0)) * tw * (1.0 + 0.08 * (0.5 - v));
    if (fig > 0.75) c = mix(c, SAFF * 0.66, cover(u, 0.36, aa) * 0.8);   // binding point
    return c;
  }
  vec3 t = weftC * (0.85 + 0.3 * fv) * (0.55 + 0.45 * shade(v, 0.07)) * (1.0 + 0.16 * (0.5 - v));   // ground: weft over
  return mix(gapC, t, cover(v, 0.07, aa));
}

vec3 bare(float fi, float fj, float u, float fell, float aa, vec3 warpC, vec3 gapC) {
  float up = mod(fi + fell, 2.0);
  float shed = 1.0 + uShed * (up > 0.5 ? 0.30 : -0.25);
  float depth = 1.0 - 0.5 * (1.0 - uBeige) * smoothstep(2.0, 70.0, fj - fell);
  vec3 t = warpC * (0.8 + 0.4 * hash(fi)) * (0.55 + 0.45 * shade(u, 0.2)) * (1.0 + 0.14 * (0.5 - u)) * shed * depth;
  return mix(gapC, t, cover(u, 0.2, aa));
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;       // css px, y down
  float aaPx = 0.7 / uDpr;
  float d = sdStage(frag);
  float inside = 1.0 - smoothstep(-aaPx, aaPx, d);
  float sig = max(15.0 * uShadowZ, 0.5);
  float ds = sdStage(frag - vec2(0.0, 8.0 * uShadowZ));
  float shadowA = uShadowA * 0.30 * (1.0 - smoothstep(-sig * 0.9, sig * 2.2, ds));
  if (inside <= 0.0) { outColor = vec4(0.0, 0.0, 0.0, shadowA); return; }

  vec3 warpC = cloth(vec3(40.0, 37.0, 34.0) / 255.0, vec3(236.0, 226.0, 207.0) / 255.0);
  vec3 weftC = cloth(vec3(27.0, 25.0, 23.0) / 255.0, vec3(245.0, 237.0, 221.0) / 255.0);
  vec3 gapC  = cloth(vec3(0.010, 0.009, 0.008), BEIGE * 0.93);
  vec3 groundMean = cloth(vec3(0.045, 0.042, 0.039), BEIGE * 0.97);
  float merge = smoothstep(0.0, 0.35, uBeige);         // bare warp joins the cloth early in the beige ramp

  vec2 w = (frag - uCamA) / uZ;                        // world: page css px at rest
  vec2 cs = uInk.zw / uGrid;
  vec2 g = (w - uInk.xy) / cs;
  float aa = max(fwidth(g.x), fwidth(g.y));            // cells per pixel
  float aaC = clamp(aa, 0.02, 0.5);
  float detail = 1.0 - smoothstep(0.16, 0.38, aa);     // cells under ~4 device px blend to their mean (no specks/moire)
  float fi = floor(g.x), fj = floor(g.y);
  float u = fract(g.x), v = fract(g.y);
  float fig = 0.0;
  if (fi >= 0.0 && fj >= 0.0 && fi < uGrid.x && fj < uGrid.y) fig = texelFetch(uMask, ivec2(int(fi), int(fj)), 0).r;
  float fell = uFell;

  vec3 col; vec3 mean;
  if (fj < fell - 1.0 || (fj == fell - 1.0 && uBeat <= 0.001)) {
    col = woven(fi, fj, u, v, fig, aaC, warpC, weftC, gapC);
    mean = fig > 0.25 ? SAFF * 0.95 : groundMean;
  } else if (fj == fell - 1.0) {                        // last pass, still being beaten up
    float vv = v - uBeat;
    col = vv >= 0.0 ? woven(fi, fj, u, vv, fig, aaC, warpC, weftC, gapC) : bare(fi, fj, u, fell, aaC, warpC, gapC);
    mean = fig > 0.25 ? SAFF * 0.95 : groundMean;
  } else if (fj == fell) {                              // pass in flight: loose weft behind the carrier
    bool laid = uInDir < 0.5 ? (w.x < uCarrierX) : (w.x > uCarrierX);
    float vv = v - 0.35;
    col = (laid && vv >= 0.0) ? woven(fi, fj, u, vv / 0.65, fig, aaC, warpC, weftC, gapC) : bare(fi, fj, u, fell, aaC, warpC, gapC);
    mean = mix(warpC * 0.35, groundMean, merge);
    col = mix(col, groundMean, merge);
    float dxc = (w.x - uCarrierX) / cs.x * (uInDir < 0.5 ? 1.0 : -1.0);
    float vy = 1.0 - smoothstep(0.26, 0.26 + aaC, abs(v - 0.62));
    float head = (1.0 - smoothstep(2.2, 2.2 + aaC, abs(dxc))) * vy;
    float trail = (dxc < 0.0 ? exp(dxc / max(uTrail, 0.001)) : 0.0) * (1.0 - smoothstep(0.12, 0.12 + aaC, abs(v - 0.62)));
    col = mix(col, vec3(0.86, 0.83, 0.78), clamp(head + 0.55 * trail, 0.0, 1.0) * uCarrierA);
  } else {
    col = bare(fi, fj, u, fell, aaC, warpC, gapC);
    mean = mix(warpC * 0.35, groundMean, merge);
    col = mix(col, groundMean, merge);                   // as the cloth turns beige, the loom's edge dissolves
    float ry = g.y - fell - (1.35 + uReed);            // the reed: a fine comb just below the fell
    if (ry >= 0.0 && ry <= 0.8) {
      float dent = 1.0 - smoothstep(0.05, 0.05 + aaC, min(u, 1.0 - u));
      float rail = 1.0 - smoothstep(0.06, 0.06 + aaC, min(ry, 0.8 - ry));
      col = mix(col, cloth(vec3(0.25, 0.235, 0.22), vec3(0.86, 0.81, 0.73)), max(dent, rail) * uReedA);
    }
  }
  col = mix(mean, col, detail);

  float dark = uTex * (1.0 - uBeige);
  float ly = (frag.y - uFellY) / (uRes.y / uDpr);
  col *= 1.0 + dark * (0.55 * exp(-ly * ly * 22.0) - 0.12);   // work-light at the fell
  vec2 q = frag / (uRes / uDpr) - 0.5;
  col *= 1.0 - dark * 0.55 * dot(q, q);                      // gentle vignette while the loom is in view

  // woven -> clean: the texture flattens to the exact logo (smooth, mipmapped alpha) on the stage colour
  vec2 uvp = (w - uPng.xy) / uPng.zw;
  float sa = (uvp.x >= 0.0 && uvp.y >= 0.0 && uvp.x <= 1.0 && uvp.y <= 1.0) ? clamp(texture(uLogo, uvp, -1.0).a * 1.1, 0.0, 1.0) : 0.0;
  vec3 flatC = mix(cloth(vec3(0.0), BEIGE), SAFF, sa * uLogoA);
  col = mix(flatC, col, uTex);

  col *= uExposure;
  outColor = vec4(col * inside, inside + shadowA * (1.0 - inside));
}`
