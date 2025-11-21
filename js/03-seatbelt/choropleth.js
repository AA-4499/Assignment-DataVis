(async function(){
    const container = d3.select('#viz-age-severity');
    if (container.empty()) return;
    container.selectAll('*').remove();
    const metric = 'non_wearing_seatbelts';

    // control UI
    const control = container.append('div').attr('class','map-control');
    control.append('label').attr('for','age-select').text('Select age group: ');
    const ageSelect = control.append('select').attr('id','age-select');

    const width = 960, height = 650;
    const svg = container.append('svg').attr('viewBox', `0 0 ${width} ${height}`).style('width','100%').style('height','auto');

    const tooltip = d3.select('body').append('div').attr('class','choropleth-tooltip').style('opacity',0).style('pointer-events','none');

    // try load topojson / geojson
    const localTopo = 'data/australia_states.json';
    const localGeo  = 'data/australia_states.json';
    let geo = null;
    async function tryLoadLocal(){
        try { const topo = await d3.json(localTopo); const objKey = Object.keys(topo.objects)[0]; return topojson.feature(topo, topo.objects[objKey]); } catch(e){}
        try { const g = await d3.json(localGeo); if (g && g.type === 'FeatureCollection') return g; } catch(e){}
        return null;
    }
    geo = await tryLoadLocal();
    if (!geo) {
        container.append('div').attr('class','map-error').html('<strong>Map file not found.</strong><br>Place australia_states.topojson or .geojson in data/');
        console.error('map file missing');
        return;
    }

    // load CSV and prepare
    const raw = await d3.csv('data/police_enforcement_2024_fines.csv', d => ({
        YEAR: d.YEAR, JURISDICTION: d.JURISDICTION, METRIC: d.METRIC,
        AGE_GROUP: d.AGE_GROUP || 'Unknown',
        FINES: +d.FINES||0, ARRESTS: +d.ARRESTS||0, CHARGES: +d.CHARGES||0
    }));
    const rows = raw.filter(d => d.METRIC === metric);
    const ageGroups = Array.from(new Set(rows.map(d => d.AGE_GROUP))).sort();
    ageGroups.unshift('All ages');

    const dataByAge = new Map();
    for (const age of ageGroups){
        const slice = age==='All ages' ? rows : rows.filter(d=>d.AGE_GROUP===age);
        const byJ = d3.rollups(slice, v=>({
            fines:d3.sum(v, x=>x.FINES),
            arrests:d3.sum(v, x=>x.ARRESTS),
            charges:d3.sum(v, x=>x.CHARGES)
        }), d=>d.JURISDICTION);
        dataByAge.set(age, new Map(byJ));
    }

    // match geo features to jurisdiction codes (same logic as original)
    const fullToAbbr = {"New South Wales":"NSW","Victoria":"VIC","Queensland":"QLD","Western Australia":"WA","South Australia":"SA","Tasmania":"TAS","Northern Territory":"NT","Australian Capital Territory":"ACT"};
    function dataJurisdictions(){ const s=new Set(); for(const m of dataByAge.values()) for(const k of m.keys()) s.add(k); return Array.from(s); }
    function dataHasJurisdiction(k){ for(const m of dataByAge.values()) if(m.has(k)) return true; return false; }
    function findJurisdictionKey(props){
        const candidates=[props.postal,props.postcode,props.STE_CODE,props.STATE_ABBR,props.state_abbr,props.STATE,props.STATE_NAME,props.NAME,props.name].filter(Boolean).map(String);
        for(const c of candidates){ if(dataHasJurisdiction(c)) return c; const t=c.trim(); if(dataHasJurisdiction(t)) return t; }
        const full=(props.STATE_NAME||props.STATE||props.NAME||props.name||'').toString();
        if(full && fullToAbbr[full] && dataHasJurisdiction(fullToAbbr[full])) return fullToAbbr[full];
        for(const key of dataJurisdictions()) if(full && key.toLowerCase()===full.toLowerCase()) return key;
        return null;
    }

    geo.features.forEach(f=>{
        const key = findJurisdictionKey(f.properties) || f.properties.STATE || f.properties.name || f.id || '';
        f.properties._match = key;
        f.properties.fines = 0; f.properties.arrests = 0; f.properties.charges = 0; f.properties.severeRatio = 0;
    });

    const projection = d3.geoMercator();
    const path = d3.geoPath().projection(projection);
    projection.fitSize([width,height],geo);

    const mapGroup = svg.append('g').attr('class','map-layer');
    const countries = mapGroup.selectAll('path').data(geo.features).join('path').attr('d',path).attr('stroke','#333').attr('stroke-width',0.5);

    const color = d3.scaleSequential(d3.interpolateOrRd).domain([0,1]);
    const defs = svg.append('defs');
    const linear = defs.append('linearGradient').attr('id','legend-grad');
    linear.append('stop').attr('offset','0%').attr('stop-color', color(0));
    linear.append('stop').attr('offset','100%').attr('stop-color', color(1));
    const legend = svg.append('g').attr('class','choropleth-legend').attr('transform',`translate(20,${height-60})`);
    legend.append('rect').attr('width',260).attr('height',10).style('fill','url(#legend-grad)').style('stroke','#999');
    const legendScale = d3.scaleLinear().domain([0,1]).range([0,260]);
    const legendAxisG = legend.append('g').attr('transform',`translate(0,10)`).call(d3.axisBottom(legendScale).ticks(5).tickFormat(d=>d3.format('.0%')(d)));
    legend.append('text').attr('x',0).attr('y',-8).text('Severe outcomes (% of national enforcement)').style('font-size','12px');

    function update(age){
        const map = dataByAge.get(age);
        let nationalTotal=0;
        for(const [k,vals] of (map||new Map())) nationalTotal += vals.fines+vals.arrests+vals.charges;
        if(nationalTotal===0 && age!=='All ages'){ const fb=dataByAge.get('All ages'); for(const [k,vals] of (fb||new Map())) nationalTotal += vals.fines+vals.arrests+vals.charges; }
        nationalTotal = nationalTotal || 1;

        geo.features.forEach(f=>{
            const k = f.properties._match;
            const vals = (k && map && map.has(k)) ? map.get(k) : {fines:0,arrests:0,charges:0};
            f.properties.fines = vals.fines; f.properties.arrests = vals.arrests; f.properties.charges = vals.charges;
            const severeCount = vals.arrests + vals.charges;
            f.properties.severeRatio = severeCount / nationalTotal;
            f.properties.totalLocal = vals.fines + vals.arrests + vals.charges;
            f.properties.nationalTotal = nationalTotal;
            f.properties.severeCount = severeCount;
        });

        const maxRatio = d3.max(geo.features, d=>d.properties.severeRatio) || 0.01;
        color.domain([0, maxRatio]);
        linear.selectAll('stop').remove();
        linear.append('stop').attr('offset','0%').attr('stop-color', color(0));
        linear.append('stop').attr('offset','100%').attr('stop-color', color(maxRatio));
        legendAxisG.call(d3.axisBottom(d3.scaleLinear().domain([0,maxRatio]).range([0,260])).ticks(5).tickFormat(d=>d3.format('.2%')(d)));
        countries.transition().duration(400).attr('fill', d => (d.properties && d.properties.totalLocal>0) ? color(d.properties.severeRatio) : '#eee');
    }

    countries.on('mousemove',(event,d)=>{
        const p=d.properties; const total=p.totalLocal||0;
        const pf = total ? p.fines/total : 0; const pa = total ? p.arrests/total : 0; const pc= total ? p.charges/total : 0;
        const severeShare = p.severeRatio||0;
        tooltip.style('left', (event.pageX+12)+'px').style('top',(event.pageY+12)+'px').style('opacity',1)
            .html(`<strong>${p._match||p.STATE_NAME||p.name||'Unknown'}</strong><br/>
                   Fines: ${d3.format(',')(p.fines)} (${d3.format('.1%')(pf)})<br/>
                   Arrests: ${d3.format(',')(p.arrests)} (${d3.format('.1%')(pa)})<br/>
                   Charges: ${d3.format(',')(p.charges)} (${d3.format('.1%')(pc)})<br/>
                   Severe: ${d3.format(',')(p.severeCount||0)}<br/>
                   Severe share of national enforcement: ${d3.format('.2%')(severeShare)}`
            );
    }).on('mouseout', ()=> tooltip.style('opacity',0));

    ageSelect.selectAll('option').data(ageGroups).join('option').attr('value',d=>d).text(d=>d);
    ageSelect.on('change', ()=> update(ageSelect.node().value));
    ageSelect.node().value = 'All ages';
    update('All ages');

})();