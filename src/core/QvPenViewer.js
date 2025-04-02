import { CONFIG } from '../config/config.js';
import { Renderer } from '../rendering/Renderer.js';
import { EditingTools } from '../tools/EditingTools.js';
import { ColorUtils } from '../utils/ColorUtils.js';
import { GeometryUtils } from '../utils/GeometryUtils.js';

export class QvPenViewer {
    constructor(canvas) {
        this.canvas = canvas;
        this.engine = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;  // rendererをnullで初期化
        this.penData = null;
        this.penContainer = null;
        this.gridParent = null;
        this.fileInfo = document.getElementById('fileInfo');
        
        // ローディング状態とウェルカム状態の管理フラグを追加
        this.isLoading = false;
        this.isWelcomeState = true;  // 初期状態はウェルカム状態
        
        // 履歴管理用の変数を追加
        this.historyStack = [];
        this.redoStack = [];
        this.maxHistoryLength = 20; // 履歴の最大保存数
        this.lastHistoryState = null; // 最後に保存した状態（重複防止用）
        
        this.init();
        this.setupFileInput();
        this.setupEditingUI();
        this.setupKeyboardShortcuts(); // キーボードショートカットの設定を追加
        this.updateUIVisibility();  // 初期表示でUIの表示状態を更新
    }

