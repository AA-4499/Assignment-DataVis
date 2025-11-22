// ...new file...
const exportChart = (function(){

    function _serializeSvg(svgNode){
        const clone = svgNode.cloneNode(true);
        // ensure xmlns
        if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        // set width/height attributes from viewBox if not set, to preserve size when rendering to canvas
        if (!clone.getAttribute('width') || !clone.getAttribute('height')) {
            const vb = clone.getAttribute('viewBox');
            if (vb) {
                const parts = vb.split(/\s+/).map(Number);
                if (parts.length === 4) {
                    clone.setAttribute('width', parts[2]);
                    clone.setAttribute('height', parts[3]);
                }
            }
        }
        const serializer = new XMLSerializer();
        return serializer.serializeToString(clone);
    }

    function downloadBlob(blob, filename){
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(()=> URL.revokeObjectURL(url), 1500);
    }

    function downloadSVG(svgNode, filename = 'chart.svg'){
        const svgString = _serializeSvg(svgNode);
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        downloadBlob(blob, filename);
    }

    async function svgToPng(svgNode, filename = 'chart.png', scale = 2){
        const svgString = _serializeSvg(svgNode);
        const svg64 = btoa(unescape(encodeURIComponent(svgString)));
        const dataUrl = 'data:image/svg+xml;base64,' + svg64;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        return new Promise((resolve, reject) => {
            img.onload = () => {
                const w = img.width * scale;
                const h = img.height * scale;
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff'; // background white
                ctx.fillRect(0,0,w,h);
                ctx.drawImage(img, 0, 0, w, h);
                canvas.toBlob(blob => {
                    if (!blob) { reject(new Error('PNG conversion failed')); return; }
                    downloadBlob(blob, filename);
                    resolve();
                }, 'image/png', 0.92);
            };
            img.onerror = (e) => reject(e);
            img.src = dataUrl;
        });
    }

    return {
        downloadSVG,
        svgToPng
    };
})();