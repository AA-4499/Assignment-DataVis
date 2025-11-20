(async function(){
    const container = d3.select('#viz-jurisdiction-consistency');
    if (container.empty()) return;
    container.selectAll('*').remove();

    // Read metric from data-metric attribute
    const metric = container.attr('data-metric') || 'speed_fines';

    // Load CSV
    const data = await d3.csv('data/police_enforcement_2024_fines.csv', d => ({
        YEAR: d.YEAR,
        JURISDICTION: d.JURISDICTION,
        METRIC: d.METRIC,
        FINES: +d.FINES || 0,
        ARRESTS: +d.ARRESTS || 0,
        CHARGES: +d.CHARGES || 0
    }));

    // Filter by metric
    const filtered = data.filter(d => d.METRIC === metric);

    // Get unique years
    const years = Array.from(new Set(filtered.map(d => d.YEAR))).sort();
    years.unshift('Average'); // Add "Average" option

    // Add year selector UI
    const control = container.append('div').attr('class','map-control');
    control.append('label').attr('for','year-select').text('Select year: ');
    const yearSelect = control.append('select').attr('id','year-select');
    yearSelect.selectAll('option')
        .data(years)
        .join('option')
        .attr('value', d => d)
        .text(d => d);

    // Treemap layout
    const width = 1000, height = 600;
    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('width','80%').style('height','auto');

    // Tooltip
    const tooltip = d3.select('body').append('div')
        .attr('class','choropleth-tooltip')
        .style('position','absolute')
        .style('pointer-events','none')
        .style('opacity',0);

    // Legend
    const legend = svg.append('g').attr('transform',`translate(${width-180},${height-40})`);
    const defs = svg.append('defs');
    const grad = defs.append('linearGradient').attr('id','treemap-legend');
    grad.append('stop').attr('offset','0%').attr('stop-color', d3.interpolateBlues(0));
    grad.append('stop').attr('offset','100%').attr('stop-color', d3.interpolateBlues(1));
    legend.append('rect')
        .attr('width', 120).attr('height', 12)
        .style('fill','url(#treemap-legend)');
    legend.append('text').attr('x',0).attr('y',-4).text('Fines Ratio').attr('fill','#222').attr('font-size','12px');
    legend.append('text').attr('x',0).attr('y',28).text('0% (all severe)').attr('fill','#222').attr('font-size','11px');
    legend.append('text').attr('x',90).attr('y',28).text('100% (all fines)').attr('fill','#222').attr('font-size','11px');

    // Color scale
    const color = d3.scaleSequential(d3.interpolateBlues).domain([0, 1]);

    function renderTreemap(selectedYear) {
        svg.selectAll('g.treemap-node').remove();

        // Prepare hierarchy data
        let root;
        if (selectedYear === 'Average') {
            const grouped = d3.rollups(
                filtered,
                v => ({
                    fines: d3.mean(v, d => d.FINES),
                    arrests: d3.mean(v, d => d.ARRESTS),
                    charges: d3.mean(v, d => d.CHARGES)
                }),
                d => d.JURISDICTION
            );
            root = {
                name: "Jurisdictions",
                children: grouped.map(([jurisdiction, vals]) => ({
                    name: jurisdiction,
                    value: vals.fines + vals.arrests + vals.charges,
                    fines: Math.round(vals.fines),
                    arrests: Math.round(vals.arrests),
                    charges: Math.round(vals.charges)
                }))
            };
        } else {
            const grouped = d3.rollups(
                filtered.filter(d => d.YEAR === selectedYear),
                v => ({
                    fines: d3.sum(v, d => d.FINES),
                    arrests: d3.sum(v, d => d.ARRESTS),
                    charges: d3.sum(v, d => d.CHARGES)
                }),
                d => d.JURISDICTION
            );
            root = {
                name: "Jurisdictions",
                children: grouped.map(([jurisdiction, vals]) => ({
                    name: jurisdiction,
                    value: vals.fines + vals.arrests + vals.charges,
                    fines: vals.fines,
                    arrests: vals.arrests,
                    charges: vals.charges
                }))
            };
        }

        // Treemap layout
        const treemap = d3.treemap()
            .size([width, height])
            .paddingInner(2);

        const hierarchyData = d3.hierarchy(root)
            .sum(d => d.value)
            .sort((a, b) => b.value - a.value);

        treemap(hierarchyData);

        // Dynamic color domain
        const ratios = hierarchyData.leaves().map(d => {
            const total = d.data.fines + d.data.arrests + d.data.charges;
            return total ? d.data.fines / total : 0;
        });
        const minRatio = d3.min(ratios);
        const maxRatio = d3.max(ratios);

        // Use Viridis for better perceptual uniformity
        const color = d3.scaleSequential(d3.interpolateViridis).domain([minRatio, maxRatio]);

        // Draw rectangles
        const nodes = svg.selectAll('g.treemap-node')
            .data(hierarchyData.leaves())
            .join('g')
            .attr('class','treemap-node')
            .attr('transform', d => `translate(${d.x0},${d.y0})`);

        nodes.append('rect')
            .attr('width', d => d.x1 - d.x0)
            .attr('height', d => d.y1 - d.y0)
            .attr('fill', d => {
                const total = d.data.fines + d.data.arrests + d.data.charges;
                const ratio = total ? d.data.fines / total : 0;
                return color(ratio);
            })
            .attr('stroke', '#fff');

        // Tooltip
        nodes.on('mousemove', (event, d) => {
            const x = event.pageX, y = event.pageY;
            const total = d.data.fines + d.data.arrests + d.data.charges;
            const ratio = total ? d.data.fines / total : 0;
            tooltip.style('left', (x+12) + 'px').style('top', (y+12) + 'px').style('opacity',1)
                .html(`<strong>${d.data.name} (${selectedYear})</strong><br/>
                       Fines: ${d.data.fines}<br/>
                       Arrests: ${d.data.arrests}<br/>
                       Charges: ${d.data.charges}<br/>
                       Fines Ratio: ${d3.format('.1%')(ratio)}`);
        }).on('mouseout', () => tooltip.style('opacity',0));

        // Add clear labels
        nodes.append('text')
            .attr('x', 6)
            .attr('y', 22)
            .attr('fill', '#fff')
            .attr('font-size', '1em')
            .attr('font-weight', 'bold')
            .text(d => {
                const total = d.data.fines + d.data.arrests + d.data.charges;
                const ratio = total ? d.data.fines / total : 0;
                return `${d.data.name}\n${d3.format('.0%')(ratio)}`;
            });

        // Legend (dynamic)
        legend.selectAll('*').remove();
        const grad = defs.append('linearGradient').attr('id','treemap-legend-dyn');
        grad.append('stop').attr('offset','0%').attr('stop-color', color(minRatio));
        grad.append('stop').attr('offset','100%').attr('stop-color', color(maxRatio));
        legend.append('rect')
            .attr('width', 120).attr('height', 12)
            .style('fill','url(#treemap-legend-dyn)');
        legend.append('text').attr('x',0).attr('y',-4).text('Fines Ratio').attr('fill','#222').attr('font-size','12px');
        legend.append('text').attr('x',0).attr('y',28).text(`${d3.format('.0%')(minRatio)} (lowest)`).attr('fill','#222').attr('font-size','11px');
        legend.append('text').attr('x',90).attr('y',28).text(`${d3.format('.0%')(maxRatio)} (highest)`).attr('fill','#222').attr('font-size','11px');
    }

    // Initial render
    yearSelect.node().value = 'Average';
    renderTreemap('Average');

    // Update on change
    yearSelect.on('change', function() {
        renderTreemap(this.value);
    });
})();