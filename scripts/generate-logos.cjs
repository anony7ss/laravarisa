const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function main() {
  const inputPath = path.join(__dirname, '..', 'public', 'logo.jpg');
  const fullLogoPath = path.join(__dirname, '..', 'public', 'logo.png');
  const emblemPath = path.join(__dirname, '..', 'public', 'logo-emblem.png');
  const faviconPath = path.join(__dirname, '..', 'public', 'favicon.png');
  const faviconIcoPath = path.join(__dirname, '..', 'public', 'favicon.ico');

  console.log('Lendo imagem original:', inputPath);
  const { data, info } = await sharp(inputPath).raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;

  // Cor do fundo da imagem original
  const bgR = 253.77;
  const bgG = 239.83;
  const bgB = 236.66;

  // Buffer RGBA transparente
  const rgba = Buffer.alloc(w * h * 4);

  // Parâmetros de threshold
  const t0 = 24;
  const t1 = 85;

  for (let i = 0; i < w * h; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];

    const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

    let alpha = 0;
    if (dist <= t0) {
      alpha = 0;
    } else if (dist >= t1) {
      alpha = 1;
    } else {
      alpha = (dist - t0) / (t1 - t0);
      alpha = alpha * alpha * (3 - 2 * alpha); // smoothstep
    }

    // Unmultiply de cor para evitar halo claro em fundos escuros
    let fR = r;
    let fG = g;
    let fB = b;
    if (alpha > 0.01) {
      fR = Math.min(255, Math.max(0, (r - (1 - alpha) * bgR) / alpha));
      fG = Math.min(255, Math.max(0, (g - (1 - alpha) * bgG) / alpha));
      fB = Math.min(255, Math.max(0, (b - (1 - alpha) * bgB) / alpha));
    }

    rgba[i * 4] = Math.round(fR);
    rgba[i * 4 + 1] = Math.round(fG);
    rgba[i * 4 + 2] = Math.round(fB);
    rgba[i * 4 + 3] = Math.round(alpha * 255);
  }

  // Remoção de ruído isolado (ilhas com tamanho < 15 pixels)
  const visited = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (visited[idx] || rgba[idx * 4 + 3] === 0) continue;

      const queue = [idx];
      visited[idx] = 1;
      const island = [idx];
      let head = 0;

      while (head < queue.length) {
        const curr = queue[head++];
        const cx = curr % w;
        const cy = Math.floor(curr / w);

        for (const [dx, dy] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
          [-1, -1],
          [1, 1],
          [-1, 1],
          [1, -1],
        ]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const nidx = ny * w + nx;
            if (!visited[nidx] && rgba[nidx * 4 + 3] > 0) {
              visited[nidx] = 1;
              queue.push(nidx);
              island.push(nidx);
            }
          }
        }
      }

      // Se for uma ilha espúria de ruído (< 15 pixels), zera o alpha
      if (island.length < 15) {
        for (const p of island) {
          rgba[p * 4 + 3] = 0;
        }
      }
    }
  }

  // 1. Salvar public/logo.png (recorte limpo, fundo transparente)
  // Encontrar bounding box de todo o conteúdo para fazer um trim equilibrado
  let minX = w, maxX = 0, minY = h, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rgba[(y * w + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  console.log(`Content bounding box: [${minX}, ${minY}] to [${maxX}, ${maxY}] (${maxX - minX}x${maxY - minY})`);

  // Adicionar margem agradável de 24px em volta
  const pad = 24;
  const cropLeft = Math.max(0, minX - pad);
  const cropTop = Math.max(0, minY - pad);
  const cropWidth = Math.min(w - cropLeft, maxX - minX + pad * 2);
  const cropHeight = Math.min(h - cropTop, maxY - minY + pad * 2);

  await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
    .png({ compressionLevel: 9 })
    .toFile(fullLogoPath);

  console.log('Criado:', fullLogoPath, `(${cropWidth}x${cropHeight})`);

  // 2. Salvar public/logo-emblem.png (crop quadrado centrado na mandala com o 'L')
  // Mandala bounds: x em torno de 224..759, y em torno de 45..606
  let mMinX = w, mMaxX = 0, mMinY = h, mMaxY = 0;
  for (let y = 0; y < 615; y++) {
    for (let x = 0; x < w; x++) {
      if (rgba[(y * w + x) * 4 + 3] > 20) {
        if (x < mMinX) mMinX = x;
        if (x > mMaxX) mMaxX = x;
        if (y < mMinY) mMinY = y;
        if (y > mMaxY) mMaxY = y;
      }
    }
  }

  console.log(`Mandala bounds: [${mMinX}, ${mMinY}] to [${mMaxX}, ${mMaxY}] (${mMaxX - mMinX}x${mMaxY - mMinY})`);
  const mCenterX = Math.round((mMinX + mMaxX) / 2);
  const mCenterY = Math.round((mMinY + mMaxY) / 2);
  const mSize = Math.max(mMaxX - mMinX, mMaxY - mMinY);
  // Quadrado de 600x600 centrado na mandala
  const emblemDim = Math.min(600, Math.max(580, mSize + 40));
  const emblemLeft = Math.max(0, Math.round(mCenterX - emblemDim / 2));
  const emblemTop = Math.max(0, Math.round(mCenterY - emblemDim / 2));

  await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: emblemLeft, top: emblemTop, width: emblemDim, height: emblemDim })
    .png({ compressionLevel: 9 })
    .toFile(emblemPath);

  console.log('Criado:', emblemPath, `(${emblemDim}x${emblemDim})`);

  // 3. Gerar favicon em alta definição e versões otimizadas
  await sharp(emblemPath)
    .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(faviconPath);

  await sharp(emblemPath)
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(faviconIcoPath);

  const faviconPngBuffer = fs.readFileSync(faviconPath);
  const base64Favicon = faviconPngBuffer.toString('base64');
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">\n  <image href="data:image/png;base64,${base64Favicon}" width="64" height="64" />\n</svg>\n`;
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'favicon.svg'), svgContent, 'utf8');

  console.log('Favicons (png, ico, svg) gerados com sucesso!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
