/* ...existing code... */
(async function(){
    const container = d3.select('#viz-age-severity');
    if (container.empty()) return;
    container.selectAll('*').remove();

    // add control panel for AGE_GROUP
    const control = container.append('div').attr('class','map-control');
    control.append('label').attr('for','age-select').text('Select age group: ');
    const ageSelect = control.append('select').attr('id','age-select');

    const width = 960, height = 650;
    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('width','100%').style('height','auto');

    // tooltip
    const tooltip = d3.select('body').append('div')
        .attr('class','choropleth-tooltip')
        .style('position','absolute')
        .style('pointer-events','none')
        .style('opacity',0);

    // load geo (try topojson then geojson)
    let geo = null;
    const localTopo = 'data/australia_states.json';
    const localGeo  = 'data/australia_states.json';

    async function tryLoadLocal() {
        try {
            const topo = await d3.json(localTopo);
            const objKey = Object.keys(topo.objects)[0];
            return topojson.feature(topo, topo.objects[objKey]);
        } catch (e) { /* ignore */ }
        try {
            const g = await d3.json(localGeo);
            if (g && g.type === 'FeatureCollection') return g;
        } catch (e) { /* ignore */ }
        return null;
    }

    geo = await tryLoadLocal();
    if (!geo) {
        container.append('div')
            .attr('class', 'map-error')
            .html(
                '<strong>Map file not found.</strong><br>' +
                'Place a TopoJSON or GeoJSON of Australian states as:<br>' +
                '<code>data/australia_states.topojson</code> or <code>data/australia_states.geojson</code><br>' +
                'Download from data.gov.au, GADM, NaturalEarth or a GitHub repo and save under the project /data folder.'
            );
        console.error('Choropleth: australia_states.topojson/.geojson not found in data/');
        return;
    }

    // load CSV and prepare rollups per AGE_GROUP and JURISDICTION (only speed_fines rows)
    const raw = await d3.csv('data/police_enforcement_2024_fines.csv', d => ({
        YEAR: d.YEAR, JURISDICTION: d.JURISDICTION, METRIC: d.METRIC,
        AGE_GROUP: d.AGE_GROUP || 'Unknown',
        FINES: +d.FINES || 0, ARRESTS: +d.ARRESTS || 0, CHARGES: +d.CHARGES || 0
    }));

    const speedRows = raw.filter(d => d.METRIC === 'speed_fines');
    const ageGroups = Array.from(new Set(speedRows.map(d => d.AGE_GROUP))).sort();
    ageGroups.unshift('All ages'); // add combined option

    // build nested maps: age -> jurisdiction -> totals
    const dataByAge = new Map();
    for (const age of ageGroups) {
        const rows = age === 'All ages' ? speedRows : speedRows.filter(d => d.AGE_GROUP === age);
        const byJ = d3.rollups(rows,
            vals => ({
                fines: d3.sum(vals, v => v.FINES),
                arrests: d3.sum(vals, v => v.ARRESTS),
                charges: d3.sum(vals, v => v.CHARGES)
            }),
            d => d.JURISDICTION
        );
        dataByAge.set(age, new Map(byJ));
    }

    // match GEO features to jurisdiction keys (tries many props)
    const fullToAbbr = {
        "New South Wales":"NSW","Victoria":"VIC","Queensland":"QLD",
        "Western Australia":"WA","South Australia":"SA","Tasmania":"TAS",
        "Northern Territory":"NT","Australian Capital Territory":"ACT"
    };

    function findJurisdictionKey(props){
        const candidates = [
            props.postal, props.postcode, props.STE_CODE, props.STATE_ABBR,
            props.state_abbr, props.STATE, props.STATE_NAME, props.NAME, props.name
        ].filter(Boolean).map(String);

        for (const c of candidates){
            if (dataHasJurisdiction(c)) return c;
            const t = c.trim();
            if (dataHasJurisdiction(t)) return t;
        }
        const full = (props.STATE_NAME || props.STATE || props.NAME || props.name || '').toString();
        if (full && fullToAbbr[full] && dataHasJurisdiction(fullToAbbr[full])) return fullToAbbr[full];
        for (const key of dataJurisdictions()){
            if (full && key.toLowerCase() === full.toLowerCase()) return key;
        }
        return null;
    }
    function dataJurisdictions(){
        // union of all jurisdictions in dataset
        const s = new Set();
        for (const m of dataByAge.values()){
            for (const k of m.keys()) s.add(k);
        }
        return Array.from(s);
    }
    function dataHasJurisdiction(k){
        for (const m of dataByAge.values()) if (m.has(k)) return true;
        return false;
    }

    // attach empty props then later update per selection
    geo.features.forEach(f => {
        const key = findJurisdictionKey(f.properties) || f.properties.STATE || f.properties.name || f.id || '';
        f.properties._match = key;
        f.properties.fines = 0;
        f.properties.arrests = 0;
        f.properties.charges = 0;
        f.properties.severeRatio = 0;
    });

    // projection / path
    const projection = d3.geoMercator();
    const path = d3.geoPath().projection(projection);
    projection.fitSize([width, height], geo);

    // draw base map paths
    const mapGroup = svg.append('g').attr('class','map-layer');
    const countries = mapGroup.selectAll('path').data(geo.features).join('path')
        .attr('d', path)
        .attr('stroke','#333').attr('stroke-width',0.5);

    // color scale: 0 (no severe) -> 1 (all severe)
    const color = d3.scaleSequential(d3.interpolateOrRd).domain([0,1]);

    // legend group (keep defs created earlier)
    const legendWidth = 260, legendHeight = 10;
    const legendX = 20, legendY = height - 60;
    const defs = svg.append('defs');
    const linear = defs.append('linearGradient').attr('id','legend-grad');
    // initial stops (will be updated inside update())
    linear.append('stop').attr('offset','0%').attr('stop-color', color(0));
    linear.append('stop').attr('offset','100%').attr('stop-color', color(1));
    const legend = svg.append('g').attr('class','choropleth-legend').attr('transform',`translate(${legendX},${legendY})`);
    legend.append('rect').attr('width', legendWidth).attr('height', legendHeight).style('fill','url(#legend-grad)').style('stroke','#999');
    const legendScale = d3.scaleLinear().domain([0,1]).range([0, legendWidth]);
    const legendAxis = d3.axisBottom(legendScale).ticks(5).tickFormat(d => d3.format('.0%')(d));
    const legendAxisG = legend.append('g').attr('transform',`translate(0,${legendHeight})`).call(legendAxis);
    legend.append('text').attr('x',0).attr('y',-8).text('Severe outcomes (% of national enforcement)').style('font-size','12px').style('fill','#222');

    // update function to compute and color by selected age
    function update(age) {
        const map = dataByAge.get(age);

        // compute national totals (sum across all jurisdictions for this age)
        let nationalTotal = 0;
        for (const [k,vals] of (map || new Map())) {
            nationalTotal += (vals.fines + vals.arrests + vals.charges);
        }
        if (nationalTotal === 0 && age !== 'All ages') {
            const fallback = dataByAge.get('All ages');
            for (const [k,vals] of (fallback || new Map())) {
                nationalTotal += (vals.fines + vals.arrests + vals.charges);
            }
        }
        nationalTotal = nationalTotal || 1; // avoid div-by-zero

        // assign properties: compute severe ratio relative to national total
        geo.features.forEach(f => {
            const k = f.properties._match;
            const vals = (k && map && map.has(k)) ? map.get(k) : {fines:0, arrests:0, charges:0};
            f.properties.fines = vals.fines;
            f.properties.arrests = vals.arrests;
            f.properties.charges = vals.charges;
            const severeCount = vals.arrests + vals.charges;
            // severeRatio is now share of national enforcement
            f.properties.severeRatio = severeCount / nationalTotal;
            f.properties.totalLocal = vals.fines + vals.arrests + vals.charges;
            f.properties.nationalTotal = nationalTotal;
            f.properties.severeCount = severeCount;
        });

        // compute max ratio for legend scaling
        const maxRatio = d3.max(geo.features, d => d.properties.severeRatio) || 0.01;
        color.domain([0, maxRatio]);

        // update legend gradient stops to use current color domain
        linear.selectAll('stop').remove();
        linear.append('stop').attr('offset','0%').attr('stop-color', color(0));
        linear.append('stop').attr('offset','100%').attr('stop-color', color(maxRatio));

        // update legend axis domain and re-render
        legendScale.domain([0, maxRatio]);
        legendAxisG.call(d3.axisBottom(legendScale).ticks(5).tickFormat(d => d3.format('.2%')(d)));

        // recolor map
        countries.transition().duration(400)
            .attr('fill', d => (d.properties && d.properties.totalLocal > 0) ? color(d.properties.severeRatio) : '#eee');
    }

    // tooltip interactions — show severe share of national enforcement
    countries.on('mousemove', (event,d) => {
        const x = event.pageX, y = event.pageY;
        const p = d.properties;
        const total = p.totalLocal || 0;
        const pf = total ? p.fines/total : 0;
        const pa = total ? p.arrests/total : 0;
        const pc = total ? p.charges/total : 0;
        const severeShare = p.severeRatio || 0; // share of national enforcement
        tooltip.style('left', (x+12) + 'px').style('top', (y+12) + 'px').style('opacity',1)
            .html(`<strong>${p._match || p.STATE_NAME || p.name || 'Unknown'}</strong><br/>
                   Fines: ${d3.format(',')(p.fines)} (${d3.format('.1%')(pf)})<br/>
                   Arrests: ${d3.format(',')(p.arrests)} (${d3.format('.1%')(pa)})<br/>
                   Charges: ${d3.format(',')(p.charges)} (${d3.format('.1%')(pc)})<br/>
                   Severe (Arrests+Charges): ${d3.format(',')(p.severeCount || 0)}<br/>
                   Severe share of national enforcement: ${d3.format('.2%')(severeShare)} (${d3.format(',')(Math.round(severeShare * (p.nationalTotal || 0))) } incidents)`);
    }).on('mouseout', () => tooltip.style('opacity',0));

    // populate select options and wire up change
    ageSelect.selectAll('option').data(ageGroups).join('option')
        .attr('value', d => d).text(d => d);
    ageSelect.on('change', () => update(ageSelect.node().value));

    // initial render
    ageSelect.node().value = 'All ages';
    update('All ages');

})();
/* ...existing code... */