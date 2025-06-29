/***********************************
 * 1.  Mini‑matrix helpers (4×4)   *
 ***********************************/
function mat4Identity() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
function mat4Multiply(a, b) { const o = new Array(16); for (let r = 0; r < 4; ++r) { for (let c = 0; c < 4; ++c) { o[c + 4 * r] = a[4 * r] * b[c] + a[4 * r + 1] * b[c + 4] + a[4 * r + 2] * b[c + 8] + a[4 * r + 3] * b[c + 12]; } } return o; }
function mat4Translate(m, [x, y, z]) { const t = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; return mat4Multiply(m, t); }  // m * T
function mat4Rotate(m, ang, [x, y, z]) { const s = Math.sin(ang), c = Math.cos(ang), ic = 1 - c; const r = [x * x * ic + c, x * y * ic + z * s, x * z * ic - y * s, 0, y * x * ic - z * s, y * y * ic + c, y * z * ic + x * s, 0, z * x * ic + y * s, z * y * ic - x * s, z * z * ic + c, 0, 0, 0, 0, 1]; return mat4Multiply(r, m); }  // R * m (premultiply)
function mat4Perspective(fov, asp, n, f) { const q = 1 / Math.tan(fov / 2); return [q / asp, 0, 0, 0, 0, q, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0]; }
function vec3ApplyMat4([x, y, z], m) {
    return [
        m[0] * x + m[4] * y + m[8] * z + m[12],
        m[1] * x + m[5] * y + m[9] * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14]
    ];
} // assumes w==1, rotation/translation only

/***********************************
 * 2.  WebGL boot‑strap           *
 ***********************************/
const cvs = document.getElementById('glcanvas');
const gl = cvs.getContext('webgl'); if (!gl) { alert('WebGL unavailable'); throw 'No WebGL'; }
function resize() { const dpr = window.devicePixelRatio || 1; const r = cvs.getBoundingClientRect(); cvs.width = r.width * dpr; cvs.height = r.height * dpr; gl.viewport(0, 0, cvs.width, cvs.height); } resize(); window.addEventListener('resize', resize);
const vsrc = `attribute vec3 aPos;attribute vec3 aCol;uniform mat4 uM,uV,uP;varying vec3 vCol;void main(){vCol=aCol;gl_Position=uP*uV*uM*vec4(aPos,1.);}`;
const fsrc = `precision mediump float;varying vec3 vCol;void main(){gl_FragColor=vec4(vCol,1.);} `;
function compile(src, t) { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(s); return s; }
const prog = gl.createProgram(); gl.attachShader(prog, compile(vsrc, gl.VERTEX_SHADER)); gl.attachShader(prog, compile(fsrc, gl.FRAGMENT_SHADER)); gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw gl.getProgramInfoLog(prog); gl.useProgram(prog);
const aPos = gl.getAttribLocation(prog, 'aPos'); const aCol = gl.getAttribLocation(prog, 'aCol'); const uM = gl.getUniformLocation(prog, 'uM'); const uV = gl.getUniformLocation(prog, 'uV'); const uP = gl.getUniformLocation(prog, 'uP');

/***********************************
 * 3.  Unit‑cube geometry         *
 ***********************************/
const C = { U: [1, 1, 1], D: [1, 1, 0], F: [0, 1, 0], B: [0, 0, 1], L: [1, .5, 0], R: [1, 0, 0] };
function pushFace(arr, axis, sign, col) {
    const idx = { x: 0, y: 1, z: 2 }[axis]; const s = sign * 0.5; const v = [[-0.5, -0.5, s], [0.5, -0.5, s], [0.5, 0.5, s], [-0.5, 0.5, s]]; // local face space
    for (const p of v) { const t = p[idx]; p[idx] = p[2]; p[2] = t; if (axis === 'y') { [p[0], p[2]] = [p[2], p[0]]; } }
    for (const i of [0, 1, 2, 0, 2, 3]) arr.push(...v[i], ...col);
}
let verts = []; pushFace(verts, 'z', 1, C.F); pushFace(verts, 'z', -1, C.B); pushFace(verts, 'x', 1, C.R); pushFace(verts, 'x', -1, C.L); pushFace(verts, 'y', 1, C.U); pushFace(verts, 'y', -1, C.D);
const vbuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 24, 0); gl.enableVertexAttribArray(aCol); gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, 24, 12);