    async init() {
        // Initialize BabylonJS engine
        this.engine = new BABYLON.Engine(this.canvas, true);
        
        // 保存された表示設定を読み込む
        this.loadDisplaySettings();
        
        // Create scene and initialize renderer
        this.scene = new BABYLON.Scene(this.engine);
        
        // 保存された背景色を適用
        this.applyBackgroundColor();
        
        // Setup camera
        this.setupCamera();
        
        // Setup lights
        this.setupLights();
        
        // Create and setup renderer - IMPORTANT: Initialize renderer before using it
        this.renderer = new Renderer(this.scene);
        
        // Add grid if enabled - Now safe to call renderer methods
        if (CONFIG.showGrid) {
            this.gridParent = this.renderer.createEnhancedGrid();
        }
        
        // Initialize editing tools if enabled
        if (CONFIG.editing.enabled) {
            const utilityLayer = new BABYLON.UtilityLayerRenderer(this.scene);
            utilityLayer.utilityLayerScene.autoClearDepthAndStencil = false;
            
            this.editingTools = new EditingTools(
                this.scene,
                utilityLayer,
                this.onTransformChanged.bind(this)
            );
        }

        // Register render loop
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            this.engine.resize();
        });
    }

    setupCamera() {
        this.camera = new BABYLON.ArcRotateCamera(
            "camera",
            Math.PI / 4,  // 斜め上からの視点に変更 (π/4 = 45度)
            Math.PI / 4,  // 斜め上からの視点に変更 (π/4 = 45度)
            3,
            new BABYLON.Vector3(0, 0, 0),
            this.scene
        );
        this.camera.attachControl(this.canvas, true);
        this.camera.wheelPrecision = 50;
        this.camera.lowerRadiusLimit = 0.01;
        this.camera.upperRadiusLimit = 10;
        this.camera.minZ = 0.001;
        
        // 初期カメラ位置を保存
        this.initialCameraPosition = {
            alpha: Math.PI / 4,  // 水平角度 (45度)
            beta: Math.PI / 4,    // 垂直角度 (45度)
            radius: 3             // 距離
        };
    }

    setupLights() {
        const light = new BABYLON.HemisphericLight(
            "light",
            new BABYLON.Vector3(0, 1, 0),
            this.scene
        );
        light.intensity = 1.0;

        const ambientLight = new BABYLON.HemisphericLight(
            "ambientLight",
            new BABYLON.Vector3(0, -1, 0),
            this.scene
        );
        ambientLight.intensity = 0.5;
    }

    createScene() {
        const scene = this.scene;

        return scene;
    }

    setupFileInput() {
        const fileInput = document.getElementById('fileInput');
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                this.loadFileFromInput(file);
            }
        });

        const loadDefaultBtn = document.getElementById('loadDefault');
        loadDefaultBtn.addEventListener('click', () => {
            this.loadPenData(CONFIG.defaultJsonFile);
        });
    }

    loadFileFromInput(file) {
        // ローディング状態に設定
        this.isLoading = true;
        this.updateUIVisibility();
        
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.penData = data;
                this.fileInfo.textContent = `Loaded: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
                this.clearScene();
                this.renderPenData();

                // 新しいデータを読み込んだら履歴をリセット
                this.historyStack = [];
                this.redoStack = [];
                this.lastHistoryState = null;
                
                // ウェルカム状態とローディング状態を終了
                this.isWelcomeState = false;
                this.isLoading = false;
                this.updateUIVisibility();
            } catch (error) {
                console.error('Error parsing JSON file:', error);
                this.fileInfo.textContent = `Error: Invalid JSON file - ${error.message}`;
                
                // エラー発生時もローディング状態を終了
                this.isLoading = false;
                this.updateUIVisibility();
            }
        };

        reader.onerror = (error) => {
            console.error('Error reading file:', error);
            this.fileInfo.textContent = 'Error: Failed to read the file';
            
            // エラー発生時もローディング状態を終了
            this.isLoading = false;
            this.updateUIVisibility();
        };

        reader.readAsText(file);
    }

    async loadPenData(url) {
        // ローディング状態に設定
        this.isLoading = true;
        this.updateUIVisibility();
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            this.penData = await response.json();
            this.fileInfo.textContent = `Loaded: ${url}`;
            this.clearScene();
            this.renderPenData();

            // 新しいデータを読み込んだら履歴をリセット
            this.historyStack = [];
            this.redoStack = [];
            this.lastHistoryState = null;
            
            // ウェルカム状態とローディング状態を終了
            this.isWelcomeState = false;
            this.isLoading = false;
            this.updateUIVisibility();
        } catch (error) {
            console.error('Error loading pen data:', error);
            this.fileInfo.textContent = `Error loading ${url}: ${error.message}`;
            
            // エラー発生時もローディング状態を終了
            this.isLoading = false;
            this.updateUIVisibility();
        }
    }

    renderPenData() {
        if (!this.penData || !this.penData.exportedData) {
            this.fileInfo.textContent = 'Error: Invalid QvPen data format';
            return;
        }

        // Ensure renderer is available
        if (!this.renderer) {
            console.error('Renderer not initialized');
            return;
        }

        this.penContainer = new BABYLON.TransformNode("penContainer", this.scene);

        this.penData.exportedData.forEach((stroke, idx) => {
            if (!stroke.positions || stroke.positions.length < 3) return;

            const points = [];
            for (let i = 0; i < stroke.positions.length; i += 3) {
                if (i + 2 < stroke.positions.length) {
                    points.push(new BABYLON.Vector3(
                        stroke.positions[i],
                        stroke.positions[i + 1],
                        stroke.positions[i + 2]
                    ));
                }
            }

            if (points.length < 2) return;

            const colors = ColorUtils.createColorsFromGradient(stroke.color, points.length);
            const strokeWidth = GeometryUtils.getStrokeWidth(
                stroke,
                CONFIG.defaultLineWidth,
                this.penData.width
            );

            if (CONFIG.useCustomShader) {
                this.renderer.createCustomShaderLines(points, colors, idx, this.penContainer, strokeWidth);
            } else {
                this.renderer.createTubesAlongPath(points, colors, idx, this.penContainer, strokeWidth);
            }
        });

        // トランスフォーム数値入力欄を更新
        this.updateTransformInspectorValues();

        if (CONFIG.editing.focusOnLoad) {
            this.frameSelectedObject();
        }

        if (CONFIG.editing.normalizeOnLoad) {
            this.normalizeToOrigin();
        }
    }

    // シーンをクリアするメソッド
    clearScene() {
        if (this.penContainer) {
            this.penContainer.dispose();
            this.penContainer = null;
        }
    }

    // 新しいデータロード関数
    loadData(data) {
        // ローディング状態に設定
        this.isLoading = true;
        this.updateUIVisibility();
        
        try {
            // データの形式をチェックし適切に処理
            if (Array.isArray(data)) {
                // データが配列の場合（エクスポート機能から直接渡された場合）
                this.penData = {
                    exportedData: data,
                    timestamp: new Date().toISOString(),
                    fileName: 'exported_data.json'
                };
            } else if (data.exportedData && Array.isArray(data.exportedData)) {
                // データが{exportedData: [...]}の形式の場合
                this.penData = data;
            } else {
                // その他の形式の場合はそのまま使用
                this.penData = data;
            }
            
            this.fileInfo.textContent = `Loaded: ${this.penData.fileName || 'Exported Data'}`;
            this.clearScene();
            this.renderPenData();

            // 新しいデータを読み込んだら履歴をリセット
            this.historyStack = [];
            this.redoStack = [];
            this.lastHistoryState = null;
            
            // ウェルカム状態とローディング状態を終了
            this.isWelcomeState = false;
            this.isLoading = false;
            this.updateUIVisibility();
        } catch (error) {
            console.error('Error loading data:', error);
            this.fileInfo.textContent = `Error: Invalid data format - ${error.message}`;
            
            // エラー発生時もローディング状態を終了
            this.isLoading = false;
            this.updateUIVisibility();
        }
    }

    // UIの表示状態を更新するメソッド
    updateUIVisibility() {
        const editingTools = document.getElementById('editingTools');
        const transformInspector = document.getElementById('transformInspector');
        const saveFileContainer = document.getElementById('saveFileContainer');
        
        // ウェルカム状態またはローディング状態ではコントロール要素を非表示
        if (this.isWelcomeState || this.isLoading) {
            if (editingTools) editingTools.style.display = 'none';
            if (transformInspector) transformInspector.style.display = 'none';
            if (saveFileContainer) saveFileContainer.style.display = 'none';
            
            // エディットツールを無効化
            if (this.editingTools) {
                this.editingTools.hideAllGizmos();
            }
        } else {
            // データロード後は通常表示
            if (editingTools) editingTools.style.display = 'block';
            if (saveFileContainer) saveFileContainer.style.display = 'block';
            
            // トランスフォームインスペクタは設定に従って表示/非表示
            if (transformInspector && CONFIG.editing.showTransformInspector) {
                transformInspector.style.display = 'block';
            }
        }
    }

    frameSelectedObject() {
        if (!this.penContainer) return;

        const boundingBox = GeometryUtils.calculateBoundingBox(this.penContainer);
        if (!boundingBox) return;

        const radius = boundingBox.dimensions.length() * 0.5;
        
        BABYLON.Animation.CreateAndStartAnimation(
            "frameCamera",
            this.camera,
            "target",
            60,
            20,
            this.camera.target,
            boundingBox.center,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        
        BABYLON.Animation.CreateAndStartAnimation(
            "frameRadius",
            this.camera,
            "radius",
            60,
            20,
            this.camera.radius,
            radius * 2.5,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        
        // フォーカス時にカメラのアルファとベータ角度は変更しない
    }

    resetCamera() {
        if (!this.initialCameraPosition) return;
        
        BABYLON.Animation.CreateAndStartAnimation(
            "resetAlpha",
            this.camera,
            "alpha",
            60,
            20,
            this.camera.alpha,
            this.initialCameraPosition.alpha,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        
        BABYLON.Animation.CreateAndStartAnimation(
            "resetBeta",
            this.camera,
            "beta",
            60,
            20,
            this.camera.beta,
            this.initialCameraPosition.beta,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        
        BABYLON.Animation.CreateAndStartAnimation(
            "resetRadius",
            this.camera,
            "radius",
            60,
            20,
            this.camera.radius,
            this.initialCameraPosition.radius,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        
        // ターゲットを原点に戻す
        BABYLON.Animation.CreateAndStartAnimation(
            "resetTarget",
            this.camera,
            "target",
            60,
            20,
            this.camera.target,
            new BABYLON.Vector3(0, 0, 0),
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );
    }

    normalizeToOrigin() {
        if (!this.penData || !this.penContainer) return;

        // 正規化前の状態を履歴に保存
        this.addToHistory(this.createHistoryState());

        const boundingBox = GeometryUtils.calculateBoundingBox(this.penContainer);
        if (!boundingBox) {
            console.warn("Cannot normalize: No valid bounding info found");
            return;
        }

        const translationToOrigin = boundingBox.center.scale(-1);
        this.penContainer.position = new BABYLON.Vector3(0, 0, 0);

        this.penData.exportedData.forEach(stroke => {
            if (!stroke.positions || stroke.positions.length < 3) return;

            for (let i = 0; i < stroke.positions.length; i += 3) {
                stroke.positions[i] -= boundingBox.center.x;
                stroke.positions[i + 1] -= boundingBox.center.y;
                stroke.positions[i + 2] -= boundingBox.center.z;
            }
        });

        this.clearScene();
        this.renderPenData();
        this.updateTransformInspectorValues();
        
        // 正規化後に現在のギズモを再アタッチする
        if (this.editingTools && this.editingTools.currentGizmo) {
            this.editingTools.currentGizmo.attachedMesh = this.penContainer;
        }
        
        // 正規化完了メッセージ
        if (this.fileInfo) {
            this.fileInfo.textContent = '原点に正規化しました';
        }
    }

    startDragTransform() {
        if (!this.penContainer) return;
        
        // トランスフォーム開始前の状態を保存
        this.addToHistory(this.createHistoryState());
        
        this.lastTransform = {
            position: this.penContainer.position.clone(),
            rotation: this.penContainer.rotation.clone(),
            scaling: this.penContainer.scaling.clone()
        };
    }

    updateDragTransform() {
        this.updateTransformInspectorValues();
    }

    endDragTransform() {
        if (!this.penContainer) return;
        
        const currentTransform = {
            position: this.penContainer.position.clone(),
            rotation: this.penContainer.rotation.clone(),
            scaling: this.penContainer.scaling.clone()
        };
    }

    onTransformChanged(type, message) {
        switch (type) {
            case 'start':
                this.startDragTransform();
                break;
            case 'update':
                this.updateDragTransform();
                break;
            case 'end':
                this.endDragTransform();
                break;
            case 'message':
                // メッセージ表示処理を追加
                if (this.fileInfo && message) {
                    this.fileInfo.textContent = message;
                    // 3秒後に元のファイル情報に戻す
                    setTimeout(() => {
                        if (this.penData) {
                            this.fileInfo.textContent = `Loaded: ${this.penData.fileName || 'データ'}`;
                        }
                    }, 3000);
                }
                break;
        }
    }

    setupEditingUI() {
        if (!CONFIG.editing.enabled) return;

        const transformInspector = document.getElementById('transformInspector');
        if (CONFIG.editing.showTransformInspector) {
            transformInspector.style.display = 'none'; // 初期状態では非表示に変更
        }

        this.setupToolButtons();
        this.setupTransformInputs();
    }

    setupToolButtons() {
        const buttons = {
            move: document.getElementById('moveToolBtn'),
            rotate: document.getElementById('rotateToolBtn'),
            scale: document.getElementById('scaleToolBtn'),
            trim: document.getElementById('trimToolBtn'),
            normalize: document.getElementById('normalizeBtn'),
            applyTrim: document.getElementById('applyTrimBtn'),
            cancelTrim: document.getElementById('cancelTrimBtn'),
            save: document.getElementById('saveButton'),
            coordToggle: document.getElementById('coordinateToggleBtn') // Add coordinate toggle button
        };

        buttons.move.addEventListener('click', () => this.setTool('position'));
        buttons.rotate.addEventListener('click', () => this.setTool('rotation'));
        buttons.scale.addEventListener('click', () => this.setTool('scale'));
        buttons.trim.addEventListener('click', () => this.setTool('trim'));
        buttons.normalize.addEventListener('click', () => this.normalizeToOrigin());
        buttons.applyTrim.addEventListener('click', () => this.applyTrim());
        buttons.cancelTrim.addEventListener('click', () => this.cancelTrim());
        buttons.save.addEventListener('click', () => this.saveJson());
        
        // Add event listener for coordinate toggle button
        buttons.coordToggle.addEventListener('click', () => this.toggleCoordinateSystem());
        
        // Initialize coordinate toggle button text based on current mode
        if (this.editingTools && buttons.coordToggle) {
            buttons.coordToggle.textContent = this.editingTools.useLocalSpace ? '座標系：ローカル' : '座標系：グローバル';
        }
    }

    setupTransformInputs() {
        this.transformInputs = {
            position: {
                x: document.getElementById('posX'),
                y: document.getElementById('posY'),
                z: document.getElementById('posZ')
            },
            rotation: {
                x: document.getElementById('rotX'),
                y: document.getElementById('rotY'),
                z: document.getElementById('rotZ')
            },
            scale: {
                x: document.getElementById('scaleX'),
                y: document.getElementById('scaleY'),
                z: document.getElementById('scaleZ')
            }
        };

        Object.values(this.transformInputs).forEach(group => {
            Object.values(group).forEach(input => {
                input.addEventListener('change', () => this.updateTransformFromInspector());
            });
        });
    }

    setTool(type) {
        // ウェルカム状態またはローディング状態の場合はツール変更をしない
        if (this.isWelcomeState || this.isLoading) return;
        
        if (type === 'trim') {
            document.getElementById('applyTrimBtn').style.display = 'inline-block';
            document.getElementById('cancelTrimBtn').style.display = 'inline-block';
            this.editingTools.startTrimMode();
        } else {
            document.getElementById('applyTrimBtn').style.display = 'none';
            document.getElementById('cancelTrimBtn').style.display = 'none';
            this.editingTools.setActiveGizmo(type, this.penContainer);
        }

        this.updateButtonStates(type);
        this.updateTransformInspectorVisibility(type);
    }

    updateButtonStates(activeType) {
        const toolButtons = {
            position: document.getElementById('moveToolBtn'),
            rotation: document.getElementById('rotateToolBtn'),
            scale: document.getElementById('scaleToolBtn'),
            trim: document.getElementById('trimToolBtn')
        };

        Object.entries(toolButtons).forEach(([type, button]) => {
            button.classList.toggle('active', type === activeType);
        });
    }

    updateTransformInspectorVisibility(toolType) {
        // ウェルカム状態またはローディング状態の場合はインスペクタを非表示
        const inspector = document.getElementById('transformInspector');
        if (this.isWelcomeState || this.isLoading) {
            inspector.style.display = 'none';
            return;
        }
        
        // トリムモードでもトランスフォームインスペクタを表示
        inspector.style.display = 'block';
    }

    // キーボードショートカットの設定
    setupKeyboardShortcuts() {
        window.addEventListener('keydown', (event) => {
            // ウェルカム状態またはローディング状態の場合はキーボードショートカットを無効化
            if (this.isWelcomeState || this.isLoading) return;
            
            // Ctrl+Z: 元に戻す
            if (event.ctrlKey && event.key === 'z') {
                event.preventDefault();
                if (typeof this.undo === 'function') {
                    this.undo();
                }
            }
            
            // Ctrl+Y: やり直す
            if (event.ctrlKey && event.key === 'y') {
                event.preventDefault();
                if (typeof this.redo === 'function') {
                    this.redo();
                }
            }
            
            // R: カメラを初期位置にリセット
            if (event.key === 'r' || event.key === 'R') {
                event.preventDefault();
                this.resetCamera();
            }
            
            // F: 選択オブジェクトにフォーカス（カメラズーム）
            if (event.key === 'f' || event.key === 'F') {
                event.preventDefault();
                this.frameSelectedObject();
            }
        });
    }

    // トランスフォーム値の更新
    updateTransformInspectorValues() {
        if (!this.penContainer || !this.transformInputs) return;

        // ローカル座標系での値を取得
        if (this.editingTools && this.editingTools.useLocalSpace) {
            const position = this.penContainer.position;
            const rotation = this.penContainer.rotation;
            const scaling = this.penContainer.scaling;

            const rotDegrees = {
                x: BABYLON.Tools.ToDegrees(rotation.x),
                y: BABYLON.Tools.ToDegrees(rotation.y),
                z: BABYLON.Tools.ToDegrees(rotation.z)
            };

            this.transformInputs.position.x.value = position.x.toFixed(3);
            this.transformInputs.position.y.value = position.y.toFixed(3);
            this.transformInputs.position.z.value = position.z.toFixed(3);

            this.transformInputs.rotation.x.value = rotDegrees.x.toFixed(1);
            this.transformInputs.rotation.y.value = rotDegrees.y.toFixed(1);
            this.transformInputs.rotation.z.value = rotDegrees.z.toFixed(1);

            this.transformInputs.scale.x.value = scaling.x.toFixed(2);
            this.transformInputs.scale.y.value = scaling.y.toFixed(2);
            this.transformInputs.scale.z.value = scaling.z.toFixed(2);
        } 
        // グローバル座標系での値を取得（ワールド変換行列から計算）
        else if (this.transformInputs) {
            // メッシュのワールド行列を取得
            const worldMatrix = this.penContainer.getWorldMatrix();
            
            // 位置、回転、スケールを抽出
            const position = new BABYLON.Vector3();
            const rotation = new BABYLON.Vector3();
            const scaling = new BABYLON.Vector3();
            
            worldMatrix.decompose(scaling, undefined, position);
            
            // 回転の抽出（クォータニオンから euler angles へ変換）
            const quaternion = new BABYLON.Quaternion();
            worldMatrix.decompose(undefined, quaternion, undefined);
            const euler = quaternion.toEulerAngles();
            
            // 角度を度数に変換
            const rotDegrees = {
                x: BABYLON.Tools.ToDegrees(euler.x),
                y: BABYLON.Tools.ToDegrees(euler.y),
                z: BABYLON.Tools.ToDegrees(euler.z)
            };
            
            this.transformInputs.position.x.value = position.x.toFixed(3);
            this.transformInputs.position.y.value = position.y.toFixed(3);
            this.transformInputs.position.z.value = position.z.toFixed(3);

            this.transformInputs.rotation.x.value = rotDegrees.x.toFixed(1);
            this.transformInputs.rotation.y.value = rotDegrees.y.toFixed(1);
            this.transformInputs.rotation.z.value = rotDegrees.z.toFixed(1);

            this.transformInputs.scale.x.value = scaling.x.toFixed(2);
            this.transformInputs.scale.y.value = scaling.y.toFixed(2);
            this.transformInputs.scale.z.value = scaling.z.toFixed(2);
        }
    }

    // インスペクタからトランスフォーム値を反映
    updateTransformFromInspector() {
        if (!this.penContainer || !this.transformInputs) return;
        
        const position = new BABYLON.Vector3(
            parseFloat(this.transformInputs.position.x.value) || 0,
            parseFloat(this.transformInputs.position.y.value) || 0,
            parseFloat(this.transformInputs.position.z.value) || 0
        );

        const rotation = new BABYLON.Vector3(
            BABYLON.Tools.ToRadians(parseFloat(this.transformInputs.rotation.x.value) || 0),
            BABYLON.Tools.ToRadians(parseFloat(this.transformInputs.rotation.y.value) || 0),
            BABYLON.Tools.ToRadians(parseFloat(this.transformInputs.rotation.z.value) || 0)
        );

        const scaling = new BABYLON.Vector3(
            parseFloat(this.transformInputs.scale.x.value) || 1,
            parseFloat(this.transformInputs.scale.y.value) || 1,
            parseFloat(this.transformInputs.scale.z.value) || 1
        );

        this.penContainer.position = position;
        this.penContainer.rotation = rotation;
        this.penContainer.scaling = scaling;
    }

    // トリムを適用する
    applyTrim() {
        if (!this.editingTools || !this.editingTools.isTrimMode || !this.penData) return;
        
        try {
            // トリミング前の状態を履歴に保存（実装されている場合）
            if (typeof this.addToHistory === 'function' && typeof this.createHistoryState === 'function') {
                this.addToHistory(this.createHistoryState());
            }
            
            // トリム前に現在のトランスフォームをデータに適用する
            this.applyTransformationsToData();
            
            const trimBounds = this.editingTools.getTrimBounds();
            if (!trimBounds) return;

            // トリムボックスの位置、回転、スケールから境界ボックスを計算
            const boxCenter = trimBounds.position;
            const boxSize = new BABYLON.Vector3(
                1 * trimBounds.scaling.x,
                1 * trimBounds.scaling.y,
                1 * trimBounds.scaling.z
            );
            
            // トリム境界の最小値と最大値を計算
            const min = boxCenter.subtract(boxSize.scale(0.5));
            const max = boxCenter.add(boxSize.scale(0.5));

            // トリム処理を実行
            const newStrokeData = [];
            this.penData.exportedData.forEach(stroke => {
                if (!stroke.positions || stroke.positions.length < 3) {
                    newStrokeData.push(stroke);
                    return;
                }

                // ストロークの各点をチェックし、トリム領域内のポイントのみを保持
                const newPositions = [];
                for (let i = 0; i < stroke.positions.length; i += 3) {
                    const point = new BABYLON.Vector3(
                        stroke.positions[i],
                        stroke.positions[i + 1],
                        stroke.positions[i + 2]
                    );
                    
                    // 回転を考慮したトリム判定をここで行う
                    // トリムボックスのローカル座標系に変換
                    const rotationMatrix = BABYLON.Matrix.RotationYawPitchRoll(
                        trimBounds.rotation.y,
                        trimBounds.rotation.x,
                        trimBounds.rotation.z
                    );
                    
                    // 点をトリムボックスの中心を基準に移動
                    const centeredPoint = point.subtract(boxCenter);
                    
                    // 回転の逆行列を適用してローカル座標系に変換
                    const inverseRotation = rotationMatrix.clone().invert();
                    const localPoint = BABYLON.Vector3.TransformCoordinates(centeredPoint, inverseRotation);
                    
                    // ローカル座標系での判定
                    if (
                        Math.abs(localPoint.x) <= boxSize.x / 2 &&
                        Math.abs(localPoint.y) <= boxSize.y / 2 &&
                        Math.abs(localPoint.z) <= boxSize.z / 2
                    ) {
                        newPositions.push(point.x, point.y, point.z);
                    }
                }
                
                // 新しいストロークデータを作成
                if (newPositions.length >= 6) { // 少なくとも2点以上あれば有効なストローク
                    newStrokeData.push({
                        positions: newPositions,
                        color: stroke.color,
                        width: stroke.width || 0.01
                    });
                }
            });

            // トリムされたデータに更新
            this.penData.exportedData = newStrokeData;
            this.penData.trimmedTimestamp = new Date().toISOString();

            // トリムボックスをクリア
            if (this.editingTools.clearTrimBox) {
                this.editingTools.clearTrimBox();
            }
            
            // シーンを再描画
            this.clearScene();
            this.renderPenData();
            
            // 操作モードを移動に戻す
            this.setTool('position');
            
            // トリム完了メッセージ
            if (this.fileInfo) {
                this.fileInfo.textContent = `Trim completed (${new Date().toLocaleTimeString()})`;
            }
        } catch (error) {
            console.error('Error applying trim:', error);
            if (this.fileInfo) {
                this.fileInfo.textContent = `Error applying trim: ${error.message}`;
            }
        }
    }

    // トリムをキャンセル
    cancelTrim() {
        if (!this.editingTools) return;
        
        // トリムモードを終了
        if (this.editingTools.clearTrimBox) {
            this.editingTools.clearTrimBox();
        }
        
        // 操作モードを移動に戻す
        this.setTool('position');
    }

    // JSONとして保存
    saveJson() {
        if (!this.penData) {
            console.error('No pen data to save');
            if (this.fileInfo) {
                this.fileInfo.textContent = 'Error: No data to save';
            }
            return;
        }

        try {
            // 保存前に現在のトランスフォームをデータに適用
            this.applyTransformationsToData();
            
            // JSONデータを生成
            const jsonString = JSON.stringify(this.penData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            // ダウンロードリンクを作成して自動クリック
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = this.penData.fileName || `qvpen_export_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            // URLを解放
            URL.revokeObjectURL(url);
            
            // 保存完了メッセージ
            if (this.fileInfo) {
                this.fileInfo.textContent = `File saved as ${downloadLink.download}`;
            }
        } catch (error) {
            console.error('Error saving JSON:', error);
            if (this.fileInfo) {
                this.fileInfo.textContent = `Error saving JSON: ${error.message}`;
            }
        }
    }

    // 座標系の切り替え
    toggleCoordinateSystem() {
        if (!this.editingTools) return;
        
        // EditingToolsクラスのtoggleCoordinateSystemメソッドを呼び出す
        if (typeof this.editingTools.toggleCoordinateSystem === 'function') {
            this.editingTools.toggleCoordinateSystem();
            
            // ボタンのテキストを更新
            const coordToggleBtn = document.getElementById('coordinateToggleBtn');
            if (coordToggleBtn && typeof this.editingTools.useLocalSpace !== 'undefined') {
                coordToggleBtn.innerHTML = this.editingTools.useLocalSpace ? 
                    '<i class="fas fa-cube"></i> ローカル座標系' : 
                    '<i class="fas fa-globe"></i> グローバル座標系';
            }
        }
    }

    // データにトランスフォーメーションを適用
    applyTransformationsToData() {
        if (!this.penContainer || !this.penData || !this.penData.exportedData) return;

        // 現在のトランスフォームが単位行列に近い場合は何もしない
        const transform = {
            position: this.penContainer.position.clone(),
            rotation: this.penContainer.rotation.clone(),
            scaling: this.penContainer.scaling.clone()
        };

        // 単位行列からの差異が十分小さい場合は何もしない
        if (transform.position.length() < 0.001 && 
            Math.abs(transform.rotation.x) < 0.001 && 
            Math.abs(transform.rotation.y) < 0.001 && 
            Math.abs(transform.rotation.z) < 0.001 &&
            Math.abs(transform.scaling.x - 1.0) < 0.001 && 
            Math.abs(transform.scaling.y - 1.0) < 0.001 && 
            Math.abs(transform.scaling.z - 1.0) < 0.001) {
            return;
        }

        // 履歴に追加
        if (typeof this.addToHistory === 'function' && typeof this.createHistoryState === 'function') {
            this.addToHistory(this.createHistoryState());
        }

        // 各ストロークの頂点にトランスフォームを適用
        this.penData.exportedData.forEach(stroke => {
            if (!stroke.positions || stroke.positions.length < 3) return;

            const points = [];
            for (let i = 0; i < stroke.positions.length; i += 3) {
                points.push(new BABYLON.Vector3(
                    stroke.positions[i],
                    stroke.positions[i + 1],
                    stroke.positions[i + 2]
                ));
            }

            // トランスフォーム行列を作成
            const matrix = BABYLON.Matrix.Compose(
                transform.scaling,
                BABYLON.Quaternion.RotationYawPitchRoll(
                    transform.rotation.y,
                    transform.rotation.x,
                    transform.rotation.z
                ),
                transform.position
            );

            // 各点に行列を適用
            for (let i = 0; i < points.length; i++) {
                const transformedPoint = BABYLON.Vector3.TransformCoordinates(points[i], matrix);
                stroke.positions[i * 3] = transformedPoint.x;
                stroke.positions[i * 3 + 1] = transformedPoint.y;
                stroke.positions[i * 3 + 2] = transformedPoint.z;
            }
        });

        // トランスフォームをリセット
        this.penContainer.position = new BABYLON.Vector3(0, 0, 0);
        this.penContainer.rotation = new BABYLON.Vector3(0, 0, 0);
        this.penContainer.scaling = new BABYLON.Vector3(1, 1, 1);
        
        // トランスフォーム値の表示を更新
        this.updateTransformInspectorValues();
    }

    // 履歴状態を作成
    createHistoryState() {
        if (!this.penData) return null;

        return {
            penData: JSON.parse(JSON.stringify(this.penData)),
            transform: this.penContainer ? {
                position: this.penContainer.position.clone(),
                rotation: this.penContainer.rotation.clone(),
                scaling: this.penContainer.scaling.clone()
            } : null
        };
    }

    // 履歴に追加
    addToHistory(state) {
        if (!state) return;
        
        // 直前の状態と同じなら追加しない
        if (this.lastHistoryState && 
            JSON.stringify(state) === JSON.stringify(this.lastHistoryState)) {
            return;
        }

        this.historyStack.push(state);
        this.lastHistoryState = state;

        // 履歴が多すぎる場合は古いものを削除
        if (this.historyStack.length > this.maxHistoryLength) {
            this.historyStack.shift();
        }

        // やり直しスタックをクリア
        this.redoStack = [];
    }

    // 元に戻す
    undo() {
        if (this.isWelcomeState || this.isLoading) return;
        if (this.historyStack.length === 0) {
            if (this.fileInfo) {
                this.fileInfo.textContent = '元に戻す履歴がありません';
            }
            return;
        }

        // 現在の状態をやり直しスタックに追加
        const currentState = this.createHistoryState();
        this.redoStack.push(currentState);

        // 履歴スタックから前の状態を取得
        const previousState = this.historyStack.pop();
        this.lastHistoryState = this.historyStack.length > 0 ? 
            this.historyStack[this.historyStack.length - 1] : null;

        // 状態を復元
        this.restoreFromHistoryState(previousState);
    }

    // やり直し
    redo() {
        if (this.isWelcomeState || this.isLoading) return;
        if (this.redoStack.length === 0) {
            if (this.fileInfo) {
                this.fileInfo.textContent = 'やり直す操作がありません';
            }
            return;
        }

        // 現在の状態を履歴スタックに追加
        const currentState = this.createHistoryState();
        this.historyStack.push(currentState);

        // やり直しスタックから次の状態を取得
        const nextState = this.redoStack.pop();
        this.lastHistoryState = currentState;

        // 状態を復元
        this.restoreFromHistoryState(nextState);
    }

    // 履歴から状態を復元
    restoreFromHistoryState(state) {
        if (!state) return;

        // 現在のカメラ位置を保存
        const currentCamera = {
            alpha: this.camera.alpha,
            beta: this.camera.beta,
            radius: this.camera.radius,
            target: this.camera.target.clone()
        };

        // 状態を復元
        this.penData = state.penData;
        
        // シーンをクリアして再描画
        this.clearScene();
        this.renderPenData();
        
        // トランスフォームを復元
        if (state.transform && this.penContainer) {
            this.penContainer.position = state.transform.position.clone();
            this.penContainer.rotation = state.transform.rotation.clone();
            this.penContainer.scaling = state.transform.scaling.clone();
            
            // トランスフォーム値表示を更新
            this.updateTransformInspectorValues();
            
            // 現在アクティブなツールのギズモを再アタッチ
            if (this.editingTools && this.editingTools.currentGizmo) {
                this.editingTools.currentGizmo.attachedMesh = this.penContainer;
            }
        }

        // カメラ位置を復元
        this.camera.alpha = currentCamera.alpha;
        this.camera.beta = currentCamera.beta;
        this.camera.radius = currentCamera.radius;
        this.camera.setTarget(currentCamera.target);

        // 状態復元メッセージ
        if (this.fileInfo) {
            this.fileInfo.textContent = `状態を復元しました (${new Date().toLocaleTimeString()})`;
        }
    }

    // 保存された表示設定を読み込む
    loadDisplaySettings() {
        // localStorageから表示設定を読み込む
        const savedShowGrid = localStorage.getItem('qvpen-showGrid');
        const savedBackgroundColor = localStorage.getItem('qvpen-backgroundColor');
        
        // グリッド表示設定を適用
        if (savedShowGrid !== null) {
            CONFIG.showGrid = savedShowGrid === 'true';
        }
        
        // 背景色は別のメソッドで適用
        if (savedBackgroundColor) {
            this.savedBackgroundColor = savedBackgroundColor;
        }
    }
    
    // 背景色を適用する
    applyBackgroundColor() {
        if (this.savedBackgroundColor) {
            // 色のRGB値を0〜1の範囲に変換して適用
            const r = parseInt(this.savedBackgroundColor.substring(1, 3), 16) / 255;
            const g = parseInt(this.savedBackgroundColor.substring(3, 5), 16) / 255;
            const b = parseInt(this.savedBackgroundColor.substring(5, 7), 16) / 255;
            this.scene.clearColor = new BABYLON.Color4(r, g, b, 1.0);
        }
    }
}