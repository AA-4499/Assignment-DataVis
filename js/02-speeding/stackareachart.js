// stackedareachart.js
async function drawTemporalTrend() {

    const data = await d3.csv("data/police_enforcement_2024_fines.csv", d3.autoType);

    // ---- 1. Filter to SPEEDING infringements ----
    const filteredData = data.filter(d => d.METRIC === "speed_fines");

    // ---- 2. Aggregate by YEAR ----
    const yearlyRaw = d3.rollups(
        filteredData,
        v => {
            const fines = d3.sum(v, d => d.FINES);
            const arrests = d3.sum(v, d => d.ARRESTS);
            const charges = d3.sum(v, d => d.CHARGES);
            const severe = arrests + charges;
            const total = fines + severe;

            return {
                finesRaw: fines,
                severeRaw: severe,
                total
            };
        },
        d => d.YEAR
    )
    .map(([year, v]) => ({
        year: +year,
        ...v
    }))
    .sort((a, b) => d3.ascending(a.year, b.year));

    // ---- 3. Convert to per 1000 (ratio-based) ----
    const yearly = yearlyRaw.map(d => {
        const denom = d.total === 0 ? 1 : d.total; // avoid division by zero  

        return {
            year: d.year,
            finesRaw: d.finesRaw,
            severeRaw: d.severeRaw,
            finesPer1000: (d.finesRaw / denom) * 1000,
            severePer1000: (d.severeRaw / denom) * 1000
        };
    });

    // ---- 4. Stack keys ----
    const keys = ["finesPer1000", "severePer1000"];

    const stack = d3.stack()
        .keys(keys)
        .order(d3.stackOrderNone)
        .offset(d3.stackOffsetNone);

    const series = stack(yearly);

    // ---- 5. Setup SVG ----
    const container = d3.select("#viz-temporal-trend");
    const width = container.node().clientWidth;
    const height = 350;

    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height);

    const margin = { top: 30, right: 40, bottom: 40, left: 50 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // ---- 6. Scales ----
    const x = d3.scaleLinear()
        .domain(d3.extent(yearly, d => d.year))
        .range([0, chartWidth]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(yearly, d => d.finesPer1000 + d.severePer1000)])
        .nice()
        .range([chartHeight, 0]);

    const color = d3.scaleOrdinal()
        .domain(keys)
        .range(["#3182bd", "#e6550d"]); // blue fines, orange severe

    // ---- 7. Area generator ----
    const area = d3.area()
        .x(d => x(d.data.year))
        .y0(d => y(d[0]))
        .y1(d => y(d[1]));

    // ---- 8. Draw stacked layers ----
    g.selectAll(".layer")
        .data(series)
        .join("path")
        .attr("class", "layer")
        .attr("d", area)
        .attr("fill", d => color(d.key))
        .attr("opacity", d => d.key === "finesPer1000" ? 0.55 : 0.75);

    // ---- 9. Axes ----
    g.append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("d")));

    g.append("g").call(d3.axisLeft(y));

    // ---- 10. Legend ----
    const legend = svg.append("g")
        .attr("transform", `translate(${margin.left},10)`);

    const items = [
        { key: "finesPer1000", label: "FINES (per 1000)" },
        { key: "severePer1000", label: "SEVERE (per 1000)" }
    ];

    items.forEach((it, i) => {
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

    // ---- 11. Tooltip ----
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "chart-tooltip")
        .style("position", "absolute")
        .style("background", "white")
        .style("border", "1px solid #ccc")
        .style("padding", "8px")
        .style("font-size", "12px")
        .style("display", "none");

    const bisect = d3.bisector(d => d.year).left;

    g.append("rect")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("fill", "transparent")
        .on("mousemove", event => {
            const [mx] = d3.pointer(event);
            const xVal = x.invert(mx);
            let i = bisect(yearly, xVal);
            if (i > 0 && (xVal - yearly[i - 1].year) < (yearly[i].year - xVal)) {
                i = i - 1;
            }
            const d = yearly[i];

            tooltip.style("display", "block")
                .style("left", event.pageX + 12 + "px")
                .style("top", event.pageY + 12 + "px")
                .html(`
                    <strong>Year:</strong> ${d.year}<br/>
                    <strong>FINES:</strong> ${d.finesRaw} (${d.finesPer1000.toFixed(2)} per 1000)<br/>
                    <strong>SEVERE:</strong> ${d.severeRaw} (${d.severePer1000.toFixed(2)} per 1000)
                `);
        })
        .on("mouseout", () => tooltip.style("display", "none"));
}

drawTemporalTrend();
