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
    years.unshift('Average');

    // Control is positioned absolutely by CSS now
    const control = container.append('div').attr('class','map-control');
    control.append('label').attr('for','year-select').text('Select year: ');
    const yearSelect = control.append('select').attr('id','year-select');
    yearSelect.selectAll('option').data(years).join('option').attr('value',d=>d).text(d=>d);

    const width=1000, height=600;
    const svg = container.append('svg')
        .attr('viewBox',`0 0 ${width} ${height}`)
        .style('width','100%')
        .style('height','auto');
    
    // Group for zooming content
    const contentGroup = svg.append('g');

    // State for zoom
    let active = d3.select(null);

    function reset() {
        active = d3.select(null);
        contentGroup.transition().duration(750).attr("transform", "");
    }

    // Background click to reset zoom
    svg.on('click', reset);

    const tooltip = d3.select('body').append('div').attr('class','choropleth-tooltip').style('opacity',0).style('pointer-events','none');

    function renderTreemap(selectedYear){
        // Reset zoom when changing data/year
        reset();

        contentGroup.selectAll('g.treemap-node').remove();
        let root;
        if(selectedYear==='Average'){
            const grouped = d3.rollups(filtered, v=>({fines:d3.mean(v,x=>x.FINES), arrests:d3.mean(v,x=>x.ARRESTS), charges:d3.mean(v,x=>x.CHARGES)}), d=>d.JURISDICTION);
            root = {name:'Jurisdictions', children: grouped.map(([jur, vals])=>({name:jur, value: vals.fines+vals.arrests+vals.charges, fines:Math.round(vals.fines), arrests:Math.round(vals.arrests), charges:Math.round(vals.charges)}))};
        } else {
            const grouped = d3.rollups(filtered.filter(d=>d.YEAR===selectedYear), v=>({fines:d3.sum(v,x=>x.FINES), arrests:d3.sum(v,x=>x.ARRESTS), charges:d3.sum(v,x=>x.CHARGES)}), d=>d.JURISDICTION);
            root = {name:'Jurisdictions', children: grouped.map(([jur, vals])=>({name:jur, value: vals.fines+vals.arrests+vals.charges, fines:vals.fines, arrests:vals.arrests, charges:vals.charges}))};
        }

        const treemap = d3.treemap().size([width,height]).paddingInner(2);
        const hierarchyData = d3.hierarchy(root).sum(d=>d.value).sort((a,b)=>b.value-a.value);
        treemap(hierarchyData);

        const ratios = hierarchyData.leaves().map(d=>{const t=d.data.fines+d.data.arrests+d.data.charges; return t? d.data.fines/t:0;});
        const minRatio = d3.min(ratios), maxRatio = d3.max(ratios);
        const color = d3.scaleSequential(d3.interpolateViridis).domain([minRatio||0, maxRatio||1]);

        const nodes = contentGroup.selectAll('g.treemap-node')
            .data(hierarchyData.leaves())
            .join('g')
            .attr('class','treemap-node')
            .attr('transform',d=>`translate(${d.x0},${d.y0})`)
            .style('cursor', 'pointer'); // Indicate clickable

        nodes.append('rect')
            .attr('width',d=>d.x1-d.x0)
            .attr('height',d=>d.y1-d.y0)
            .attr('fill',d=>{const t=d.data.fines+d.data.arrests+d.data.charges; return color(t? d.data.fines/t:0);})
            .attr('stroke','#fff');

        // Zoom Logic: Click to focus on a node
        nodes.on('click', function(event, d) {
            event.stopPropagation(); // Prevent triggering background reset
            
            // If clicking the already active node, zoom out
            if (active.node() === this) return reset();

            active = d3.select(this);

            const dx = d.x1 - d.x0;
            const dy = d.y1 - d.y0;
            const x = (d.x0 + d.x1) / 2;
            const y = (d.y0 + d.y1) / 2;
            
            // Calculate scale to fit the node (max 8x zoom)
            const scale = Math.min(8, 0.9 / Math.max(dx / width, dy / height));
            const translate = [width / 2 - scale * x, height / 2 - scale * y];

            contentGroup.transition().duration(750)
                .attr("transform", `translate(${translate})scale(${scale})`);
        });

        nodes.on('mousemove',(event,d)=>{
            const total = d.data.fines+d.data.arrests+d.data.charges; const ratio = total? d.data.fines/total:0;
            tooltip.style('left',(event.pageX+12)+'px').style('top',(event.pageY+12)+'px').style('opacity',1)
                .html(`<strong>${d.data.name} (${selectedYear})</strong><br/>Fines: ${d.data.fines}<br/>Arrests: ${d.data.arrests}<br/>Charges: ${d.data.charges}<br/>Fines ratio: ${d3.format('.1%')(ratio)}`);
        }).on('mouseout',()=>tooltip.style('opacity',0));

        nodes.append('text')
            .attr('x',6)
            .attr('y',18)
            .attr('fill','#fff')
            .attr('font-size','12px')
            .attr('font-weight','600')
            .text(d=> `${d.data.name} ${d3.format('.0%')((d.data.fines||0)/((d.data.fines||0)+(d.data.arrests||0)+(d.data.charges||0)||1))}`);
    }

    yearSelect.node().value = 'Average'; renderTreemap('Average');
    yearSelect.on('change', function(){ renderTreemap(this.value); });
})();