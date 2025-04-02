import { CONFIG } from '../config/config.js';
import { ColorUtils } from '../utils/ColorUtils.js';

export class Renderer {
    constructor(scene) {
        this.scene = scene;
        if (CONFIG.useCustomShader) {
            this.registerCustomShaders();
        }
    }

    registerCustomShaders() {
        BABYLON.Effect.ShadersStore["customRoundedLineVertexShader"] = `
            precision highp float;
            attribute vec3 position;
            attribute vec3 normal;
            attribute vec2 uv;
            attribute vec4 color;
            uniform mat4 world;
            uniform mat4 viewProjection;
            uniform float width;
            uniform float aspectRatio;
            varying vec2 vUV;
            varying vec4 vColor;
            varying float vDistance;

            void main() {
                vec4 worldPos = world * vec4(position, 1.0);
                gl_Position = viewProjection * worldPos;
                vUV = uv;
                vColor = color;
                vDistance = 1.0;
            }
        `;

        BABYLON.Effect.ShadersStore["customRoundedLineFragmentShader"] = `
            precision highp float;
            varying vec2 vUV;
            varying vec4 vColor;
            varying float vDistance;

            void main() {
                float l = length(vUV);
                if (l > 0.5) {
                    discard;
                }
                gl_FragColor = vec4(vColor.rgb, 1.0);
            }
        `;
    }

    createCustomShaderLines(points, colors, idx, parent, strokeWidth) {
        if (points.length < 2) return null;

        const lines = BABYLON.MeshBuilder.CreateLines(`stroke-${idx}`, {
            points,
            updatable: false,
            instance: null
        }, this.scene);

        const positions = lines.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        const vertexCount = positions.length / 3;
        const vertexColors = [];

        for (let i = 0; i < colors.length; i++) {
            vertexColors.push(colors[i].r, colors[i].g, colors[i].b, colors[i].a);
        }

        while (vertexColors.length < vertexCount * 4) {
            vertexColors.push(1, 1, 1, 1);
        }

        lines.setVerticesData(BABYLON.VertexBuffer.ColorKind, vertexColors);

        const material = new BABYLON.ShaderMaterial(
            `customLineMaterial-${idx}`,
            this.scene,
            {
                vertex: "customRoundedLineVertexShader",
                fragment: "customRoundedLineFragmentShader"
            },
            {
                attributes: ["position", "normal", "uv", "color"],
                uniforms: ["world", "worldView", "worldViewProjection", "view", "projection", "width", "aspectRatio"]
            }
        );

        material.setFloat("width", strokeWidth);
        material.setFloat("aspectRatio", CONFIG.tubeAspectRatio);

        lines.material = material;
        lines.parent = parent;

        if (CONFIG.roundedEndcaps) {
            this.createRoundedCap(points[0], colors[0], `stroke-${idx}-cap-start`, parent, strokeWidth);
            this.createRoundedCap(points[points.length - 1], colors[colors.length - 1], `stroke-${idx}-cap-end`, parent, strokeWidth);
        }

        return lines;
    }

    createTubesAlongPath(points, colors, idx, parent, strokeWidth) {
        if (points.length < 2) return null;

        if (CONFIG.useContinuousTube) {
            return this.createContinuousTube(points, colors, idx, parent, strokeWidth);
        } else {
            return this.createSegmentedTubes(points, colors, idx, parent, strokeWidth);
        }
    }

    createContinuousTube(points, colors, idx, parent, strokeWidth) {
        const tube = BABYLON.MeshBuilder.CreateTube(`stroke-${idx}`, {
            path: points,
            radius: strokeWidth / 2,
            tessellation: CONFIG.tubeSegments,
            cap: BABYLON.Mesh.CAP_ALL,
            updatable: false
        }, this.scene);

        const vertexData = new BABYLON.VertexData();
        tube.updateVerticesData(BABYLON.VertexBuffer.PositionKind, vertexData.positions);

        const material = new BABYLON.StandardMaterial(`stroke-${idx}-mat`, this.scene);
        const avgColor = ColorUtils.calculateAverageColor(colors);
        material.emissiveColor = new BABYLON.Color3(avgColor.r, avgColor.g, avgColor.b);
        material.disableLighting = true;
        material.backFaceCulling = false;

        tube.material = material;
        tube.parent = parent;

        if (CONFIG.roundedEndcaps) {
            this.createRoundedCap(points[0], colors[0], `stroke-${idx}-cap-start`, parent, strokeWidth);
            this.createRoundedCap(points[points.length - 1], colors[colors.length - 1], `stroke-${idx}-cap-end`, parent, strokeWidth);
        }

        return tube;
    }

    createSegmentedTubes(points, colors, idx, parent, strokeWidth) {
        const segments = [];

        for (let i = 0; i < points.length - 1; i++) {
            const start = points[i];
            const end = points[i + 1];
            const segmentLength = BABYLON.Vector3.Distance(start, end);

            if (segmentLength < CONFIG.invisibleLength) {
                continue;
            }

            const segment = this.createTubeSegment(
                start,
                end,
                colors[i],
                colors[i + 1],
                `stroke-${idx}-segment-${i}`,
                parent,
                strokeWidth
            );

            if (segment) {
                segments.push(segment);
            }
        }

        if (CONFIG.roundedEndcaps && segments.length > 0) {
            this.createRoundedCap(points[0], colors[0], `stroke-${idx}-cap-start`, parent, strokeWidth);
            this.createRoundedCap(points[points.length - 1], colors[colors.length - 1], `stroke-${idx}-cap-end`, parent, strokeWidth);
        }

        return segments;
    }

