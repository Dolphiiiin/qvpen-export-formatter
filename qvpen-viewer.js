import { QvPenViewer } from './src/core/QvPenViewer.js';

// グローバル変数としてviewerを宣言
let viewer;

// データをロードする関数をグローバルにエクスポート
window.loadQvPenData = function(jsonData) {
    if (!viewer) {
        console.error('Viewer not initialized');
        return;
    }
    
    try {
        // エクスポートされたデータの場合とJSONファイルの場合で処理を分ける
        if (jsonData.exportedData && Array.isArray(jsonData.exportedData)) {
            // ログからエクスポートされたデータの形式
            viewer.loadData(jsonData.exportedData);
        } else {
            // 通常のJSONファイルの形式
            viewer.loadData(jsonData);
        }
    } catch (e) {
        console.error('Error loading data:', e);
    }
};

// Wait for DOM to load
window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('renderCanvas');
    if (!canvas) {
        console.error('Canvas element not found!');
        return;
    }

    // Initialize QvPen viewer
    viewer = new QvPenViewer(canvas);
    
    // JSONファイル直接読み込み処理
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const jsonData = JSON.parse(e.target.result);
                window.loadQvPenData(jsonData);
                document.getElementById('fileInfo').textContent = `読み込み完了: ${file.name}`;
            } catch (error) {
                console.error('Error parsing JSON:', error);
                document.getElementById('fileInfo').textContent = 'JSONの解析に失敗しました';
            }
        };
        reader.readAsText(file);
    });
    
    // デフォルトファイル読み込み
    document.getElementById('loadDefault').addEventListener('click', () => {
        fetch('payapaya_azarashi.json')
            .then(response => response.json())
            .then(data => {
                window.loadQvPenData(data);
                document.getElementById('fileInfo').textContent = '読み込み完了: payapaya_azarashi.json (デフォルト)';
            })
            .catch(error => {
                console.error('Error loading default file:', error);
                document.getElementById('fileInfo').textContent = 'デフォルトファイルの読み込みに失敗しました';
            });
    });
});