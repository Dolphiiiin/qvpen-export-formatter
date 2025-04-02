export class GeometryUtils {
    static calculateBoundingBox(mesh) {
        if (!mesh) return null;
        
        const boundingInfo = mesh.getHierarchyBoundingVectors(true);
        if (!boundingInfo || !boundingInfo.min || !boundingInfo.max) {
            return null;
        }
        
        return {
            min: boundingInfo.min,
            max: boundingInfo.max,
            center: boundingInfo.min.add(boundingInfo.max.subtract(boundingInfo.min).scale(0.5)),
            dimensions: boundingInfo.max.subtract(boundingInfo.min)
        };
    }

    static getStrokeWidth(stroke, defaultWidth, globalWidth) {
        if (stroke.width !== undefined && typeof stroke.width === 'number' && stroke.width > 0) {
            return stroke.width;
        }
        
        if (stroke.thickness !== undefined && typeof stroke.thickness === 'number' && stroke.thickness > 0) {
            return stroke.thickness;
        }
        
        if (globalWidth !== undefined && typeof globalWidth === 'number' && globalWidth > 0) {
            return globalWidth;
        }
        
        return defaultWidth;
    }

    static transformWorldMatrix(position, rotation, scaling) {
        // スケーリングを正確に適用するため、各軸の値を個別に処理
        const scaleVector = new BABYLON.Vector3(
            Math.abs(scaling.x),
            Math.abs(scaling.y),
            Math.abs(scaling.z)
        );
        
        return BABYLON.Matrix.Compose(
            scaleVector,
            BABYLON.Quaternion.RotationYawPitchRoll(rotation.y, rotation.x, rotation.z),
            position
        );
    }

    static transformPoint(point, matrix) {
        return BABYLON.Vector3.TransformCoordinates(point, matrix);
    }

    static applyTransformToPoints(points, transform) {
        const matrix = this.transformWorldMatrix(
            transform.position,
            transform.rotation,
            transform.scaling
        );
        
        return points.map(p => this.transformPoint(p, matrix));
    }

    static checkPointInBox(point, box) {
        const localPoint = BABYLON.Vector3.TransformCoordinates(
            point,
            BABYLON.Matrix.Invert(this.transformWorldMatrix(
                box.position,
                box.rotation,
                box.scaling
            ))
        );
        
        return Math.abs(localPoint.x) <= 0.5 &&
               Math.abs(localPoint.y) <= 0.5 &&
               Math.abs(localPoint.z) <= 0.5;
    }

    static calculateSegmentLength(start, end) {
        return BABYLON.Vector3.Distance(start, end);
    }

    static lerp(start, end, t) {
        return start + (end - start) * t;
    }

    static lerpVector3(start, end, t) {
        return new BABYLON.Vector3(
            this.lerp(start.x, end.x, t),
            this.lerp(start.y, end.y, t),
            this.lerp(start.z, end.z, t)
        );
    }

    static calculateIntersectionPoint(p1, p2, box) {
        // ワールド空間からボックスのローカル空間への変換行列を作成
        const worldToLocal = BABYLON.Matrix.Invert(
            this.transformWorldMatrix(
                box.position,
                box.rotation,
                box.scaling
            )
        );

        // 点をボックスのローカル空間に変換
        const localP1 = BABYLON.Vector3.TransformCoordinates(p1, worldToLocal);
        const localP2 = BABYLON.Vector3.TransformCoordinates(p2, worldToLocal);

        // ローカル空間での線分の方向ベクトル
        const direction = localP2.subtract(localP1);
        direction.normalize();

        // 各軸での交点パラメータを計算
        const tMin = new BABYLON.Vector3(
            (-0.5 - localP1.x) / direction.x,
            (-0.5 - localP1.y) / direction.y,
            (-0.5 - localP1.z) / direction.z
        );

        const tMax = new BABYLON.Vector3(
            (0.5 - localP1.x) / direction.x,
            (0.5 - localP1.y) / direction.y,
            (0.5 - localP1.z) / direction.z
        );

        // 各軸でのエントリーポイントとイグジットポイントを見つける
        const t1 = Math.max(
            Math.min(tMin.x, tMax.x),
            Math.min(tMin.y, tMax.y),
            Math.min(tMin.z, tMax.z)
        );

        const t2 = Math.min(
            Math.max(tMin.x, tMax.x),
            Math.max(tMin.y, tMax.y),
            Math.max(tMin.z, tMax.z)
        );

        // 交点が線分上にない場合はnullを返す
        if (t1 > t2 || t2 < 0) {
            return null;
        }

        // 線分の始点から終点方向への交点を返す
        const t = t1 >= 0 ? t1 : t2;
        const localIntersection = localP1.add(direction.scale(t));
        
        // 交点をワールド空間に戻す
        return BABYLON.Vector3.TransformCoordinates(
            localIntersection,
            this.transformWorldMatrix(
                box.position,
                box.rotation,
                box.scaling
            )
        );
    }
}