    createTubeSegment(start, end, startColor, endColor, name, parent, strokeWidth) {
        const path = [start, end];

        const tube = BABYLON.MeshBuilder.CreateTube(name, {
            path: path,
            radius: strokeWidth / 2,
            tessellation: CONFIG.tubeSegments,
            cap: BABYLON.Mesh.CAP_ALL,
            updatable: false
        }, this.scene);

        const material = new BABYLON.StandardMaterial(`${name}-mat`, this.scene);
        material.diffuseColor = new BABYLON.Color3(startColor.r, startColor.g, startColor.b);
        material.emissiveColor = new BABYLON.Color3(startColor.r, startColor.g, startColor.b);
        material.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        material.disableLighting = false;
        material.backFaceCulling = false;

        tube.material = material;
        tube.parent = parent;

        return tube;
    }

    createRoundedCap(position, color, name, parent, diameter) {
        const sphere = BABYLON.MeshBuilder.CreateSphere(name, {
            diameter: diameter,
            segments: CONFIG.tubeSegments
        }, this.scene);
        
        sphere.position = position;
        
        const material = new BABYLON.StandardMaterial(`${name}-mat`, this.scene);
        material.emissiveColor = new BABYLON.Color3(color.r, color.g, color.b);
        material.disableLighting = true;
        material.backFaceCulling = false;
        
        sphere.material = material;
        sphere.parent = parent;
        
        return sphere;
    }

    createEnhancedGrid() {
        const gridParent = new BABYLON.TransformNode("gridParent", this.scene);
        const gridSize = CONFIG.gridSize;

        if (CONFIG.showGroundPlane) {
            this.createGroundPlane(gridParent, gridSize);
        }

        this.createMajorGridLines(gridParent, gridSize);
        
        if (CONFIG.minorGridDensity > CONFIG.majorGridDensity) {
            this.createMinorGridLines(gridParent, gridSize);
        }

        return gridParent;
    }

    createGroundPlane(parent, size) {
        const ground = BABYLON.MeshBuilder.CreateGround("groundPlane", {
            width: size * 2,
            height: size * 2
        }, this.scene);

        const material = new BABYLON.StandardMaterial("groundMaterial", this.scene);
        material.diffuseColor = new BABYLON.Color3(
            CONFIG.groundPlaneColor.r,
            CONFIG.groundPlaneColor.g,
            CONFIG.groundPlaneColor.b
        );
        material.alpha = CONFIG.groundPlaneColor.a;
        material.backFaceCulling = false;
        
        ground.material = material;
        ground.parent = parent;
    }

    createMajorGridLines(parent, size) {
        const majorGridStep = 1 / CONFIG.majorGridDensity;

        // X-Z plane grid (horizontal)
        for (let x = -size; x <= size; x += majorGridStep) {
            const line = BABYLON.MeshBuilder.CreateLines("gridLineMajorX", {
                points: [
                    new BABYLON.Vector3(x, 0.005, -size),
                    new BABYLON.Vector3(x, 0.005, size)
                ]
            }, this.scene);

            if (Math.abs(x) < 0.001) {
                line.color = new BABYLON.Color3(0, 0, 1);
                line.enableEdgesRendering();
                line.edgesWidth = 1.5;
            } else {
                line.color = CONFIG.gridMajorColor;
            }

            line.parent = parent;
        }

        for (let z = -size; z <= size; z += majorGridStep) {
            const line = BABYLON.MeshBuilder.CreateLines("gridLineMajorZ", {
                points: [
                    new BABYLON.Vector3(-size, 0.005, z),
                    new BABYLON.Vector3(size, 0.005, z)
                ]
            }, this.scene);

            if (Math.abs(z) < 0.001) {
                line.color = new BABYLON.Color3(1, 0, 0);
                line.enableEdgesRendering();
                line.edgesWidth = 1.5;
            } else {
                line.color = CONFIG.gridMajorColor;
            }

            line.parent = parent;
        }
    }

    createMinorGridLines(parent, size) {
        const minorGridStep = 1 / CONFIG.minorGridDensity;
        const majorGridStep = 1 / CONFIG.majorGridDensity;

        for (let x = -size; x <= size; x += minorGridStep) {
            if (Math.abs(x % majorGridStep) < 0.0001) continue;

            const line = BABYLON.MeshBuilder.CreateLines("gridLineMinorX", {
                points: [
                    new BABYLON.Vector3(x, 0.005, -size),
                    new BABYLON.Vector3(x, 0.005, size)
                ]
            }, this.scene);

            line.color = CONFIG.gridMinorColor;
            line.parent = parent;
        }

        for (let z = -size; z <= size; z += minorGridStep) {
            if (Math.abs(z % majorGridStep) < 0.0001) continue;

            const line = BABYLON.MeshBuilder.CreateLines("gridLineMinorZ", {
                points: [
                    new BABYLON.Vector3(-size, 0.005, z),
                    new BABYLON.Vector3(size, 0.005, z)
                ]
            }, this.scene);

            line.color = CONFIG.gridMinorColor;
            line.parent = parent;
        }
    }
}