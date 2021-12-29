"use strict";
exports.__esModule = true;
exports.InterpolationBuffer = void 0;
var math_vector_1 = require("@babylonjs/core/Maths/math.vector");
var STATE;
(function (STATE) {
    STATE[STATE["INITIALIZING"] = 0] = "INITIALIZING";
    STATE[STATE["BUFFERING"] = 1] = "BUFFERING";
    STATE[STATE["PLAYING"] = 2] = "PLAYING";
})(STATE || (STATE = {}));
var MODE;
(function (MODE) {
    MODE[MODE["MODE_LERP"] = 0] = "MODE_LERP";
    MODE[MODE["MODE_HERMITE"] = 1] = "MODE_HERMITE";
})(MODE || (MODE = {}));
// const vectorPool: Vector3[] = [];
// const quatPool: Quaternion[] = [];
var framePool = [];
// const getPooledVector: () => Vector3 = () => vectorPool.shift() || new Vector3();
// const getPooledQuaternion: () => Quaternion = () => quatPool.shift() || new Quaternion();
var getPooledFrame = function () {
    var frame = framePool.pop();
    if (!frame) {
        frame = { position: new math_vector_1.Vector3(), velocity: new math_vector_1.Vector3(), scale: new math_vector_1.Vector3(), quaternion: new math_vector_1.Quaternion(), time: 0 };
    }
    return frame;
};
var freeFrame = function (f) { return framePool.push(f); };
var InterpolationBuffer = /** @class */ (function () {
    function InterpolationBuffer(mode, bufferTime) {
        if (mode === void 0) { mode = MODE.MODE_LERP; }
        if (bufferTime === void 0) { bufferTime = 0.15; }
        this.state = STATE.INITIALIZING;
        this.buffer = [];
        this.bufferTime = bufferTime * 1000;
        this.time = 0;
        this.mode = mode;
        this.originFrame = getPooledFrame();
        this.position = new math_vector_1.Vector3();
        this.quaternion = new math_vector_1.Quaternion();
        this.scale = new math_vector_1.Vector3(1, 1, 1);
    }
    InterpolationBuffer.prototype.hermite = function (target, t, p1, p2, v1, v2) {
        var t2 = t * t;
        var t3 = t * t * t;
        var a = 2 * t3 - 3 * t2 + 1;
        var b = -2 * t3 + 3 * t2;
        var c = t3 - 2 * t2 + t;
        var d = t3 - t2;
        target.copyFrom(p1.scaleInPlace(a));
        target.add(p2.scaleInPlace(b));
        target.add(v1.scaleInPlace(c));
        target.add(v2.scaleInPlace(d));
    };
    InterpolationBuffer.prototype.lerp = function (target, v1, v2, alpha) {
        math_vector_1.Vector3.LerpToRef(v1, v2, alpha, target);
    };
    InterpolationBuffer.prototype.slerp = function (target, r1, r2, alpha) {
        math_vector_1.Quaternion.SlerpToRef(r1, r2, alpha, target);
    };
    InterpolationBuffer.prototype.updateOriginFrameToBufferTail = function () {
        freeFrame(this.originFrame);
        this.originFrame = this.buffer.shift() || getPooledFrame();
    };
    InterpolationBuffer.prototype.appendBuffer = function (position, velocity, quaternion, scale) {
        var tail = this.buffer.length > 0 ? this.buffer[this.buffer.length - 1] : null;
        // update the last entry in the buffer if this is the same frame
        if (tail && tail.time === this.time) {
            if (position) {
                tail.position.copyFrom(position);
            }
            if (velocity) {
                tail.velocity.copyFrom(velocity);
            }
            if (quaternion) {
                tail.quaternion.copyFrom(quaternion);
            }
            if (scale) {
                tail.scale.copyFrom(scale);
            }
        }
        else {
            var priorFrame = tail || this.originFrame;
            var newFrame = getPooledFrame();
            newFrame.position.copyFrom(position || priorFrame.position);
            newFrame.velocity.copyFrom(velocity || priorFrame.velocity);
            newFrame.quaternion.copyFrom(quaternion || priorFrame.quaternion);
            newFrame.scale.copyFrom(scale || priorFrame.scale);
            newFrame.time = this.time;
            this.buffer.push(newFrame);
        }
    };
    InterpolationBuffer.prototype.setTarget = function (position, velocity, quaternion, scale) {
        this.appendBuffer(position, velocity, quaternion, scale);
    };
    InterpolationBuffer.prototype.setPosition = function (position, velocity) {
        this.appendBuffer(position, velocity, undefined, undefined);
    };
    InterpolationBuffer.prototype.setQuaternion = function (quaternion) {
        this.appendBuffer(undefined, undefined, quaternion, undefined);
    };
    InterpolationBuffer.prototype.setScale = function (scale) {
        this.appendBuffer(undefined, undefined, undefined, scale);
    };
    InterpolationBuffer.prototype.update = function (delta) {
        if (this.state === STATE.INITIALIZING) {
            if (this.buffer.length > 0) {
                this.updateOriginFrameToBufferTail();
                this.position.copyFrom(this.originFrame.position);
                this.quaternion.copyFrom(this.originFrame.quaternion);
                this.scale.copyFrom(this.originFrame.scale);
                this.state = STATE.BUFFERING;
            }
        }
        if (this.state === STATE.BUFFERING) {
            if (this.buffer.length > 0 && this.time > this.bufferTime) {
                this.state = STATE.PLAYING;
            }
        }
        if (this.state === STATE.PLAYING) {
            var mark = this.time - this.bufferTime;
            //Purge this.buffer of expired frames
            while (this.buffer.length > 0 && mark > this.buffer[0].time) {
                //if this is the last frame in the buffer, just update the time and reuse it
                if (this.buffer.length > 1) {
                    this.updateOriginFrameToBufferTail();
                }
                else {
                    this.originFrame.position.copyFrom(this.buffer[0].position);
                    this.originFrame.velocity.copyFrom(this.buffer[0].velocity);
                    this.originFrame.quaternion.copyFrom(this.buffer[0].quaternion);
                    this.originFrame.scale.copyFrom(this.buffer[0].scale);
                    this.originFrame.time = this.buffer[0].time;
                    this.buffer[0].time = this.time + delta;
                }
            }
            if (this.buffer.length > 0 && this.buffer[0].time > 0) {
                var targetFrame = this.buffer[0];
                var delta_time = targetFrame.time - this.originFrame.time;
                var alpha = (mark - this.originFrame.time) / delta_time;
                if (this.mode === MODE.MODE_LERP) {
                    this.lerp(this.position, this.originFrame.position, targetFrame.position, alpha);
                }
                else if (this.mode === MODE.MODE_HERMITE) {
                    this.hermite(this.position, alpha, this.originFrame.position, targetFrame.position, this.originFrame.velocity.scaleInPlace(delta_time), targetFrame.velocity.scaleInPlace(delta_time));
                }
                this.slerp(this.quaternion, this.originFrame.quaternion, targetFrame.quaternion, alpha);
                this.lerp(this.scale, this.originFrame.scale, targetFrame.scale, alpha);
            }
        }
        if (this.state !== STATE.INITIALIZING) {
            this.time += delta;
        }
    };
    InterpolationBuffer.prototype.getPosition = function () {
        return this.position;
    };
    InterpolationBuffer.prototype.getQuaternion = function () {
        return this.quaternion;
    };
    InterpolationBuffer.prototype.getScale = function () {
        return this.scale;
    };
    return InterpolationBuffer;
}());
exports.InterpolationBuffer = InterpolationBuffer;
