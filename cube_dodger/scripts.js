import * as mat4 from 'https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/mat4.js';

let _vs = `
attribute vec3 aPosition;
attribute vec3 aNormal;

uniform mat4 uMVP;
uniform mat4 uModel;
uniform mat4 uNormalMatrix;

varying vec3 vNormal;

void main(){
    vNormal = mat3(uNormalMatrix) * aNormal;
    gl_Position = uMVP * vec4(aPosition, 1.0);
}
`;

let _fs = `
precision mediump float;
uniform vec3 uColor;
varying vec3 vNormal;
void main(){
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.8));
    float diff = max(dot(normal, lightDir), 0.2);
    gl_FragColor = vec4(uColor * diff, 1.0);
}
`;

const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl');
if (!gl) { alert('WebGL not supported'); throw 'no webgl'; }

function compile(gl, type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(s); return s; }
function program(gl, vs, fs) { const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw gl.getProgramInfoLog(p); return p; }
const vs = compile(gl, gl.VERTEX_SHADER, _vs);
const fs = compile(gl, gl.FRAGMENT_SHADER, _fs);
const prog = program(gl, vs, fs);
gl.useProgram(prog);

const locPos = gl.getAttribLocation(prog, 'aPosition');
const locNormal = gl.getAttribLocation(prog, 'aNormal');
const locMVP = gl.getUniformLocation(prog, 'uMVP');
const locColor = gl.getUniformLocation(prog, 'uColor');
const locModel = gl.getUniformLocation(prog, 'uModel');
const locNormalMatrix = gl.getUniformLocation(prog, 'uNormalMatrix');

const VERTS = new Float32Array([
    // front
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5,
    -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    // back
    -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5,
    -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5,
    // left
    -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5,
    -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5,
    // right
    0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5,
    0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
    // top
    -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5,
    -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5,
    // bottom
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5,
    -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5
]);

const NORMALS = new Float32Array([
    // front
    0, 0, 1, 0, 0, 1, 0, 0, 1,
    0, 0, 1, 0, 0, 1, 0, 0, 1,
    // back
    0, 0, -1, 0, 0, -1, 0, 0, -1,
    0, 0, -1, 0, 0, -1, 0, 0, -1,
    // left
    -1, 0, 0, -1, 0, 0, -1, 0, 0,
    -1, 0, 0, -1, 0, 0, -1, 0, 0,
    // right
    1, 0, 0, 1, 0, 0, 1, 0, 0,
    1, 0, 0, 1, 0, 0, 1, 0, 0,
    // top
    0, 1, 0, 0, 1, 0, 0, 1, 0,
    0, 1, 0, 0, 1, 0, 0, 1, 0,
    // bottom
    0, -1, 0, 0, -1, 0, 0, -1, 0,
    0, -1, 0, 0, -1, 0, 0, -1, 0
]);

const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, VERTS, gl.STATIC_DRAW);
gl.enableVertexAttribArray(locPos);
gl.vertexAttribPointer(locPos, 3, gl.FLOAT, false, 0, 0);

const nbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, nbo);
gl.bufferData(gl.ARRAY_BUFFER, NORMALS, gl.STATIC_DRAW);
gl.enableVertexAttribArray(locNormal);
gl.vertexAttribPointer(locNormal, 3, gl.FLOAT, false, 0, 0);

gl.enable(gl.DEPTH_TEST);

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; gl.viewport(0, 0, canvas.width, canvas.height); }
window.addEventListener('resize', resize); resize();

const LANES = [-2, 0, 2], SPEED = 0.15, RESET_Z = -60, HIT_Z_PLAYER = -8, END_Z = 6, NUM_OBS = 5;
let playerLane = 1, score = 0;
const scoreElem = document.getElementById('score');
const obstacles = []; for (let i = 0; i < NUM_OBS; i++)obstacles.push({ z: RESET_Z - i * 12, lane: Math.floor(Math.random() * LANES.length) });

window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a') playerLane = Math.max(0, playerLane - 1);
    if (e.key === 'ArrowRight' || e.key === 'd') playerLane = Math.min(LANES.length - 1, playerLane + 1);
});

const model = mat4.create(), view = mat4.create(), proj = mat4.create(), mvp = mat4.create(), normalMatrix = mat4.create();

function updateCamera() {
    mat4.perspective(proj, Math.PI / 4, canvas.width / canvas.height, 0.1, 100);
    mat4.lookAt(view, [0, 6, 6], [0, 0, -20], [0, 1, 0]);
}
updateCamera();

function collides(obs) { return obs.lane === playerLane && Math.abs(obs.z - HIT_Z_PLAYER) < 1; }
let gameOver = false;
function frame() {
    if (gameOver) return;
    gl.clearColor(0.8, 0.87, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    mat4.identity(model);
    mat4.translate(model, model, [LANES[playerLane], 0, HIT_Z_PLAYER]);
    mat4.multiply(mvp, proj, mat4.multiply(mvp, view, model));
    mat4.invert(normalMatrix, model);
    mat4.transpose(normalMatrix, normalMatrix);
    gl.uniformMatrix4fv(locMVP, false, mvp);
    gl.uniformMatrix4fv(locModel, false, model);
    gl.uniformMatrix4fv(locNormalMatrix, false, normalMatrix);
    gl.uniform3f(locColor, 0.1, 0.3, 0.95);
    gl.drawArrays(gl.TRIANGLES, 0, 36);

    gl.uniform3f(locColor, 1, 0, 0);
    for (const obs of obstacles) {
        obs.z += SPEED;
        if (obs.z > END_Z) {
            obs.z = RESET_Z;
            obs.lane = Math.floor(Math.random() * LANES.length);
            score++;
            scoreElem.textContent = 'Score: ' + score;
        }
        if (collides(obs)) {
            document.getElementById('hud').textContent = '💥 Game Over – refresh to retry';
            gameOver = true;
        }

        mat4.identity(model);
        mat4.translate(model, model, [LANES[obs.lane], 0, obs.z]);
        mat4.multiply(mvp, proj, mat4.multiply(mvp, view, model));
        mat4.invert(normalMatrix, model);
        mat4.transpose(normalMatrix, normalMatrix);
        gl.uniformMatrix4fv(locMVP, false, mvp);
        gl.uniformMatrix4fv(locModel, false, model);
        gl.uniformMatrix4fv(locNormalMatrix, false, normalMatrix);
        gl.drawArrays(gl.TRIANGLES, 0, 36);
    }
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);