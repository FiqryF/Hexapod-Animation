const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function loadFunction(name, globals) {
    const source = html.match(new RegExp('^            function ' + name + '\\([^]*?^            }', 'm'));
    assert.ok(source, 'Missing function ' + name);
    const context = vm.createContext(globals);
    vm.runInContext(source[0], context);
    return context[name];
}

const math = {
    MathUtils: {
        clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
        lerp: (from, to, amount) => from + (to - from) * amount
    }
};
const lift = loadFunction('c2BellLift', { THREE: math });
const minimumJerk = loadFunction('minimumJerk', { THREE: math });
assert.equal(lift(0), 0);
assert.equal(lift(1), 0);
assert.equal(lift(0.5), 1);
const epsilon = 0.00001;
assert.ok(lift(epsilon) / epsilon < 0.00001);
assert.ok(lift(1 - epsilon) / epsilon < 0.00001);
assert.ok(Math.abs((lift(2 * epsilon) - 2 * lift(epsilon)) / epsilon ** 2) < 0.02);
assert.ok(Math.abs((lift(1 - 2 * epsilon) - 2 * lift(1 - epsilon)) / epsilon ** 2) < 0.02);

const spring = loadFunction('stepCriticallyDamped', {});
let value = 0;
let velocity = 0;
for (let step = 0; step < 240; step++) {
    const next = spring(value, 1, velocity, 8, 1 / 120);
    assert.ok(next.value >= value && next.value <= 1);
    value = next.value;
    velocity = next.velocity;
}
assert.ok(value > 0.999);

// The same elapsed time must produce the same solver steps at different refresh rates.
for (const fps of [30, 60, 90, 144, 240]) {
    const state = {
        SIMULATION_STEP: 1 / 120,
        simulationAccumulator: 0,
        simulationTime: 0,
        simulationTicks: 0,
        capturePreviousPose() {},
        updateMovement: () => ({ isMoving: true }),
        updateHeadServo() {},
        updateChassis: () => 1,
        updateLegs() {}
    };
    const advance = loadFunction('advanceSimulation', state);
    for (let frame = 0; frame < fps; frame++) advance(1 / fps);
    assert.equal(state.simulationTicks, 120, 'Incorrect step count at ' + fps + ' FPS');
    assert.ok(Math.abs(state.simulationTime - 1) < 1e-10);
    advance(20);
    assert.equal(state.simulationTicks, 126, 'Catch-up must stay bounded after suspension');
}

function point(x = 0, y = 0, z = 0) {
    return {
        x, y, z,
        copy(other) {
            this.x = other.x;
            this.y = other.y;
            this.z = other.z;
        },
        add(other) {
            this.x += other.x;
            this.y += other.y;
            this.z += other.z;
        },
        sub(other) {
            this.x -= other.x;
            this.y -= other.y;
            this.z -= other.z;
        },
        subVectors(from, to) {
            this.x = from.x - to.x;
            this.y = from.y - to.y;
            this.z = from.z - to.z;
        },
        lerpVectors(from, to, amount) {
            this.x = math.MathUtils.lerp(from.x, to.x, amount);
            this.y = math.MathUtils.lerp(from.y, to.y, amount);
            this.z = math.MathUtils.lerp(from.z, to.z, amount);
        }
    };
}

const target = point(2, 0, 0);
const foot = { plantedWorldPos: point(), liftoffWorldPos: point(), landingWorldPos: point(), wasSwinging: false };
const placeFoot = loadFunction('updateFootPlacement', {
    THREE: math, currentGait: 'tripod', tempWorldFoot: target,
    minimumJerk, c2BellLift: lift, stepHeight: 0.85,
    getTerrainHeightAt: () => 0,
    settleLeg() { throw new Error('Unexpected settling during a swing'); }
});
placeFoot(foot, true, true, 0.1, 0.48, 1 / 120);
target.x = 20;
placeFoot(foot, true, true, 0.47, 0.48, 1 / 120);
placeFoot(foot, true, false, 0.49, 0.48, 1 / 120);
assert.equal(foot.plantedWorldPos.x, 2, 'Touchdown must use the cached landing point');
assert.equal(foot.plantedWorldPos.y, 0);
assert.equal(foot.wasSwinging, false);

