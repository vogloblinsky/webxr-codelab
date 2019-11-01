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

// remaps opacity from 0 to 1
const opacityRemap = mat => {
    if (mat.opacity === 0) {
        mat.opacity = 1;
    }
};

/**
 * The Reticle class creates an object that repeatedly calls
 * `xrSession.requestHitTest()` to render a ring along a found
 * horizontal surface.
 */
class Reticle extends THREE.Object3D {
    /**
     * @param {XRSession} xrSession
     * @param {THREE.Camera} camera
     */
    constructor(camera) {
        super();

        this.name = 'Reticle';

        let geometry = new THREE.RingGeometry(0.1, 0.11, 24, 1);
        let material = new THREE.MeshBasicMaterial({
            color: 0xffffff
        });
        // Orient the geometry so its position is flat on a horizontal surface
        geometry.applyMatrix(
            new THREE.Matrix4().makeRotationX(THREE.Math.degToRad(-90))
        );

        this.ring = new THREE.Mesh(geometry, material);

        this.add(this.ring);

        this.visible = false;
        this.camera = camera;
    }

    /**
     * Fires a hit test in the middle of the screen and places the reticle
     * upon the surface if found.
     *
     * @param {XRSession} session
     * @param {XRCoordinateSystem} frameOfRef
     */
    async update(session, frameOfRef) {
        this.raycaster = this.raycaster || new THREE.Raycaster();
        this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
        const ray = this.raycaster.ray;
        let xrray = new XRRay(ray.origin, ray.direction);

        let hits;

        try {
            hits = await session.requestHitTest(xrray, frameOfRef);
        } catch (error) {
            hits = [];
        }

        if (hits.length) {
            const hit = hits[0];
            const hitMatrix = new THREE.Matrix4().fromArray(hit.hitMatrix);

            // Now apply the position from the hitMatrix onto our model
            this.position.setFromMatrixPosition(hitMatrix);

            // Rotate the anchor to face the camera
            const targetPos = new THREE.Vector3().setFromMatrixPosition(
                this.camera.matrixWorld
            );
            const angle = Math.atan2(
                targetPos.x - this.position.x,
                targetPos.z - this.position.z
            );
            this.rotation.set(0, angle, 0);

            this.visible = true;
        }
    }
}

