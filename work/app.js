/*
 * Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Container class to manage connecting to the WebXR Device API
 * and handle rendering on every frame.
 */
class App {
    constructor() {
        this.onXRFrame = this.onXRFrame.bind(this);
        this.onEnterAR = this.onEnterAR.bind(this);

        this.init();
    }

    /**
     * Fetches the XRDevice, if available.
     */
    async init() {
        // The entry point of the WebXR Device API is on `navigator.xr`.
        // We also want to ensure that `XRSession` has `requestHitTest`,
        // indicating that the #webxr-hit-test flag is enabled.
        if (navigator.xr && XRSession.prototype.requestHitTestSource) {
            console.log(
                'navigator.xr && XRSession.prototype.requestHitTestSource ok'
            );
            navigator.xr.isSessionSupported('immersive-ar').then(
                () => {
                    console.log('supportsSession immersive-ar ok');
                },
                () => {
                    this.onNoXRDevice();
                }
            );
        } else {
            // If `navigator.xr` or `XRSession.prototype.requestHitTest`
            // does not exist, we must display a message indicating there
            // are no valid devices.
            this.onNoXRDevice();
            return;
        }

        // We found an XRDevice! Bind a click listener on our "Enter AR" button
        // since the spec requires calling `device.requestSession()` within a
        // user gesture.
        document
            .querySelector('#enter-ar')
            .addEventListener('click', this.onEnterAR);
    }

    /**
     * Handle a click event on the '#enter-ar' button and attempt to
     * start an XRSession.
     */
    async onEnterAR() {
        // Now that we have an XRDevice, and are responding to a user
        // gesture, we must create an XRPresentationContext on a
        // canvas element.
        const outputCanvas = document.createElement('canvas');

        // Request a session
        navigator.xr
            .requestSession('immersive-ar')
            .then(xrSession => {
                this.session = xrSession;
                console.log('requestSession immersive-ar ok');
                xrSession.addEventListener('end', this.onXRSessionEnded);
                // If `requestSession` is successful, add the canvas to the
                // DOM since we know it will now be used.
                document.body.appendChild(outputCanvas);
                // Do necessary session setup here.
                this.onSessionStarted();
            })
            .catch(error => {
                // "immersive-ar" sessions are not supported
                console.warn('requestSession immersive-ar error: ', error);
                this.onNoXRDevice();
            });
    }

    /**
     * Toggle on a class on the page to disable the "Enter AR"
     * button and display the unsupported browser message.
     */
    onNoXRDevice() {
        document.body.classList.add('unsupported');
    }

    onXRSessionEnded() {
        console.log('onXRSessionEnded');
    }

    /**
     * Called when the XRSession has begun. Here we set up our three.js
     * renderer, scene, and camera and attach our XRWebGLLayer to the
     * XRSession and kick off the render loop.
     */
    async onSessionStarted() {
        // Add the `ar` class to our body, which will hide our 2D components
        document.body.classList.add('ar');

        // To help with working with 3D on the web, we'll use three.js. Set up
        // the WebGLRenderer, which handles rendering to our session's base layer.
        // THREE.WebGLRenderer 107
        this.renderer = new THREE.WebGLRenderer({
            alpha: true,
            preserveDrawingBuffer: true
        });
        this.renderer.autoClear = false;

        this.gl = this.renderer.getContext();

        // this.renderer.vr === new WebXRManager(...) -> https://github.com/mrdoob/three.js/blob/dev/src/renderers/webvr/WebXRManager.js
        this.renderer.vr.enabled = true;

        this.XRReferenceSpaceType = 'local';

        this.renderer.vr.setReferenceSpaceType(this.XRReferenceSpaceType);
        this.renderer.vr.setSession(this.session);

        // Set our session's baseLayer to an XRWebGLLayer
        // using our new renderer's context
        this.session.baseLayer = new XRWebGLLayer(this.session, this.gl);

        // A THREE.Scene contains the scene graph for all objects in the
        // render scene.
        // Call our utility which gives us a THREE.Scene populated with
        // cubes everywhere.
        this.scene = DemoUtils.createCubeScene();

        // We'll update the camera matrices directly from API, so
        // disable matrix auto updates so three.js doesn't attempt
        // to handle the matrices independently.
        this.camera = new THREE.PerspectiveCamera();
        this.camera.matrixAutoUpdate = false;

        // Also done by three.js WebXRManager setSession
        /*this.xrReferenceSpace = await this.session.requestReferenceSpace(
            this.XRReferenceSpaceType
        );*/
        // Begin the session’s animation loop.
        this.session.requestAnimationFrame(this.onXRFrame);
    }

    /**
     * Called on the XRSession's requestAnimationFrame.
     * Called with the time and XRPresentationFrame.
     */
    onXRFrame(time, frame) {
        let session = frame.session;

        // Queue up the next frame
        session.requestAnimationFrame(this.onXRFrame);

        this.renderer.render(this.scene, this.camera);
    }
}

window.app = new App();
