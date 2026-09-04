import { useEffect, useRef, useState } from "react";

import { createF28RenderGeometry } from "./atlas-f28";

interface AtlasGlobePoint {
  category: string;
  displayName: string | null;
  latticeId?: string;
  latitude: number;
  longitude: number;
  poiId: string;
  regionId: string;
  workingLabel: string;
}

const vertexShaderSource = `#version 300 es
precision highp float;
in vec3 aPosition; in vec3 aNormal; in vec3 aColor; in float aEmission;
uniform mat4 uProjection, uView, uModel;
out vec3 vNormal; out vec3 vWorld; out vec3 vColor; out float vEmission;
void main(){vec4 w=uModel*vec4(aPosition,1.0);vWorld=w.xyz;vNormal=mat3(uModel)*aNormal;vColor=aColor;vEmission=aEmission;gl_Position=uProjection*uView*w;}`;

const fragmentShaderSource = `#version 300 es
precision highp float;
in vec3 vNormal; in vec3 vWorld; in vec3 vColor; in float vEmission;
uniform vec3 uCamera; uniform float uLight;
out vec4 outColor;
void main(){vec3 n=normalize(vNormal);vec3 V=normalize(uCamera-vWorld);vec3 L=normalize(vec3(-0.48,0.58,0.82));float diff=max(dot(n,L),0.0);vec3 H=normalize(L+V);float spec=pow(max(dot(n,H),0.0),72.0)*0.16;float rim=pow(1.0-max(dot(n,V),0.0),3.0);vec3 c=vColor*(0.46+0.64*diff)*uLight;c+=vec3(spec);c+=vec3(0.018,0.06,0.09)*rim*0.38;c+=vColor*vEmission;c=pow(max(c,vec3(0.0)),vec3(0.96));outColor=vec4(c,1.0);}`;

function identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function perspective(fieldOfView: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fieldOfView / 2);
  const nearFar = 1 / (near - far);
  const output = new Float32Array(16);
  output[0] = f / aspect; output[5] = f; output[10] = (far + near) * nearFar;
  output[11] = -1; output[14] = 2 * far * near * nearFar;
  return output;
}

function rotateX(angle: number) {
  const cosine = Math.cos(angle); const sine = Math.sin(angle);
  return new Float32Array([1, 0, 0, 0, 0, cosine, sine, 0, 0, -sine, cosine, 0, 0, 0, 0, 1]);
}

function rotateY(angle: number) {
  const cosine = Math.cos(angle); const sine = Math.sin(angle);
  return new Float32Array([cosine, 0, -sine, 0, 0, 1, 0, 0, sine, 0, cosine, 0, 0, 0, 0, 1]);
}

function multiply(left: Float32Array, right: Float32Array) {
  const output = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) for (let row = 0; row < 4; row += 1) {
    output[column * 4 + row] = left[row]! * right[column * 4]!
      + left[4 + row]! * right[column * 4 + 1]!
      + left[8 + row]! * right[column * 4 + 2]!
      + left[12 + row]! * right[column * 4 + 3]!;
  }
  return output;
}

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const fieldOfView = 41 * Math.PI / 180;