const swings = loadFunction('isLegSwinging', { currentGait: 'tripod' });
assert.equal(swings({ wasSwinging: false }, true, 0.2, 0.48, 1.8, 1 / 120), false);
assert.equal(swings({ wasSwinging: false }, true, 0.01, 0.48, 1.8, 1 / 120), true);
assert.equal(swings({ wasSwinging: true }, true, 0.2, 0.48, 1.8, 1 / 120), true);
assert.equal(swings({ wasSwinging: true }, false, 0.2, 0.48, 1.8, 1 / 120), false);

// Render interpolation includes body, joints and contact markers, without changing solver state.
const rotation = () => ({
    x: 0, y: 0, z: 0,
    set(x, y, z) { this.x = x; this.y = y; this.z = z; }
});
const renderLeg = {
    previousAngles: { coxa: 0, femur: 0, tibia: 0 },
    currentAngles: { coxa: 1, femur: 2, tibia: -2 },
    previousFootPosition: point(), plantedWorldPos: point(2, 0, 0),
    coxaGroup: { rotation: rotation() }, femurGroup: { rotation: rotation() },
    tibiaGroup: { rotation: rotation() }, rippleRing: { position: point() }
};
const renderState = {
    THREE: math,
    previousPose: { rootPosition: point(), rootYaw: 0, bodyPosition: point(), bodyRotation: point(), headPan: 0 },
    currentPose: { rootPosition: point(2, 0, 0), rootYaw: 1, bodyPosition: point(0, 2, 0), bodyRotation: point(1, 0, 0), headPan: 1 },
    hexapodRoot: { position: point(), rotation: rotation() },
    robotBodyGroup: { position: point(), rotation: rotation() },
    headPanGroup: { rotation: rotation() }, legs: [renderLeg]
};
const applyPose = loadFunction('applyRenderPose', renderState);
applyPose(0.5);
assert.equal(renderState.hexapodRoot.position.x, 1);
assert.equal(renderState.robotBodyGroup.position.y, 1);
assert.equal(renderLeg.coxaGroup.rotation.y, 0.5);
assert.equal(renderLeg.femurGroup.rotation.z, 1);
assert.equal(renderLeg.tibiaGroup.rotation.z, -1);
assert.equal(renderLeg.rippleRing.position.x, 1);
assert.equal(renderState.headPanGroup.rotation.y, 0.5);
applyPose(1);
assert.equal(renderState.hexapodRoot.position.x, 2);
assert.equal(renderLeg.coxaGroup.rotation.y, renderLeg.currentAngles.coxa);
assert.equal(renderLeg.plantedWorldPos.x, 2);

renderState.capturePose = loadFunction('capturePose', renderState);
renderState.applyRenderPose = applyPose;
renderState.SIMULATION_STEP = 1 / 120;
renderState.simulationAccumulator = 1 / 240;
renderState.simulationTime = 1;
renderState.renderCameraOffset = point();
renderState.camera = { position: point(10, 0, 0) };
renderState.controls = { target: point() };
renderState.hexapodRoot.updateMatrixWorld = () => {};
renderState.updateSonar = () => {};
renderState.renderViews = () => {
    assert.equal(renderState.hexapodRoot.position.x, 1);
    assert.equal(renderState.camera.position.x, 9);
    throw new Error('Simulated render failure');
};
const renderFrame = loadFunction('renderInterpolatedViews', renderState);
assert.throws(renderFrame, /Simulated render failure/);
assert.equal(renderState.hexapodRoot.position.x, 2);
assert.equal(renderState.camera.position.x, 10);
assert.equal(renderState.controls.target.x, 0);

console.log('Passed motion checks for lift continuity, damping, refresh rates, swing starts, touchdown and render interpolation.');
