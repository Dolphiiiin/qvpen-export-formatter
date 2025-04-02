import { CONFIG } from '../config/config.js';

export class EditingTools {
    constructor(scene, utilityLayer, onTransformChanged) {
        this.scene = scene;
        this.utilityLayer = utilityLayer;
        this.onTransformChanged = onTransformChanged;
        this.currentGizmo = null;
        this.isPivotMode = false;
        this.trimBox = null;
        this.trimBoxGizmo = null;
        this.isTrimMode = false;
        this.trimKeyObservable = null;
        this.useLocalSpace = CONFIG.editing.useLocalSpace; // ローカル/グローバル軸モードの状態

        this.initializeTools();
    }

    initializeTools() {
        this.setupGizmos();
        this.setupPointerBehavior();
        
        if (CONFIG.editing.snapToGrid) {
            this.setupSnapping();
        }
        
        this.setupDragBehaviors();
        this.setupKeyboardShortcuts();
    }

    setupGizmos() {
        // Position gizmo setup
        this.positionGizmo = new BABYLON.PositionGizmo(this.utilityLayer);
        this.positionGizmo.scaleRatio = CONFIG.editing.gizmoSize;
        this.positionGizmo.updateGizmoRotationToMatchAttachedMesh = this.useLocalSpace;
        this.positionGizmo.updateGizmoPositionToMatchAttachedMesh = true;
        
        // 平面移動ギズモを有効化
        if (this.positionGizmo.xGizmo) this.positionGizmo.xGizmo.planeBehavior = true;
        if (this.positionGizmo.yGizmo) this.positionGizmo.yGizmo.planeBehavior = true;
        if (this.positionGizmo.zGizmo) this.positionGizmo.zGizmo.planeBehavior = true;

        // Rotation gizmo setup
        this.rotationGizmo = new BABYLON.RotationGizmo(this.utilityLayer);
        this.rotationGizmo.scaleRatio = CONFIG.editing.gizmoSize * 1.5;
        this.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = this.useLocalSpace;
        this.rotationGizmo.updateGizmoPositionToMatchAttachedMesh = true;

        // Scale gizmo setup
        this.scaleGizmo = new BABYLON.ScaleGizmo(this.utilityLayer);
        this.scaleGizmo.scaleRatio = CONFIG.editing.gizmoSize;
        this.scaleGizmo.updateGizmoRotationToMatchAttachedMesh = this.useLocalSpace;
        this.scaleGizmo.updateGizmoPositionToMatchAttachedMesh = true;

        // ユニフォームスケールを有効化
        if (this.scaleGizmo.uniformScaleGizmo) {
            this.scaleGizmo.uniformScaleGizmo.isEnabled = true;
            this.scaleGizmo.uniformScaleGizmo.sensitivity = 0.5;
        }

        // Setup colors after gizmos are fully initialized
        this.setupGizmoColors();

        // Hide all gizmos initially
        this.hideAllGizmos();
    }

    setupGizmoColors() {
        // Position gizmo colors
        if (this.positionGizmo.xGizmo && this.positionGizmo.xGizmo.coloredMaterial) {
            this.positionGizmo.xGizmo.coloredMaterial.diffuseColor = new BABYLON.Color3(1, 0.2, 0.2);
            if (this.positionGizmo.xGizmo.dragBehavior && this.positionGizmo.xGizmo.dragBehavior.dragAxis) {
                this.positionGizmo.xGizmo.dragBehavior.dragAxis.material.lineWidth = 3;
            }
        }
        if (this.positionGizmo.yGizmo && this.positionGizmo.yGizmo.coloredMaterial) {
            this.positionGizmo.yGizmo.coloredMaterial.diffuseColor = new BABYLON.Color3(0.2, 1, 0.2);
            if (this.positionGizmo.yGizmo.dragBehavior && this.positionGizmo.yGizmo.dragBehavior.dragAxis) {
                this.positionGizmo.yGizmo.dragBehavior.dragAxis.material.lineWidth = 3;
            }
        }
        if (this.positionGizmo.zGizmo && this.positionGizmo.zGizmo.coloredMaterial) {
            this.positionGizmo.zGizmo.coloredMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.2, 1);
            if (this.positionGizmo.zGizmo.dragBehavior && this.positionGizmo.zGizmo.dragBehavior.dragAxis) {
                this.positionGizmo.zGizmo.dragBehavior.dragAxis.material.lineWidth = 3;
            }
        }

