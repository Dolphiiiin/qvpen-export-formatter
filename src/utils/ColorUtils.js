export class ColorUtils {
    static createColorsFromGradient(colorData, pointCount) {
        const colors = [];

        if (colorData && colorData.type === "gradient" && colorData.value && colorData.value.length >= 2) {
            const startColor = this.hexToColor4(colorData.value[0]);
            const endColor = this.hexToColor4(colorData.value[1]);

            for (let i = 0; i < pointCount; i++) {
                const ratio = i / (pointCount - 1);
                const color = new BABYLON.Color4(
                    startColor.r + (endColor.r - startColor.r) * ratio,
                    startColor.g + (endColor.g - startColor.g) * ratio,
                    startColor.b + (endColor.b - startColor.b) * ratio,
                    1.0
                );
                colors.push(color);
            }
        } else {
            const white = new BABYLON.Color4(1, 1, 1, 1);
            for (let i = 0; i < pointCount; i++) {
                colors.push(white);
            }
        }

        return colors;
    }

    static hexToColor4(hex) {
        hex = hex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) / 255;
        const g = parseInt(hex.substring(2, 4), 16) / 255;
        const b = parseInt(hex.substring(4, 6), 16) / 255;
        return new BABYLON.Color4(r, g, b, 1.0);
    }

    static calculateAverageColor(colors) {
        if (!colors || colors.length === 0) {
            return new BABYLON.Color4(1, 1, 1, 1);
        }

        let r = 0, g = 0, b = 0, a = 0;
        for (let i = 0; i < colors.length; i++) {
            r += colors[i].r;
            g += colors[i].g;
            b += colors[i].b;
            a += colors[i].a;
        }

        return new BABYLON.Color4(
            r / colors.length,
            g / colors.length,
            b / colors.length,
            a / colors.length
        );
    }
}