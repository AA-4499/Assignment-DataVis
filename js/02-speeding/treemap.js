(async function(){
    const container = d3.select('#viz-jurisdiction-consistency');
    if (container.empty()) return;
    container.selectAll('*').remove();
    const metric = 'speed_fines';
    
    const data = await d3.csv('data/police_enforcement_2024_fines.csv', d=>({
        YEAR:d.YEAR, JURISDICTION:d.JURISDICTION, METRIC:d.METRIC, FINES:+d.FINES||0, ARRESTS:+d.ARRESTS||0, CHARGES:+d.CHARGES||0
    }));
    const filtered = data.filter(d=>d.METRIC===metric);
    const years = Array.from(new Set(filtered.map(d=>d.YEAR))).sort();
    const options = ['Average', 'All years', ...years];

    const stack = container.append('div').attr('class','chart-stack');
    const control = stack.append('div').attr('class','map-control inline-control');
    control.append('label').attr('for','year-select').text('Select year: ');
    const yearSelect = control.append('select').attr('id','year-select');
    yearSelect.selectAll('option').data(options).join('option').attr('value',d=>d).text(d=>d);

    // export buttons
    const exportGroup = control.append('div').attr('class','export-controls');
    exportGroup.append('button').attr('type','button').attr('id','btn-download-svg').text('Download SVG');
    exportGroup.append('button').attr('type','button').attr('id','btn-download-png').text('Download PNG');
    
    const width = 1000, height = 600;
    const svg = stack.append('svg').attr('viewBox',`0 0 ${width} ${height}`).style('width','100%').style('height','auto');
    const tooltip = d3.select('body').append('div').attr('class','choropleth-tooltip').style('opacity',0).style('pointer-events','none');
    
    // Add background rect to capture outside clicks (reset zoom)
    svg.append('rect')
        .attr('class','tm-bg')
        .attr('width', width)
        .attr('height', height)
        .attr('fill', 'transparent')
        .style('cursor','default');

    // container group for nodes we will transform when zooming
    const layer = svg.append('g').attr('class','treemap-layer');

    function renderTreemap(selectedYear){
        layer.selectAll('*').remove(); // clear nodes from layer
        // compute root as before
        let root;
        if (selectedYear === 'Average') {
            const grouped = d3.rollups(filtered, v=>({fines:d3.mean(v,x=>x.FINES), arrests:d3.mean(v,x=>x.ARRESTS), charges:d3.mean(v,x=>x.CHARGES)}), d=>d.JURISDICTION);
            root = {name:'Jurisdictions', children: grouped.map(([jur, vals])=>({name:jur, value: vals.fines+vals.arrests+vals.charges, fines:Math.round(vals.fines), arrests:Math.round(vals.arrests), charges:Math.round(vals.charges)}))};
        } else if (selectedYear === 'All years') {
            const grouped = d3.rollups(filtered, v=>({fines:d3.sum(v,x=>x.FINES), arrests:d3.sum(v,x=>x.ARRESTS), charges:d3.sum(v,x=>x.CHARGES)}), d=>d.JURISDICTION);
            root = {name:'Jurisdictions', children: grouped.map(([jur, vals])=>({name:jur, value: vals.fines+vals.arrests+vals.charges, fines:vals.fines, arrests:vals.arrests, charges:vals.charges}))};
        } else {
            const grouped = d3.rollups(filtered.filter(d=>d.YEAR===selectedYear), v=>({fines:d3.sum(v,x=>x.FINES), arrests:d3.sum(v,x=>x.ARRESTS), charges:d3.sum(v,x=>x.CHARGES)}), d=>d.JURISDICTION);
            root = {name:'Jurisdictions', children: grouped.map(([jur, vals])=>({name:jur, value: vals.fines+vals.arrests+vals.charges, fines:vals.fines, arrests:vals.arrests, charges:vals.charges}))};
        }

        const treemap = d3.treemap().size([width,height]).paddingInner(4).tile(d3.treemapResquarify);
        const hierarchyData = d3.hierarchy(root).sum(d=>d.value).sort((a,b)=>b.value-a.value);
        treemap(hierarchyData);

        const ratios = hierarchyData.leaves().map(d=>{const t=d.data.fines+d.data.arrests+d.data.charges; return t? d.data.fines/t:0;});
        const minRatio = d3.min(ratios), maxRatio = d3.max(ratios);
        const color = d3.scaleSequential(d3.interpolateViridis).domain([minRatio||0, maxRatio||1]);

        const nodes = layer.selectAll('g.treemap-node').data(hierarchyData.leaves()).join('g').attr('class','treemap-node').attr('transform',d=>`translate(${d.x0},${d.y0})`);
        
        // 1. Draw Rectangles
        nodes.append('rect')
            .attr('width', d => d.x1 - d.x0)
            .attr('height', d => d.y1 - d.y0)
            .attr('fill', d => {
                const t = d.data.fines + d.data.arrests + d.data.charges; 
                return color(t ? d.data.fines/t : 0);
            })
            .attr('stroke','#fff')
            .style('cursor','pointer');

        // 2. Add ClipPath to prevent text overflow
        nodes.append("clipPath")
            .attr("id", (d, i) => "clip-" + i)
            .append("rect")
            .attr("width", d => d.x1 - d.x0)
            .attr("height", d => d.y1 - d.y0);

        // 3. Add Text with ClipPath and Visibility Logic
        nodes.append('text')
            .attr("clip-path", (d, i) => "url(#clip-" + i + ")")
            .attr('x', 6)
            .attr('y', 16)
            .attr('fill', '#fff')
            .attr('font-size', '12px')
            .attr('font-weight', '600')
            .style("pointer-events", "none")
            .style("display", d => ((d.x1 - d.x0 > 35 && d.y1 - d.y0 > 20) ? "block" : "none"))
            .text(d => `${d.data.name} ${d3.format('.0%')((d.data.fines||0)/((d.data.fines||0)+(d.data.arrests||0)+(d.data.charges||0)||1))}`);

        // Tooltip events remain on nodes (rect area)
        nodes.on('mousemove',(event,d)=>{
            const total = d.data.fines+d.data.arrests+d.data.charges; const ratio = total? d.data.fines/total:0;
            tooltip.style('left',(event.pageX+12)+'px').style('top',(event.pageY+12)+'px').style('opacity',1)
                .html(`<strong>${d.data.name} (${selectedYear})</strong><br/>Fines: ${d.data.fines}<br/>Arrests: ${d.data.arrests}<br/>Charges: ${d.data.charges}<br/>Fines ratio: ${d3.format('.1%')(ratio)}`);
        }).on('mouseout',()=>tooltip.style('opacity',0));

        // -------- Zoom behaviour --------
        let current = null; // currently zoomed node data

        function zoomTo(d){
            if (!d){
                // reset
                layer.transition().duration(600).attr('transform', `translate(0,0) scale(1)`);
                current = null;
                return;
            }
            // compute scale and translate to center clicked node
            const dx = d.x1 - d.x0;
            const dy = d.y1 - d.y0;
            const kx = width / dx;
            const ky = height / dy;
            const k = Math.min(kx, ky, 8); // cap max zoom
            const tx = -d.x0 * k + (width - dx * k) / 2;
            const ty = -d.y0 * k + (height - dy * k) / 2;
            layer.transition().duration(600).attr('transform', `translate(${tx},${ty}) scale(${k})`);
            current = d;
        }

        nodes.on('click', (event, d) => {
            event.stopPropagation();
            // toggle zoom
            if (current && current.data && current.data.name === d.data.name) {
                zoomTo(null);
            } else {
                zoomTo(d);
            }
        });

        // clicking background resets zoom
        svg.select('.tm-bg').on('click', () => zoomTo(null));


    }

    yearSelect.node().value = 'Average'; renderTreemap('Average');
    yearSelect.on('change', function(){ renderTreemap(this.value); });

    // wire buttons (after svg is created)
    document.getElementById('btn-download-svg').addEventListener('click', () => {
        exportChart.downloadSVG(svg.node(), 'treemap-seatbelt.svg');
    });
    document.getElementById('btn-download-png').addEventListener('click', () => {
        exportChart.svgToPng(svg.node(), 'treemap-seatbelt.png', 2).catch(err => console.error(err));
    });
})();