        // Rotation gizmo colors
        if (this.rotationGizmo.xGizmo && this.rotationGizmo.xGizmo.coloredMaterial) {
            this.rotationGizmo.xGizmo.coloredMaterial.diffuseColor = new BABYLON.Color3(1, 0, 0.4);
            this.rotationGizmo.xGizmo.coloredMaterial.alpha = 0.7;
        }
        if (this.rotationGizmo.yGizmo && this.rotationGizmo.yGizmo.coloredMaterial) {
            this.rotationGizmo.yGizmo.coloredMaterial.diffuseColor = new BABYLON.Color3(0.4, 1, 0);
            this.rotationGizmo.yGizmo.coloredMaterial.alpha = 0.7;
        }
        if (this.rotationGizmo.zGizmo && this.rotationGizmo.zGizmo.coloredMaterial) {
            this.rotationGizmo.zGizmo.coloredMaterial.diffuseColor = new BABYLON.Color3(0, 0.7, 1);
            this.rotationGizmo.zGizmo.coloredMaterial.alpha = 0.7;
        }

        // Scale gizmo colors
        if (this.scaleGizmo.xGizmo && this.scaleGizmo.xGizmo.coloredMaterial) {
            this.scaleGizmo.xGizmo.coloredMaterial.diffuseColor = new BABYLON.Color3(1, 0.2, 0.2);
        }
        if (this.scaleGizmo.yGizmo && this.scaleGizmo.yGizmo.coloredMaterial) {
            this.scaleGizmo.yGizmo.coloredMaterial.diffuseColor = new BABYLON.Color3(0.2, 1, 0.2);
        }
        if (this.scaleGizmo.zGizmo && this.scaleGizmo.zGizmo.coloredMaterial) {
            this.scaleGizmo.zGizmo.coloredMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.2, 1);
        }
        
        if (this.scaleGizmo.uniformScaleGizmo) {
            if (this.scaleGizmo.uniformScaleGizmo.coloredMaterial) {
                this.scaleGizmo.uniformScaleGizmo.coloredMaterial.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.8);
            }
            this.scaleGizmo.uniformScaleGizmo.hoverColor = new BABYLON.Color3(1, 1, 1);
        }
    }

    setupPointerBehavior() {
        this.pointerDragBehavior = new BABYLON.PointerDragBehavior({
            dragPlaneNormal: BABYLON.Vector3.Up()
        });
        this.pointerDragBehavior.moveAttached = true;
        this.pointerDragBehavior.useObjectOrientationForDragging = true;
    }

    setupSnapping() {
        const snapValue = CONFIG.editing.snapIncrement;
        const rotationSnap = Math.PI / 12;

        [this.positionGizmo, this.rotationGizmo, this.scaleGizmo].forEach(gizmo => {
            if (!gizmo) return;

            ['x', 'y', 'z'].forEach(axis => {
                if (gizmo[axis + 'Gizmo']) {
                    gizmo[axis + 'Gizmo'].snapDistance = 
                        gizmo === this.rotationGizmo ? rotationSnap : snapValue;
                }
            });
        });

        if (this.scaleGizmo.uniformScaleGizmo) {
            this.scaleGizmo.uniformScaleGizmo.snapDistance = 0.1;
        }
    }

    setupDragBehaviors() {
        const dragStartColor = new BABYLON.Color3(1, 1, 0);
        const dragEndColor = new BABYLON.Color3(1, 1, 1);

        const setupGizmoDragBehavior = (gizmo) => {
            ['x', 'y', 'z'].forEach(axis => {
                const axisGizmo = gizmo[axis + 'Gizmo'];
                if (!axisGizmo || !axisGizmo.dragBehavior) return;

                axisGizmo.dragBehavior.onDragStartObservable.add(() => {
                    axisGizmo.coloredMaterial.emissiveColor = dragStartColor;
                    this.onTransformChanged?.('start');
                });

                axisGizmo.dragBehavior.onDragObservable.add(() => {
                    this.onTransformChanged?.('update');
                });

                axisGizmo.dragBehavior.onDragEndObservable.add(() => {
                    axisGizmo.coloredMaterial.emissiveColor = dragEndColor;
                    this.onTransformChanged?.('end');
                });
            });
        };

        setupGizmoDragBehavior(this.positionGizmo);
        setupGizmoDragBehavior(this.rotationGizmo);
        setupGizmoDragBehavior(this.scaleGizmo);
        
        // ユニフォームスケール用のドラッグ挙動も設定
        if (this.scaleGizmo.uniformScaleGizmo && this.scaleGizmo.uniformScaleGizmo.dragBehavior) {
            this.scaleGizmo.uniformScaleGizmo.dragBehavior.onDragStartObservable.add(() => {
                this.onTransformChanged?.('start');
            });
            
            this.scaleGizmo.uniformScaleGizmo.dragBehavior.onDragObservable.add(() => {
                this.onTransformChanged?.('update');
            });
            
            this.scaleGizmo.uniformScaleGizmo.dragBehavior.onDragEndObservable.add(() => {
                this.onTransformChanged?.('end');
            });
        }
    }

    setupKeyboardShortcuts() {
        this.scene.onKeyboardObservable.add((kbInfo) => {
            if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
                if (!this.isTrimMode) {
                    switch (kbInfo.event.key.toLowerCase()) {
                        case 'w': this.setActiveGizmo('position'); break;
                        case 'e': this.setActiveGizmo('rotation'); break;
                        case 'r': this.setActiveGizmo('scale'); break;
                        case 't': this.startTrimMode(); break;
                        case ' ': this.togglePivotMode(); break;
                        case 'l': this.toggleCoordinateSystem(); break; // ローカル/グローバル軸の切り替えをLキーに割り当て
                    }
                } else {
                    switch (kbInfo.event.key.toLowerCase()) {
                        case 'enter': this.applyTrim(); break;
                        case 'escape': this.cancelTrim(); break;
                    }
                }
            }
        });
    }

    // ローカル/グローバル座標系の切り替えメソッド
    toggleCoordinateSystem() {
        if (!this.currentGizmo || !this.currentGizmo.attachedMesh) return;
        
        this.useLocalSpace = !this.useLocalSpace;
        
        // 全てのギズモの座標系を更新
        [this.positionGizmo, this.rotationGizmo, this.scaleGizmo].forEach(gizmo => {
            if (gizmo) {
                gizmo.updateGizmoRotationToMatchAttachedMesh = this.useLocalSpace;
            }
        });
        
        // UIに表示するメッセージ
        const statusMessage = this.useLocalSpace ? "ローカル軸モード" : "グローバル軸モード";
        if (this.onTransformChanged) {
            this.onTransformChanged('message', statusMessage);
        }
        
        // 設定を更新（オプション）
        CONFIG.editing.useLocalSpace = this.useLocalSpace;
    }

    setActiveGizmo(type, mesh = null) {
        // トリムモード中は他のツールに切り替えない
        if (this.isTrimMode && type !== 'trim') {
            this.clearTrimBox();  // トリムモードを終了してからツール切り替え
        }

        this.hideAllGizmos();
        
        switch (type) {
            case 'position':
                this.currentGizmo = this.positionGizmo;
                break;
            case 'rotation':
                this.currentGizmo = this.rotationGizmo;
                break;
            case 'scale':
                this.currentGizmo = this.scaleGizmo;
                break;
            case 'trim':
                this.startTrimMode();
                return;  // トリムモード時は他のギズモをアタッチしない
        }

        if (this.currentGizmo && mesh) {
            this.currentGizmo.attachedMesh = mesh;
        }
    }

    hideAllGizmos() {
        this.positionGizmo.attachedMesh = null;
        this.rotationGizmo.attachedMesh = null;
        this.scaleGizmo.attachedMesh = null;
        this.currentGizmo = null;
    }

    togglePivotMode() {
        if (!this.currentGizmo || !this.currentGizmo.attachedMesh) return;
        
        this.isPivotMode = !this.isPivotMode;
        this.currentGizmo.updateGizmoPositionToMatchAttachedMesh = this.isPivotMode;
        
        if (!this.isPivotMode) {
            const mesh = this.currentGizmo.attachedMesh;
            const boundingInfo = mesh.getHierarchyBoundingVectors(true);
            if (boundingInfo) {
                const center = boundingInfo.min.add(boundingInfo.max).scale(0.5);
                this.currentGizmo.setCustomMeshPosition(center);
            }
        }
    }

    startTrimMode() {
        // ギズモを非表示にするのではなく、トリムモードを開始
        if (this.currentGizmo) {
            this.currentGizmo.attachedMesh = null;
        }
        this.isTrimMode = true;
        this.createTrimBox();

        // トリム範囲入力フィールドを表示
        const trimInputs = document.getElementById('trimRangeInputs');
        if (trimInputs) {
            trimInputs.style.display = 'block';
        }

        // トリムボタンを表示
        document.getElementById('applyTrimBtn').style.display = 'inline-block';
        document.getElementById('cancelTrimBtn').style.display = 'inline-block';
    }

    createTrimBox(mesh) {
        if (this.trimBox) {
            this.clearTrimBox();  // 既存のトリムボックスがある場合は削除
        }

        let trimSize = new BABYLON.Vector3(1, 1, 1);
        
        if (mesh) {
            const boundingInfo = mesh.getHierarchyBoundingVectors(true);
            if (boundingInfo && boundingInfo.min && boundingInfo.max) {
                const dimensions = boundingInfo.max.subtract(boundingInfo.min);
                trimSize = dimensions.scale(0.8); // 均一なスケーリングを使用せず、元のアスペクト比を維持
            }
        }
        
        this.trimBox = BABYLON.MeshBuilder.CreateBox("trimBox", {
            width: trimSize.x,
            height: trimSize.y,
            depth: trimSize.z
        }, this.scene);
        
        const trimMaterial = new BABYLON.StandardMaterial("trimMaterial", this.scene);
        trimMaterial.diffuseColor = new BABYLON.Color3(
            CONFIG.editing.trimColor.r,
            CONFIG.editing.trimColor.g,
            CONFIG.editing.trimColor.b
        );
        trimMaterial.alpha = CONFIG.editing.trimColor.a;
        trimMaterial.wireframe = false;
        trimMaterial.backFaceCulling = false;
        
        this.trimBox.material = trimMaterial;
        this.trimBox.renderingGroupId = 1;
        
        this.trimBoxGizmo = new BABYLON.BoundingBoxGizmo(
            new BABYLON.Color3(1, 0, 0),
            this.utilityLayer
        );
        this.trimBoxGizmo.attachedMesh = this.trimBox;
        // クリックできる制御点のサイズを0.1から0.05に変更（より小さく）
        this.trimBoxGizmo.scaleBoxSize = 0.05;
        
        // スケーリングの制限を解除（均一スケーリングを使用しない）
        this.trimBoxGizmo.onScaleBoxDragObservable.clear();  // 既存のスケール制限を解除
        
        // トリムボックス変形時の操作を履歴に記録するためのイベント設定
        this.trimBoxGizmo.onRotationSphereDragObservable.add((event) => {
            this.onTransformChanged?.('update');
            this.updateTrimInputFields(); // 数値入力フィールドを更新
        });
        
        this.trimBoxGizmo.onScaleBoxDragObservable.add((event) => {
            this.onTransformChanged?.('update');
            this.updateTrimInputFields(); // 数値入力フィールドを更新
        });
        
        // 移動ギズモでも操作可能に
        this.positionGizmo.attachedMesh = this.trimBox;
        this.positionGizmo.onDragStartObservable.add(() => {
            this.onTransformChanged?.('start');
        });
        
        this.positionGizmo.onDragEndObservable.add(() => {
            this.onTransformChanged?.('end');
            this.updateTrimInputFields(); // 数値入力フィールドを更新
        });

        this.setupTrimKeyboardControls();
        this.setupTrimInputListeners();
        this.updateTrimInputFields(); // 初期値を設定
    }
    
    // トリム範囲の数値入力フィールドの値を更新
    updateTrimInputFields() {
        if (!this.trimBox) return;
        
        // 位置と拡大縮小の値を数値入力フィールドに反映
        const posX = document.getElementById('trimPosX');
        const posY = document.getElementById('trimPosY');
        const posZ = document.getElementById('trimPosZ');
        const sizeX = document.getElementById('trimSizeX');
        const sizeY = document.getElementById('trimSizeY');
        const sizeZ = document.getElementById('trimSizeZ');
        
        if (posX && posY && posZ) {
            posX.value = this.trimBox.position.x.toFixed(2);
            posY.value = this.trimBox.position.y.toFixed(2);
            posZ.value = this.trimBox.position.z.toFixed(2);
        }
        
        if (sizeX && sizeY && sizeZ) {
            sizeX.value = this.trimBox.scaling.x.toFixed(2);
            sizeY.value = this.trimBox.scaling.y.toFixed(2);
            sizeZ.value = this.trimBox.scaling.z.toFixed(2);
        }
    }
    
    // トリム範囲の数値入力フィールドのイベントリスナーを設定
    setupTrimInputListeners() {
        const posX = document.getElementById('trimPosX');
        const posY = document.getElementById('trimPosY');
        const posZ = document.getElementById('trimPosZ');
        const sizeX = document.getElementById('trimSizeX');
        const sizeY = document.getElementById('trimSizeY');
        const sizeZ = document.getElementById('trimSizeZ');
        
        const updateTrimBoxFromInput = () => {
            if (!this.trimBox) return;
            
            // 位置の更新
            if (posX && posY && posZ) {
                this.trimBox.position.x = parseFloat(posX.value) || 0;
                this.trimBox.position.y = parseFloat(posY.value) || 0;
                this.trimBox.position.z = parseFloat(posZ.value) || 0;
            }
            
            // サイズの更新
            if (sizeX && sizeY && sizeZ) {
                this.trimBox.scaling.x = Math.max(0.1, parseFloat(sizeX.value) || 1);
                this.trimBox.scaling.y = Math.max(0.1, parseFloat(sizeY.value) || 1);
                this.trimBox.scaling.z = Math.max(0.1, parseFloat(sizeZ.value) || 1);
            }
            
            this.onTransformChanged?.('update');
        };
        
        // 各入力フィールドに変更イベントリスナーを追加
        [posX, posY, posZ, sizeX, sizeY, sizeZ].forEach(input => {
            if (input) {
                input.addEventListener('change', updateTrimBoxFromInput);
                input.addEventListener('input', updateTrimBoxFromInput);
            }
        });
    }
    
    clearTrimBox() {
        if (!this.trimBox) return;
        
        // 移動ギズモをトリムボックスから切り離す
        if (this.positionGizmo && this.positionGizmo.attachedMesh === this.trimBox) {
            this.positionGizmo.attachedMesh = null;
        }
        
        if (this.trimBoxGizmo) {
            this.trimBoxGizmo.dispose();
            this.trimBoxGizmo = null;
        }
        
        this.trimBox.dispose();
        this.trimBox = null;
        
        if (this.trimKeyObservable) {
            this.scene.onKeyboardObservable.remove(this.trimKeyObservable);
            this.trimKeyObservable = null;
        }
        
        this.isTrimMode = false;
        
        // UI要素を非表示に
        const trimInputs = document.getElementById('trimRangeInputs');
        if (trimInputs) {
            trimInputs.style.display = 'none';
        }
        
        // トリムボタンを非表示
        document.getElementById('applyTrimBtn').style.display = 'none';
        document.getElementById('cancelTrimBtn').style.display = 'none';
    }

    cancelTrim() {
        this.clearTrimBox();
        this.setActiveGizmo('position');
    }

    applyTrim() {
        // トリミングの確認ダイアログを表示
        if (confirm('選択した範囲で描画データをトリミングしますか？\n※現在のトランスフォーム（位置・回転・拡大縮小）が適用されたデータに対してトリミングが行われます')) {
            // 親クラスのapplyTrimメソッドが呼び出される
            if (this.getTrimBounds()) {
                // トリムの適用後、トリムモードを終了
                this.clearTrimBox();
                this.setActiveGizmo('position');  // デフォルトツールに戻る
            }
        }
        // キャンセルの場合は何もしない（トリムモードは継続）
    }

    // このメソッドは外部から呼び出され、実際のトリミング処理を実行します
    getTrimBounds() {
        if (!this.trimBox) return null;

        return {
            position: this.trimBox.position.clone(),
            rotation: this.trimBox.rotation.clone(),
            scaling: this.trimBox.scaling.clone()
        };
    }

    dispose() {
        this.hideAllGizmos();
        this.clearTrimBox();
        
        this.positionGizmo?.dispose();
        this.rotationGizmo?.dispose();
        this.scaleGizmo?.dispose();
        this.trimBoxGizmo?.dispose();  // trimBoxGizmoの破棄を追加
        
        if (this.trimKeyObservable) {
            this.scene.onKeyboardObservable.remove(this.trimKeyObservable);
        }
    }
}