/**
 * AIビジュアルページ生成時に渡すデザイン骨格。
 * example.html のデザインシステムを元に抽出。
 * :root のカラー変数だけ楽曲のムードに合わせて Claude が自由に上書きする。
 */
export const VISUAL_DESIGN_SKELETON = `<!-- DESIGN SKELETON: このCSS構造を必ず使うこと。 -->
<style>
  :root {
    --c-main:    #2e7d32;
    --c-light:   #e8f5e9;
    --c-mid:     #43a047;
    --c-accent:  #00c853;
    --kw-blue:   #1565c0;
    --kw-orange: #e65100;
    --badge-a:   #2e7d32;
    --badge-b:   #1565c0;
    --gray-bg:     #f5f5f5;
    --gray-border: #ccc;
    --text:        #212121;
    --sub:         #555;
    --white:       #fff;
  }

  *{box-sizing:border-box;margin:0;padding:0}

  body {
    font-family:'Helvetica Neue','Hiragino Kaku Gothic ProN','Meiryo',sans-serif;
    background:#f0f4f0;color:var(--text);font-size:15px;line-height:1.75;padding-bottom:40px;
  }

  /* PAGE HEADER */
  .page-header {
    background:linear-gradient(135deg,color-mix(in srgb,var(--c-main) 70%,#000) 0%,var(--c-main) 60%,var(--c-mid) 100%);
    color:var(--white);padding:28px 20px 24px;position:relative;overflow:hidden;
  }
  .page-header::after {
    content:'';position:absolute;right:-30px;bottom:-30px;
    width:130px;height:130px;border-radius:50%;background:rgba(255,255,255,0.07);
  }
  .page-header .chapter-label {
    font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:0.75;margin-bottom:6px;
  }
  .page-header h1{font-size:22px;font-weight:700;margin-bottom:8px;}
  .page-header .header-sub{font-size:13px;opacity:0.85;}

  /* SECTION */
  .section{margin:18px 14px 0;background:var(--white);border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.07);}
  .section-header{background:var(--c-main);color:var(--white);padding:14px 18px;display:flex;align-items:center;gap:10px;}
  .section-header h2{font-size:18px;font-weight:700;letter-spacing:0.5px;}
  .section-body{padding:18px 16px;}

  p{margin-bottom:12px;color:var(--text);}

  /* BADGES */
  .badge{font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;letter-spacing:0.5px;}
  .badge-a{background:#a5d6a7;color:#1b5e20;}
  .badge-b{background:#90caf9;color:#0d47a1;}

  /* KEYWORDS */
  .kw      {color:var(--c-main);font-weight:700;}
  .kw-blue {color:var(--kw-blue);font-weight:700;}
  .kw-orange{color:var(--kw-orange);font-weight:700;}

  /* HIGHLIGHT BOX */
  .highlight-box {
    background:var(--c-light);border-left:4px solid var(--c-main);
    border-radius:0 8px 8px 0;padding:13px 15px;margin:14px 0;font-size:14px;
  }
  .highlight-box strong{color:var(--c-main);display:block;margin-bottom:4px;font-size:13px;letter-spacing:0.5px;}

  /* NOTE BOX */
  .note-box {
    background:#fffde7;border:1.5px solid #f9a825;border-radius:10px;
    padding:12px 15px;margin:14px 0;font-size:13.5px;display:flex;align-items:flex-start;gap:10px;
  }
  .note-box .note-icon{font-size:20px;flex-shrink:0;margin-top:1px;}

  /* CARD GRID */
  .card-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0;}
  .card-item{background:var(--gray-bg);border-radius:10px;padding:12px;border:1.5px solid var(--gray-border);}
  .card-item .card-title{font-size:12px;color:var(--sub);margin-bottom:4px;font-weight:600;letter-spacing:0.5px;}
  .card-item .card-value{font-size:14px;font-weight:700;color:var(--c-main);}

  /* FIG LABEL */
  .fig-label {
    background:var(--c-main);color:var(--white);font-size:11.5px;font-weight:700;
    display:inline-block;padding:2px 10px;border-radius:4px;margin-bottom:8px;letter-spacing:0.5px;
  }

  /* DIAGRAM WRAPPER (汎用図表コンテナ) */
  .diagram-wrap {
    background:var(--gray-bg);border:1.5px solid var(--gray-border);
    border-radius:10px;padding:14px 10px;margin:14px 0;overflow-x:auto;
  }
  .diagram-title{font-size:12px;color:var(--sub);margin-bottom:10px;font-weight:600;text-align:center;}

  /* FLOW ROW (汎用フロー) */
  .flow-row{display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;}
  .flow-node {
    border:2px solid var(--c-main);border-radius:50px;background:var(--c-light);
    padding:10px 16px;font-size:13px;font-weight:700;color:var(--c-main);text-align:center;min-width:70px;
  }
  .flow-node.gray{border-color:#888;background:#e0e0e0;color:#333;border-radius:0;}
  .flow-node.circle{border-radius:50%;width:70px;height:70px;display:flex;align-items:center;justify-content:center;line-height:1.3;background:var(--white);}
  .flow-node.store{border-radius:0;border-top:2.5px solid #333;border-bottom:2.5px solid #333;border-left:none;border-right:none;background:var(--white);}
  .flow-arrow{font-size:18px;color:#444;line-height:1;}
  .flow-arrow-down{font-size:18px;color:#444;display:block;text-align:center;}
  .flow-label{font-size:11px;color:var(--c-main);font-weight:600;text-align:center;}

  /* TABLE */
  .data-table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;}
  .data-table th{background:var(--c-main);color:var(--white);padding:8px 10px;font-weight:700;text-align:center;}
  .data-table td{padding:9px 10px;border-bottom:1px solid #e0e0e0;vertical-align:top;}
  .data-table tr:last-child td{border-bottom:none;}

  /* LEGEND BOX */
  .legend-box{background:var(--gray-bg);border:1.5px solid var(--gray-border);border-radius:10px;padding:12px 14px;margin:12px 0;}
  .legend-box .legend-title{font-size:12px;font-weight:700;color:var(--sub);margin-bottom:8px;letter-spacing:0.5px;}
  .legend-row{display:flex;align-items:center;gap:10px;margin-bottom:7px;font-size:13px;}

  /* DIVIDER */
  .divider{height:1px;background:#e0e0e0;margin:16px 0;}

  /* QUOTE BOX */
  .quote-box{background:#f3f3f3;border-left:4px solid #aaa;border-radius:0 8px 8px 0;padding:11px 14px;margin:12px 0;font-size:13px;color:#555;font-style:italic;}

  /* STEP CARDS */
  .steps{display:flex;flex-direction:column;gap:10px;margin:12px 0;}
  .step-card{display:flex;gap:12px;align-items:flex-start;background:var(--gray-bg);border-radius:10px;padding:12px 13px;border:1.5px solid #ddd;}
  .step-num{background:var(--c-main);color:var(--white);border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;margin-top:1px;}
  .step-text{font-size:13.5px;color:var(--text);line-height:1.65;}

  /* CHIPS */
  .chip-row{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;}
  .chip{background:var(--c-light);border:1.5px solid var(--c-main);border-radius:20px;padding:5px 14px;font-size:13px;font-weight:700;color:var(--c-main);}
  .chip.blue{background:#e3f2fd;border-color:#1565c0;color:#1565c0;}
  .chip.orange{background:#fff3e0;border-color:#e65100;color:#e65100;}
  .chip.gray{background:#f5f5f5;border-color:#888;color:#555;}

  /* PAGE FOOTER */
  .page-footer{text-align:center;font-size:11px;color:#aaa;margin-top:28px;padding:0 16px;}
</style>`;
