// stackedareachart.js
async function drawTemporalTrend() {
    const data = await d3.csv("data/police_enforcement_2024_fines.csv", d3.autoType);

    // ---- 1. Prepare aggregated data by YEAR and convert to per 1000 ----
    const filteredData = data.filter(d => d.METRIC === "non_wearing_seatbelts");

    const yearlyRaw = d3.rollups(
        filteredData,
        v => {
            const fines = d3.sum(v, d => d.FINES);
            const severe = d3.sum(v, d => d.ARRESTS) + d3.sum(v, d => d.CHARGES);
            return { fines, severe };
        },
        d => d.YEAR
    )
    .map(([year, values]) => ({
        year: +year,
        ...values
    }))
    .sort((a, b) => d3.ascending(a.year, b.year));

    // convert to per 1000
    const yearly = yearlyRaw.map(d => {
        const finesCount = d.fines || 0;
        const severeCount = d.severe || 0;
        return {
            year: d.year,
            finesRaw: finesCount,
            severeRaw: severeCount,
            finesPer10: finesCount / 10,
            severe: severeCount
        };
    });

    // ---- 2. Stack keys (per 1000 fines) ----
    const keys = ["severe", "finesPer10"];

    const stack = d3.stack()
    .keys(keys)
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone);

    const series = stack(yearly);

    // ---- 3. SVG container ----
    const container = d3.select("#viz-temporal-trend");
    const width = container.node().clientWidth;
    const height = 350;

    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height);

    const margin = { top: 30, right:50, bottom: 45, left: 50 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // ---- 4. Scales ----
    const x = d3.scaleLinear()
        .domain(d3.extent(yearly, d => d.year))
        .range([0, chartWidth]);

    const maxPer1000 = d3.max(yearly, d => d.severe + d.finesPer10);
    const y = d3.scaleLinear()
        .domain([0, maxPer1000 * 1.1])
        .range([chartHeight, 0]);

    const color = d3.scaleOrdinal()
        .domain(keys)
        .range(["#e6550d", "#3182bd"]); // severePer1000 (orange), finesPer1000 (blue)

    // ---- 5. Area generator ----
    const area = d3.area()
        .x(d => x(d.data.year))
        .y0(d => y(d[0]))
        .y1(d => y(d[1]));

    // ---- 6. Draw layers ----
    g.selectAll(".layer")
        .data(series)
        .join("path")
        .attr("class", "layer")
        .attr("d", area)
        .attr("fill", d => color(d.key))
        .attr("opacity", d => d.key === "finesPer10" ? 0.45 : 0.85);

    // ---- 7. Axes ----
    g.append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("d")))
        .append("text")
        .attr("x", chartWidth / 2)
        .attr("y", 30)
        .attr("fill", "black")
        .style("text-anchor", "middle")
        .text("Year");

    g.append("g")
        .call(d3.axisLeft(y))
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (chartHeight / 2))
        .attr("dy", "1em")
        .attr("fill", "black")
        .style("text-anchor", "middle")
        .text("Count per 10");
        
    // ---- 8. Legend ----
    const legend = svg.append("g")
        .attr("transform", `translate(${margin.left},10)`);

    const legendItems = [ { key: 'finesPer10', label: 'FINES (per 10)' }, { key: 'severe', label: 'SEVERE' } ];
    legendItems.forEach((it, i) => {
        const row = legend.append("g")
            .attr("transform", `translate(${i * 180},0)`);

        row.append("rect")
            .attr("width", 16)
            .attr("height", 16)
            .attr("fill", color(it.key));

        row.append("text")
            .attr("x", 22)
            .attr("y", 13)
            .text(it.label);
    });

    // ---- Tooltip overlay ----
    const tooltip = d3.select('body').append('div')
        .attr('class', 'chart-tooltip')
        .style('position', 'absolute')
        .style('pointer-events', 'none')
        .style('background', 'rgba(255,255,255,0.95)')
        .style('border', '1px solid #ccc')
        .style('padding', '8px')
        .style('font-size', '12px')
        .style('border-radius', '4px')
        .style('display', 'none');

    const bisect = d3.bisector(d => d.year).left;

    const overlay = g.append('rect')
        .attr('width', chartWidth)
        .attr('height', chartHeight)
        .attr('fill', 'transparent')
        .on('mousemove', (event) => {
            const [mx, my] = d3.pointer(event);
            const x0 = x.invert(mx);
            let i = bisect(yearly, x0);
            if (i >= yearly.length) i = yearly.length - 1;
            if (i > 0 && (i === 0 || (x0 - yearly[i-1].year) < (yearly[i].year - x0))) i = i - 1;
            const d = yearly[i];
            if (!d) return;

            tooltip.style('display', 'block')
                .html(`<strong>Year:</strong> ${d.year}<br/>
                       <strong>FINES:</strong> ${d.finesRaw} (${d.finesPer10.toFixed(2)} per 10)<br/>
                       <strong>SEVERE:</strong> ${d.severeRaw} (${d.severe.toFixed(2)})`)
                .style('left', (event.pageX + 12) + 'px')
                .style('top', (event.pageY + 12) + 'px');
        })
        .on('mouseover', () => tooltip.style('display', 'block'))
        .on('mouseout', () => tooltip.style('display', 'none'));
}

drawTemporalTrend();