// Dither Tool - Free v1.1 - Web App by Alejandro Muñoz
// Contact: contact@alejandromunoz.com.ar
// For reporting bugs or suggestions.

let img = null;
let needsRedraw = false;
let redrawTimeout;
let isProcessing = false;
let processedImg = null;

let state = {
  algorithm: 'bayer',
  threshold: 128,
  zoom: 1,
  brightness: 0,
  contrast: 1,
  load: () => document.getElementById('fileInput').click(),
};
let gui;

let panX = 0;
let panY = 0;
let isDragging = false;
let dragStartX, dragStartY;
let imgStartPanX, imgStartPanY;

function setup() {
  (async () => {
    const { GUI } = await import('https://cdn.jsdelivr.net/npm/lil-gui@0.19.0/dist/lil-gui.esm.min.js');

    gui = new GUI({ title: 'Dither Tool - Free v1.1', width: 250 });

    const loadFolder = gui.addFolder('Load');
    loadFolder.add(state, 'load').name('Load Image from File');
    loadFolder.open();

    const viewFolder = gui.addFolder('View');
    viewFolder.add(state, 'zoom', 0.1, 4, 0.05).name('Zoom');
    viewFolder.open();

    const effectFolder = gui.addFolder('Effect');
    effectFolder.add(state, 'threshold', 0, 255, 1).name('Threshold');
    effectFolder.open();

    const adjustFolder = gui.addFolder('Image Adjustments');
    adjustFolder.add(state, 'brightness', -100, 100, 1).name('Brightness');
    adjustFolder.add(state, 'contrast', 0.1, 3, 0.1).name('Contrast');
    adjustFolder.open();

    gui.onFinishChange(() => {
      needsRedraw = true;
      if (img) {
        clearTimeout(redrawTimeout);
        redrawTimeout = setTimeout(() => redraw(), 150);
      }
    });

    const cnv = createCanvas(windowWidth, windowHeight);
    cnv.parent('canvas-container');
    noLoop();
    background(30);

    document.getElementById('fileInput').onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        loadImage(URL.createObjectURL(file), loaded => {
          img = loaded;
          processedImg = null;
          state.zoom = 1;
          state.brightness = 0;
          state.contrast = 1;
          panX = 0;
          panY = 0;
          needsRedraw = true;
          redraw();
          showToast('Image loaded!');
        });
      }
    };

    const guiElement = gui.domElement;
    guiElement.style.position = 'fixed';
    guiElement.style.top = '10px';
    guiElement.style.right = '10px';

    loadImage('https://picsum.photos/800/600', (loaded) => {
      img = loaded;
      processedImg = null;
      state.zoom = 1;
      state.brightness = 0;
      state.contrast = 1;
      panX = 0;
      panY = 0;
      needsRedraw = true;
      redraw();
      showToast('Initial image loaded!');
    });
  })();
}

