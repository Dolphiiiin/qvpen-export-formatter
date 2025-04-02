export const CONFIG = {
    defaultLineWidth: 0.03,
    lineWidth: 0.03,
    invisibleLength: 1.0,
    roundedEndcaps: true,
    tubeSegments: 8,
    tubeAspectRatio: 1.0,
    useCustomShader: false,
    defaultJsonFile: 'payapaya_azarashi.json',
    useContinuousTube: true,

    // Grid configuration
    showGrid: true,
    gridSize: 3,
    majorGridDensity: 1,
    minorGridDensity: 10,
    gridMajorColor: new BABYLON.Color3(0.4, 0.4, 0.4),
    gridMinorColor: new BABYLON.Color3(0.4, 0.4, 0.4),
    gridOpacity: 0.25,
    showGroundPlane: true,
    groundPlaneColor: new BABYLON.Color4(0.2, 0.2, 0.3, 0.2),
    
    // Axis overlay
    axisOverlaySize: 0.12,
    axisOverlayPosition: {x: 0.03, y: 0.85},
    
    // Editing tools configuration
    editing: {
        enabled: true,
        activeToolIndex: 0,
        gizmoSize: 0.5,  // ギズモサイズを0.15から0.5に変更
        trimColor: new BABYLON.Color4(1, 0, 0, 0.3),
        snapToGrid: false,
        snapIncrement: 0.1,
        focusOnLoad: true,
        normalizeOnLoad: false,
        showTransformInspector: true,
        showPlaneMoveGizmo: true,  // 平面移動ギズモの表示を有効化
        useLocalSpace: true // ローカル軸モードをデフォルトに設定
    }
};