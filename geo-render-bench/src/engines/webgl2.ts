import type { ViewState } from '../bench/camera';
import type { PointData } from '../data';
import type { Engine } from './types';

// Bare-metal reference: one VBO of mercator-projected points drawn as GL_POINTS in
// a single draw call. The throughput CEILING — it shows how much overhead deck.gl /
// MapLibre add over hand-written WebGL2. 2D mercator (ignores pitch), but driven by
// the same ViewState so motion + visible point count stay comparable.

const VERT = `#version 300 es
in vec2 a_merc;
uniform vec2 u_center;
uniform float u_worldSize;
uniform float u_bearing;
uniform vec2 u_halfViewport;
uniform float u_pointSize;
void main() {
  vec2 d = (a_merc - u_center) * u_worldSize;
  float s = sin(u_bearing);
  float c = cos(u_bearing);
  vec2 r = vec2(d.x * c - d.y * s, d.x * s + d.y * c);
  gl_Position = vec4(r.x / u_halfViewport.x, -r.y / u_halfViewport.y, 0.0, 1.0);
  gl_PointSize = u_pointSize;
}`;

const FRAG = `#version 300 es
precision mediump float;
out vec4 fragColor;
void main() {
  fragColor = vec4(0.537, 0.706, 0.980, 1.0);
}`;

const TILE_SIZE = 512;

function mercator(lng: number, lat: number): [number, number] {
  const x = (lng + 180) / 360;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI);
  return [x, y];
}

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('createShader failed');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`shader compile: ${gl.getShaderInfoLog(sh)}`);
  }
  return sh;
}

export class WebGL2Engine implements Engine {
  readonly name = 'WebGL2 (raw)';
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private count = 0;
  private dpr = 1;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private view: ViewState | null = null;

  mount(container: HTMLElement, initial: ViewState): Promise<void> {
    this.dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.width = Math.floor(container.clientWidth * this.dpr);
    canvas.height = Math.floor(container.clientHeight * this.dpr);
    container.appendChild(canvas);
    const gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('WebGL2 not available');
    this.canvas = canvas;
    this.gl = gl;

    const program = gl.createProgram();
    if (!program) throw new Error('createProgram failed');
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`link: ${gl.getProgramInfoLog(program)}`);
    }
    this.program = program;
    gl.useProgram(program);
    for (const u of [
      'u_center',
      'u_worldSize',
      'u_bearing',
      'u_halfViewport',
      'u_pointSize',
    ]) {
      this.loc[u] = gl.getUniformLocation(program, u);
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.043, 0.063, 0.125, 1); // #0b1020
    this.view = initial;
    return Promise.resolve();
  }

  setData(data: PointData): Promise<void> {
    const gl = this.gl;
    if (!gl || !this.program) throw new Error('webgl2 not mounted');
    // Project to mercator unit coords once (CPU), upload as the static VBO.
    const merc = new Float32Array(data.length * 2);
    const p = data.positions;
    for (let i = 0; i < data.length; i++) {
      const [mx, my] = mercator(p[i * 2], p[i * 2 + 1]);
      merc[i * 2] = mx;
      merc[i * 2 + 1] = my;
    }
    this.count = data.length;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, merc, gl.STATIC_DRAW);
    const aMerc = gl.getAttribLocation(this.program, 'a_merc');
    gl.enableVertexAttribArray(aMerc);
    gl.vertexAttribPointer(aMerc, 2, gl.FLOAT, false, 0, 0);
    this.buffer = buffer;
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        if (this.view) this.applyView(this.view);
        gl.finish();
        resolve();
      });
    });
  }

  applyView(view: ViewState): void {
    const gl = this.gl;
    const canvas = this.canvas;
    if (!gl || !canvas) return;
    this.view = view;
    const [cx, cy] = mercator(view.longitude, view.latitude);
    gl.uniform2f(this.loc.u_center, cx, cy);
    gl.uniform1f(this.loc.u_worldSize, TILE_SIZE * 2 ** view.zoom * this.dpr);
    gl.uniform1f(this.loc.u_bearing, (view.bearing * Math.PI) / 180);
    gl.uniform2f(this.loc.u_halfViewport, canvas.width / 2, canvas.height / 2);
    gl.uniform1f(this.loc.u_pointSize, 2 * this.dpr);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, this.count);
  }

  destroy(): void {
    const gl = this.gl;
    if (gl) {
      if (this.buffer) gl.deleteBuffer(this.buffer);
      if (this.program) gl.deleteProgram(this.program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    this.canvas?.remove();
    this.gl = null;
    this.canvas = null;
    this.program = null;
    this.buffer = null;
  }
}