function draw() {
  background(30);
  if (!img) {
    textAlign(CENTER, CENTER);
    fill(200);
    textSize(16);
    text('Load an image using the panel', width/2, height/2);
    return;
  }

  if (isProcessing) {
    textAlign(CENTER, CENTER);
    fill(200);
    textSize(16);
    text('Processing...', width/2, height/2);
    return;
  }

  if (needsRedraw) {
    const result = applyDither(img, false);
    if (result) {
      processedImg = result.after;
    }
    needsRedraw = false;
  }

  if (processedImg) {
    push();
    let imgW = processedImg.width * state.zoom;
    let imgH = processedImg.height * state.zoom;

    let x = (width - imgW) / 2 + panX;
    let y = (height - imgH) / 2 + panY;

    imageMode(CORNER);
    image(processedImg, x, y, imgW, imgH);
    pop();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  redraw();
}

function mousePressed() {
  if (img && !isProcessing && !isDragging) {
    let imgW = processedImg.width * state.zoom;
    let imgH = processedImg.height * state.zoom;

    let rotatedW = imgW;
    let rotatedH = imgH;

    let x = (width - rotatedW) / 2 + panX;
    let y = (height - rotatedH) / 2 + panY;

    if (mouseX >= x && mouseX <= x + rotatedW && mouseY >= y && mouseY <= y + rotatedH) {
        isDragging = true;
        dragStartX = mouseX;
        dragStartY = mouseY;
        imgStartPanX = panX;
        imgStartPanY = panY;
        return false;
    }
  }
}

function mouseDragged() {
  if (isDragging) {
    panX = imgStartPanX + (mouseX - dragStartX);
    panY = imgStartPanY + (mouseY - dragStartY);
    redraw();
    return false;
  }
}

function mouseReleased() {
  if (isDragging) {
    isDragging = false;
  }
}

function applyDither(src, isExport = false) {
  if (isProcessing) {
    console.log("applyDither: Ya se está procesando, abortando.");
    return null;
  }

  isProcessing = true;
  console.log("applyDither: Iniciando procesamiento.");

  try {
    let w = src.width;
    let h = src.height;

    const maxPreviewDim = 1600;
    const r = min(maxPreviewDim / w, maxPreviewDim / h);
    if (r < 1) {
        w = floor(w * r);
        h = floor(h * r);
    }

    if (w <= 0 || h <= 0) {
        console.error("applyDither: Dimensiones inválidas:", w, "x", h);
        return null;
    }

    const g = createGraphics(w, h);
    if (!g) {
        console.error("applyDither: No se pudo crear el p5.Graphics.");
        return null;
    }
    g.image(src, 0, 0, w, h);

    g.loadPixels();
    for (let i = 0; i < g.pixels.length; i += 4) {
      let r = g.pixels[i];
      let gVal = g.pixels[i+1];
      let b = g.pixels[i+2];

      r += state.brightness;
      gVal += state.brightness;
      b += state.brightness;

      r = ((r - 128) * state.contrast) + 128;
      gVal = ((gVal - 128) * state.contrast) + 128;
      b = ((b - 128) * state.contrast) + 128;

      r = constrain(r, 0, 255);
      gVal = constrain(gVal, 0, 255);
      b = constrain(b, 0, 255);

      g.pixels[i] = r;
      g.pixels[i+1] = gVal;
      g.pixels[i+2] = b;
    }
    g.updatePixels();

    g.loadPixels();
    for (let i = 0; i < g.pixels.length; i += 4) {
      const gray = 0.299 * g.pixels[i] + 0.587 * g.pixels[i+1] + 0.114 * g.pixels[i+2];
      g.pixels[i] = gray;
      g.pixels[i+1] = gray;
      g.pixels[i+2] = gray;
    }
    g.updatePixels();

    const bayerMatrix = [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5]
    ];
    const matrixSize = 4;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (x + y * w) * 4;
            const oldPixel = g.pixels[idx];
            const threshold = (bayerMatrix[y % matrixSize][x % matrixSize] + 0.5) / 16.0 * 255;
            const newPixelValue = oldPixel > (state.threshold - 128 + threshold) ? 255 : 0;

            g.pixels[idx] = newPixelValue;
            g.pixels[idx + 1] = newPixelValue;
            g.pixels[idx + 2] = newPixelValue;
        }
    }

    g.updatePixels();
    console.log("applyDither: Procesamiento terminado. Tamaño final:", g.width, "x", g.height);
    return { after: g };

  } catch (error) {
    console.error("applyDither: Error durante el procesamiento:", error);
    return null;

  } finally {
    console.log("applyDither: Restableciendo isProcessing.");
    isProcessing = false;
  }
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.position = 'fixed';
  toast.style.bottom = '20px';
  toast.style.right = '20px';
  toast.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
  toast.style.color = 'white';
  toast.style.padding = '10px 15px';
  toast.style.borderRadius = '5px';
  toast.style.zIndex = '1001';
  toast.style.opacity = '0';
  toast.style.transition = 'opacity 0.3s ease-in-out';
  toast.style.pointerEvents = 'none';

  document.body.appendChild(toast);

  setTimeout(() => { toast.style.opacity = '1'; }, 10);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 2000);
}