/***********************************
 * 4.  Rubik cube data            *
 ***********************************/
const cubies = []; for (let x = -1; x <= 1; ++x)for (let y = -1; y <= 1; ++y)for (let z = -1; z <= 1; ++z)cubies.push({ pos: [x, y, z], rot: mat4Identity() });

/***********************************
 * 5.  Camera interaction         *
 ***********************************/
let camDist = 8, rotX = -.52, rotY = .52, drag = false, lx, ly; cvs.addEventListener('mousedown', e => { drag = true; lx = e.clientX; ly = e.clientY; }); window.addEventListener('mouseup', () => drag = false); window.addEventListener('mousemove', e => { if (!drag) return; rotY += (e.clientX - lx) * .005; rotX = Math.max(-1.4, Math.min(1.4, rotX + (e.clientY - ly) * .005)); lx = e.clientX; ly = e.clientY; }); window.addEventListener('wheel', e => { camDist *= Math.exp(e.deltaY * .001); });

/***********************************
 * 6.  Slice rotation animation   *
 ***********************************/
let anim = null; // {cubies,axis,dir,angle}
function startMove(face, dir) {
    if (anim) return; let axis, sel;
    switch (face) {
        case 'U': axis = [0, 1, 0]; sel = c => c.pos[1] === 1; break;
        case 'D': axis = [0, 1, 0]; dir *= -1; sel = c => c.pos[1] === -1; break;
        case 'F': axis = [0, 0, 1]; sel = c => c.pos[2] === 1; break;
        case 'B': axis = [0, 0, 1]; dir *= -1; sel = c => c.pos[2] === -1; break;
        case 'R': axis = [1, 0, 0]; sel = c => c.pos[0] === 1; break;
        case 'L': axis = [1, 0, 0]; dir *= -1; sel = c => c.pos[0] === -1; break;
    }
    anim = { cubies: cubies.filter(sel), axis, dir, angle: 0 };
}
window.addEventListener('keydown', e => { const k = e.key.toUpperCase(); if ('UDFBLR'.includes(k)) startMove(k, e.shiftKey ? -1 : 1); });

/***********************************
 * 7.  Render loop                *
 ***********************************/
function render() {
    requestAnimationFrame(render);
    gl.clearColor(.05, .05, .05, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST);
    // 7A. animate current slice
    if (anim) {
        anim.angle = Math.min(anim.angle + .06, Math.PI / 2);
        const Rtemp = mat4Rotate(mat4Identity(), anim.angle * anim.dir, anim.axis);
        anim.cubies.forEach(c => c.tmpRot = Rtemp);
        if (anim.angle >= Math.PI / 2 - 1e-4) { // snap
            const Rsnap = mat4Rotate(mat4Identity(), Math.PI / 2 * anim.dir, anim.axis);
            anim.cubies.forEach(c => {
                // c.rot = mat4Multiply(Rsnap, c.rot);
                c.rot = mat4Multiply(c.rot, Rsnap);
                c.pos = vec3ApplyMat4(c.pos, Rsnap).map(v => Math.round(v)); // keep integer coords
                delete c.tmpRot;
            });
            anim = null;
        }
    }
    // 7B. camera matrices
    const asp = cvs.width / cvs.height; let view = mat4Identity(); view = mat4Translate(view, [0, 0, -camDist]); view = mat4Rotate(view, rotX, [1, 0, 0]); view = mat4Rotate(view, rotY, [0, 1, 0]); gl.uniformMatrix4fv(uV, false, new Float32Array(view)); gl.uniformMatrix4fv(uP, false, new Float32Array(mat4Perspective(Math.PI / 4, asp, .1, 100)));
    // 7C. draw cubies
    cubies.forEach(c => {
        let pos = c.pos, orient = c.rot;
        // if (c.tmpRot) { pos = vec3ApplyMat4(pos, c.tmpRot); orient = mat4Multiply(c.tmpRot, orient); } // live slice
        if (c.tmpRot) { pos = vec3ApplyMat4(pos, c.tmpRot); orient = mat4Multiply(orient, c.tmpRot); } // live slice
        let model = mat4Translate(mat4Identity(), pos);
        model = mat4Multiply(orient, model);
        gl.uniformMatrix4fv(uM, false, new Float32Array(model));
        gl.drawArrays(gl.TRIANGLES, 0, 36);
    });
}
requestAnimationFrame(render); cvs.focus();