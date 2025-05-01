function generatePlaceholder (width = 100, height = 100, color = '#666', background = '#ccc', text: any) {
    const displayText = text || `${width}x${height}`;
    const svgContent = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${background}" />
      <text x="50%" y="50%" dominant-baseline="middle" font-family="-apple-system, Inter, sans-serif" text-anchor="middle" fill="${color}" font-size="20">
        ${displayText}
      </text>
    </svg>
  `;
  return svgContent
};

export { generatePlaceholder }