export function AtlasGlobe({
  connections = [],
  onSelect,
  points,
  regionMappings = [],
  selectedId,
  unavailableMessage,
}: {
  connections?: ReadonlyArray<{ atlasConnectionId: string; fromLatticeId: string; toLatticeId: string }>;
  onSelect: (poiId: string) => void;
  points: AtlasGlobePoint[];
  regionMappings?: ReadonlyArray<{ latticeId: string; regionId: string }>;
  selectedId?: string;
  unavailableMessage?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const connectionLayerRef = useRef<SVGSVGElement>(null);
  const markerLayerRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const controls = useRef({ yaw: -0.45, pitch: -0.12, distance: 2.7, light: 1.03, velocityX: 0, velocityY: 0 });
  const updateStatus = () => {
    const state = controls.current;
    if (statusRef.current) statusRef.current.textContent = `Rotation ${Math.round(state.pitch * 180 / Math.PI)}°, ${Math.round(state.yaw * 180 / Math.PI)}° · Camera ${state.distance.toFixed(2)}`;
  };
  const [autoRotate, setAutoRotate] = useState(() => typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const autoRotateRef = useRef(autoRotate);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);
  useEffect(() => {
    const canvas = canvasRef.current;
    const markerLayer = markerLayerRef.current;
    const connectionLayer = connectionLayerRef.current;
    if (!canvas || !markerLayer || !connectionLayer) return;
    const gl = canvas.getContext("webgl2", { alpha: true, antialias: true });
    if (!gl) {
      setLoading(false);
      setError("WebGL2 is unavailable. Use the accessible 2D Atlas view on this device.");
      return;
    }

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("WebGL shader allocation failed.");
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "WebGL shader compilation failed.");
      return shader;
    };

    let animationFrame = 0;
    let observer: ResizeObserver | undefined;
    const allocatedBuffers: WebGLBuffer[] = [];
    let program: WebGLProgram | undefined;
    try {
      const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
      const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
      program = gl.createProgram() ?? undefined;
      if (!program) throw new Error("WebGL program allocation failed.");
      gl.attachShader(program, vertexShader); gl.attachShader(program, fragmentShader); gl.linkProgram(program);
      gl.deleteShader(vertexShader); gl.deleteShader(fragmentShader);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "WebGL program linking failed.");
      gl.useProgram(program);

      const geometry = createF28RenderGeometry();
      const bind = (name: string, data: Float32Array, size: number) => {
        const location = gl.getAttribLocation(program!, name);
        const buffer = gl.createBuffer();
        if (location < 0 || !buffer) throw new Error(`WebGL attribute ${name} is unavailable.`);
        allocatedBuffers.push(buffer); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
      };
      bind("aPosition", geometry.positions, 3);
      bind("aNormal", geometry.normals, 3);
      bind("aColor", geometry.colors, 3);
      bind("aEmission", geometry.emissions, 1);

      const uniforms = {
        projection: gl.getUniformLocation(program, "uProjection"), view: gl.getUniformLocation(program, "uView"),
        model: gl.getUniformLocation(program, "uModel"), camera: gl.getUniformLocation(program, "uCamera"),
        light: gl.getUniformLocation(program, "uLight"),
      };
      setLoading(false);

      const resize = () => {
        const rectangle = canvas.getBoundingClientRect(); const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.max(1, Math.round(rectangle.width * pixelRatio)); const height = Math.max(1, Math.round(rectangle.height * pixelRatio));
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; gl.viewport(0, 0, width, height); }
      };
      observer = new ResizeObserver(resize); observer.observe(canvas); resize();

      let lastTime = performance.now();
      const render = (now: number) => {
        resize(); const state = controls.current; const delta = Math.min(0.05, (now - lastTime) / 1000); lastTime = now;
        if (activePointers.current.size === 0) {
          if (autoRotateRef.current) state.yaw += delta * 0.105;
          state.yaw += state.velocityX; state.pitch = clamp(state.pitch + state.velocityY, -1.45, 1.45);
          state.velocityX *= 0.92; state.velocityY *= 0.92;
        }
        const aspect = canvas.width / canvas.height; const projection = perspective(fieldOfView, aspect, 0.1, 50);
        const view = identity(); view[14] = -state.distance; const model = multiply(rotateY(state.yaw), rotateX(state.pitch));
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.useProgram(program!);
        gl.uniformMatrix4fv(uniforms.projection, false, projection); gl.uniformMatrix4fv(uniforms.view, false, view);
        gl.uniformMatrix4fv(uniforms.model, false, model); gl.uniform3f(uniforms.camera, 0, 0, state.distance);
        gl.uniform1f(uniforms.light, state.light); gl.drawArrays(gl.TRIANGLES, 0, geometry.vertexCount);

        const projected = new Map<string, { visible: boolean; x: number; y: number }>();
        const markerElements = markerLayer.querySelectorAll<HTMLElement>("[data-globe-marker]");
        markerElements.forEach((marker) => {
          const latitude = Number(marker.dataset.latitude) * Math.PI / 180;
          const longitude = Number(marker.dataset.longitude) * Math.PI / 180;
          const sourceX = Math.cos(latitude) * Math.sin(longitude); const sourceY = Math.sin(latitude); const sourceZ = Math.cos(latitude) * Math.cos(longitude);
          const pitchCosine = Math.cos(state.pitch); const pitchSine = Math.sin(state.pitch);
          const pitchedY = pitchCosine * sourceY - pitchSine * sourceZ; const pitchedZ = pitchSine * sourceY + pitchCosine * sourceZ;
          const yawCosine = Math.cos(state.yaw); const yawSine = Math.sin(state.yaw);
          const worldX = yawCosine * sourceX + yawSine * pitchedZ; const worldZ = -yawSine * sourceX + yawCosine * pitchedZ;
          const denominator = state.distance - worldZ; const visible = worldZ > 0;
          const x = 50 + ((1 / Math.tan(fieldOfView / 2)) / aspect * worldX / denominator) * 50;
          const y = 50 - ((1 / Math.tan(fieldOfView / 2)) * pitchedY / denominator) * 50;
          if (marker.dataset.poiId) projected.set(marker.dataset.poiId, { visible, x, y });
          marker.hidden = !visible;
          if (visible) {
            marker.style.left = `${x}%`;
            marker.style.top = `${y}%`;
          }
        });
        const latticeByRegion = new Map(regionMappings.map((mapping) => [mapping.regionId, mapping.latticeId]));
        const pointByLattice = new Map<string, string>();
        for (const point of points) {
          const latticeId = point.latticeId ?? latticeByRegion.get(point.regionId);
          if (latticeId && !pointByLattice.has(latticeId)) pointByLattice.set(latticeId, point.poiId);
        }
        connectionLayer.querySelectorAll<SVGLineElement>("[data-atlas-connection]").forEach((line) => {
          const from = projected.get(pointByLattice.get(line.dataset.fromLattice ?? "") ?? "");
          const to = projected.get(pointByLattice.get(line.dataset.toLattice ?? "") ?? "");
          const visible = Boolean(from?.visible && to?.visible);
          line.style.display = visible ? "" : "none";
          if (from && to && visible) {
            line.setAttribute("x1", `${from.x}%`); line.setAttribute("y1", `${from.y}%`);
            line.setAttribute("x2", `${to.x}%`); line.setAttribute("y2", `${to.y}%`);
          }
        });
        updateStatus();
        animationFrame = requestAnimationFrame(render);
      };
      animationFrame = requestAnimationFrame(render);
    } catch (caught) {
      setLoading(false); setError(caught instanceof Error ? caught.message : "The WebGL globe could not start.");
    }
    return () => {
      cancelAnimationFrame(animationFrame); observer?.disconnect();
      allocatedBuffers.forEach((buffer) => gl.deleteBuffer(buffer));
      if (program) gl.deleteProgram(program);
    };
  }, [connections, points, regionMappings]);

  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const dragState = useRef<{ distance?: number; separation?: number; x: number; y: number } | undefined>(undefined);
  const reset = () => {
    controls.current = { yaw: -0.45, pitch: -0.12, distance: 2.7, light: 1.03, velocityX: 0, velocityY: 0 };
    updateStatus();
  };

  return <div className="atlas-globe-wrap">
    <div
      aria-label="Interactive Eidolon F28 tiled globe, three-dimensional. Use arrow keys to rotate, plus and minus to zoom, and Home to reset."
      className="atlas-globe"
      onKeyDown={(event) => {
        const state = controls.current;
        if (event.key === "ArrowLeft") state.yaw -= 0.12; else if (event.key === "ArrowRight") state.yaw += 0.12;
        else if (event.key === "ArrowUp") state.pitch = clamp(state.pitch - 0.12, -1.45, 1.45); else if (event.key === "ArrowDown") state.pitch = clamp(state.pitch + 0.12, -1.45, 1.45);
        else if (event.key === "+" || event.key === "=") state.distance = clamp(state.distance - 0.2, 2.05, 5.2);
        else if (event.key === "-") state.distance = clamp(state.distance + 0.2, 2.05, 5.2); else if (event.key === "Home") reset(); else return;
        updateStatus();
        event.preventDefault();
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId); activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const pointers = [...activePointers.current.values()];
        dragState.current = pointers.length === 2
          ? { x: 0, y: 0, distance: controls.current.distance, separation: Math.hypot(pointers[0]!.x - pointers[1]!.x, pointers[0]!.y - pointers[1]!.y) }
          : { x: event.clientX, y: event.clientY };
        controls.current.velocityX = controls.current.velocityY = 0;
      }}
      onPointerMove={(event) => {
        if (!activePointers.current.has(event.pointerId) || !dragState.current) return;
        activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); const pointers = [...activePointers.current.values()];
        if (pointers.length === 2 && dragState.current.separation && dragState.current.distance) {
          const separation = Math.hypot(pointers[0]!.x - pointers[1]!.x, pointers[0]!.y - pointers[1]!.y);
          controls.current.distance = clamp(dragState.current.distance * dragState.current.separation / separation, 2.05, 5.2);
        } else {
          const deltaX = event.clientX - dragState.current.x; const deltaY = event.clientY - dragState.current.y;
          controls.current.yaw += deltaX * 0.0062; controls.current.pitch = clamp(controls.current.pitch + deltaY * 0.0062, -1.45, 1.45);
          controls.current.velocityX = deltaX * 0.00032; controls.current.velocityY = deltaY * 0.00032;
          dragState.current = { x: event.clientX, y: event.clientY };
        }
      }}
      onPointerUp={(event) => { activePointers.current.delete(event.pointerId); dragState.current = undefined; }}
      onPointerCancel={(event) => { activePointers.current.delete(event.pointerId); dragState.current = undefined; }}
      onWheel={(event) => { event.preventDefault(); controls.current.distance = clamp(controls.current.distance * Math.exp(event.deltaY * 0.0011), 2.05, 5.2); }}
      role="application"
      tabIndex={0}
    >
      <canvas aria-hidden="true" ref={canvasRef} />
      <svg aria-label={`${connections.length} visible Atlas connections`} className="atlas-globe-connections" ref={connectionLayerRef}>
        {connections.map((connection) => <line data-atlas-connection data-from-lattice={connection.fromLatticeId} data-to-lattice={connection.toLatticeId} key={connection.atlasConnectionId} />)}
      </svg>
      <div className="atlas-globe-markers" ref={markerLayerRef}>
        {points.map((point) => <button
          aria-label={`Select ${point.displayName ?? point.workingLabel}`}
          className={`map-data-pin ${point.poiId === selectedId ? "selected" : ""}`}
          data-globe-marker
          data-latitude={point.latitude}
          data-longitude={point.longitude}
          data-poi-id={point.poiId}
          key={point.poiId}
          onClick={() => onSelect(point.poiId)}
        />)}
      </div>
      {loading && <p className="atlas-globe-message" role="status">Building locked F28 tiled globe…</p>}
      {error && <p className="atlas-globe-message atlas-globe-message--error" role="alert">{error}</p>}
    </div>
    {unavailableMessage && <p className="notice notice--warn" role="status">{unavailableMessage}</p>}
    <div className="atlas-globe-controls">
      <button className="button" onClick={reset}>Reset globe</button>
      <label><input checked={autoRotate} onChange={(event) => setAutoRotate(event.target.checked)} type="checkbox" /> Auto rotate</label>
      <label>Zoom <input aria-label="Globe zoom" defaultValue="270" max="520" min="205" onInput={(event) => { controls.current.distance = Number(event.currentTarget.value) / 100; }} type="range" /></label>
      <label>Light <input aria-label="Globe light" defaultValue="103" max="125" min="75" onInput={(event) => { controls.current.light = Number(event.currentTarget.value) / 100; }} type="range" /></label>
      <span className="muted" ref={statusRef}>Rotation -7°, -26° · Camera 2.70</span>
    </div>
  </div>;
}