window.DemoUtils = {
    /**
     * Creates a THREE.Scene containing lights that case shadows,
     * and a mesh that will receive shadows.
     *
     * @return {THREE.Scene}
     */
    createLitScene() {
        const scene = new THREE.Scene();

        // The materials will render as a black mesh
        // without lights in our scenes. Let's add an ambient light
        // so our material can be visible, as well as a directional light
        // for the shadow.
        const light = new THREE.AmbientLight(0xffffff, 1);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
        directionalLight.position.set(10, 15, 10);

        // We want this light to cast shadow.
        directionalLight.castShadow = true;

        // Make a large plane to receive our shadows
        const planeGeometry = new THREE.PlaneGeometry(2000, 2000);
        // Rotate our plane to be parallel to the floor
        planeGeometry.rotateX(-Math.PI / 2);

        // Create a mesh with a shadow material, resulting in a mesh
        // that only renders shadows once we flip the `receiveShadow` property.
        const shadowMesh = new THREE.Mesh(
            planeGeometry,
            new THREE.ShadowMaterial({
                color: 0x111111,
                opacity: 0.2
            })
        );

        // Give it a name so we can reference it later, and set `receiveShadow`
        // to true so that it can render our model's shadow.
        shadowMesh.name = 'shadowMesh';
        shadowMesh.receiveShadow = true;
        shadowMesh.position.y = 10000;

        // Add lights and shadow material to scene.
        scene.add(shadowMesh);
        scene.add(light);
        scene.add(directionalLight);

        return scene;
    },

    /**
     * Creates a THREE.Scene containing cubes all over the scene.
     *
     * @return {THREE.Scene}
     */
    createCubeScene() {
        const scene = new THREE.Scene();

        const materials = [
            new THREE.MeshBasicMaterial({
                color: 0xff0000
            }),
            new THREE.MeshBasicMaterial({
                color: 0x0000ff
            }),
            new THREE.MeshBasicMaterial({
                color: 0x00ff00
            }),
            new THREE.MeshBasicMaterial({
                color: 0xff00ff
            }),
            new THREE.MeshBasicMaterial({
                color: 0x00ffff
            }),
            new THREE.MeshBasicMaterial({
                color: 0xffff00
            })
        ];

        const ROW_COUNT = 4;
        const SPREAD = 1;
        const HALF = ROW_COUNT / 2;
        for (let i = 0; i < ROW_COUNT; i++) {
            for (let j = 0; j < ROW_COUNT; j++) {
                for (let k = 0; k < ROW_COUNT; k++) {
                    const box = new THREE.Mesh(
                        new THREE.BoxBufferGeometry(0.2, 0.2, 0.2),
                        materials
                    );
                    box.position.set(i - HALF, j - HALF, k - HALF);
                    box.position.multiplyScalar(SPREAD);
                    scene.add(box);
                }
            }
        }

        return scene;
    },

    /**
     * Loads an OBJ model with an MTL material applied.
     * Returns a THREE.Group object containing the mesh.
     *
     * @param {string} objURL
     * @param {string} mtlURL
     * @return {Promise<THREE.Group>}
     */
    loadModel(objURL, mtlURL) {
        // OBJLoader and MTLLoader are not a part of three.js core, and
        // must be included as separate scripts.
        const objLoader = new THREE.OBJLoader();
        const mtlLoader = new THREE.MTLLoader();

        // Set texture path so that the loader knows where to find
        // linked resources
        // mtlLoader.setTexturePath(mtlURL.substr(0, mtlURL.lastIndexOf('/') + 1));

        // remaps ka, kd, & ks values of 0,0,0 -> 1,1,1, models from
        // Poly benefit due to how they were encoded.
        mtlLoader.setMaterialOptions({
            ignoreZeroRGBs: true
        });

        // OBJLoader and MTLLoader provide callback interfaces; let's
        // return a Promise and resolve or reject based off of the asset
        // downloading.
        return new Promise((resolve, reject) => {
            mtlLoader.load(
                mtlURL,
                materialCreator => {
                    // We have our material package parsed from the .mtl file.
                    // Be sure to preload it.
                    materialCreator.preload();

                    // Remap opacity values in the material to 1 if they're set as
                    // 0; this is another peculiarity of Poly models and some
                    // MTL materials.
                    for (let material of Object.values(
                        materialCreator.materials
                    )) {
                        opacityRemap(material);
                    }

                    // Give our OBJ loader our materials to apply it properly to the model
                    objLoader.setMaterials(materialCreator);

                    // Finally load our OBJ, and resolve the promise once found.
                    objLoader.load(objURL, resolve, function() {}, reject);
                },
                function() {},
                reject
            );
        });
    },

    loadGltfModel(url) {
        const gltfLoader = new THREE.GLTFLoader();

        return new Promise((resolve, reject) => {
            gltfLoader.load(
                url,
                function(data) {
                    gltf = data;

                    let object = gltf.scene;

                    let animations = gltf.animations;

                    if (animations && animations.length) {
                        mixer = new THREE.AnimationMixer(object);

                        for (let i = 0; i < animations.length; i++) {
                            let animation = animations[i];

                            animation.duration = 4;

                            mixer.clipAction(animation).play();
                        }
                    }

                    resolve(gltf.scene);
                },
                undefined,
                function(error) {
                    console.error(error);
                    reject(error);
                }
            );
        });
    },

    /**
     * Similar to THREE.Object3D's `lookAt` function, except we only
     * want to rotate on the Y axis. In our AR use case, we don't want
     * our model rotating in all axes, instead just on the Y.
     *
     * @param {THREE.Object3D} looker
     * @param {THREE.Object3D} target
     */
    lookAtOnY(looker, target) {
        const targetPos = new THREE.Vector3().setFromMatrixPosition(
            target.matrixWorld
        );

        const angle = Math.atan2(
            targetPos.x - looker.position.x,
            targetPos.z - looker.position.z
        );
        looker.rotation.set(0, angle, 0);
    },

    createExitButton(session) {
        let button = document.createElement('button');
        button.style.position = 'absolute';
        button.style.bottom = '20px';
        button.style.padding = '12px 6px';
        button.style.border = '1px solid #fff';
        button.style.borderRadius = '4px';
        button.style.background = 'rgba(0,0,0,0.1)';
        button.style.color = '#fff';
        button.style.font = 'normal 13px sans-serif';
        button.style.textAlign = 'center';
        button.style.opacity = '0.5';
        button.style.outline = 'none';
        button.style.zIndex = '999';
        button.style.left = 'calc(50% - 50px)';
        button.style.width = '100px';

        button.textContent = 'EXIT AR';

        button.onclick = function() {
            session.end();
            document.body.removeChild(button);
        };

        document.body.appendChild(button);
    }
};
